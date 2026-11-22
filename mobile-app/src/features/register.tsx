import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { businessById, movements } from './preview';
import { BusinessMark } from './business';
import { Button, Card, Copy, Heading, Notice, Screen, Skeleton } from './ui';

export function RegisterScreen() {
  const { colors } = useBenefyTheme();
  const cameraStyles = useCameraStyles();
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const scanned = useRef(false);
  useFocusEffect(useCallback(() => {
    scanned.current = false;
    setFocused(true);
    const refresh = () => void refreshPermission().catch(() => setError('No se pudo consultar el permiso de cámara.'));
    refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      listener.remove();
      setFocused(false);
    };
  }, [refreshPermission]));

  const scan = (raw: string) => {
    if (scanned.current) return;
    scanned.current = true;
    setFocused(false);
    const text = raw.trim().toLowerCase();
    const parts = /^benefy-demo:(blend|fuerza|nutrimax)(?::(nuevo|vencido))?$/.exec(text);
    if (!parts || parts[2]?.toLowerCase() === 'vencido') {
      router.push({ pathname: '/scan/error', params: {
        reason: parts ? 'vencido' : text.startsWith('benefy-demo:') ? 'invalido' : 'ajeno',
      } });
      return;
    }
    router.push({ pathname: '/scan/confirm', params: { id: parts[1], join: parts[2] === 'nuevo' ? '1' : '0' } });
  };

  const allowCamera = async () => {
    setError('');
    try {
      if (permission?.granted || (await requestPermission()).granted) setActive(true);
    } catch {
      setError('No se pudo solicitar acceso a la cámara.');
    }
  };

  const scanning = active && permission?.granted && focused;
  const needsSettings = permission && !permission.granted && !permission.canAskAgain;

  return <Screen title="Registrar visita" tabs>
    {!permission && !error && <Skeleton />}
    {error !== '' && <Notice title={error} retry={() => void allowCamera()} />}
    {permission && <View style={cameraStyles.card}>
      <View style={[cameraStyles.preview, scanning && cameraStyles.livePreview]}>
        {scanning && <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={result => scan(result.data)}
          onMountError={() => { setError('No se pudo abrir la cámara.'); setActive(false); }} />}
        <View pointerEvents="none" style={cameraStyles.guide}>
          <View style={[cameraStyles.frame, scanning && cameraStyles.liveFrame]}>
            {!scanning && <MaterialIcons name="qr-code-scanner" size={48} color={colors.mint} />}
          </View>
        </View>
      </View>
      <View style={cameraStyles.controls}>
        <Text accessibilityRole="header" style={cameraStyles.instruction}>
          {scanning ? 'Coloca el QR dentro del recuadro' : 'Escanea el QR del negocio'}
        </Text>
        {needsSettings && <Copy>Activa el permiso de cámara en los ajustes del dispositivo para registrar tu visita.</Copy>}
        {scanning
          ? <Button label="Cerrar cámara" kind="quiet" onPress={() => setActive(false)} />
          : needsSettings
            ? <Button label="Abrir ajustes" icon="settings" onPress={() => void Linking.openSettings().catch(() => setError('No se pudieron abrir los ajustes.'))} />
            : <Button label={permission.granted ? 'Abrir cámara' : 'Permitir cámara'} icon="qr-code-scanner"
                onPress={() => void allowCamera()} />}
      </View>
    </View>}
    {permission && !scanning && <View style={cameraStyles.privacy}>
      <MaterialIcons name="lock-outline" size={16} color={colors.muted} />
      <Text style={cameraStyles.privacyText}>La cámara solo lee el QR. Benefy no guarda fotos ni videos.</Text>
    </View>}
  </Screen>;
}

export function ScanConfirmScreen() {
  const { id, join } = useLocalSearchParams<{ id: string; join?: string }>();
  const business = businessById(id);
  const [checkedAt] = useState(() => Date.now());
  const [error, setError] = useState(false);
  const recentlyRegistered = join !== '1' && movements.some(item =>
    item.business === id && item.kind === 'Visita registrada' && checkedAt - item.date < 5 * 60_000);
  return <Screen title="Confirmar registro">
    {business ? <Card>
      <BusinessMark business={business} size={72} />
      <Heading>{join === '1' ? `Unirte a ${business.name} y registrar tu primera visita` : `Registrar visita en ${business.name}`}</Heading>
      <Copy>{business.address} · Registro de una visita</Copy>
      {recentlyRegistered && <Copy>Ya registraste una visita en este negocio hace unos minutos.</Copy>}
      <Copy>La lectura del código por sí sola no acredita visitas ni puntos.</Copy>
      {error && <Copy>Conecta una sesión al servidor para confirmar el registro. Tu progreso sigue intacto.</Copy>}
      <Button label="Confirmar" disabled={recentlyRegistered} onPress={() => setError(true)} />
      <Button label="Cancelar" kind="quiet" onPress={() => router.navigate('/register')} />
    </Card> : <Notice title="No se reconoce el negocio de este código" />}
  </Screen>;
}

export function ScanResultScreen() {
  return <Screen title="Resultado del registro">
    <Notice title="Visita sin confirmar" message="Aquí aparecerán el progreso y los premios cuando el servidor confirme tu visita." />
    <Button label="Registrar otro" onPress={() => router.navigate('/register')} />
  </Screen>;
}

const errors: Record<string, string> = {
  vencido: 'Este código venció. Solicita un código vigente en el negocio.',
  invalido: 'El código está incompleto o contiene datos inválidos.',
  ajeno: 'El código no pertenece a un negocio de Benefy.',
};

export function ScanErrorScreen() {
  const { reason } = useLocalSearchParams<{ reason: string }>();
  return <Screen title="No se pudo leer el código">
    <Notice title="⚠ Código rechazado" message={errors[reason] ?? errors.invalido} />
    <Button label="Volver a escanear" onPress={() => router.navigate('/register')} />
  </Screen>;
}

const useCameraStyles = createThemedStyles(colors => StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.panel },
  preview: { height: 180, overflow: 'hidden', backgroundColor: colors.brand },
  livePreview: { height: 340 },
  guide: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  frame: { width: 106, aspectRatio: 1, borderColor: colors.mint, borderWidth: 2, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center' },
  liveFrame: { width: '68%', maxWidth: 260, borderWidth: 3 },
  controls: { padding: 16, gap: 12 },
  instruction: { color: colors.navy, fontSize: 19, textAlign: 'center', fontWeight: '800' },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  privacyText: { color: colors.muted, fontSize: 12, flexShrink: 1 },
}));
