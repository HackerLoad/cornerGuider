import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatKm } from '../src/format';
import { pickAndImportGpx } from '../src/services/importer';
import { useRoutesStore } from '../src/stores/routesStore';
import { colors } from '../src/theme';

export default function Routes() {
  const routes = useRoutesStore((s) => s.routes);
  const add = useRoutesStore((s) => s.add);
  const [busy, setBusy] = useState(false);

  async function onImport() {
    setBusy(true);
    try {
      const summary = await pickAndImportGpx();
      if (summary) add(summary);
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={routes}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Noch keine Route. Importiere eine GPX-Datei (Track oder Route) – zum Beispiel aus Kurviger oder Calimoto.
          </Text>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/route/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.meta}>
                {formatKm(item.lengthM)} · {item.curveCount} Kurven ·{' '}
                {new Date(item.importedAt).toLocaleDateString('de-DE')}
              </Text>
            </Pressable>
          </Link>
        )}
      />
      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={onImport} disabled={busy}>
        {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>GPX importieren</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.muted, fontSize: 16, lineHeight: 22, marginTop: 24 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 10 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14, marginTop: 4 },
  button: {
    margin: 16,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#000', fontSize: 18, fontWeight: '800' },
});
