import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { recovering, beginRecovery, finishRecovery } = useAuth();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSendCode = async () => {
    setErrorMsg(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMsg('Ingresa el correo asociado a tu cuenta.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setStep('verify');
    } catch {
      setErrorMsg('No se pudo enviar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setErrorMsg(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!recovering && otpCode.trim().length < 6) {
      setErrorMsg('Ingresa el código de 6 dígitos que enviamos a tu correo.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      // 1. Verificar el código OTP de recuperación (inicia sesión temporal)
      if (!recovering) {
        beginRecovery();
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: otpCode.trim(),
          type: 'recovery',
        });
        if (verifyError) {
          finishRecovery();
          setErrorMsg('El código es inválido o ya expiró.');
          return;
        }
      }

      // 2. Actualizar la contraseña del usuario autenticado
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setErrorMsg(updateError.message);
        return;
      }

      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña se restableció correctamente.',
        [{ text: 'Continuar', onPress: finishRecovery }],
      );
    } catch {
      setErrorMsg('Ocurrió un error al restablecer tu contraseña.');
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
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Text style={styles.backText}>‹ Volver</Text>
          </Pressable>

          <Text style={styles.title}>
            {step === 'request' ? 'Recuperar contraseña' : 'Ingresa tu código'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'request'
              ? 'Te enviaremos un código de verificación a tu correo para crear una nueva contraseña.'
              : `Enviamos un código de 6 dígitos a ${email.trim().toLowerCase()}.`}
          </Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            {step === 'request' ? (
              <>
                <Text style={styles.label}>Correo electrónico</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />
                <Pressable
                  disabled={loading}
                  onPress={handleSendCode}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (pressed || loading) && styles.buttonDisabled,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Enviar código</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>Código de verificación (6 dígitos)</Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="123456"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.otpInput]}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />

                <Text style={styles.label}>Nueva contraseña</Text>
                <TextInput
                  autoCapitalize="none"
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <Text style={styles.label}>Confirmar nueva contraseña</Text>
                <TextInput
                  autoCapitalize="none"
                  placeholder="Repite la contraseña"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                <Pressable
                  disabled={loading}
                  onPress={handleResetPassword}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (pressed || loading) && styles.buttonDisabled,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Guardar nueva contraseña</Text>
                  )}
                </Pressable>

                <Pressable
                  disabled={loading}
                  onPress={handleSendCode}
                  style={styles.resendButton}
                >
                  <Text style={styles.resendText}>Reenviar código</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 32 },
  backButton: { alignSelf: 'flex-start', marginBottom: 20 },
  backText: { color: colors.greenDark, fontSize: 15, fontWeight: '700' },
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
