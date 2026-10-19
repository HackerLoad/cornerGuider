import { Link, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFormat } from '../src/i18n';
import { OSM_COPYRIGHT_URL } from '../src/osm';
import { listRecordings, type RecordingInfo } from '../src/services/freerideStorage';
import { useRoutesStore } from '../src/stores/routesStore';
import { colors } from '../src/theme';

/** Startseite der Freien Fahrt (Versuch): ohne geplante Route, Straßenverlauf aus OpenStreetMap. */
export default function FreerideStart() {
  const f = useFormat();
  const routes = useRoutesStore((s) => s.routes);
  const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
  useFocusEffect(useCallback(() => setRecordings(listRecordings()), []));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>{f.t('free.title')}</Text>
      <Text style={styles.text}>{f.t('free.text1')}</Text>
      <Text style={styles.text}>{f.t('free.text2')}</Text>

      <Pressable style={styles.button} onPress={() => router.push('/freeride-drive')}>
        <Text style={styles.buttonText}>{f.t('free.start')}</Text>
      </Pressable>

      {routes.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.section}>{f.t('free.simSection')}</Text>
          {routes.map((r) => (
            <Pressable
              key={r.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/freeride-drive', params: { sim: r.id } })}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.muted}>{f.t('free.simDesc')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={styles.section}>{f.t('free.recordings')}</Text>
        {recordings.length === 0 ? <Text style={styles.muted}>{f.t('free.noRecordings')}</Text> : null}
        {recordings.map((r) => (
          <Link key={r.id} href={{ pathname: '/freeride-result/[id]', params: { id: r.id } }} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.cardTitle}>{new Date(r.startedAt).toLocaleString(f.lang === 'de' ? 'de-DE' : 'en-GB')}</Text>
              <Text style={styles.muted}>{f.t('free.viewResult')}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Text style={styles.attribution} onPress={() => void Linking.openURL(OSM_COPYRIGHT_URL).catch(() => undefined)}>
        {f.t('free.attribution')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  text: { color: colors.text, fontSize: 16, lineHeight: 23 },
  section: { color: colors.accent, fontSize: 16, fontWeight: '700', marginTop: 8 },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#000', fontSize: 18, fontWeight: '800' },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 2 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  attribution: { color: colors.muted, fontSize: 12, marginTop: 12 },
});
