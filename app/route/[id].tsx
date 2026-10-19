import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { CurveRow } from '../../src/components/CurveRow';
import { prefetchTiles, type PrefetchProgress } from '../../src/freeride/tileLoader';
import { tilesAlong } from '../../src/freeride/tiles';
import { makeProjection } from '../../src/geo/projection';
import { errorMessage } from '../../src/errors';
import { assertRoadDataConfigured, createTileLoader } from '../../src/services/roadData';
import { useFormat } from '../../src/i18n';
import { warningText } from '../../src/routes/warningText';
import type { StoredRoute } from '../../src/routes/model';
import { loadRoute } from '../../src/services/routeStorage';
import { useRoutesStore } from '../../src/stores/routesStore';
import { useFeedbackStore } from '../../src/stores/feedbackStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { colors } from '../../src/theme';

export default function RouteOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useFormat();
  const setSettings = useSettingsStore((s) => s.set);
  const activeId = useSettingsStore((s) => s.activeRouteId);
  const remove = useRoutesStore((s) => s.remove);
  const allMarks = useFeedbackStore((s) => s.marks);
  const removeMark = useFeedbackStore((s) => s.remove);
  const routeMarks = allMarks.filter((m) => m.routeId === id);
  const [cached, setCached] = useState<number | null>(null);
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const stopRef = useRef(false);
  const [route, setRoute] = useState<StoredRoute | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadRoute(id).then((r) => !cancelled && setRoute(r));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Kacheln entlang der Strecke (für den Offline-Download der Freien Fahrt)
  const tiles = useMemo(() => {
    if (!route) return [];
    const proj = makeProjection(route.projectionOrigin);
    const pts = route.path.filter((_, i) => i % 20 === 0 || i === route.path.length - 1).map((p) => proj.toLatLon(p));
    return tilesAlong(pts, 1);
  }, [route]);

  useEffect(() => {
    if (tiles.length === 0) return;
    let cancelled = false;
    const loader = createTileLoader();
    Promise.all(tiles.map((t) => loader.has(t))).then((has) => !cancelled && setCached(has.filter(Boolean).length));
    return () => {
      cancelled = true;
    };
  }, [tiles, downloading]);

  const startDownload = async () => {
    stopRef.current = false;
    try {
      assertRoadDataConfigured(); // im Release ohne eigenen Server: klare Meldung statt lauter Fehlversuche
    } catch (e) {
      Alert.alert(errorMessage(e, f.lang));
      return;
    }
    setDownloading(true);
    setProgress({ done: 0, total: tiles.length, failed: 0 });
    try {
      const res = await prefetchTiles(tiles, createTileLoader(), { onProgress: setProgress, shouldStop: () => stopRef.current });
      setProgress(res);
    } finally {
      setDownloading(false);
    }
  };

  if (route === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (route === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{f.t('route.notFound')}</Text>
      </View>
    );
  }

  const confirmDelete = () =>
    Alert.alert(f.t('route.deleteTitle'), route.name, [
      { text: f.t('common.cancel'), style: 'cancel' },
      {
        text: f.t('common.delete'),
        style: 'destructive',
        onPress: () => {
          remove(route.id);
          router.replace('/routes');
        },
      },
    ]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: route.name }} />
      <FlatList
        data={route.curves}
        keyExtractor={(c) => String(c.index)}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.summary}>
              {f.km(route.lengthM)} · {f.tn(route.curves.length)}
            </Text>
            {route.warnings.map((w, i) => (
              <Text key={i} style={styles.warning}>⚠︎ {warningText(w, f.t, f.dist)}</Text>
            ))}
            <Pressable
              style={styles.button}
              onPress={() => router.push({ pathname: '/drive/[id]', params: { id: route.id } })}
            >
              <Text style={styles.buttonText}>{f.t('route.start')}</Text>
            </Pressable>
            {activeId !== route.id ? (
              <Pressable
                style={[styles.button, styles.secondary]}
                onPress={() => setSettings({ activeRouteId: route.id, goMode: 'route' })}
              >
                <Text style={[styles.buttonText, { color: colors.accent }]}>{f.t('route.makeGo')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.goInfo}>{f.t('route.isGo')}</Text>
            )}
            <View style={styles.offline}>
              <Text style={styles.summary}>{f.t('route.offline.title')}</Text>
              <Text style={styles.offlineText}>{f.t('route.offline.explain')}</Text>
              {downloading && progress ? (
                <>
                  <Text style={styles.offlineText}>{f.t('route.offline.progress', { done: progress.done, total: progress.total })}</Text>
                  <Pressable onPress={() => { stopRef.current = true; }} hitSlop={8}>
                    <Text style={styles.offlineLink}>{f.t('route.offline.stop')}</Text>
                  </Pressable>
                </>
              ) : cached !== null && tiles.length > 0 && cached >= tiles.length ? (
                <Text style={styles.offlineOk}>✓ {f.t('route.offline.done')}</Text>
              ) : (
                <>
                  {cached !== null && cached > 0 ? <Text style={styles.offlineText}>{f.t('route.offline.partial', { cached, total: tiles.length })}</Text> : null}
                  <Pressable style={[styles.button, styles.secondary]} onPress={() => void startDownload()}>
                    <Text style={[styles.buttonText, { color: colors.accent }]}>{f.t('route.offline.load', { count: tiles.length - (cached ?? 0) })}</Text>
                  </Pressable>
                </>
              )}
              {progress && progress.failed > 0 && !downloading ? (
                <Text style={styles.warning}>{f.t('route.offline.failed', { count: progress.failed })}</Text>
              ) : null}
            </View>
            <Pressable
              style={[styles.button, styles.secondary]}
              onPress={() => router.push({ pathname: '/drive/[id]', params: { id: route.id, sim: '1' } })}
            >
              <Text style={[styles.buttonText, { color: colors.accent }]}>{f.t('route.simulate')}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <CurveRow curve={item} />}
        ListFooterComponent={
          <View>
            {routeMarks.length > 0 ? (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={styles.summary}>{f.t('route.feedback')}</Text>
                {routeMarks.map((m) => (
                  <View key={m.id} style={styles.markRow}>
                    <Text style={styles.markText}>
                      {f.t('route.feedbackItem', {
                        kind: f.t(m.kind === 'wrong' ? 'fb.mark.wrong' : 'fb.mark.missing'),
                        curve: m.curve ? ` · ${f.dir(m.curve.direction)} ${m.curve.grade}` : '',
                        position: f.km(m.distAlongM ?? 0),
                      })}
                    </Text>
                    <Pressable onPress={() => removeMark(m.id)} hitSlop={10}>
                      <Text style={styles.delete}>{f.t('common.delete')}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable onPress={confirmDelete} style={{ paddingVertical: 20 }}>
              <Text style={styles.delete}>{f.t('route.delete')}</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.muted },
  summary: { color: colors.text, fontSize: 20, fontWeight: '700' },
  warning: { color: colors.warn, fontSize: 14, marginTop: 8, lineHeight: 20 },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  markRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  markText: { color: colors.text, fontSize: 15, flex: 1 },
  offline: { marginTop: 16, gap: 6 },
  offlineText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  offlineLink: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  offlineOk: { color: '#6fcf6f', fontSize: 16, fontWeight: '700' },
  goInfo: { color: colors.muted, fontSize: 13, marginTop: 8, textAlign: 'center' },
  secondary: { backgroundColor: colors.card, marginTop: 8 },
  buttonText: { color: '#000', fontSize: 17, fontWeight: '800' },
  delete: { color: colors.danger, textAlign: 'center', fontSize: 16 },
});
