import { createThemedStyles, themePreferences, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useCallback, useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { Alert, AppState, Image, Linking, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { DisplayQr } from '../components/DisplayQr';
import { notificationPermission } from './notificationPermission';
import type { NotificationPermission } from './notificationPermission.types';
import { businesses, loadProfile, notificationTypes, profile, usePreview, useResource } from './preview';
import { Button, Card, Choice, Copy, Heading, Notice, Row, Screen, Skeleton, useUiStyles } from './ui';
import { version } from '../../package.json';

const memberId = 'BF-9021';
const metrics = [
  { label: 'Puntos totales', value: businesses.reduce((total, business) => total + business.points, 0) },
  { label: 'Comercios activos', value: businesses.length },
  { label: 'Premios listos', value: businesses.filter(business => business.goalCount > 0 && business.visits >= business.goalCount).length },
];

export function ProfileScreen() {
  const { colors } = useBenefyTheme();
  const profileStyles = useProfileStyles();
  const styles = useUiStyles();
  const resource = useResource(loadProfile);
  const session = usePreview();
  const [showQr, setShowQr] = useState(false);
  const account = resource.data;
  return <Screen title="Perfil" tabs>
    {resource.loading && !account && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el perfil" retry={resource.refresh} />}
    {account && <>
      <View style={profileStyles.hero}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil"
          onPress={() => router.push({ pathname: '/profile-edit', params: { field: 'photo' } })}
          style={({ pressed }) => [profileStyles.avatarRing, pressed && styles.dim]}>
          <Avatar uri={account.photo} initials={`${account.firstName.charAt(0)}${account.lastName.charAt(0)}`} size={76} />
          <View style={profileStyles.camera}><MaterialIcons name="photo-camera" size={15} color={colors.onMint} /></View>
        </Pressable>
        <Text accessibilityRole="header" style={profileStyles.name}>{account.firstName} {account.lastName}</Text>
        <View style={profileStyles.metrics}>
          {metrics.map(({ label, value }) => <View key={label} style={profileStyles.metric}>
            <Text style={profileStyles.metricValue}>{value}</Text>
            <Text style={profileStyles.metricLabel}>{label}</Text>
          </View>)}
        </View>
        <Text style={profileStyles.member}>Miembro desde marzo 2026 · ID #{memberId}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile-edit')}
          style={({ pressed }) => [profileStyles.edit, pressed && styles.dim]}>
          <MaterialIcons name="edit" size={18} color={colors.mint} />
          <Text style={profileStyles.editText}>Editar perfil</Text>
        </Pressable>
      </View>

      <Card>
        <Heading>Datos de contacto</Heading>
        <ProfileContact icon="mail-outline" label="Correo electrónico" value={account.email} field="email" />
        <View style={profileStyles.divider} />
        <ProfileContact icon="phone" label="Teléfono" value={account.phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '+52 $1 $2 $3')} field="phone" />
      </Card>

      <Card>
        <Heading>Accesos rápidos</Heading>
        <ProfileAction icon="qr-code" label="Mi QR de miembro" detail="Muestra tu identificación de Benefy" onPress={() => setShowQr(true)} />
        <View style={profileStyles.divider} />
        <ProfileAction icon="history" label="Historial de movimientos" detail="Consulta tus visitas y puntos" onPress={() => router.push('/history')} />
      </Card>

      <Card><ProfileAction icon="settings" label="Configuración" detail="Notificaciones y privacidad" onPress={() => router.push('/settings')} /></Card>

      <Card>
        <Heading>Cuenta</Heading>
        <ProfileAction icon="help-outline" label="Ayuda y soporte" onPress={() => router.push('/help')} />
        <View style={profileStyles.divider} />
        <ProfileAction icon="logout" label="Cerrar sesión" danger onPress={() => Alert.alert('Cerrar sesión', '¿Quieres salir de Benefy?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar sesión', style: 'destructive', onPress: () => { session.setSignedIn(false); router.replace('/welcome'); } },
        ])} />
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
            <DisplayQr value={`benefy-demo-member:${memberId}`} label={`Código QR de demostración, ID ${memberId}`} />
            <Copy>ID #{memberId} · Demostración</Copy>
            <Button label="Cerrar" onPress={() => setShowQr(false)} />
          </View>
        </View>
      </Modal>
    </>}
  </Screen>;
}

function ProfileContact({ icon, label, value, field }: {
  icon: 'mail-outline' | 'phone'; label: string; value: string; field: 'email' | 'phone';
}) {
  const { colors } = useBenefyTheme();
  const profileStyles = useProfileStyles();
  const styles = useUiStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${label}, ${value}, verificado`}
    onPress={() => router.push({ pathname: '/profile-edit', params: { field } })}
    style={({ pressed }) => [profileStyles.contact, pressed && styles.dim]}>
    <View style={profileStyles.icon}><MaterialIcons name={icon} size={20} color={colors.green} /></View>
    <View style={styles.flex}>
      <View style={profileStyles.contactLabels}>
        <Copy>{label}</Copy>
        <View style={profileStyles.verified}>
          <MaterialIcons name="check-circle" size={14} color={colors.green} />
          <Text style={profileStyles.verifiedText}>Verificado</Text>
        </View>
      </View>
      <Text style={profileStyles.rowLabel}>{value}</Text>
    </View>
    <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
  </Pressable>;
}

function ProfileAction({ icon, label, detail, onPress, danger }: {
  icon: ComponentProps<typeof MaterialIcons>['name']; label: string; detail?: string; onPress: () => void; danger?: boolean;
}) {
  const { colors } = useBenefyTheme();
  const profileStyles = useProfileStyles();
  const styles = useUiStyles();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [profileStyles.contact, pressed && styles.dim]}>
    <View style={profileStyles.icon}><MaterialIcons name={icon} size={21} color={danger ? colors.dangerText : colors.green} /></View>
    <View style={styles.flex}>
      <Text style={[profileStyles.rowLabel, danger && profileStyles.danger]}>{label}</Text>
      {detail && <Copy>{detail}</Copy>}
    </View>
    <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
  </Pressable>;
}

function Avatar({ uri, initials, size = 64 }: { uri: string; initials: string; size?: number }) {
  const profileStyles = useProfileStyles();
  const style = { width: size, height: size, borderRadius: size / 2 };
  return uri ? <Image source={{ uri }} style={style} /> :
    <View style={[profileStyles.avatar, style]}>
      <Text style={profileStyles.initials}>{initials.toUpperCase()}</Text>
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
  verifiedText: { color: colors.green, fontSize: 11, fontWeight: '700' },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.subtle },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  danger: { color: colors.dangerText },
  deleteLink: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.backdrop },
  qrPanel: { backgroundColor: colors.panel, alignItems: 'center', borderRadius: 20, padding: 20, gap: 10 },
}));

const fields = [
  { name: 'firstName', label: 'Nombre' },
  { name: 'lastName', label: 'Apellido' },
  { name: 'phone', label: 'Teléfono' },
  { name: 'email', label: 'Correo electrónico' },
] as const;
type Field = typeof fields[number]['name'];

export function ProfileEditScreen() {
  const { dark } = useBenefyTheme();
  const profileStyles = useProfileStyles();
  const editStyles = useEditStyles();
  const styles = useUiStyles();
  const navigation = useNavigation();
  const { field } = useLocalSearchParams<{ field?: string }>();
  const selectedField = fields.find(item => item.name === field);
  const photoOnly = field === 'photo';
  const visibleFields = photoOnly ? [] : selectedField ? [selectedField] : fields;
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [notice, setNotice] = useState('');
  const inputs = useRef<Partial<Record<Field, ComponentRef<typeof TextInput> | null>>>({});
  const changed = fields.some(({ name }) => draft[name] !== profile[name]) || draft.photo !== profile.photo;
  usePreventRemove(changed, ({ data }) => {
    Alert.alert('Tienes cambios pendientes', '¿Qué quieres hacer con los cambios?', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar cambios', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const pickPhoto = async () => {
    setNotice('');
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled) setDraft(previous => ({ ...previous, photo: result.assets[0].uri }));
    } catch {
      setNotice('No se pudo abrir la galería.');
    }
  };

  const save = () => {
    const nextErrors: typeof errors = {};
    if (!draft.firstName.trim()) nextErrors.firstName = 'Escribe tu nombre.';
    if (!draft.lastName.trim()) nextErrors.lastName = 'Escribe tu apellido.';
    if (!/^\+?[\d ().-]+$/.test(draft.phone.trim()) || draft.phone.replace(/\D/g, '').length < 10 ||
      draft.phone.replace(/\D/g, '').length > 15) nextErrors.phone = 'Escribe un número de 10 a 15 dígitos.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) nextErrors.email = 'Escribe un correo electrónico válido.';
    setErrors(nextErrors);
    const first = visibleFields.find(({ name }) => nextErrors[name]);
    if (first) {
      inputs.current[first.name]?.focus();
      return;
    }
    setNotice('Para guardar tu perfil necesitas una sesión conectada al servidor.');
  };

  return <Screen title={photoOnly ? 'Foto de perfil' : selectedField ? `Editar ${selectedField.label.toLowerCase()}` : 'Editar perfil'}>
    {!selectedField && <View style={editStyles.photo}>
      <Avatar uri={draft.photo} initials={`${draft.firstName.charAt(0)}${draft.lastName.charAt(0)}`} size={76} />
      <View style={editStyles.photoActions}>
        <Button label="Cambiar foto" icon="photo-camera" kind="quiet" onPress={() => void pickPhoto()} />
        {draft.photo !== '' && <Button label="Quitar foto" kind="quiet" onPress={() => setDraft({ ...draft, photo: '' })} />}
      </View>
    </View>}
    {visibleFields.length > 0 && <Card>
      {!selectedField && <Heading>Datos personales</Heading>}
      {visibleFields.map(({ name, label }) => <View key={name} style={editStyles.fieldGroup}>
        <Text style={profileStyles.rowLabel}>{label}</Text>
        <TextInput ref={node => { inputs.current[name] = node; }} accessibilityLabel={label}
          style={[styles.field, editStyles.input, errors[name] && editStyles.invalid]}
          value={draft[name]} keyboardType={name === 'phone' ? 'phone-pad' : name === 'email' ? 'email-address' : 'default'}
          autoCapitalize={name === 'email' ? 'none' : 'words'} autoFocus={name === selectedField?.name}
          keyboardAppearance={dark ? 'dark' : 'light'}
          onChangeText={text => setDraft(previous => ({ ...previous, [name]: text }))} />
        {errors[name] && <Text accessibilityRole="alert" style={styles.error}>{errors[name]}</Text>}
      </View>)}
    </Card>}
    {notice !== '' && <Text accessibilityRole="alert" style={styles.error}>{notice}</Text>}
    <Button label="Guardar cambios" onPress={save} disabled={!changed} />
  </Screen>;
}

const useEditStyles = createThemedStyles(colors => StyleSheet.create({
  photo: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.brand },
  photoActions: { flex: 1, gap: 6 },
  fieldGroup: { gap: 5, paddingVertical: 4 },
  input: { paddingHorizontal: 12, fontSize: 16 },
  invalid: { borderColor: colors.dangerText },
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
  const session = usePreview();
  const refresh = useCallback(async () => {
    setError('');
    try { setPermission(await notificationPermission()); }
    catch { setError('No se pudo consultar el permiso de notificaciones.'); }
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => listener.remove();
  }, [refresh]));

  const request = async () => {
    session.markNotificationPrompted();
    setPending(true);
    setError('');
    try { setPermission(await notificationPermission(true)); }
    catch { setError('No se pudo solicitar el permiso de notificaciones.'); }
    finally { setPending(false); }
  };
  const openSettings = () => void Linking.openSettings().catch(() => setError('No se pudieron abrir los ajustes.'));
  return <Screen title="Notificaciones del dispositivo">
    {!permission && !error && <Skeleton />}
    {error !== '' && <Notice title={error} retry={() => void refresh()} />}
    {permission === 'unavailable' && <Notice title="Permisos disponibles en Android y iOS" />}
    {permission && permission !== 'unavailable' && permission !== 'granted' && <Card>
      <Heading>Activa los avisos de Benefy</Heading>
      <Copy>Recibe avisos sobre tus visitas, metas, cupones, alianzas y promociones.</Copy>
      {permission === 'undetermined' && !session.notificationPrompted
        ? <Button label="Activar notificaciones" onPress={() => void request()} disabled={pending} />
        : <><Copy>Los avisos están desactivados. Puedes seguir usando Benefy y cambiar el permiso en los ajustes.</Copy>
          <Button label="Abrir ajustes" onPress={openSettings} /></>}
    </Card>}
    {permission && <Card>
      <Heading>Preferencias de avisos</Heading>
      {permission !== 'granted' && <Copy>Activa el permiso del sistema para cambiar las preferencias.</Copy>}
      {notificationTypes.map(key => <Row key={key}><View style={styles.flex}><Copy>{key}</Copy></View>
        <Switch accessibilityLabel={key} disabled={permission !== 'granted'} value={session.preferences[key] ?? true}
          trackColor={{ false: colors.line, true: colors.green }}
          onValueChange={value => session.togglePreference(key, value)} />
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
  const terms = useResource(loadTerms);
  const privacy = useResource(loadPrivacy);
  const resource = selected === documents[0] ? terms : privacy;
  return <Screen title="Documentos legales">
    <Choice values={documents} value={selected} onChange={select} />
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el documento" retry={resource.refresh} />}
    {resource.data && <Card><Heading>{selected}</Heading><Copy>{resource.data}</Copy></Card>}
  </Screen>;
}

export function DeleteAccountScreen() {
  const { dark } = useBenefyTheme();
  const styles = useUiStyles();
  const phrase = 'Eliminar mi cuenta';
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(false);
  return <Screen title="Eliminar cuenta">
    <Card><Heading>Esta acción es permanente</Heading>
      <Copy>Perderás tus puntos, visitas y cupones asociados a la cuenta.</Copy>
      <Copy>Escribe «{phrase}» para confirmar.</Copy>
      <TextInput accessibilityLabel="Confirmación para eliminar cuenta" style={styles.field} value={confirmation}
        keyboardAppearance={dark ? 'dark' : 'light'}
        onChangeText={setConfirmation} autoCorrect={false} />
      {error && <Text accessibilityRole="alert" style={styles.error}>La cuenta de demostración no está conectada al servidor. No se eliminó ninguna cuenta.</Text>}
      <Button label={phrase} kind="danger" disabled={confirmation.trim() !== phrase} onPress={() => setError(true)} />
      <Button label="Cancelar" kind="quiet" onPress={() => router.back()} />
    </Card>
  </Screen>;
}
