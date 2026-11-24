import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { PreferencesProvider } from '../features/preferences';
import { ScanSessionProvider } from '../features/scanSession';
import { queryClient } from '../lib/queryClient';
import { BenefyThemeProvider, useBenefyTheme } from '../theme';

const accountRoutes = [
  '(tabs)', 'about', 'business/[id]', 'business-allies/[id]', 'business-coupons/[id]',
  'coupon/[id]', 'coupons', 'delete-account', 'dynamics', 'explore', 'help', 'history',
  'legal', 'notification-settings', 'notifications', 'privacy', 'profile-edit', 'redeem/[id]',
  'reward/[id]', 'scan/confirm', 'scan/error', 'scan/success', 'settings', 'shop/[id]',
];

function Routes() {
  const {
    session, loading, recovering, profileLoading, profileError,
    retryProfile, signOut,
  } = useAuth();
  const signedIn = !!session && !recovering;
  const { colors, dark } = useBenefyTheme();
  const baseTheme = dark ? DarkTheme : DefaultTheme;
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.panel).catch(() => {});
  }, [colors.panel]);
  const cargando = loading || (signedIn && profileLoading);
  return <ThemeProvider value={{ ...baseTheme, colors: {
    ...baseTheme.colors, background: colors.background, card: colors.panel,
    text: colors.ink, border: colors.line, primary: colors.green, notification: colors.mint,
  } }}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    {cargando ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.background }}>
      <ActivityIndicator accessibilityLabel="Cargando cuenta" color={colors.green} />
      {signedIn && <Text style={{ color: colors.muted }}>Preparando tu cuenta…</Text>}
    </View> : signedIn && profileError ? <View style={{
      flex: 1, justifyContent: 'center', gap: 14, padding: 24, backgroundColor: colors.background,
    }}>
      <Text accessibilityRole="header" style={{ color: colors.navy, fontSize: 22, fontWeight: '800' }}>
        No pudimos preparar tu cuenta
      </Text>
      <Text style={{ color: colors.muted, lineHeight: 20 }}>
        Revisa tu conexión e intenta de nuevo. Si el problema continúa, cierra sesión y vuelve a entrar.
      </Text>
      <Pressable accessibilityRole="button" onPress={retryProfile} style={({ pressed }) => ({
        minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12,
        backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1,
      })}>
        <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Reintentar</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void signOut().catch(() => {})}
        style={({ pressed }) => ({
          minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12,
          backgroundColor: colors.subtle, opacity: pressed ? 0.7 : 1,
        })}>
        <Text style={{ color: colors.navy, fontWeight: '700' }}>Cerrar sesión</Text>
      </Pressable>
    </View> : <PreferencesProvider accountId={session?.user.id}>
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
    </PreferencesProvider>}
  </ThemeProvider>;
}

export default function RootLayout() {
  return <QueryClientProvider client={queryClient}>
    <SafeAreaProvider><BenefyThemeProvider><AuthProvider><Routes /></AuthProvider></BenefyThemeProvider></SafeAreaProvider>
  </QueryClientProvider>;
}
