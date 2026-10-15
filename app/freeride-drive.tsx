import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CurveGraphic } from '../src/components/CurveGraphic';
import { DriveLayout } from '../src/components/DriveLayout';
import { SimulatedLocationSource } from '../src/drive/simulator';
import { FreerideSession, type FreerideSnapshot } from '../src/freeride/session';
import { directionLabel, formatDistance, formatSpeed } from '../src/format';
import type { Units } from '../src/settings';
import { configureAudioSession } from '../src/services/audioSession';
import { DeviceLocationSource } from '../src/services/deviceLocation';
import { saveRecording } from '../src/services/freerideStorage';
import { loadRoute } from '../src/services/routeStorage';
import { speakWithSettings, stopSpeaking } from '../src/services/speech';
import { currentDriveSettings, useSettingsStore } from '../src/stores/settingsStore';
import { colors } from '../src/theme';

/** Kopfzeile: nie umbrechen, die Schrift schrumpft stattdessen, bis der Text in die Breite passt. */
const ONE_LINE = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.4 } as const;

function headline(s: FreerideSnapshot | null, units: Units): { text: string; tone: 'normal' | 'warn' | 'bad' } {
  if (!s) return { text: 'GPS wird gesucht …', tone: 'normal' };
  if (s.data === 'error' && s.status === 'noRoad') return { text: 'Keine Straßendaten', tone: 'bad' };
  if (s.data === 'loading' && s.status === 'noRoad') return { text: 'Straßendaten laden …', tone: 'normal' };
  if (s.status === 'noRoad') return { text: 'Keine Straße erkannt', tone: 'bad' };
  if (s.status === 'uncertain') return { text: 'Straße unsicher – keine Ansage', tone: 'warn' };
  const first = s.upcoming[0];
  if (!first) return { text: 'Keine Kurve voraus', tone: 'normal' };
  const dir = `${directionLabel(first.curve.direction)} ${first.curve.grade}`;
  return {
    text: first.inside ? `Jetzt: ${dir}` : `In ${formatDistance(Math.round(first.distanceTo / 10) * 10, units)}: ${dir}`,
    tone: 'normal',
  };
}

function roadLine(s: FreerideSnapshot | null, units: Units): string {
  if (!s || s.status === 'noRoad') return s?.dataError ? `Fehler: ${s.dataError}` : '';
  const name = [s.wayRef, s.wayName].filter(Boolean).join(' · ');
  const end =
    s.endReason === 'junction' || s.endReason === 'roundabout'
      ? ` · ${s.endReason === 'junction' ? 'Kreuzung' : 'Kreisverkehr'} in ${formatDistance(Math.round(s.aheadM / 10) * 10, units)}`
      : s.endReason === 'dataEnd'
        ? ` · Datenende in ${formatDistance(Math.round(s.aheadM / 10) * 10, units)}`
        : '';
  return `${name}${end}`;
}

export default function FreerideDrive() {
  useKeepAwake();
  const { sim: simRouteId } = useLocalSearchParams<{ sim?: string }>();
  const units = useSettingsStore((s) => s.units);
  const driveSide = useSettingsStore((s) => s.driveSide);
  const showRidingLine = useSettingsStore((s) => s.showRidingLine);
  const listCount = useSettingsStore((s) => s.listCount);
  const [snap, setSnap] = useState<FreerideSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<FreerideSession | null>(null);
  const [sim, setSim] = useState<SimulatedLocationSource | null>(null);
  const [, redraw] = useState(0);

  useEffect(() => {
    let s: FreerideSession | null = null;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        await configureAudioSession();
        let source: DeviceLocationSource | SimulatedLocationSource;
        if (simRouteId) {
          const route = await loadRoute(simRouteId);
          if (!route) throw new Error('Route für die Simulation nicht gefunden.');
          const simSource = new SimulatedLocationSource(route, { speedKmh: 60 });
          if (!cancelled) setSim(simSource);
          source = simSource;
        } else {
          source = new DeviceLocationSource();
        }
        s = new FreerideSession({ source, speak: (t) => speakWithSettings(t), getSettings: currentDriveSettings });
        if (cancelled) return;
        setSession(s);
        unsub = s.subscribe(setSnap);
        await s.start();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
      stopSpeaking();
      void s?.stop();
    };
  }, [simRouteId]);

  const finish = async () => {
    if (!session) return router.back();
    await session.stop();
    const rec = session.getRecording();
    if (rec && rec.fixes.length >= 10) {
      saveRecording(rec);
      router.replace({ pathname: '/freeride-result/[id]', params: { id: rec.id } });
    } else {
      router.back();
    }
  };
  const confirmStop = () =>
    Alert.alert('Fahrt beenden?', 'Die Fahrt wird gespeichert und ausgewertet.', [
      { text: 'Weiterfahren', style: 'cancel' },
      { text: 'Beenden', style: 'destructive', onPress: () => void finish() },
    ]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.alert}>{error}</Text>
        <Pressable style={styles.stop} onPress={() => router.back()}><Text style={styles.stopText}>Zurück</Text></Pressable>
      </View>
    );
  }
  if (!session) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const head = headline(snap, units);
  const first = snap && snap.status !== 'noRoad' ? snap.upcoming[0] : undefined;
  const rest = snap?.upcoming.slice(1, 1 + listCount) ?? [];

  return (
    <DriveLayout
      header={
        <View>
          <Text style={[styles.big, head.tone === 'bad' && { color: colors.danger }, head.tone === 'warn' && { color: colors.warn }]} {...ONE_LINE}>
            {head.text}
          </Text>
          <Text style={styles.road} numberOfLines={1}>{roadLine(snap, units)}</Text>
        </View>
      }
      graphic={({ width: w, height: h }) =>
        first && snap?.status === 'ok' ? (
          <CurveGraphic curve={first.curve} width={w} height={h} progressM={first.progressM} driveSide={driveSide} showLine={showRidingLine} />
        ) : null
      }
      list={
        snap?.status === 'ok'
          ? rest.map((u) => (
              <View key={`${u.curve.startXY.x.toFixed(0)}_${u.curve.startXY.y.toFixed(0)}`} style={styles.item}>
                <Text style={[styles.itemGrade, { color: colors.grade[u.curve.grade - 1] }]}>{u.curve.grade}</Text>
                <Text style={styles.itemText}>{directionLabel(u.curve.direction)}</Text>
                <Text style={styles.itemDist}>in {formatDistance(Math.round(u.distanceTo / 10) * 10, units)}</Text>
              </View>
            ))
          : null
      }
      sim={
        sim ? (
          <View style={styles.simBar}>
            <Text style={styles.simLabel}>SIMULATION {formatSpeed(sim.speedKmh / 3.6, units)}</Text>
            <View style={styles.simRow}>
              <SimBtn label="−10" onPress={() => { sim.setSpeedKmh(sim.speedKmh - 10); redraw((n) => n + 1); }} />
              <SimBtn label="+10" onPress={() => { sim.setSpeedKmh(sim.speedKmh + 10); redraw((n) => n + 1); }} />
              <SimBtn label={sim.isPaused ? 'Weiter' : 'Pause'} onPress={() => { sim.setPaused(!sim.isPaused); redraw((n) => n + 1); }} />
              <SimBtn label="+500 m" onPress={() => sim.jump(500)} />
            </View>
          </View>
        ) : null
      }
      footer={
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerText}>{snap ? formatSpeed(snap.speed, units) : ''}</Text>
            <Text style={styles.attribution}>© OpenStreetMap-Mitwirkende</Text>
          </View>
          <Pressable onPress={confirmStop} style={styles.stop}><Text style={styles.stopText}>Beenden</Text></Pressable>
        </View>
      }
    />
  );
}

function SimBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.simBtn}>
      <Text style={styles.simBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  big: { color: '#fff', fontSize: 40, fontWeight: '900' },
  alert: { color: colors.danger, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  road: { color: colors.muted, fontSize: 15, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  itemGrade: { fontSize: 32, fontWeight: '900', width: 40, textAlign: 'center' },
  itemText: { color: '#fff', fontSize: 26, fontWeight: '700', flex: 1 },
  itemDist: { color: colors.muted, fontSize: 24 },
  simBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1a1400', gap: 6 },
  simLabel: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  simRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  simBtn: { backgroundColor: colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  simBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 16 },
  footerText: { color: colors.muted, fontSize: 18 },
  attribution: { color: colors.muted, fontSize: 12 },
  stop: { backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18 },
  stopText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
