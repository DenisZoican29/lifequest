import { Lato_400Regular, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { useStore } from '@/state/store';
import { Button, T } from '@/ui/components';
import { font, SHELL_WIDTH, useIsDark, usePalette } from '@/ui/theme';
import { ToastHost } from '@/ui/toast';

/** Desktop browser POC: centre a phone-width app shell (design spec §12). */
function Shell({ children }: { children: ReactNode }) {
  const p = usePalette();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: p.shell, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: SHELL_WIDTH, backgroundColor: p.canvas, borderLeftWidth: 1, borderRightWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const p = usePalette();
  const dark = useIsDark();
  const ready = useStore((s) => s.ready);
  const loadError = useStore((s) => s.loadError);
  const onboarded = useStore((s) => s.snapshot.settings.onboarded);
  const [fontsLoaded, fontError] = useFonts({ Lato_400Regular, Lato_700Bold, Lato_900Black });
  // A font failure falls back to system fonts rather than blocking the app.
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    void useStore.getState().init();
    // Re-evaluate "today" so the free allowance resets when local midnight passes.
    const id = setInterval(() => useStore.getState().bumpTick(), 30_000);
    return () => clearInterval(id);
  }, []);

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: p.canvas, card: p.canvas, text: p.ink, border: p.border, primary: p.forest },
  };

  if (!ready || !fontsReady || loadError) {
    return (
      <Shell>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.canvas, padding: 24, gap: 12 }}>
          {loadError ? (
            <>
              <T kind="h2">Could not open local storage</T>
              <T kind="muted" style={{ textAlign: 'center' }}>
                {loadError}. Private windows or blocked site data can prevent saving.
              </T>
              <Button title="Try again" onPress={() => void useStore.getState().init()} />
            </>
          ) : (
            <ActivityIndicator color={p.forest} />
          )}
        </View>
      </Shell>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <Shell>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: p.canvas },
            headerTintColor: p.ink,
            headerTitleStyle: { fontFamily: font.bold, fontSize: 18 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: p.canvas },
          }}>
          {/* First run shows onboarding only; afterwards it is unreachable until data is erased. */}
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'LifeQuest' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="goal/[id]" options={{ title: 'Goal' }} />
            <Stack.Screen name="goal-form" options={{ title: 'Goal' }} />
            <Stack.Screen name="task-form" options={{ title: 'Quest' }} />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ headerShown: false, title: 'Welcome' }} />
          </Stack.Protected>
        </Stack>
        <ToastHost />
      </Shell>
    </ThemeProvider>
  );
}
