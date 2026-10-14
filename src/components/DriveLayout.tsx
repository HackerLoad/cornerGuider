import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface GraphicArea {
  width: number;
  height: number;
}

interface Props {
  /** Kopfzeile, z. B. „In 240 m: Rechts 3" */
  header: ReactNode;
  /** Kurvengrafik; bekommt die verfügbare Fläche */
  graphic: (area: GraphicArea) => ReactNode;
  /** Zeilen der nächsten Kurven */
  list: ReactNode;
  /** Optional: Simulationsleiste */
  sim?: ReactNode;
  footer: ReactNode;
}

/** Zu klein für die Grafik: darunter wird sie nicht mehr gezeichnet. */
const MIN_AREA = 120;

/**
 * Fahrmodus-Layout. Hochformat: Kopfzeile, Grafik, Liste untereinander. Querformat (Handy quer am Lenker):
 * links Kopfzeile und Liste, rechts die große Grafik; Sicherheitsabstände (Notch, Home-Balken) werden beachtet.
 */
export function DriveLayout({ header, graphic, list, sim, footer }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState<GraphicArea>({ width: 0, height: 0 });
  const landscape = width > height;

  if (!landscape) {
    const h = Math.max(180, Math.min(width, height * 0.42));
    return (
      <View style={[styles.root, { paddingTop: 54, paddingBottom: Math.max(insets.bottom - 6, 6) }]}>
        <View style={styles.header}>{header}</View>
        <View style={{ height: h, alignItems: 'center' }}>{graphic({ width, height: h })}</View>
        <ScrollView style={styles.list}>{list}</ScrollView>
        {sim}
        {footer}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        styles.row,
        {
          paddingTop: Math.max(insets.top, 10),
          paddingBottom: Math.max(insets.bottom, 6),
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: Math.max(insets.right, 12),
        },
      ]}
    >
      <View style={styles.leftCol}>
        <View style={styles.header}>{header}</View>
        <ScrollView style={styles.list}>{list}</ScrollView>
        {sim}
        {footer}
      </View>
      <View
        style={styles.rightCol}
        onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {area.width > MIN_AREA && area.height > MIN_AREA ? graphic(area) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  row: { flexDirection: 'row', gap: 12 },
  header: { paddingHorizontal: 16, minHeight: 70, justifyContent: 'center' },
  list: { flex: 1, paddingHorizontal: 16 },
  leftCol: { flex: 1 },
  rightCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
