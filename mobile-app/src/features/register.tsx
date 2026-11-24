import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import {
  ApiError,
  registrarVisita,
  resolverQr,
  type NegocioQr,
  type ResolverQrResultado,
  type VisitaResultado,
} from '../lib/api';
import { useScanSession } from './scanSession';
import { Button, Card, Copy, Heading, Notice, Screen, Skeleton } from './ui';

const UUID_QR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const scanErrors: Record<string, string> = {
  qr_invalido: 'El código no corresponde a un negocio o sucursal de Benefy.',
  negocio_inactivo: 'El negocio o la sucursal están inactivos. Pide un código vigente.',
  cuenta_inactiva: 'Tu cuenta está inactiva. Contacta al equipo de Benefy.',
  api_no_configurada: 'La conexión con Benefy no está configurada en esta instalación.',
  red: 'No se pudo conectar con Benefy. Revisa tu conexión e intenta de nuevo.',
  sin_sesion: 'Tu sesión no está disponible. Vuelve a iniciar sesión.',
};

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

function QrBusinessMark({ negocio, size = 64 }: { negocio: NegocioQr; size?: number }) {
  if (negocio.logo_url) {
    return <Image source={{ uri: negocio.logo_url }} style={{ width: size, height: size, borderRadius: 16 }} />;
  }
  return <View style={{
    width: size,
    height: size,
    borderRadius: 16,
    backgroundColor: '#E8F4EE',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <Text style={{ color: '#006c4b', fontSize: size * 0.38, fontWeight: '800' }}>
      {negocio.nombre.trim().slice(0, 1).toUpperCase() || 'B'}
    </Text>
  </View>;
}

export function RegisterScreen() {
  const { colors } = useBenefyTheme();
  const cameraStyles = useCameraStyles();
  const { session } = useAuth();
  const { clear } = useScanSession();
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const scanned = useRef(false);
  useFocusEffect(useCallback(() => {
    scanned.current = false;
    setFocused(true);
    clear();
    const refresh = () => void refreshPermission().catch(() => setError('No se pudo consultar el permiso de cámara.'));
    refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      listener.remove();
      setFocused(false);
    };
  }, [clear, refreshPermission]));

  const scan = (raw: string) => {
    if (scanned.current) return;
    scanned.current = true;
    setFocused(false);
    const text = raw.trim();
    if (!session?.access_token) {
      router.push({ pathname: '/scan/error', params: {
        codigo: 'sin_sesion',
        detalle: scanErrors.sin_sesion,
      } });
      return;
    }
    if (!UUID_QR.test(text)) {
      router.push({ pathname: '/scan/error', params: {
        codigo: 'qr_invalido',
        detalle: scanErrors.qr_invalido,
      } });
      return;
    }
    router.push({ pathname: '/scan/confirm', params: { qr: text.toLowerCase() } });
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
  const { qr } = useLocalSearchParams<{ qr?: string }>();
  const { session } = useAuth();
  const token = session?.access_token;
  const { setResolution, setResult } = useScanSession();
  const [resolution, setLocalResolution] = useState<ResolverQrResultado | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let active = true;
    if (!qr || !token) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setLoading(false);
        setError(qr ? scanErrors.sin_sesion : 'No se recibió un código QR válido.');
      });
      return () => { active = false; };
    }
    resolverQr(qr, token).then(
      respuesta => {
        if (!active) return;
        setLocalResolution(respuesta);
        setResolution(respuesta);
      },
      err => {
        if (!active) return;
        if (err instanceof ApiError && ['qr_invalido', 'negocio_inactivo', 'cuenta_inactiva'].includes(err.codigo ?? '')) {
          router.replace({ pathname: '/scan/error', params: {
            codigo: err.codigo ?? 'qr_invalido',
            detalle: err.message,
          } });
          return;
        }
        setError(mensajeError(err));
      },
    ).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [qr, token, setResolution, intento]);

  function reintentar() {
    setLoading(true);
    setError(null);
    setIntento(valor => valor + 1);
  }

  const confirmar = async () => {
    if (!qr || !session?.access_token || !resolution) return;
    setBusy(true);
    setError(null);
    try {
      const resultado: VisitaResultado = await registrarVisita(qr, session.access_token);
      setResult(resultado);
      router.replace('/scan/success');
    } catch (err) {
      if (err instanceof ApiError && ['qr_invalido', 'negocio_inactivo', 'cuenta_inactiva'].includes(err.codigo ?? '')) {
        router.replace({ pathname: '/scan/error', params: {
          codigo: err.codigo ?? 'qr_invalido',
          detalle: err.message,
        } });
        return;
      }
      setError(mensajeError(err));
    } finally {
      setBusy(false);
    }
  };

  return <Screen title="Confirmar registro">
    {loading && <Skeleton />}
    {!loading && error && <Notice title="No se pudo validar el código" message={error} retry={reintentar} />}
    {!loading && resolution && <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <QrBusinessMark negocio={resolution.negocio} />
        <View style={{ flex: 1 }}>
          <Heading>{resolution.negocio.nombre}</Heading>
          <Copy>{resolution.sucursal?.nombre ?? 'Negocio completo'}</Copy>
        </View>
      </View>
      <Copy>Registraremos una visita válida para hoy. El servidor verificará el límite diario y otorgará los puntos o sellos que correspondan.</Copy>
      <Button label={busy ? 'Registrando…' : 'Confirmar visita'} disabled={busy} onPress={() => void confirmar()} />
      <Button label="Cancelar" kind="quiet" onPress={() => router.back()} />
    </Card>}
  </Screen>;
}

export function ScanResultScreen() {
  const { resolution, result, clear } = useScanSession();
  if (!result) {
    return <Screen title="Resultado del registro">
      <Notice title="No hay una visita reciente" message="Escanea el QR del negocio para registrar tu visita." />
      <Button label="Volver al escáner" onPress={() => router.replace('/register')} />
    </Screen>;
  }
  const negocio = resolution?.negocio;
  return <Screen title={result.already_registered ? 'Visita ya registrada' : 'Visita registrada'}>
    <Card>
      <Heading>{result.already_registered ? 'Tu visita de hoy ya estaba registrada' : `¡Bienvenido a ${negocio?.nombre ?? 'tu negocio'}!`}</Heading>
      <Copy>{resolution?.sucursal?.nombre ?? negocio?.nombre ?? 'Benefy'}</Copy>
      {result.puntos_otorgados > 0
        ? <Heading>+{result.puntos_otorgados} puntos</Heading>
        : <Copy>No se otorgaron puntos adicionales en esta visita.</Copy>}
    </Card>
    {result.tarjetas.length > 0 && <Card>
      <Heading>Tarjetas de sellos</Heading>
      {result.tarjetas.map(tarjeta => <Copy key={`${tarjeta.ciclo}-${tarjeta.dinamica}`}>
        {tarjeta.completado
          ? `¡Completaste una tarjeta! ${tarjeta.sellos_actuales} de ${tarjeta.meta} sellos.`
          : `Avance: ${tarjeta.sellos_actuales} de ${tarjeta.meta} sellos.`}
      </Copy>)}
    </Card>}
    {result.cupones_emitidos.length > 0 && <Card>
      <Heading>Cupones desbloqueados</Heading>
      <Copy>Se emitieron {result.cupones_emitidos.length} cupón{result.cupones_emitidos.length === 1 ? '' : 'es'}.</Copy>
    </Card>}
    <Button label="Escanear otro negocio" icon="qr-code-scanner" onPress={() => {
      clear();
      router.replace('/register');
    }} />
    <Button label="Volver al inicio" kind="quiet" onPress={() => {
      clear();
      router.replace('/');
    }} />
  </Screen>;
}

export function ScanErrorScreen() {
  const { codigo, detalle } = useLocalSearchParams<{ codigo?: string; detalle?: string }>();
  const message = detalle || scanErrors[codigo ?? ''] || 'No se pudo registrar la visita.';
  return <Screen title="No se pudo leer el código">
    <Notice title="Código rechazado" message={message} />
    <Button label="Volver a escanear" onPress={() => router.replace('/register')} />
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
