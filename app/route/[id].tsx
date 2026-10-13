import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { CurveRow } from '../../src/components/CurveRow';
import { formatKm } from '../../src/format';
import type { StoredRoute } from '../../src/routes/model';
import { loadRoute } from '../../src/services/routeStorage';
import { useRoutesStore } from '../../src/stores/routesStore';
import { colors } from '../../src/theme';

export default function RouteOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
        <Text style={styles.muted}>Route nicht gefunden.</Text>
      </View>
    );
  }

  const confirmDelete = () =>
    Alert.alert('Route löschen?', route.name, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => {
          remove(route.id);
          router.replace('/');
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
              {formatKm(route.lengthM)} · {route.curves.length} Kurven
            </Text>
            {route.warnings.map((w) => (
              <Text key={w} style={styles.warning}>⚠︎ {w}</Text>
            ))}
            <Pressable style={[styles.button, styles.disabled]} disabled>
              <Text style={styles.buttonText}>Fahrt starten (folgt)</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <CurveRow curve={item} />}
        ListFooterComponent={
          <Pressable onPress={confirmDelete} style={{ paddingVertical: 20 }}>
            <Text style={styles.delete}>Route löschen</Text>
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
  disabled: { opacity: 0.4 },
  buttonText: { color: '#000', fontSize: 17, fontWeight: '800' },
  delete: { color: colors.danger, textAlign: 'center', fontSize: 16 },
});
