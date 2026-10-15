import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MarkKind } from '../feedback/model';
import { useFormat } from '../i18n';
import { colors } from '../theme';

/** Zwei große Knöpfe zum Markieren (Falsch / Fehlt), gedacht für den Beifahrer. Bestätigt kurz mit „Gemerkt". */
export function FeedbackBar({ onMark }: { onMark: (kind: MarkKind) => boolean }) {
  const f = useFormat();
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const press = (kind: MarkKind) => {
    if (!onMark(kind)) return;
    setSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 1500);
  };

  return (
    <View style={styles.row}>
      <Pressable style={[styles.btn, styles.wrong]} onPress={() => press('wrong')}>
        <Text style={styles.text}>{f.t('fb.wrong')}</Text>
      </Pressable>
      <Text style={styles.saved}>{saved ? f.t('fb.saved') : ''}</Text>
      <Pressable style={[styles.btn, styles.missing]} onPress={() => press('missing')}>
        <Text style={styles.text}>{f.t('fb.missing')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  wrong: { backgroundColor: '#4a1d1d' },
  missing: { backgroundColor: '#1d2f4a' },
  text: { color: colors.text, fontSize: 17, fontWeight: '800' },
  saved: { color: colors.accent, fontSize: 14, fontWeight: '700', minWidth: 74, textAlign: 'center' },
});
