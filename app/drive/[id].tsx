import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CurveGraphic } from '../../src/components/CurveGraphic';
import { DriveSession, type DriveSnapshot } from '../../src/drive/driveSession';
import { SimulatedLocationSource } from '../../src/drive/simulator';
import { directionLabel, formatDistance } from '../../src/format';
import type { StoredRoute } from '../../src/routes/model';
import { configureAudioSession } from '../../src/services/audioSession';
import { DeviceLocationSource } from '../../src/services/deviceLocation';
import { loadRoute } from '../../src/services/routeStorage';
import { speak, stopSpeaking } from '../../src/services/speech';
import { currentDriveSettings } from '../../src/stores/settingsStore';
import { colors } from '../../src/theme';

/** Kopfzeile: nie umbrechen, die Schrift schrumpft stattdessen, bis der Text in die Breite passt. */
const ONE_LINE = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.4 } as const;

function SimBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.simBtn}>
      <Text style={styles.simBtnText}>{label}</Text>
    </Pressable>
  );
}

export default function DriveScreen() {
  useKeepAwake();
  const { id, sim: simParam } = useLocalSearchParams<{ id: string; sim?: string }>();
  const isSim = simParam === '1';
  const [sim, setSim] = useState<SimulatedLocationSource | null>(null);
  const [, setSimTick] = useState(0); // erzwingt Neuzeichnen nach Änderungen am Simulator
  const [offsetOn, setOffsetOn] = useState(false);
  const { width, height } = useWindowDimensions();
  const [route, setRoute] = useState<StoredRoute | null | undefined>(undefined);
  const [snap, setSnap] = useState<DriveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let session: DriveSession | null = null;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const r = await loadRoute(id);
      if (cancelled) return;
      setRoute(r);
      if (!r) return;
      try {
        await configureAudioSession();
        let source: DeviceLocationSource | SimulatedLocationSource;
        if (isSim) {
          const simSource = new SimulatedLocationSource(r, { speedKmh: 60 });
          setSim(simSource);
          source = simSource;
        } else {
          source = new DeviceLocationSource();
        }
        session = new DriveSession({
          route: r,
          source,
          speak: (t) => speak(t, currentDriveSettings().speechRate),
          getSettings: currentDriveSettings,
        });
        unsub = session.subscribe(setSnap);
        await session.start();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
      stopSpeaking();
      void session?.stop();
    };
  }, [id, isSim]);

  const confirmStop = () =>
    Alert.alert('Fahrt beenden?', undefined, [
      { text: 'Weiterfahren', style: 'cancel' },
      { text: 'Beenden', style: 'destructive', onPress: () => router.back() },
    ]);

  if (route === undefined) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (route === null) return <View style={styles.center}><Text style={styles.big}>Route nicht gefunden</Text></View>;
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.alert}>{error}</Text>
        <Pressable style={styles.stop} onPress={() => router.back()}><Text style={styles.stopText}>Zurück</Text></Pressable>
      </View>
    );
  }

  const first = snap?.upcoming[0];
  const rest = snap?.upcoming.slice(1) ?? [];
  const graphicH = Math.max(180, Math.min(width, height * 0.42));

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        {snap?.status === 'offRoute' ? (
          <Text style={styles.alert} {...ONE_LINE}>ABSEITS DER ROUTE</Text>
        ) : snap?.status === 'finished' ? (
          <Text style={styles.big} {...ONE_LINE}>Ziel erreicht</Text>
        ) : !snap || snap.status === 'acquiring' ? (
          <Text style={styles.big} {...ONE_LINE}>GPS wird gesucht …</Text>
        ) : first ? (
          <Text style={styles.big} {...ONE_LINE}>
            {first.inside ? 'Jetzt' : `In ${formatDistance(Math.round(first.distanceTo / 10) * 10)}`}:{' '}
            {directionLabel(first.curve.direction)} {first.curve.grade}
          </Text>
        ) : (
          <Text style={styles.big} {...ONE_LINE}>Keine Kurven mehr</Text>
        )}
      </View>

      {first && snap?.status === 'onRoute' ? (
        <View style={styles.graphic}>
          <CurveGraphic
            curve={first.curve}
            width={width}
            height={graphicH}
            progressM={snap ? snap.dist - first.curve.startDist : undefined}
          />
        </View>
      ) : (
        <View style={{ height: graphicH }} />
      )}

      <ScrollView style={styles.list}>
        {rest.map((u) => (
          <View key={u.curve.index} style={styles.item}>
            <Text style={[styles.itemGrade, { color: colors.grade[u.curve.grade - 1] }]}>{u.curve.grade}</Text>
            <Text style={styles.itemText}>{directionLabel(u.curve.direction)}</Text>
            <Text style={styles.itemDist}>in {formatDistance(Math.round(u.distanceTo / 10) * 10)}</Text>
          </View>
        ))}
      </ScrollView>

      {sim ? (
        <View style={styles.simBar}>
          <Text style={styles.simLabel}>SIMULATION {Math.round(sim.speedKmh)} km/h</Text>
          <View style={styles.simRow}>
            <SimBtn label="−10" onPress={() => { sim.setSpeedKmh(sim.speedKmh - 10); setSimTick((n) => n + 1); }} />
            <SimBtn label="+10" onPress={() => { sim.setSpeedKmh(sim.speedKmh + 10); setSimTick((n) => n + 1); }} />
            <SimBtn label={sim.isPaused ? 'Weiter' : 'Pause'} onPress={() => { sim.setPaused(!sim.isPaused); setSimTick((n) => n + 1); }} />
            <SimBtn label="+500 m" onPress={() => sim.jump(500)} />
            <SimBtn
              label={offsetOn ? 'Zurück' : 'Abweichen'}
              onPress={() => { sim.setSideOffset(offsetOn ? 0 : 120); setOffsetOn(!offsetOn); }}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {snap ? `${Math.round(snap.speed * 3.6)} km/h · Rest ${formatDistance(snap.remaining)}` : ''}
        </Text>
        <Pressable onPress={confirmStop} style={styles.stop}><Text style={styles.stopText}>Beenden</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 54 },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  top: { paddingHorizontal: 16, minHeight: 70, justifyContent: 'center' },
  big: { color: '#fff', fontSize: 40, fontWeight: '900' },
  alert: { color: colors.danger, fontSize: 40, fontWeight: '900' },
  graphic: { alignItems: 'center' },
  list: { flex: 1, paddingHorizontal: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  itemGrade: { fontSize: 32, fontWeight: '900', width: 40, textAlign: 'center' },
  itemText: { color: '#fff', fontSize: 26, fontWeight: '700', flex: 1 },
  itemDist: { color: colors.muted, fontSize: 24 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 28 },
  footerText: { color: colors.muted, fontSize: 18 },
  stop: { backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18 },
  simBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1a1400', gap: 6 },
  simLabel: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  simRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  simBtn: { backgroundColor: colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  simBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stopText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
