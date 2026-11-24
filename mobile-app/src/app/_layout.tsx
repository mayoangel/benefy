import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { PreviewProvider } from '../features/preview';
import { ScanSessionProvider } from '../features/scanSession';
import { BenefyThemeProvider, useBenefyTheme } from '../theme';

const accountRoutes = [
  '(tabs)', 'about', 'business/[id]', 'business-allies/[id]', 'business-coupons/[id]',
  'coupon/[id]', 'coupons', 'delete-account', 'dynamics', 'help', 'history', 'legal',
  'notification-settings', 'notifications', 'privacy', 'profile-edit', 'redeem/[id]',
  'reward/[id]', 'scan/confirm', 'scan/error', 'scan/success', 'settings', 'shop/[id]',
];

function Routes() {
  const { session, loading, recovering } = useAuth();
  const signedIn = !!session && !recovering;
  const { colors, dark } = useBenefyTheme();
  const baseTheme = dark ? DarkTheme : DefaultTheme;
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.panel).catch(() => {});
  }, [colors.panel]);
  return <ThemeProvider value={{ ...baseTheme, colors: {
    ...baseTheme.colors, background: colors.background, card: colors.panel,
    text: colors.ink, border: colors.line, primary: colors.green, notification: colors.mint,
  } }}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    {loading ? <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator accessibilityLabel="Cargando sesión" color={colors.green} />
    </View> : <PreviewProvider accountId={session?.user.id}>
      <ScanSessionProvider accountId={session?.user.id}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={signedIn}>
            {accountRoutes.map(name => <Stack.Screen key={name} name={name} />)}
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="auth" />
          </Stack.Protected>
        </Stack>
      </ScanSessionProvider>
    </PreviewProvider>}
  </ThemeProvider>;
}

export default function RootLayout() {
  return <SafeAreaProvider><BenefyThemeProvider><AuthProvider><Routes /></AuthProvider></BenefyThemeProvider></SafeAreaProvider>;
}
