import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
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

export default function RegisterScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMsg(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!nombre.trim() || !apellido.trim() || !cleanEmail || !password) {
      setErrorMsg('Completa todos los campos obligatorios.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            telefono: telefono.trim() || null,
            rol: 'consumidor',
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          setErrorMsg('Este correo electrónico ya está registrado.');
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      // Si Supabase requiere confirmación de correo, session vendrá en null
      if (!data.session) {
        Alert.alert(
          'Revisa tu correo',
          'Te enviamos un enlace de verificación. Confirma tu cuenta para iniciar sesión.',
          [{ text: 'Ir a iniciar sesión', onPress: () => router.replace('/auth/login') }],
        );
        return;
      }

      router.replace('/');
    } catch {
      setErrorMsg('No se pudo completar el registro. Intenta de nuevo.');
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
          <View style={styles.brandHeader}>
            <Image
                source={require('../../../assets/LogoR.png')}
                style={styles.logoImage}
            />
            <Text style={styles.logoText}>Benefy</Text>
          </View>

          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>
            Únete gratis y empieza a ganar beneficios en tus comercios favoritos.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  placeholder="Sofía"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Apellido *</Text>
                <TextInput
                  placeholder="Pérez"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={apellido}
                  onChangeText={setApellido}
                />
              </View>
            </View>

            <Text style={styles.label}>Teléfono (opcional)</Text>
            <TextInput
              keyboardType="phone-pad"
              placeholder="664 123 4567"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={telefono}
              onChangeText={setTelefono}
            />

            <Text style={styles.label}>Correo electrónico *</Text>
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

            <Text style={styles.label}>Contraseña *</Text>
            <TextInput
              autoCapitalize="none"
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.label}>Confirmar contraseña *</Text>
            <TextInput
              autoCapitalize="none"
              placeholder="Repite tu contraseña"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <Pressable
              disabled={loading}
              onPress={handleRegister}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || loading) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>Crear cuenta</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿Ya tienes una cuenta? </Text>
            <Link href="/auth/login" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.footerLink}>Inicia sesión</Text>
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
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 32 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoImage: {
    width: 50,
    height: 38,
    borderRadius: 10, // Opcional, por si tu imagen tiene fondo cuadrado
    resizeMode: 'contain',
  },
  logoMarkText: { color: colors.surface, fontSize: 19, fontWeight: '800' },
  logoText: { marginLeft: 9, color: colors.greenDark, fontSize: 21, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 5, marginBottom: 18 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
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
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  halfInput: { flex: 1 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 5 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 13,
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
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: colors.muted, fontSize: 13 },
  footerLink: { color: colors.greenDark, fontSize: 13, fontWeight: '800' },
});