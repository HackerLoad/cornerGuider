import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatKm } from '../../src/format';
import { useRoutesStore } from '../../src/stores/routesStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { colors } from '../../src/theme';

/** Startseite: ein großer Go-Knopf. Er fährt die gewählte Strecke oder startet die Freie Fahrt. */
export default function Go() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = width > height;
  const s = useSettingsStore();
  const routes = useRoutesStore((r) => r.routes);
  const active = routes.find((r) => r.id === s.activeRouteId) ?? null;

  const size = Math.min(landscape ? height * 0.62 : width * 0.66, 300);

  function go() {
    if (s.goMode === 'free') return router.push('/freeride-drive');
    if (!active) {
      return Alert.alert('Keine Strecke gewählt', 'Importiere eine GPX-Datei und wähle sie als Strecke, oder starte die Freie Fahrt.', [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Strecken öffnen', onPress: () => router.push('/routes') },
        { text: 'Freie Fahrt', onPress: () => s.set({ goMode: 'free' }) },
      ]);
    }
    router.push({ pathname: '/drive/[id]', params: { id: active.id } });
  }

  const info =
    s.goMode === 'free' ? (
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Freie Fahrt</Text>
        <Text style={styles.infoText}>
          Ohne Route: Der Straßenverlauf wird aus OpenStreetMap vorhergesagt (Versuch, braucht Internet).
        </Text>
        <Pressable onPress={() => router.push('/freeride')} hitSlop={10}>
          <Text style={styles.link}>Aufzeichnungen und Simulation</Text>
        </Pressable>
      </View>
    ) : active ? (
      <View style={styles.info}>
        <Text style={styles.infoLabel}>STRECKE</Text>
        <Text style={styles.infoTitle} numberOfLines={2}>{active.name}</Text>
        <Text style={styles.infoText}>{formatKm(active.lengthM, s.units)} · {active.curveCount} Kurven</Text>
        <View style={styles.links}>
          <Pressable onPress={() => router.push('/routes')} hitSlop={10}><Text style={styles.link}>Ändern</Text></Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/drive/[id]', params: { id: active.id, sim: '1' } })}
            hitSlop={10}
          >
            <Text style={styles.link}>Simulation</Text>
          </Pressable>
        </View>
      </View>
    ) : (
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Noch keine Strecke</Text>
        <Text style={styles.infoText}>Importiere eine GPX-Datei (Track oder Route, z. B. aus Kurviger oder Calimoto).</Text>
        <Pressable onPress={() => router.push('/routes')} hitSlop={10}><Text style={styles.link}>Strecke importieren</Text></Pressable>
      </View>
    );

  return (
    <View
      style={[
        styles.container,
        landscape && styles.row,
        { paddingTop: Math.max(insets.top, 16) + 8, paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 20) },
      ]}
    >
      <View style={landscape ? styles.left : styles.top}>
        <View style={styles.segment}>
          {(['route', 'free'] as const).map((m) => (
            <Pressable key={m} onPress={() => s.set({ goMode: m })} style={[styles.segBtn, s.goMode === m && styles.segActive]}>
              <Text style={[styles.segText, s.goMode === m && styles.segTextActive]}>{m === 'route' ? 'Strecke' : 'Freie Fahrt'}</Text>
            </Pressable>
          ))}
        </View>
        {landscape ? info : null}
      </View>

      <View style={styles.center}>
        <Pressable
          onPress={go}
          style={({ pressed }) => [
            styles.goOuter,
            { width: size + 24, height: size + 24, borderRadius: (size + 24) / 2 },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Fahrt starten"
        >
          <View style={[styles.goInner, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[styles.goText, { fontSize: size * 0.34 }]}>GO</Text>
          </View>
        </Pressable>
      </View>

      {!landscape ? <View style={styles.bottom}>{info}</View> : null}

      <View style={[styles.voiceChip, { bottom: 12 }]}>
        <Pressable onPress={() => s.set({ voiceEnabled: !s.voiceEnabled })} style={styles.chip} hitSlop={8}>
          <Text style={styles.chipText}>{s.voiceEnabled ? 'Ansagen an' : 'Ansagen aus'} · ab Stufe {s.minAnnounceGrade}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  top: { alignItems: 'center' },
  left: { flex: 1, justifyContent: 'center', gap: 20 },
  center: { flex: 1.1, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: 8, paddingBottom: 56, minHeight: 150, justifyContent: 'flex-end' },
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, gap: 4, alignSelf: 'center' },
  segBtn: { paddingVertical: 9, paddingHorizontal: 18, borderRadius: 9 },
  segActive: { backgroundColor: colors.accent },
  segText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  segTextActive: { color: '#000' },
  goOuter: { backgroundColor: 'rgba(255,179,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  goInner: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#000', fontWeight: '900', letterSpacing: 2 },
  info: { alignItems: 'center', gap: 4 },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  infoTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  infoText: { color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  links: { flexDirection: 'row', gap: 24, marginTop: 6 },
  link: { color: colors.accent, fontSize: 16, fontWeight: '700', marginTop: 6 },
  voiceChip: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  chip: { backgroundColor: colors.card, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
