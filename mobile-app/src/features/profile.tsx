import { createThemedStyles, themePreferences, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { launchImageLibraryAsync } from 'expo-image-picker';
import {
  useCallback, useEffect, useRef, useState, type ComponentProps, type ComponentRef,
} from 'react';
import {
  Alert, AppState, Image, Linking, Modal, Pressable, StyleSheet, Switch,
  Text, TextInput, View,
} from 'react-native';
import { DisplayQr } from '../components/DisplayQr';
import { useAuth } from '../auth/AuthContext';
import { ApiError, type Perfil } from '../lib/api';
import { removeAvatarUrl, uploadAvatar } from '../lib/storage';
import { useActualizarPerfilMutation, useBilleteraQuery, usePerfilQuery } from './queries';
import { notificationPermission } from './notificationPermission';
import type { NotificationPermission } from './notificationPermission.types';
import { notificationTypes, usePreferences } from './preferences';
import {
  Button, Card, Choice, Copy, Heading, Notice, Row, Screen, Skeleton, useUiStyles,
} from './ui';
import { version } from '../../package.json';

function memberId(perfil: Perfil) {
  return `BF-${String(perfil.id).padStart(4, '0')}`;
}

function memberSince(value: string) {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return 'Fecha no disponible';
  return fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function phoneLabel(value: string | null) {
  return value && value.trim() ? value : 'Agregar teléfono';
}

export function ProfileScreen() {
  const { colors } = useBenefyTheme();
  const profileStyles = useProfileStyles();
  const styles = useUiStyles();
  const { signOut } = useAuth();
  const perfil = usePerfilQuery();
  const billetera = useBilleteraQuery();
  const [showQr, setShowQr] = useState(false);

  if (perfil.isLoading) {
    return <Screen title="Perfil" tabs><Skeleton /></Screen>;
  }
  if (perfil.isError || !perfil.data) {
    return <Screen title="Perfil" tabs>
      <Notice title="No se pudo cargar el perfil" retry={() => void perfil.refetch()} />
    </Screen>;
  }

  const account = perfil.data;
  const walletReady = !billetera.isError && !!billetera.data;
  const saldos = billetera.data?.saldos ?? [];
  const tarjetas = billetera.data?.tarjetas ?? [];
  const negocios = new Set<number>([
    ...saldos.map(item => item.negocio),
    ...tarjetas.map(item => item.negocio),
  ]);
  const puntos = saldos.reduce((total, item) => total + item.saldo_actual, 0);
  const premiosListos = tarjetas.filter(item => item.sellos_actuales >= item.meta).length;
  const metrics = [
    { label: 'Puntos totales', value: walletReady ? puntos : '—' },
    { label: 'Comercios activos', value: walletReady ? negocios.size : '—' },
    { label: 'Premios listos', value: walletReady ? premiosListos : '—' },
  ];

  return <Screen title="Perfil" tabs>
    <View style={profileStyles.hero}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil"
        onPress={() => router.push({ pathname: '/profile-edit', params: { field: 'photo' } })}
        style={({ pressed }) => [profileStyles.avatarRing, pressed && styles.dim]}>
        <Avatar uri={account.foto_perfil}
          initials={`${account.nombre.charAt(0)}${account.apellido.charAt(0)}`} size={76} />
        <View style={profileStyles.camera}>
          <MaterialIcons name="photo-camera" size={15} color={colors.onMint} />
        </View>
      </Pressable>
      <Text accessibilityRole="header" style={profileStyles.name}>
        {account.nombre} {account.apellido}
      </Text>
      <View style={profileStyles.metrics}>
        {metrics.map(({ label, value }) => <View key={label} style={profileStyles.metric}>
          <Text style={profileStyles.metricValue}>{value}</Text>
          <Text style={profileStyles.metricLabel}>{label}</Text>
        </View>)}
      </View>
      <Text style={profileStyles.member}>
        Miembro desde {memberSince(account.fecha_registro)} · ID #{memberId(account)}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/profile-edit')}
        style={({ pressed }) => [profileStyles.edit, pressed && styles.dim]}>
        <MaterialIcons name="edit" size={18} color={colors.mint} />
        <Text style={profileStyles.editText}>Editar perfil</Text>
      </Pressable>
    </View>

    {billetera.isError && <Notice title="No se pudieron cargar tus métricas"
      message="El perfil está disponible, pero la cartera no respondió."
      retry={() => void billetera.refetch()} />}

    <Card>
      <Heading>Datos de contacto</Heading>
      <ProfileContact icon="mail-outline" label="Correo electrónico"
        value={account.correo} field="email" editable={false} />
      <View style={profileStyles.divider} />
      <ProfileContact icon="phone" label="Teléfono"
        value={phoneLabel(account.telefono)} field="phone" editable />
    </Card>

    <Card>
      <Heading>Accesos rápidos</Heading>
      <ProfileAction icon="qr-code" label="Mi QR de miembro"
        detail="Muestra tu identificación de Benefy" onPress={() => setShowQr(true)} />
      <View style={profileStyles.divider} />
      <ProfileAction icon="history" label="Historial de movimientos"
        detail="Consulta tus visitas y puntos" onPress={() => router.push('/history')} />
    </Card>

    <Card>
      <ProfileAction icon="settings" label="Configuración"
        detail="Notificaciones y privacidad" onPress={() => router.push('/settings')} />
    </Card>

    <Card>
      <Heading>Cuenta</Heading>
      <ProfileAction icon="help-outline" label="Ayuda y soporte" onPress={() => router.push('/help')} />
      <View style={profileStyles.divider} />
      <ProfileAction icon="logout" label="Cerrar sesión" danger onPress={() => Alert.alert(
        'Cerrar sesión', '¿Quieres salir de Benefy?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar sesión', style: 'destructive', onPress: () => {
            void signOut().catch(() => Alert.alert('No se pudo cerrar sesión', 'Inténtalo de nuevo.'));
          } },
        ],
      )} />
      <Pressable accessibilityRole="button" onPress={() => Alert.alert('Eliminar cuenta',
        'Esta acción es permanente. Si eliminas tu cuenta, perderás tus puntos, visitas y cupones.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', style: 'destructive', onPress: () => router.push('/delete-account') },
        ])} style={({ pressed }) => [profileStyles.deleteLink, pressed && styles.dim]}>
        <Text style={profileStyles.danger}>Eliminar cuenta</Text>
      </Pressable>
    </Card>

    <Modal animationType="fade" transparent visible={showQr} onRequestClose={() => setShowQr(false)}>
      <View style={profileStyles.backdrop}>
        <View accessibilityViewIsModal style={profileStyles.qrPanel}>
          <Heading>Mi QR de miembro</Heading>
          <DisplayQr value={account.qr_token}
            label={`Código QR de miembro, ID ${memberId(account)}`} />
          <Copy>ID #{memberId(account)}</Copy>
          <Copy>Este código identifica tu cuenta Benefy. No compartas capturas con otras personas.</Copy>
          <Button label="Cerrar" onPress={() => setShowQr(false)} />
        </View>
      </View>
    </Modal>
  </Screen>;
}

function ProfileContact({ icon, label, value, field, editable }: {
  icon: 'mail-outline' | 'phone';
  label: string;
  value: string;
  field: 'email' | 'phone';
  editable: boolean;
}) {
  const { colors } = useBenefyTheme();
  const profileStyles = useProfileStyles();
  const styles = useUiStyles();
  return <Pressable accessibilityRole={editable ? 'button' : 'text'}
    accessibilityLabel={editable ? `Editar ${label}, ${value}` : `${label}, ${value}`}
    disabled={!editable}
    onPress={editable
      ? () => router.push({ pathname: '/profile-edit', params: { field } })
      : undefined}
    style={({ pressed }) => [profileStyles.contact, pressed && styles.dim]}>
    <View style={profileStyles.icon}>
      <MaterialIcons name={icon} size={20} color={colors.green} />
    </View>
    <View style={styles.flex}>
      <View style={profileStyles.contactLabels}>
        <Copy>{label}</Copy>
        {!editable && <View style={profileStyles.verified}>
          <MaterialIcons name="lock-outline" size={14} color={colors.muted} />
          <Text style={profileStyles.readOnlyText}>Solo lectura</Text>
        </View>}
      </View>
      <Text style={profileStyles.rowLabel}>{value}</Text>
    </View>
    {editable && <MaterialIcons name="chevron-right" size={22} color={colors.muted} />}
  </Pressable>;
}

function ProfileAction({ icon, label, detail, onPress, danger }: {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useBenefyTheme();
  const profileStyles = useProfileStyles();
  const styles = useUiStyles();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [profileStyles.contact, pressed && styles.dim]}>
    <View style={profileStyles.icon}>
      <MaterialIcons name={icon} size={21} color={danger ? colors.dangerText : colors.green} />
    </View>
    <View style={styles.flex}>
      <Text style={[profileStyles.rowLabel, danger && profileStyles.danger]}>{label}</Text>
      {detail && <Copy>{detail}</Copy>}
    </View>
    <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
  </Pressable>;
}

function Avatar({ uri, initials, size = 64 }: { uri: string | null; initials: string; size?: number }) {
  const profileStyles = useProfileStyles();
  const style = { width: size, height: size, borderRadius: size / 2 };
  return uri ? <Image source={{ uri }} style={style} /> :
    <View style={[profileStyles.avatar, style]}>
      <Text style={profileStyles.initials}>{initials.trim().toUpperCase() || 'B'}</Text>
    </View>;
}

const useProfileStyles = createThemedStyles(colors => StyleSheet.create({
  hero: { alignItems: 'center', gap: 12, padding: 22, borderRadius: 20, backgroundColor: colors.brand },
  avatarRing: { borderRadius: 44, borderWidth: 1, borderColor: colors.mint, padding: 5 },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 27, height: 27, borderRadius: 14, borderWidth: 2,
    borderColor: colors.brand, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  initials: { color: colors.onMint, fontSize: 24, fontWeight: '800' },
  name: { color: colors.onBrand, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: colors.mint },
  editText: { color: colors.mint, fontWeight: '700' },
  metrics: { alignSelf: 'stretch', flexDirection: 'row', gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#31516D' },
  metric: { flex: 1, alignItems: 'center', gap: 3 },
  metricValue: { color: colors.onBrand, fontSize: 22, fontWeight: '800' },
  metricLabel: { color: colors.mint, textAlign: 'center', fontSize: 12 },
  member: { color: colors.onBrand, fontSize: 12, textAlign: 'center' },
  rowLabel: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5, minHeight: 48 },
  contactLabels: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.subtle, borderRadius: 10, paddingHorizontal: 5 },
  readOnlyText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.subtle },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  danger: { color: colors.dangerText },
  deleteLink: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.backdrop },
  qrPanel: { backgroundColor: colors.panel, alignItems: 'center', borderRadius: 20, padding: 20, gap: 10 },
}));

const fields = [
  { name: 'nombre', label: 'Nombre' },
  { name: 'apellido', label: 'Apellido' },
  { name: 'telefono', label: 'Teléfono' },
] as const;
type Field = typeof fields[number]['name'];
type Draft = Record<Field, string>;

export function ProfileEditScreen() {
  const perfil = usePerfilQuery();
  if (perfil.isLoading) return <Screen title="Editar perfil"><Skeleton /></Screen>;
  if (perfil.isError || !perfil.data) {
    return <Screen title="Editar perfil">
      <Notice title="No se pudo cargar el perfil" retry={() => void perfil.refetch()} />
    </Screen>;
  }
  return <ProfileEditForm perfil={perfil.data} />;
}

function ProfileEditForm({ perfil }: { perfil: Perfil }) {
  const { dark } = useBenefyTheme();
  const profileStyles = useProfileStyles();
  const editStyles = useEditStyles();
  const styles = useUiStyles();
  const navigation = useNavigation();
  const { user } = useAuth();
  const mutation = useActualizarPerfilMutation();
  const { field } = useLocalSearchParams<{ field?: string }>();
  const selectedField = fields.find(item => item.name === field);
  const photoOnly = field === 'photo';
  const visibleFields = photoOnly ? [] : selectedField ? [selectedField] : fields;
  const [draft, setDraft] = useState<Draft>({
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    telefono: perfil.telefono ?? '',
  });
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [localPhotoType, setLocalPhotoType] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const inputs = useRef<Partial<Record<Field, ComponentRef<typeof TextInput> | null>>>({});
  const photo = localPhoto || (removePhoto ? '' : perfil.foto_perfil || '');
  const changed = fields.some(({ name }) => draft[name] !== (perfil[name] ?? ''))
    || localPhoto !== null
    || removePhoto;

  usePreventRemove(changed, ({ data }) => {
    Alert.alert('Tienes cambios pendientes', '¿Qué quieres hacer con los cambios?', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar cambios', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const pickPhoto = async () => {
    setNotice('');
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) {
        setLocalPhoto(result.assets[0].uri);
        setLocalPhotoType(result.assets[0].mimeType ?? null);
        setRemovePhoto(false);
      }
    } catch {
      setNotice('No se pudo abrir la galería.');
    }
  };

  const save = async () => {
    const nextErrors: typeof errors = {};
    if (!draft.nombre.trim()) nextErrors.nombre = 'Escribe tu nombre.';
    if (!draft.apellido.trim()) nextErrors.apellido = 'Escribe tu apellido.';
    const digits = draft.telefono.replace(/\D/g, '').length;
    if (draft.telefono.trim() && (digits < 7 || digits > 15)) {
      nextErrors.telefono = 'Escribe un número de 7 a 15 dígitos.';
    }
    setErrors(nextErrors);
    const first = visibleFields.find(({ name }) => nextErrors[name]);
    if (first) {
      inputs.current[first.name]?.focus();
      return;
    }
    if (!user) {
      setNotice('Tu sesión no está disponible. Vuelve a iniciar sesión.');
      return;
    }

    setSaving(true);
    setNotice('');
    try {
      let photoUrl = perfil.foto_perfil || '';
      if (localPhoto) {
        const uploaded = await uploadAvatar(localPhoto, user.id, localPhotoType);
        photoUrl = uploaded.url;
      } else if (removePhoto) {
        photoUrl = '';
      }
      const actualizado = await mutation.mutateAsync({
        nombre: draft.nombre.trim(),
        apellido: draft.apellido.trim(),
        telefono: draft.telefono.trim(),
        foto_perfil: photoUrl,
      });
      if (localPhoto && perfil.foto_perfil && perfil.foto_perfil !== photoUrl) {
        void removeAvatarUrl(perfil.foto_perfil, user.id);
      }
      setDraft({
        nombre: actualizado.nombre,
        apellido: actualizado.apellido,
        telefono: actualizado.telefono ?? '',
      });
      setLocalPhoto(null);
      setLocalPhotoType(null);
      setRemovePhoto(false);
      setNotice('Cambios guardados.');
    } catch (error) {
      setNotice(error instanceof ApiError || error instanceof Error
        ? error.message
        : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return <Screen title={photoOnly ? 'Foto de perfil' : selectedField ? `Editar ${selectedField.label.toLowerCase()}` : 'Editar perfil'}>
    {!selectedField && <View style={editStyles.photo}>
      <Avatar uri={photo} initials={`${draft.nombre.charAt(0)}${draft.apellido.charAt(0)}`} size={76} />
      <View style={editStyles.photoActions}>
        <Button label="Cambiar foto" icon="photo-camera" kind="quiet" onPress={() => void pickPhoto()} />
        {(photo !== '' || localPhoto) && <Button label="Quitar foto" kind="quiet"
          onPress={() => { setLocalPhoto(null); setLocalPhotoType(null); setRemovePhoto(true); }} />}
      </View>
    </View>}
    {visibleFields.length > 0 && <Card>
      {!selectedField && <Heading>Datos personales</Heading>}
      {visibleFields.map(({ name, label }) => <View key={name} style={editStyles.fieldGroup}>
        <Text style={profileStyles.rowLabel}>{label}</Text>
        <TextInput ref={node => { inputs.current[name] = node; }} accessibilityLabel={label}
          style={[styles.field, editStyles.input, errors[name] && editStyles.invalid]}
          value={draft[name]}
          keyboardType={name === 'telefono' ? 'phone-pad' : 'default'}
          autoCapitalize={name === 'telefono' ? 'none' : 'words'}
          autoFocus={name === selectedField?.name}
          keyboardAppearance={dark ? 'dark' : 'light'}
          onChangeText={text => setDraft(previous => ({ ...previous, [name]: text }))} />
        {errors[name] && <Text accessibilityRole="alert" style={styles.error}>{errors[name]}</Text>}
      </View>)}
    </Card>}
    <Card>
      <Heading>Correo electrónico</Heading>
      <Copy>{perfil.correo}</Copy>
      <Copy>El correo es la identidad de tu cuenta y no se puede cambiar desde la app.</Copy>
    </Card>
    {notice !== '' && <Text accessibilityRole="alert"
      style={notice === 'Cambios guardados.' ? editStyles.success : styles.error}>{notice}</Text>}
    <Button label={saving ? 'Guardando…' : 'Guardar cambios'} onPress={() => void save()}
      disabled={!changed || saving} />
  </Screen>;
}

const useEditStyles = createThemedStyles(colors => StyleSheet.create({
  photo: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.brand },
  photoActions: { flex: 1, gap: 6 },
  fieldGroup: { gap: 5, paddingVertical: 4 },
  input: { paddingHorizontal: 12, fontSize: 16 },
  invalid: { borderColor: colors.dangerText },
  success: { color: colors.green, fontSize: 14, fontWeight: '700' },
}));

export function SettingsScreen() {
  const profileStyles = useProfileStyles();
  const { preference, setPreference } = useBenefyTheme();
  return <Screen title="Configuración">
    <Card>
      <Heading>Apariencia</Heading>
      <Choice values={themePreferences} value={preference} onChange={setPreference} />
    </Card>
    <Card>
      <Heading>Preferencias</Heading>
      <ProfileAction icon="notifications-none" label="Notificaciones" onPress={() => router.push('/notification-settings')} />
      <View style={profileStyles.divider} />
      <ProfileAction icon="lock-outline" label="Privacidad" onPress={() => router.push('/privacy')} />
    </Card>
    <Card>
      <Heading>Información de la app</Heading>
      <ProfileAction icon="description" label="Documentos legales" onPress={() => router.push('/legal')} />
      <View style={profileStyles.divider} />
      <ProfileAction icon="info-outline" label="Acerca de" detail={`Versión ${version}`} onPress={() => router.push('/about')} />
    </Card>
  </Screen>;
}

export function HelpScreen() {
  return <Screen title="Ayuda y soporte">
    <Card><Heading>Registrar una visita</Heading>
      <Copy>Abre el escáner y apunta al código QR del comercio participante.</Copy>
      <Button label="Ir al escáner" icon="qr-code-scanner" onPress={() => router.navigate('/register')} />
    </Card>
    <Card><Heading>Consultar tus movimientos</Heading>
      <Copy>Revisa el historial para ver tus visitas, puntos y canjes.</Copy>
      <Button label="Ver historial" icon="history" onPress={() => router.push('/history')} />
    </Card>
  </Screen>;
}

export function AboutScreen() {
  return <Screen title="Acerca de"><Card><Heading>Benefy</Heading><Copy>Versión {version}</Copy></Card></Screen>;
}

export function NotificationSettingsScreen() {
  const { colors } = useBenefyTheme();
  const styles = useUiStyles();
  const [permission, setPermission] = useState<NotificationPermission>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const {
    preferences, notificationPrompted, togglePreference, markNotificationPrompted,
  } = usePreferences();
  const refresh = useCallback(async () => {
    setError('');
    try {
      setPermission(await notificationPermission());
    } catch {
      setError('No se pudo consultar el permiso de notificaciones.');
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => listener.remove();
  }, [refresh]));

  const request = async () => {
    markNotificationPrompted();
    setPending(true);
    setError('');
    try {
      setPermission(await notificationPermission(true));
    } catch {
      setError('No se pudo solicitar el permiso de notificaciones.');
    } finally {
      setPending(false);
    }
  };
  const openSettings = () => void Linking.openSettings().catch(() => setError('No se pudieron abrir los ajustes.'));
  return <Screen title="Notificaciones del dispositivo">
    {!permission && !error && <Skeleton />}
    {error !== '' && <Notice title={error} retry={() => void refresh()} />}
    {permission === 'unavailable' && <Notice title="Permisos disponibles en Android y iOS" />}
    {permission && permission !== 'unavailable' && permission !== 'granted' && <Card>
      <Heading>Activa los avisos de Benefy</Heading>
      <Copy>Recibe avisos sobre tus visitas, metas, cupones, alianzas y promociones.</Copy>
      {permission === 'undetermined' && !notificationPrompted
        ? <Button label="Activar notificaciones" onPress={() => void request()} disabled={pending} />
        : <><Copy>Los avisos están desactivados. Puedes seguir usando Benefy y cambiar el permiso en los ajustes.</Copy>
          <Button label="Abrir ajustes" onPress={openSettings} /></>}
    </Card>}
    {permission && <Card>
      <Heading>Preferencias de avisos</Heading>
      {permission !== 'granted' && <Copy>Activa el permiso del sistema para cambiar las preferencias.</Copy>}
      {notificationTypes.map(key => <Row key={key}>
        <View style={styles.flex}><Copy>{key}</Copy></View>
        <Switch accessibilityLabel={key} disabled={permission !== 'granted'}
          value={preferences[key] ?? true}
          trackColor={{ false: colors.line, true: colors.green }}
          onValueChange={value => togglePreference(key, value)} />
      </Row>)}
      {permission === 'granted' && <Button label="Ajustes del sistema" kind="quiet" onPress={openSettings} />}
    </Card>}
  </Screen>;
}

export function PrivacyScreen() {
  return <Screen title="Privacidad">
    <Card><Heading>Tus datos</Heading>
      <Copy>Benefy usa tu perfil y tus registros de visitas, puntos y cupones para mostrarte tus beneficios. Solo ves los datos asociados a tu cuenta.</Copy>
      <Heading>Cámara</Heading><Copy>Se usa para leer códigos de comercios, sin guardar fotos ni video.</Copy>
      <Button label="Aviso de privacidad" kind="quiet" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
    </Card>
    <Button label="Eliminar cuenta" kind="danger" onPress={() => router.push('/delete-account')} />
  </Screen>;
}

const documents = ['Términos de uso', 'Aviso de privacidad'] as const;

async function loadDocument(url: string | undefined) {
  if (!url) throw new Error('Documento sin publicar');
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo descargar el documento');
  return response.text();
}
const loadTerms = () => loadDocument(process.env.EXPO_PUBLIC_TERMS_URL);
const loadPrivacy = () => loadDocument(process.env.EXPO_PUBLIC_PRIVACY_URL);

export function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const [selected, select] = useState<typeof documents[number]>(doc === 'privacy' ? documents[1] : documents[0]);
  const [terms, setTerms] = useState<{ data?: string; error: boolean; loading: boolean }>({ loading: true, error: false });
  const [privacy, setPrivacy] = useState<{ data?: string; error: boolean; loading: boolean }>({ loading: true, error: false });

  const fetchDocument = useCallback((kind: 'terms' | 'privacy') => {
    const setState = kind === 'terms' ? setTerms : setPrivacy;
    const loader = kind === 'terms' ? loadTerms : loadPrivacy;
    loader().then(
      data => setState({ data, loading: false, error: false }),
      () => setState({ loading: false, error: true }),
    );
  }, []);

  const reload = (kind: 'terms' | 'privacy') => {
    const setState = kind === 'terms' ? setTerms : setPrivacy;
    setState({ loading: true, error: false });
    fetchDocument(kind);
  };

  // Los documentos son estáticos de la instalación; se cargan una sola vez.
  useEffect(() => {
    fetchDocument('terms');
    fetchDocument('privacy');
  }, [fetchDocument]);

  const resource = selected === documents[0] ? terms : privacy;
  return <Screen title="Documentos legales">
    <Choice values={documents} value={selected} onChange={select} />
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el documento"
      message="Configura EXPO_PUBLIC_TERMS_URL y EXPO_PUBLIC_PRIVACY_URL con documentos públicos."
      retry={() => reload(selected === documents[0] ? 'terms' : 'privacy')} />}
    {resource.data && <Card><Heading>{selected}</Heading><Copy>{resource.data}</Copy></Card>}
  </Screen>;
}

export function DeleteAccountScreen() {
  const { dark } = useBenefyTheme();
  const styles = useUiStyles();
  const { deleteAccount } = useAuth();
  const phrase = 'Eliminar mi cuenta';
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmar = async () => {
    if (confirmation.trim().toLocaleLowerCase('es-MX') !== phrase.toLocaleLowerCase('es-MX')) return;
    setBusy(true);
    setError('');
    try {
      const resultado = await deleteAccount(phrase);
      Alert.alert(
        resultado.estado === 'completada' ? 'Cuenta eliminada' : 'Cuenta eliminada con limpieza pendiente',
        resultado.detalle,
        [{ text: 'Entendido' }],
      );
    } catch (err) {
      if (err instanceof ApiError) {
        const negocios = Array.isArray(err.datos?.negocios)
          ? err.datos?.negocios as { nombre?: string }[]
          : [];
        const detalle = negocios.length
          ? `${err.message} Negocios: ${negocios.map(item => item.nombre || 'Sin nombre').join(', ')}.`
          : err.message;
        setError(detalle);
      } else {
        setError('No se pudo eliminar la cuenta. Intenta de nuevo.');
      }
    } finally {
      setBusy(false);
    }
  };

  return <Screen title="Eliminar cuenta">
    <Card><Heading>Esta acción es permanente</Heading>
      <Copy>Perderás tus puntos, visitas y cupones asociados a la cuenta. La identidad de Supabase y tus avatares también se eliminan.</Copy>
      <Copy>Escribe «{phrase}» para confirmar.</Copy>
      <TextInput accessibilityLabel="Confirmación para eliminar cuenta" style={styles.field}
        value={confirmation} keyboardAppearance={dark ? 'dark' : 'light'}
        autoCapitalize="none" autoCorrect={false} editable={!busy}
        onChangeText={setConfirmation} />
      {error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Button label={busy ? 'Eliminando…' : phrase} kind="danger" disabled={busy
        || confirmation.trim().toLocaleLowerCase('es-MX') !== phrase.toLocaleLowerCase('es-MX')}
        onPress={() => void confirmar()} />
      <Button label="Cancelar" kind="quiet" onPress={() => router.back()} />
    </Card>
  </Screen>;
}
