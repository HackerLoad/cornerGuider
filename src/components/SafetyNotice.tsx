import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFormat } from '../i18n';
import { colors } from '../theme';

export function SafetyNotice({ onAccept }: { onAccept: () => void }) {
  const f = useFormat();
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{f.t('safety.title')}</Text>
        <Text style={styles.text}>{f.t('safety.p1')}</Text>
        <Text style={styles.text}>{f.t('safety.p2')}</Text>
        <Text style={styles.text}>{f.t('safety.p3')}</Text>
        <Text style={styles.text}>{f.t('safety.p4')}</Text>
        <Text style={styles.text}>{f.t('safety.p5')}</Text>
      </ScrollView>
      <Pressable style={styles.button} onPress={onAccept}>
        <Text style={styles.buttonText}>{f.t('safety.accept')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  content: { padding: 24, gap: 16 },
  title: { color: colors.accent, fontSize: 28, fontWeight: '800' },
  text: { color: colors.text, fontSize: 18, lineHeight: 26 },
  button: { margin: 24, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#000', fontSize: 18, fontWeight: '800' },
});
