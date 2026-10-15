import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { evaluateRecording, type RecordingSummary } from '../../src/freeride/evaluateRecording';
import { directionLabel, formatKm, formatRadius } from '../../src/format';
import { useUnits } from '../../src/stores/settingsStore';
import { loadRecording } from '../../src/services/freerideStorage';
import { colors } from '../../src/theme';

const pct = (x: number) => `${Math.round(x * 100)} %`;

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function FreerideResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const units = useUnits();
  const [state, setState] = useState<'loading' | 'missing' | 'short' | RecordingSummary>('loading');

  useEffect(() => {
    let cancelled = false;
    loadRecording(id).then((rec) => {
      if (cancelled) return;
      if (!rec) return setState('missing');
      setState(evaluateRecording(rec) ?? 'short');
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state === 'loading') return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (state === 'missing') return <View style={styles.center}><Text style={styles.muted}>Aufzeichnung nicht gefunden.</Text></View>;
  if (state === 'short') return <View style={styles.center}><Text style={styles.muted}>Die Fahrt war zu kurz für eine Auswertung.</Text></View>;

  const r = state;
  const e = r.eval;
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Stack.Screen options={{ title: 'Auswertung' }} />
      <Text style={styles.title}>{formatKm(r.distanceKm * 1000, units)} in {Math.round(r.durationMin)} min</Text>
      <Text style={styles.note}>
        Verglichen werden die angesagten Kurven mit den Kurven der tatsächlich gefahrenen Spur (GPS, ca. alle 15 m).
        Anfang und Ende der Fahrt zählen nicht mit.
      </Text>

      <Row label="Angesagte Kurven" value={String(e.announced)} />
      <Row label="Davon richtig" value={`${e.correct} (${pct(e.precision)})`} note="Position ±40 m, Richtung gleich, Stufe ±1" />
      <Row label="Falschmeldungen" value={String(e.falseAlarms.length)} />
      <Row label="Tatsächliche Kurven bis Stufe 4" value={String(e.actual)} />
      <Row label="Davon angesagt" value={`${e.recalled} (${pct(e.recall)})`} />
      <Row label="Straße sicher zugeordnet" value={pct(r.okShare)} note="Anteil der Fahrzeit" />
      <Row label="Vorhersage endete früh" value={pct(r.shortPathShare)} note="Kreuzung, Kreisverkehr oder fehlende Daten vor 600 m" />

      {e.falseAlarms.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.section}>Falschmeldungen</Text>
          {e.falseAlarms.map((a, i) => (
            <Text key={i} style={styles.item}>{directionLabel(a.direction)} {a.grade}</Text>
          ))}
        </View>
      ) : null}
      {e.missed.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.section}>Nicht angesagt</Text>
          {e.missed.slice(0, 30).map((c, i) => (
            <Text key={i} style={styles.item}>
              {directionLabel(c.direction)} {c.grade} · {formatRadius(c.minRadius, units)} · bei {formatKm(c.startDist, units)}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 16 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 14 },
  label: { color: colors.text, fontSize: 16 },
  value: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  block: { gap: 4, marginTop: 6 },
  section: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  item: { color: colors.text, fontSize: 15 },
});
