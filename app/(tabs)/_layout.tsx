import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useFormat } from '../../src/i18n';
import { colors } from '../../src/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) => ({ color, size }: { color: string; size: number }) => (
  <Ionicons name={name} size={size} color={color} />
);

/** Drei Tabs: Go (großer Startknopf), Strecken, Einstellungen. */
export default function TabsLayout() {
  const f = useFormat();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: '#0b0d0f', borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: f.t('tabs.go'), headerShown: false, tabBarIcon: icon('play-circle') }} />
      <Tabs.Screen name="routes" options={{ title: f.t('tabs.routes'), tabBarIcon: icon('map') }} />
      <Tabs.Screen name="settings" options={{ title: f.t('tabs.settings'), tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
