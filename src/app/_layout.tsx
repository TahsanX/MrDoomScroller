import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Ink, Surface } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Surface.page },
          headerTintColor: Ink.primary,
          headerTitleStyle: { fontSize: 16, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Surface.page },
        }}>
        <Stack.Screen name="index" options={{ title: 'ScrollWise' }} />
        <Stack.Screen
          name="onboarding"
          options={{ title: 'Setup', headerBackVisible: false }}
        />
        <Stack.Screen name="limits" options={{ title: 'Limits' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="calibration" options={{ title: 'Calibration' }} />
      </Stack>
    </>
  );
}
