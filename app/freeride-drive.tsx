import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CurveGraphic } from '../src/components/CurveGraphic';
import { DriveLayout } from '../src/components/DriveLayout';
import { FeedbackBar } from '../src/components/FeedbackBar';
import { useFeedbackStore } from '../src/stores/feedbackStore';
import { SimulatedLocationSource } from '../src/drive/simulator';
import { DEFAULT_CURVE_CONFIG } from '../src/curves/config';
import { isUncertain } from '../src/curves/confidence';
import { FreerideSession, type FreerideSnapshot } from '../src/freeride/session';
import { AppError, errorMessage } from '../src/errors';
import { useFormat } from '../src/i18n';
import { configureAudioSession } from '../src/services/audioSession';
import { DeviceLocationSource } from '../src/services/deviceLocation';
import { saveRecording } from '../src/services/freerideStorage';
import { createTileLoader } from '../src/services/roadData';
import { loadRoute } from '../src/services/routeStorage';
import { liveInputFromFreeride } from '../src/liveActivity/mappers';
import { endLiveActivity, updateLiveActivity } from '../src/services/liveActivity';
import { speakWithSettings, stopSpeaking } from '../src/services/speech';
import { currentDriveSettings, useSettingsStore } from '../src/stores/settingsStore';
import { colors } from '../src/theme';

/** Kopfzeile: nie umbrechen, die Schrift schrumpft stattdessen, bis der Text in die Breite passt. */
const ONE_LINE = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.4 } as const;

type Fmt = ReturnType<typeof useFormat>;

function headline(s: FreerideSnapshot | null, f: Fmt): { text: string; tone: 'normal' | 'warn' | 'bad' } {
  if (!s) return { text: f.t('drive.searching'), tone: 'normal' };
  if (s.data === 'error' && s.status === 'noRoad') return { text: f.t('free.noData'), tone: 'bad' };
  if (s.data === 'loading' && s.status === 'noRoad') return { text: f.t('free.loading'), tone: 'normal' };
  if (s.status === 'noRoad') return { text: f.t('free.noRoad'), tone: 'bad' };
  if (s.status === 'uncertain') return { text: f.t('free.uncertain'), tone: 'warn' };
  const first = s.upcoming[0];
  if (!first) return s.previewLost ? { text: f.t('free.noPreview'), tone: 'warn' } : { text: f.t('free.noCurve'), tone: 'normal' };
  const unsure = isUncertain(first.curve.confidence, DEFAULT_CURVE_CONFIG);
  const dir = `${f.dir(first.curve.direction)} ${unsure ? f.t('curve.uncertain') : first.curve.grade}`;
  return {
    text: first.inside ? `${f.t('drive.now')}: ${dir}` : `${f.t('drive.in', { distance: f.dist(Math.round(first.distanceTo / 10) * 10) })}: ${dir}`,
    tone: 'normal',
  };
}

function roadLine(s: FreerideSnapshot | null, f: Fmt): string {
  if (!s || s.status === 'noRoad') return s?.dataError ? f.t('free.error', { message: errorMessage(s.dataErrorRaw ?? s.dataError, f.lang) }) : '';
  const name = [s.wayRef, s.wayName].filter(Boolean).join(' · ');
  const d = f.dist(Math.round(s.aheadM / 10) * 10);
  const end =
    s.endReason === 'junction'
      ? ` · ${f.t('free.junction', { distance: d })}`
      : s.endReason === 'roundabout'
        ? ` · ${f.t('free.roundabout', { distance: d })}`
        : s.endReason === 'dataEnd'
          ? ` · ${f.t('free.dataEnd', { distance: d })}`
          : '';
  return `${name}${end}`;
}

export default function FreerideDrive() {
  useKeepAwake();
  const { sim: simRouteId } = useLocalSearchParams<{ sim?: string }>();
  const f = useFormat();
  const units = f.units;
  const driveSide = useSettingsStore((s) => s.driveSide);
  const showRidingLine = useSettingsStore((s) => s.showRidingLine);
  const listCount = useSettingsStore((s) => s.listCount);
  const showFeedback = useSettingsStore((s) => s.showFeedbackButtons);
  const addMark = useFeedbackStore((s) => s.add);
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
          if (!route) throw new AppError('err.simRouteMissing');
          const simSource = new SimulatedLocationSource(route, { speedKmh: 60 });
          if (!cancelled) setSim(simSource);
          source = simSource;
        } else {
          source = new DeviceLocationSource();
        }
        const loader = createTileLoader();
        s = new FreerideSession({ source, speak: (t) => speakWithSettings(t), getSettings: currentDriveSettings, loadTile: (tile) => loader.load(tile).then((r) => r.ways) });
        if (cancelled) return;
        setSession(s);
        unsub = s.subscribe(setSnap);
        await s.start();
      } catch (e) {
        setError(errorMessage(e, f.lang));
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
    Alert.alert(f.t('drive.endTitle'), f.t('free.endText'), [
      { text: f.t('drive.continue'), style: 'cancel' },
      { text: f.t('drive.end'), style: 'destructive', onPress: () => void finish() },
    ]);

  // Live-Aktivität (Sperrbildschirm / Dynamic Island) mit der nächsten Kurve
  useEffect(() => {
    if (session) updateLiveActivity(liveInputFromFreeride(snap), units, f.lang);
  }, [snap, session, units, f.lang]);
  useEffect(() => endLiveActivity, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.alert}>{error}</Text>
        <Pressable style={styles.stop} onPress={() => router.back()}><Text style={styles.stopText}>{f.t('drive.back')}</Text></Pressable>
      </View>
    );
  }
  if (!session) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;

  const head = headline(snap, f);
  const first = snap && snap.status !== 'noRoad' ? snap.upcoming[0] : undefined;
  const rest = snap?.upcoming.slice(1, 1 + listCount) ?? [];

  return (
    <DriveLayout
      header={
        <View>
          <Text style={[styles.big, head.tone === 'bad' && { color: colors.danger }, head.tone === 'warn' && { color: colors.warn }]} {...ONE_LINE}>
            {head.text}
          </Text>
          <Text style={styles.road} numberOfLines={1}>{roadLine(snap, f)}</Text>
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
                <Text style={[styles.itemGrade, { color: isUncertain(u.curve.confidence, DEFAULT_CURVE_CONFIG) ? colors.muted : colors.grade[u.curve.grade - 1] }]}>
                  {isUncertain(u.curve.confidence, DEFAULT_CURVE_CONFIG) ? '?' : u.curve.grade}
                </Text>
                <Text style={styles.itemText}>{f.dir(u.curve.direction)}</Text>
                <Text style={styles.itemDist}>{f.t('drive.in', { distance: f.dist(Math.round(u.distanceTo / 10) * 10) }).toLowerCase()}</Text>
              </View>
            ))
          : null
      }
      sim={
        sim ? (
          <View style={styles.simBar}>
            <Text style={styles.simLabel}>{f.t('sim.label', { speed: f.speed(sim.speedKmh / 3.6) })}</Text>
            <View style={styles.simRow}>
              <SimBtn label="−10" onPress={() => { sim.setSpeedKmh(sim.speedKmh - 10); redraw((n) => n + 1); }} />
              <SimBtn label="+10" onPress={() => { sim.setSpeedKmh(sim.speedKmh + 10); redraw((n) => n + 1); }} />
              <SimBtn label={sim.isPaused ? f.t('sim.resume') : f.t('sim.pause')} onPress={() => { sim.setPaused(!sim.isPaused); redraw((n) => n + 1); }} />
              <SimBtn label="+500 m" onPress={() => sim.jump(500)} />
            </View>
          </View>
        ) : null
      }
      footer={
        <View>
          {showFeedback ? (
            <FeedbackBar
              onMark={(kind) => {
                const m = session?.makeMark(kind);
                if (m) addMark(m);
                return !!m;
              }}
            />
          ) : null}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerText}>{snap ? f.speed(snap.speed) : ''}</Text>
            <Text style={styles.attribution}>{f.t('free.driveAttribution')}</Text>
          </View>
          <Pressable onPress={confirmStop} style={styles.stop}><Text style={styles.stopText}>{f.t('drive.end')}</Text></Pressable>
        </View>
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
