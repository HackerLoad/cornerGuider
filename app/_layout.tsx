import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafetyNotice } from '../src/components/SafetyNotice';
import '../src/services/locationTask';
import { useFormat } from '../src/i18n';
import { applyOrientation } from '../src/services/orientation';
import { useSettingsStore } from '../src/stores/settingsStore';
import { colors } from '../src/theme';

function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(useSettingsStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useSettingsStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

export default function RootLayout() {
  const hydrated = useHydrated();
  const f = useFormat();
  const accepted = useSettingsStore((s) => s.safetyAccepted);
  const acceptSafety = useSettingsStore((s) => s.acceptSafety);
  const orientation = useSettingsStore((s) => s.orientation);
  useEffect(() => {
    if (hydrated) void applyOrientation(orientation);
  }, [hydrated, orientation]);

  if (!hydrated) return null;
  if (!accepted) {
    return (
      <>
        <StatusBar style="light" />
        <SafetyNotice onAccept={acceptSafety} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ title: f.t('import.title'), presentation: 'modal' }} />
        <Stack.Screen name="route/[id]" options={{ title: f.t('route.title') }} />
        <Stack.Screen name="drive/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="freeride" options={{ title: f.t('go.modeFree') }} />
        <Stack.Screen name="freeride-drive" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="freeride-result/[id]" options={{ title: f.t('result.title') }} />
      </Stack>
    </>
  );
}
