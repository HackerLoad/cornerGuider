import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors } from '../theme';

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Row({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function ToggleRow(props: { label: string; note?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={props.label} note={props.note}>
      <Switch value={props.value} onValueChange={props.onChange} />
    </Row>
  );
}

export function StepperRow(props: {
  label: string;
  note?: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <Row label={props.label} note={props.note}>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={props.onMinus} hitSlop={8}><Text style={styles.stepText}>−</Text></Pressable>
        <Text style={styles.value}>{props.value}</Text>
        <Pressable style={styles.stepBtn} onPress={props.onPlus} hitSlop={8}><Text style={styles.stepText}>+</Text></Pressable>
      </View>
    </Row>
  );
}

export function ChoiceRow<T extends string>(props: {
  label: string;
  note?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.choiceBlock}>
      <Text style={styles.label}>{props.label}</Text>
      {props.note ? <Text style={styles.note}>{props.note}</Text> : null}
      <View style={styles.segment}>
        {props.options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => props.onChange(o.value)}
            style={[styles.segBtn, props.value === o.value && styles.segActive]}
          >
            <Text style={[styles.segText, props.value === o.value && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ButtonRow(props: { label: string; note?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.row} onPress={props.onPress}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, props.danger ? { color: colors.danger } : { color: colors.accent }]}>{props.label}</Text>
        {props.note ? <Text style={styles.note}>{props.note}</Text> : null}
      </View>
    </Pressable>
  );
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const styles = StyleSheet.create({
  section: { gap: 6, marginBottom: 18 },
  sectionTitle: { color: colors.accent, fontSize: 14, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 4 },
  group: { backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { color: colors.text, fontSize: 17 },
  note: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 21, fontWeight: '700' },
  value: { color: colors.text, fontSize: 16, minWidth: 78, textAlign: 'center' },
  choiceBlock: { paddingHorizontal: 16, paddingVertical: 13, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  segment: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 10, padding: 3, gap: 3 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segActive: { backgroundColor: colors.accent },
  segText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  segTextActive: { color: '#000' },
});
