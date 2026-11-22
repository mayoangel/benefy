import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { PreviewProvider, usePreview } from '../features/preview';
import { BenefyThemeProvider, useBenefyTheme } from '../theme';

function Routes() {
  const session = usePreview();
  const path = usePathname();
  const router = useRouter();
  const { colors, dark } = useBenefyTheme();
  const baseTheme = dark ? DarkTheme : DefaultTheme;
  useEffect(() => {
    if (!session.signedIn && path !== '/welcome') router.replace('/welcome');
  }, [session.signedIn, path, router]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.panel).catch(() => {});
  }, [colors.panel]);
  return <ThemeProvider value={{ ...baseTheme, colors: {
    ...baseTheme.colors, background: colors.background, card: colors.panel,
    text: colors.ink, border: colors.line, primary: colors.green, notification: colors.mint,
  } }}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  </ThemeProvider>;
}

export default function RootLayout() {
  return <BenefyThemeProvider><PreviewProvider><Routes /></PreviewProvider></BenefyThemeProvider>;
}
