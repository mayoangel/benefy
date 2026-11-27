import { useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
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

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const [email, setEmail] = useState(() =>
    Array.isArray(params.email) ? params.email[0] ?? '' : params.email ?? '',
  );
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleVerify = async () => {
    setErrorMsg(null);
    setNotice(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setErrorMsg('Ingresa el correo con el que creaste tu cuenta.');
      return;
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      setErrorMsg('Ingresa el código de 6 dígitos que enviamos a tu correo.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'signup',
      });

      if (error) {
        setErrorMsg('El código no es válido o ya expiró. Solicita uno nuevo.');
        return;
      }

      router.replace('/(tabs)');
    } catch {
      setErrorMsg('No se pudo verificar el correo. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setErrorMsg(null);
    setNotice(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMsg('Ingresa el correo con el que creaste tu cuenta.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setCode('');
      setNotice('Te enviamos un código nuevo. Revisa tu correo.');
    } catch {
      setErrorMsg('No se pudo reenviar el código. Intenta de nuevo.');
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
          <Link href="/auth/login" asChild>
            <Pressable hitSlop={10} style={styles.backButton}>
              <Text style={styles.backText}>‹ Volver al inicio de sesión</Text>
            </Pressable>
          </Link>

          <Text style={styles.title}>Confirma tu correo</Text>
          <Text style={styles.subtitle}>
            Ingresa el código de 6 dígitos que enviamos a tu correo.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
          {notice ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{notice}</Text>
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

            <Text style={styles.label}>Código de verificación</Text>
            <TextInput
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.otpInput]}
              value={code}
              onChangeText={value => setCode(value.replace(/\D/g, ''))}
            />

            <Pressable
              disabled={loading}
              onPress={handleVerify}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || loading) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>Confirmar correo</Text>
              )}
            </Pressable>

            <Pressable
              disabled={loading}
              onPress={handleResend}
              style={styles.resendButton}
            >
              <Text style={styles.resendText}>Reenviar código</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 32 },
  backButton: { alignSelf: 'flex-start', marginBottom: 20 },
  backText: { color: colors.greenDark, fontSize: 14, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
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
  noticeBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.green,
  },
  noticeText: { color: colors.greenDark, fontSize: 12, fontWeight: '600' },
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
    marginBottom: 15,
  },
  otpInput: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.green,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.72 },
  primaryButtonText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  resendButton: { alignItems: 'center', marginTop: 16 },
  resendText: { color: colors.greenDark, fontSize: 12, fontWeight: '700' },
});
