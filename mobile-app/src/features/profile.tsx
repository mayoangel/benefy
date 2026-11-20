import { router, useFocusEffect, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Alert, AppState, Image, Linking, Switch, Text, TextInput, View } from 'react-native';
import { notificationPermission } from './notificationPermission';
import type { NotificationPermission } from './notificationPermission.types';
import { loadProfile, notificationTypes, profile, usePreview, useResource } from './preview';
import { Button, Card, Choice, Copy, Heading, Notice, Row, Screen, Skeleton, styles } from './ui';
import { version } from '../../package.json';

export function ProfileScreen() {
  const resource = useResource(loadProfile);
  return <Screen title="Perfil" tabs>
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el perfil" retry={resource.refresh} />}
    {resource.data && <Card>
      <Row><Avatar uri={resource.data.photo} /><Heading>{resource.data.firstName} {resource.data.lastName}</Heading></Row>
      <Copy>Nombre · {resource.data.firstName}</Copy><Copy>Apellido · {resource.data.lastName}</Copy>
      <Copy>Correo · {resource.data.email}</Copy><Copy>Teléfono · {resource.data.phone}</Copy>
      <Button label="Editar perfil" onPress={() => router.push('/profile-edit')} />
      <Button label="Configuración" kind="quiet" onPress={() => router.push('/settings')} />
    </Card>}
  </Screen>;
}

function Avatar({ uri }: { uri: string }) {
  const style = { width: 64, height: 64, borderRadius: 32 };
  return uri ? <Image source={{ uri }} style={style} /> :
    <View style={{ ...style, alignItems: 'center', justifyContent: 'center', backgroundColor: '#64F9BC' }}>
      <Heading>AR</Heading>
    </View>;
}

const fields = [
  { name: 'firstName', label: 'Nombre' },
  { name: 'lastName', label: 'Apellido' },
  { name: 'phone', label: 'Teléfono' },
] as const;
type Field = typeof fields[number]['name'];

export function ProfileEditScreen() {
  const navigation = useNavigation();
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
    setErrors(nextErrors);
    const first = fields.find(({ name }) => nextErrors[name]);
    if (first) {
      inputs.current[first.name]?.focus();
      return;
    }
    setNotice('Para guardar tu perfil necesitas una sesión conectada al servidor.');
  };

  return <Screen title="Editar perfil">
    <Card><Avatar uri={draft.photo} /><Row>
      <Button label="Cambiar foto" kind="quiet" onPress={() => void pickPhoto()} />
      {draft.photo !== '' && <Button label="Quitar foto" kind="quiet" onPress={() => setDraft({ ...draft, photo: '' })} />}
    </Row></Card>
    <Card>
      {fields.map(({ name, label }) => <View key={name}>
        <Copy>{label}</Copy>
        <TextInput ref={node => { inputs.current[name] = node; }} accessibilityLabel={label} style={styles.field}
          value={draft[name]} keyboardType={name === 'phone' ? 'phone-pad' : 'default'}
          onChangeText={text => setDraft(previous => ({ ...previous, [name]: text }))} />
        {errors[name] && <Text accessibilityRole="alert" style={styles.error}>{errors[name]}</Text>}
      </View>)}
      <Copy>Correo electrónico</Copy>
      <TextInput accessibilityLabel="Correo electrónico, solo lectura" style={styles.field} value={draft.email} editable={false} />
      {notice !== '' && <Text accessibilityRole="alert" style={styles.error}>{notice}</Text>}
      <Button label="Guardar" onPress={save} disabled={!changed} />
    </Card>
  </Screen>;
}

export function SettingsScreen() {
  const session = usePreview();
  return <Screen title="Configuración">
    <Card>
      <Button label="Notificaciones" kind="quiet" onPress={() => router.push('/notification-settings')} />
      <Button label="Privacidad" kind="quiet" onPress={() => router.push('/privacy')} />
      <Button label="Documentos legales" kind="quiet" onPress={() => router.push('/legal')} />
      <Button label="Acerca de" kind="quiet" onPress={() => router.push('/about')} />
    </Card>
    <Button label="Cerrar sesión" kind="danger" onPress={() => Alert.alert('Cerrar sesión', '¿Quieres salir de Benefy?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => { session.setSignedIn(false); router.dismissAll(); router.replace('/welcome'); } },
    ])} />
  </Screen>;
}

export function AboutScreen() {
  return <Screen title="Acerca de"><Card><Heading>Benefy</Heading><Copy>Versión {version}</Copy></Card></Screen>;
}

export function NotificationSettingsScreen() {
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
  const phrase = 'Eliminar mi cuenta';
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(false);
  return <Screen title="Eliminar cuenta">
    <Card><Heading>Esta acción es permanente</Heading>
      <Copy>Perderás tus puntos, visitas y cupones asociados a la cuenta.</Copy>
      <Copy>Escribe «{phrase}» para confirmar.</Copy>
      <TextInput accessibilityLabel="Confirmación para eliminar cuenta" style={styles.field} value={confirmation}
        onChangeText={setConfirmation} autoCorrect={false} />
      {error && <Text accessibilityRole="alert" style={styles.error}>La cuenta de demostración no está conectada al servidor. No se eliminó ninguna cuenta.</Text>}
      <Button label={phrase} kind="danger" disabled={confirmation.trim() !== phrase} onPress={() => setError(true)} />
      <Button label="Cancelar" kind="quiet" onPress={() => router.back()} />
    </Card>
  </Screen>;
}
