import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RATINGS,
  distanceAtTime,
  exportBundle,
  ratedCurves,
  recordingToGpx,
  summarizeRatings,
  type CurveRating,
} from '../../src/feedback/model';
import { evaluateRecording, type RecordingSummary } from '../../src/freeride/evaluateRecording';
import type { FreerideRecording } from '../../src/freeride/session';
import { useFormat } from '../../src/i18n';
import { shareTextFile } from '../../src/services/exporter';
import { loadRecording, saveRecording } from '../../src/services/freerideStorage';
import { useFeedbackStore } from '../../src/stores/feedbackStore';
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
  const [rec, setRec] = useState<FreerideRecording | null | undefined>(undefined);
  const [summary, setSummary] = useState<RecordingSummary | null>(null);
  const allMarks = useFeedbackStore((s) => s.marks);
  const removeMark = useFeedbackStore((s) => s.remove);

  useEffect(() => {
    let cancelled = false;
    loadRecording(id).then((r) => {
      if (cancelled) return;
      setRec(r);
      setSummary(r ? evaluateRecording(r) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const curves = useMemo(() => (rec ? ratedCurves(rec) : []), [rec]);
  const rating = useMemo(() => summarizeRatings(curves), [curves]);
  const marks = useMemo(
    () => (rec ? allMarks.filter((m) => m.t >= rec.startedAt && m.t <= rec.endedAt + 60_000) : []),
    [rec, allMarks],
  );

  if (rec === undefined) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (rec === null) return <View style={styles.center}><Text style={styles.muted}>{f.t('result.missing')}</Text></View>;
  if (!summary) return <View style={styles.center}><Text style={styles.muted}>{f.t('result.tooShort')}</Text></View>;

  const rate = (key: string, value: CurveRating) => {
    const ratings = { ...(rec.ratings ?? {}) };
    if (ratings[key] === value) delete ratings[key]; // erneutes Tippen nimmt die Bewertung zurück
    else ratings[key] = value;
    const next = { ...rec, ratings };
    setRec(next);
    saveRecording(next);
  };

  const share = async (what: 'gpx' | 'json') => {
    try {
      const stamp = new Date(rec.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, '-');
      if (what === 'gpx') await shareTextFile(`cornerguider-${stamp}.gpx`, recordingToGpx(rec, marks), f.t('fb.exportGpx'));
      else await shareTextFile(`cornerguider-${stamp}.json`, JSON.stringify(exportBundle(rec, allMarks)), f.t('fb.exportJson'));
    } catch {
      Alert.alert(f.t('fb.exportFailed'));
    }
  };

  const r = summary;
  const e = r.eval;
  const time = (t: number) => new Date(t).toLocaleTimeString(f.lang === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const curveText = (c?: { direction: 'left' | 'right'; grade: number }) => (c ? ` ${f.dir(c.direction)} ${c.grade}` : '');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}>
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

      <View style={styles.block}>
        <Text style={styles.section}>{f.t('fb.title')}</Text>
        <Text style={styles.note}>{f.t('fb.explain')}</Text>
        {curves.length === 0 ? (
          <Text style={styles.muted}>{f.t('fb.noAnnouncements')}</Text>
        ) : (
          <>
            <Text style={styles.note}>{f.t('fb.progress', { rated: rating.rated, total: curves.length })}</Text>
            {curves.map((c) => (
              <View key={c.key} style={styles.rateCard}>
                <Text style={styles.item}>
                  {f.t('fb.curveAt', { dir: f.dir(c.direction), grade: c.grade, position: f.km(distanceAtTime(rec, c.t)) })}
                </Text>
                <View style={styles.chips}>
                  {RATINGS.map((v) => (
                    <Pressable
                      key={v}
                      onPress={() => rate(c.key, v)}
                      style={[styles.chip, c.rating === v && (v === 'ok' ? styles.chipOk : styles.chipBad)]}
                    >
                      <Text style={[styles.chipText, c.rating === v && styles.chipTextOn]}>{f.t(`rating.${v}` as 'rating.ok')}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {rating.hints.map((h) => (
              <Text key={`${h.grade}-${h.kind}`} style={styles.hint}>
                {f.t(`fb.hint.${h.kind}` as 'fb.hint.tooMild', { grade: h.grade, share: Math.round(h.share * 100) })}
              </Text>
            ))}
          </>
        )}
      </View>

      {marks.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.section}>{f.t('fb.marks')}</Text>
          {marks.map((m) => (
            <View key={m.id} style={styles.markRow}>
              <Text style={[styles.item, { flex: 1 }]}>
                {f.t('fb.markItem', { kind: f.t(m.kind === 'wrong' ? 'fb.mark.wrong' : 'fb.mark.missing'), curve: curveText(m.curve) && ` ·${curveText(m.curve)}`, time: time(m.t) })}
              </Text>
              <Pressable onPress={() => removeMark(m.id)} hitSlop={10}>
                <Text style={styles.remove}>{f.t('common.delete')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <Pressable style={styles.exportBtn} onPress={() => void share('gpx')}>
          <Text style={styles.exportText}>{f.t('fb.exportGpx')}</Text>
        </Pressable>
        <Pressable style={styles.exportBtn} onPress={() => void share('json')}>
          <Text style={styles.exportText}>{f.t('fb.exportJson')}</Text>
        </Pressable>
      </View>
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
  block: { gap: 6, marginTop: 8 },
  section: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  item: { color: colors.text, fontSize: 15 },
  rateCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, gap: 8 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.border, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12 },
  chipOk: { backgroundColor: '#2f6f3a' },
  chipBad: { backgroundColor: '#7a4a12' },
  chipText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  hint: { color: colors.warn, fontSize: 14, lineHeight: 20 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  remove: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  exportBtn: { backgroundColor: colors.card, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  exportText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
});
