import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../src/errors';
import { useFormat } from '../src/i18n';
import { importGpxFromUri } from '../src/services/importer';
import { useRoutesStore } from '../src/stores/routesStore';
import { colors } from '../src/theme';

/** Ziel für „Öffnen mit"/Teilen: importiert die übergebene Datei und zeigt die Route. */
export default function ImportScreen() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const add = useRoutesStore((s) => s.add);
  const f = useFormat();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    importGpxFromUri(uri)
      .then((summary) => {
        if (cancelled) return;
        add(summary);
        router.replace({ pathname: '/route/[id]', params: { id: summary.id } });
      })
      .catch((e) => !cancelled && setError(errorMessage(e, f.lang)));
    return () => {
      cancelled = true;
    };
  }, [uri, add]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.error}>{f.t('import.failed')}</Text>
          <Text style={styles.text}>{error}</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/routes')}>
            <Text style={styles.buttonText}>{f.t('import.toRoutes')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.text}>{f.t('import.calculating')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  text: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 20, fontWeight: '700' },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8 },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
