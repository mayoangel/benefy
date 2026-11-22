import { useState } from 'react';
import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMsg(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMsg('Ingresa tu correo electrónico y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Correo o contraseña incorrectos.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMsg('Debes confirmar tu correo antes de iniciar sesión.');
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

    } catch {
      setErrorMsg('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Marca Benefy */}
          <View style={styles.brandHeader}>
            <Image
                source={require('../../../assets/LogoR.png')}
                style={styles.logoImage}
            />
            <Text style={styles.logoText}>Benefy</Text>
          </View>

          <Text style={styles.title}>Bienvenido de nuevo</Text>
          <Text style={styles.subtitle}>
            Inicia sesión para acumular puntos, sellos y canjear tus recompensas.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="ejemplo@correo.com"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />

            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Contraseña</Text>
              <Link href="/auth/forgot-password" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.forgotLink}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.passwordWrapper}>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeButton}
                hitSlop={8}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
              </Pressable>
            </View>

            <Pressable
              disabled={loading}
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || loading) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿Aún no tienes cuenta? </Text>
            <Link href="/auth/register" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.footerLink}>Regístrate aquí</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 32, paddingBottom: 24 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  logoImage: {
    width: 50,
    height: 38,
    borderRadius: 10, // Opcional, por si tu imagen tiene fondo cuadrado
    resizeMode: 'contain',
  },
  logoMarkText: { color: colors.surface, fontSize: 20, fontWeight: '800' },
  logoText: {
    marginLeft: 10,
    color: colors.greenDark,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 22 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FAD1D2',
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0EFF4',
  },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 16,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotLink: { color: colors.greenDark, fontSize: 11, fontWeight: '700' },
  passwordWrapper: { position: 'relative', justifyContent: 'center', marginBottom: 8 },
  passwordInput: { paddingRight: 68, marginBottom: 0 },
  eyeButton: { position: 'absolute', right: 14 },
  eyeText: { color: colors.greenDark, fontSize: 12, fontWeight: '700' },
  primaryButton: {
    backgroundColor: colors.green,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 14,
  },
  buttonDisabled: { opacity: 0.72 },
  primaryButtonText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.muted, fontSize: 13 },
  footerLink: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
});
