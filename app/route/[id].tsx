import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { CurveRow } from '../../src/components/CurveRow';
import { useFormat } from '../../src/i18n';
import { warningText } from '../../src/routes/warningText';
import type { StoredRoute } from '../../src/routes/model';
import { loadRoute } from '../../src/services/routeStorage';
import { useRoutesStore } from '../../src/stores/routesStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { colors } from '../../src/theme';

export default function RouteOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useFormat();
  const setSettings = useSettingsStore((s) => s.set);
  const activeId = useSettingsStore((s) => s.activeRouteId);
  const remove = useRoutesStore((s) => s.remove);
  const [route, setRoute] = useState<StoredRoute | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadRoute(id).then((r) => !cancelled && setRoute(r));
    return () => {
      cancelled = true;
    };
  }, [id]);

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
          <Pressable onPress={confirmDelete} style={{ paddingVertical: 20 }}>
            <Text style={styles.delete}>{f.t('route.delete')}</Text>
          </Pressable>
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
  goInfo: { color: colors.muted, fontSize: 13, marginTop: 8, textAlign: 'center' },
  secondary: { backgroundColor: colors.card, marginTop: 8 },
  buttonText: { color: '#000', fontSize: 17, fontWeight: '800' },
  delete: { color: colors.danger, textAlign: 'center', fontSize: 16 },
});
