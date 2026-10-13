import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function SafetyNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sicherheitshinweis</Text>
        <Text style={styles.text}>• Die Kurvendaten werden aus GPX-Dateien berechnet und können ungenau oder falsch sein.</Text>
        <Text style={styles.text}>• cornerGuider gibt keine Geschwindigkeitsempfehlung. Die Kurvenstufe sagt nichts darüber aus, wie schnell du fahren kannst.</Text>
        <Text style={styles.text}>• Der tatsächliche Straßenverlauf, Sicht, Wetter, Fahrbahn und Verkehr haben immer Vorrang vor allen Anzeigen und Ansagen.</Text>
        <Text style={styles.text}>• Bediene das Gerät nicht während der Fahrt. Richte alles vor dem Losfahren ein.</Text>
      </ScrollView>
      <Pressable style={styles.button} onPress={onAccept}>
        <Text style={styles.buttonText}>Verstanden</Text>
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
