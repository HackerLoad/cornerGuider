import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../../src/errors';
import { useFormat } from '../../src/i18n';
import { pickAndImportGpx } from '../../src/services/importer';
import { useRoutesStore } from '../../src/stores/routesStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { colors } from '../../src/theme';

export default function Routes() {
  const f = useFormat();
  const routes = useRoutesStore((s) => s.routes);
  const add = useRoutesStore((s) => s.add);
  const activeId = useSettingsStore((s) => s.activeRouteId);
  const setSettings = useSettingsStore((s) => s.set);
  const [busy, setBusy] = useState(false);

  async function onImport() {
    setBusy(true);
    try {
      const summary = await pickAndImportGpx();
      if (summary) add(summary);
    } catch (e) {
      Alert.alert(f.t('routes.importFailed'), errorMessage(e, f.lang));
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
          <Text style={styles.empty}>{f.t('routes.empty')}</Text>
        }
        renderItem={({ item }) => {
          const isActive = item.id === activeId;
          return (
            <View style={[styles.card, isActive && styles.cardActive]}>
              <Link href={{ pathname: '/route/[id]', params: { id: item.id } }} asChild>
                <Pressable style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {f.km(item.lengthM)} · {f.tn(item.curveCount)} ·{' '}
                    {new Date(item.importedAt).toLocaleDateString(f.lang === 'de' ? 'de-DE' : 'en-GB')}
                  </Text>
                </Pressable>
              </Link>
              <Pressable
                onPress={() => setSettings({ activeRouteId: item.id, goMode: 'route' })}
                style={[styles.goChip, isActive && styles.goChipActive]}
                hitSlop={8}
              >
                <Text style={[styles.goChipText, isActive && { color: '#000' }]}>{isActive ? f.t('routes.isGo') : f.t('routes.choose')}</Text>
              </Pressable>
            </View>
          );
        }}
      />
      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={onImport} disabled={busy}>
        {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>{f.t('routes.import')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.muted, fontSize: 16, lineHeight: 22, marginTop: 24 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  cardActive: { borderColor: colors.accent },
  goChip: { backgroundColor: colors.border, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12 },
  goChipActive: { backgroundColor: colors.accent },
  goChipText: { color: colors.text, fontSize: 13, fontWeight: '800' },
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
  secondary: { marginHorizontal: 16, marginBottom: -4, backgroundColor: colors.card, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: colors.accent, fontSize: 17, fontWeight: '700' },
});
