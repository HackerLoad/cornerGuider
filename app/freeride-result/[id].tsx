import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { evaluateRecording, type RecordingSummary } from '../../src/freeride/evaluateRecording';
import { useFormat } from '../../src/i18n';
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
  const f = useFormat();
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
  if (state === 'missing') return <View style={styles.center}><Text style={styles.muted}>{f.t('result.missing')}</Text></View>;
  if (state === 'short') return <View style={styles.center}><Text style={styles.muted}>{f.t('result.tooShort')}</Text></View>;

  const r = state;
  const e = r.eval;
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Stack.Screen options={{ title: f.t('result.title') }} />
      <Text style={styles.title}>{f.t('result.distanceTime', { distance: f.km(r.distanceKm * 1000), minutes: Math.round(r.durationMin) })}</Text>
      <Text style={styles.note}>{f.t('result.explain')}</Text>

      <Row label={f.t('result.announced')} value={String(e.announced)} />
      <Row label={f.t('result.correct')} value={`${e.correct} (${pct(e.precision)})`} note={f.t('result.correctNote')} />
      <Row label={f.t('result.falseAlarms')} value={String(e.falseAlarms.length)} />
      <Row label={f.t('result.actual')} value={String(e.actual)} />
      <Row label={f.t('result.recalled')} value={`${e.recalled} (${pct(e.recall)})`} />
      <Row label={f.t('result.okShare')} value={pct(r.okShare)} note={f.t('result.okShareNote')} />
      <Row label={f.t('result.short')} value={pct(r.shortPathShare)} note={f.t('result.shortNote')} />

      {e.falseAlarms.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.section}>{f.t('result.falseAlarms')}</Text>
          {e.falseAlarms.map((a, i) => (
            <Text key={i} style={styles.item}>{f.dir(a.direction)} {a.grade}</Text>
          ))}
        </View>
      ) : null}
      {e.missed.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.section}>{f.t('result.missedList')}</Text>
          {e.missed.slice(0, 30).map((c, i) => (
            <Text key={i} style={styles.item}>
              {f.t('result.missedItem', { dir: f.dir(c.direction), grade: c.grade, radius: f.radius(c.minRadius), position: f.km(c.startDist) })}
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
