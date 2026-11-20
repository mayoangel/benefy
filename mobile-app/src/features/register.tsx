import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { businessById, movements } from './preview';
import { BusinessMark } from './business';
import { Button, Card, Copy, Heading, Notice, Screen, Skeleton } from './ui';

export function RegisterScreen() {
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

  return <Screen title="Registrar visita" tabs>
    {!permission && !error && <Skeleton />}
    {error !== '' && <Notice title={error} retry={() => void allowCamera()} />}
    {permission && (!active || !permission.granted) && <Card>
      <Heading>Escanear código QR</Heading>
      <Copy>Benefy usa la cámara para leer el código del negocio. No guarda fotos ni video.</Copy>
      {!permission.granted && (permission.status === 'denied' || !permission.canAskAgain)
        ? <><Copy>Activa el permiso de cámara en los ajustes del dispositivo para registrar visitas.</Copy>
          <Button label="Abrir ajustes" onPress={() => void Linking.openSettings().catch(() => setError('No se pudieron abrir los ajustes.'))} /></>
        : <Button label={permission.granted ? 'Abrir cámara' : 'Permitir cámara'} onPress={() => void allowCamera()} />}
    </Card>}
    {active && permission?.granted && focused && <>
      <View style={cameraStyles.preview}>
        <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={result => scan(result.data)}
          onMountError={() => { setError('No se pudo abrir la cámara.'); setActive(false); }} />
        <View pointerEvents="none" style={cameraStyles.guide}><View style={cameraStyles.frame} /></View>
      </View>
      <Text style={cameraStyles.instruction}>Coloca el código dentro del recuadro</Text>
      <Button label="Cancelar" kind="quiet" onPress={() => setActive(false)} />
    </>}
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

const cameraStyles = StyleSheet.create({
  preview: { height: 360, borderRadius: 16, overflow: 'hidden', backgroundColor: '#002647' },
  guide: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  frame: { width: '68%', aspectRatio: 1, maxWidth: 260, borderColor: '#64F9BC', borderWidth: 3, borderRadius: 24 },
  instruction: { color: '#002647', fontSize: 16, textAlign: 'center', fontWeight: '700' },
});
