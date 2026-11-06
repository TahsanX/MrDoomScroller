import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Ink, Surface, Type } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Surface.page },
          headerTintColor: Ink.primary,
          headerTitleStyle: Type.heading,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Surface.page },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ title: 'Setup', headerBackVisible: false }}
        />
        {/* Ellie arrives as a sheet, so she sits over the screen you asked from. */}
        <Stack.Screen
          name="ellie"
          options={{ title: 'Ellie', presentation: 'modal' }}
        />
        <Stack.Screen name="calibration" options={{ title: 'Calibration' }} />
      </Stack>
    </>
  );
}
