import { Link, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { listRecordings, type RecordingInfo } from '../src/services/freerideStorage';
import { useRoutesStore } from '../src/stores/routesStore';
import { colors } from '../src/theme';

/** Startseite der Freien Fahrt (Versuch): ohne geplante Route, Straßenverlauf aus OpenStreetMap. */
export default function FreerideStart() {
  const routes = useRoutesStore((s) => s.routes);
  const [recordings, setRecordings] = useState<RecordingInfo[]>([]);
  useFocusEffect(useCallback(() => setRecordings(listRecordings()), []));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.title}>Freie Fahrt (Versuch)</Text>
      <Text style={styles.text}>
        Ohne geplante Route: Die App sagt den Straßenverlauf aus OpenStreetMap-Daten voraus und meldet die Kurven davor.
        Das ist eine Vorhersage und kann an Kreuzungen falsch sein – dort schweigt die App.
      </Text>
      <Text style={styles.text}>
        Braucht Internet (die Straßendaten werden beim Fahren geladen). Die Fahrt wird aufgezeichnet und danach mit der
        tatsächlich gefahrenen Spur verglichen.
      </Text>

      <Pressable style={styles.button} onPress={() => router.push('/freeride-drive')}>
        <Text style={styles.buttonText}>Fahrt starten (GPS)</Text>
      </Pressable>

      {routes.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.section}>Simulation entlang einer importierten Route</Text>
          {routes.map((r) => (
            <Pressable
              key={r.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/freeride-drive', params: { sim: r.id } })}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.muted}>Fahrt mit simuliertem GPS, Straßendaten kommen echt aus OpenStreetMap</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={styles.section}>Aufzeichnungen</Text>
        {recordings.length === 0 ? <Text style={styles.muted}>Noch keine Fahrt aufgezeichnet.</Text> : null}
        {recordings.map((r) => (
          <Link key={r.id} href={{ pathname: '/freeride-result/[id]', params: { id: r.id } }} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.cardTitle}>{new Date(r.startedAt).toLocaleString('de-DE')}</Text>
              <Text style={styles.muted}>Auswertung ansehen</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <Text style={styles.attribution}>Straßendaten © OpenStreetMap-Mitwirkende (ODbL)</Text>
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
