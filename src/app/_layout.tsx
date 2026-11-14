import { Nunito_600SemiBold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Ink, Surface, Type } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Release builds embed Nunito through the expo-font plugin; this covers dev builds,
  // and holding the splash until it lands avoids a flash of the system font.
  const [loaded, error] = useFonts({ Nunito_600SemiBold, Nunito_800ExtraBold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Surface.page },
          headerTintColor: Ink.primary,
          headerTitleStyle: Type.heading,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Surface.page },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        {/* Ellie arrives as a sheet, so she sits over the screen you asked from. */}
        <Stack.Screen name="ellie" options={{ title: 'Ellie', presentation: 'modal' }} />
        <Stack.Screen name="calibration" options={{ title: 'Calibration' }} />
      </Stack>
    </>
  );
}
