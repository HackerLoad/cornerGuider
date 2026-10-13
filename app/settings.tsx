import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '../src/stores/settingsStore';
import { colors } from '../src/theme';

function Stepper(props: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={props.onMinus}><Text style={styles.stepText}>−</Text></Pressable>
        <Text style={styles.value}>{props.value}</Text>
        <Pressable style={styles.stepBtn} onPress={props.onPlus}><Text style={styles.stepText}>+</Text></Pressable>
      </View>
    </View>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function Settings() {
  const s = useSettingsStore();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Sprachansagen</Text>
        <Switch value={s.voiceEnabled} onValueChange={(v) => s.set({ voiceEnabled: v })} />
      </View>
      <Stepper
        label="Vorwarnzeit"
        value={`${s.leadSeconds} s`}
        onMinus={() => s.set({ leadSeconds: clamp(s.leadSeconds - 1, 2, 15) })}
        onPlus={() => s.set({ leadSeconds: clamp(s.leadSeconds + 1, 2, 15) })}
      />
      <Stepper
        label="Mindestabstand"
        value={`${s.minLeadM} m`}
        onMinus={() => s.set({ minLeadM: clamp(s.minLeadM - 10, 40, 300) })}
        onPlus={() => s.set({ minLeadM: clamp(s.minLeadM + 10, 40, 300) })}
      />
      <Stepper
        label="Sprechtempo"
        value={`${s.speechRate.toFixed(1)}×`}
        onMinus={() => s.set({ speechRate: clamp(Math.round((s.speechRate - 0.1) * 10) / 10, 0.6, 1.6) })}
        onPlus={() => s.set({ speechRate: clamp(Math.round((s.speechRate + 0.1) * 10) / 10, 0.6, 1.6) })}
      />
      <Text style={styles.hint}>
        Angesagt wird, sobald die Kurve näher ist als Vorwarnzeit × Geschwindigkeit, mindestens aber der Mindestabstand.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 12, padding: 16 },
  label: { color: colors.text, fontSize: 17 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  value: { color: colors.text, fontSize: 17, minWidth: 64, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
});
