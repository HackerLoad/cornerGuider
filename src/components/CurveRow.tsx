import { StyleSheet, Text, View } from 'react-native';
import type { Curve } from '../curves';
import { DEFAULT_CURVE_CONFIG } from '../curves/config';
import { isUncertain } from '../curves/confidence';
import { useFormat } from '../i18n';
import { colors } from '../theme';

export function CurveRow({ curve }: { curve: Curve }) {
  const f = useFormat();
  const shape = f.shape(curve.shape);
  const unsure = isUncertain(curve.confidence, DEFAULT_CURVE_CONFIG);
  const gradeColor = unsure ? colors.muted : colors.grade[curve.grade - 1];
  return (
    <View style={[styles.row, curve.followsPrevious && styles.followUp]}>
      <View style={[styles.grade, { borderColor: gradeColor }, unsure && styles.gradeUncertain]}>
        <Text style={[styles.gradeText, { color: gradeColor }]}>{unsure ? '?' : curve.grade}</Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.title}>
          {f.dir(curve.direction)} {unsure ? f.t('curve.uncertain') : curve.grade}
          {shape ? <Text style={styles.muted}>  ·  {shape}</Text> : null}
        </Text>
        <Text style={styles.muted}>
          {f.t('curve.details', { radius: f.radius(curve.minRadius), angle: Math.round(curve.totalAngle), length: f.dist(curve.length) })}
        </Text>
        {curve.followsPrevious && curve.gapToPrevious !== null ? (
          <Text style={styles.sequence}>{f.t('curve.sequence', { gap: f.dist(curve.gapToPrevious) })}</Text>
        ) : null}
      </View>
      <View style={styles.dist}>
        <Text style={styles.distText}>{f.dist(curve.startDist)}</Text>
        <Text style={styles.muted}>{f.t('curve.fromStart')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
  },
  followUp: { marginLeft: 16 },
  grade: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  gradeUncertain: { borderStyle: 'dashed' },
  gradeText: { fontSize: 22, fontWeight: '800' },
  main: { flex: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  sequence: { color: colors.accent, fontSize: 13, marginTop: 2 },
  dist: { alignItems: 'flex-end' },
  distText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
