import { StyleSheet, Text, View } from 'react-native';
import type { Curve } from '../curves';
import { directionLabel, formatDistance, formatRadius, shapeLabel } from '../format';
import { useUnits } from '../stores/settingsStore';
import { colors } from '../theme';

export function CurveRow({ curve }: { curve: Curve }) {
  const units = useUnits();
  const shape = shapeLabel(curve.shape);
  return (
    <View style={[styles.row, curve.followsPrevious && styles.followUp]}>
      <View style={[styles.grade, { borderColor: colors.grade[curve.grade - 1] }]}>
        <Text style={[styles.gradeText, { color: colors.grade[curve.grade - 1] }]}>{curve.grade}</Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.title}>
          {directionLabel(curve.direction)} {curve.grade}
          {shape ? <Text style={styles.muted}>  ·  {shape}</Text> : null}
        </Text>
        <Text style={styles.muted}>
          {formatRadius(curve.minRadius, units)} · {Math.round(curve.totalAngle)}° · {formatDistance(curve.length, units)} lang
        </Text>
        {curve.followsPrevious && curve.gapToPrevious !== null ? (
          <Text style={styles.sequence}>Folge: {formatDistance(curve.gapToPrevious, units)} nach der vorigen Kurve</Text>
        ) : null}
      </View>
      <View style={styles.dist}>
        <Text style={styles.distText}>{formatDistance(curve.startDist, units)}</Text>
        <Text style={styles.muted}>ab Start</Text>
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
  gradeText: { fontSize: 22, fontWeight: '800' },
  main: { flex: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  sequence: { color: colors.accent, fontSize: 13, marginTop: 2 },
  dist: { alignItems: 'flex-end' },
  distText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
