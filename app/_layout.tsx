import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme';

export default function RootLayout() {
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
        <Stack.Screen name="index" options={{ title: 'cornerGuider' }} />
        <Stack.Screen name="import" options={{ title: 'Import', presentation: 'modal' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Route' }} />
      </Stack>
    </>
  );
}
