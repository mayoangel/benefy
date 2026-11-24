import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessMark } from '../components/BusinessMark';
import { DisplayQr } from '../components/DisplayQr';
import { DetailTicket } from '../components/DetailTicket';
import {
  useBilleteraQuery,
  useCanjearCuponMutation,
  useCuponesQuery,
  useHistorialQuery,
  useMarcarNotificacionMutation,
  useMarcarTodasNotificacionesMutation,
  useNotificacionesQuery,
} from './queries';
import type { Cupon } from '../lib/api';
import {
  cuponDisponible,
  estadoCupon,
  formatearFecha as formatDate,
  historialItems,
  nombreNegocio as businessName,
  negociosBilletera,
  type HistoryItem,
} from '../lib/loyalty';
import { Button, Card, Choice, Copy, Heading, Notice, Screen, Skeleton, useUiStyles } from './ui';

const puedeUsar = cuponDisponible;
const statusLabel = estadoCupon;

export function WalletScreen() {
  const { colors } = useBenefyTheme();
  const walletStyles = useWalletStyles();
  const styles = useUiStyles();
  const billetera = useBilleteraQuery();
  const cupones = useCuponesQuery();
  const [section, setSection] = useState<'Disponibles' | 'Historial'>('Disponibles');
  const [business, setBusiness] = useState('Todos');

  const businesses = useMemo(
    () => negociosBilletera(billetera.data?.saldos ?? [], billetera.data?.tarjetas ?? []),
    [billetera.data],
  );

  const allCoupons = cupones.data ?? [];
  const available = allCoupons.filter(puedeUsar);
  const past = allCoupons.filter(item => !puedeUsar(item));
  const group = section === 'Disponibles' ? available : past;
  const names = ['Todos', ...new Set([
    ...businesses.map(item => item.nombre),
    ...allCoupons.map(businessName),
  ])];
  const visible = group.filter(item => business === 'Todos' || businessName(item) === business);

  if (billetera.isLoading || cupones.isLoading) {
    return <Screen title="Mi cartera" tabs><Skeleton /></Screen>;
  }
  if (billetera.isError || cupones.isError) {
    return <Screen title="Mi cartera" tabs>
      <Notice title="No se pudo cargar tu cartera" retry={() => { void billetera.refetch(); void cupones.refetch(); }} />
    </Screen>;
  }

  return <Screen title="Mi cartera" subtitle="Benefy Club" tabs headerActions={<>
    <WalletShortcut icon="receipt-long" label="Historial de movimientos" onPress={() => router.push('/history')} />
    <WalletShortcut icon="notifications-none" label="Notificaciones" onPress={() => router.push('/notifications')} />
  </>} scroll={{
    refreshControl: <RefreshControl refreshing={billetera.isFetching || cupones.isFetching}
      onRefresh={() => { void billetera.refetch(); void cupones.refetch(); }}
      tintColor={colors.green} colors={[colors.green]} progressBackgroundColor={colors.panel} />,
  }}>
    <View style={walletStyles.spread}>
      <View style={styles.flex}>
        <Text style={walletStyles.eyebrow}>Monederos activos</Text>
        <Heading>Puntos acumulados</Heading>
      </View>
      <Copy>{businesses.length} comercios</Copy>
    </View>
    {businesses.length === 0 && <Copy>Tus monederos aparecerán cuando registres una visita o recibas un beneficio.</Copy>}
    {businesses.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={walletStyles.carousel}>
      {businesses.map(item => <View key={item.id} style={walletStyles.wallet}>
        <View style={walletStyles.inline}>
          <BusinessMark nombre={item.nombre} logoUrl={item.logo_url} size={40} />
          <View style={styles.flex}>
            <Text style={walletStyles.walletName}>{item.nombre}</Text>
            <Text style={walletStyles.walletCaption}>Benefy Club</Text>
          </View>
        </View>
        <Text style={walletStyles.walletPoints}>{item.puntos} <Text style={walletStyles.walletCaption}>puntos</Text></Text>
        {item.tarjeta && <View style={walletStyles.progress}>
          <View style={walletStyles.track}><View style={[walletStyles.fill, {
            width: `${Math.min(item.tarjeta.sellos_actuales / item.tarjeta.meta, 1) * 100}%`,
          }]} /></View>
          <View style={walletStyles.spread}>
            <Text style={walletStyles.walletCaption}>{item.tarjeta.sellos_actuales} de {item.tarjeta.meta} sellos</Text>
            <Text style={walletStyles.walletCaption}>
              {item.tarjeta.sellos_actuales >= item.tarjeta.meta ? 'Premio listo' : `Faltan ${item.tarjeta.meta - item.tarjeta.sellos_actuales}`}
            </Text>
          </View>
        </View>}
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver catálogo de ${item.nombre}`}
          onPress={() => router.push({ pathname: '/shop/[id]', params: { id: String(item.id) } })}
          style={({ pressed }) => [walletStyles.catalog, pressed && styles.dim]}>
          <MaterialIcons name="redeem" size={18} color={colors.onMint} />
          <Text style={[walletStyles.link, walletStyles.catalogText]}>Ver catálogo y canjear</Text>
        </Pressable>
      </View>)}
    </ScrollView>}

    <View style={walletStyles.banner}>
      <View style={walletStyles.bannerIcon}><MaterialIcons name="qr-code-scanner" size={24} color={colors.onMint} /></View>
      <View style={styles.flex}>
        <Heading>Canje en caja</Heading>
        <Copy>Abre el QR de un cupón disponible y muéstralo al personal del comercio.</Copy>
      </View>
    </View>

    <View style={walletStyles.segment}>
      {(['Disponibles', 'Historial'] as const).map(label => {
        const selected = section === label;
        const count = label === 'Disponibles' ? available.length : past.length;
        return <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected }}
          onPress={() => setSection(label)} style={({ pressed }) => [walletStyles.segmentItem, selected && walletStyles.segmentSelected, pressed && styles.dim]}>
          <MaterialIcons name={label === 'Disponibles' ? 'confirmation-number' : 'history'} size={18} color={selected ? colors.green : colors.muted} />
          <Text style={[walletStyles.segmentLabel, selected && walletStyles.link]}>{label} ({count})</Text>
        </Pressable>;
      })}
    </View>
    {group.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={walletStyles.filters}>
      {names.map(name => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: business === name }}
        onPress={() => setBusiness(name)} style={({ pressed }) => [walletStyles.chip, business === name && walletStyles.chipSelected, pressed && styles.dim]}>
        <Text style={[walletStyles.link, business === name && walletStyles.chipText]}>{name}</Text>
      </Pressable>)}
    </ScrollView>}
    {visible.length === 0 && <Notice title={section === 'Disponibles' ? 'No hay cupones disponibles' : 'No hay cupones en el historial'}
      message={business !== 'Todos' && group.length > 0 ? 'Selecciona otro comercio para ver más cupones.' : undefined} />}
    {visible.map(coupon => <WalletTicket key={coupon.uuid} coupon={coupon} />)}
  </Screen>;
}

function WalletShortcut({ icon, label, onPress }: { icon: 'receipt-long' | 'notifications-none'; label: string; onPress: () => void }) {
  const { colors } = useBenefyTheme();
  const walletStyles = useWalletStyles();
  const styles = useUiStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [walletStyles.shortcut, pressed && styles.dim]}>
    <MaterialIcons name={icon} size={22} color={colors.navy} />
  </Pressable>;
}

export function CouponsScreen() {
  const cupones = useCuponesQuery();
  if (cupones.isLoading) return <Screen title="Mis cupones"><Skeleton /></Screen>;
  if (cupones.isError) return <Screen title="Mis cupones">
    <Notice title="No se pudieron cargar tus cupones" retry={() => void cupones.refetch()} />
  </Screen>;
  const items = cupones.data ?? [];
  const disponibles = items.filter(puedeUsar);
  const historial = items.filter(item => !puedeUsar(item));
  return <Screen title="Mis cupones" subtitle="Disponibles e historial">
    {items.length === 0 && <Notice title="Aún no tienes cupones" message="Adquiere una recompensa desde el catálogo de un negocio." />}
    {disponibles.length > 0 && <Heading>Disponibles</Heading>}
    {disponibles.map(coupon => <WalletTicket key={coupon.uuid} coupon={coupon} />)}
    {historial.length > 0 && <Heading>Historial</Heading>}
    {historial.map(coupon => <WalletTicket key={coupon.uuid} coupon={coupon} />)}
    <Button label="Ir a mi cartera" kind="quiet" onPress={() => router.navigate('/wallet')} />
  </Screen>;
}

export function BusinessCouponsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const negocioId = Number(params.id);
  const cupones = useCuponesQuery();
  if (cupones.isLoading) return <Screen title="Cupones del negocio"><Skeleton /></Screen>;
  if (cupones.isError) return <Screen title="Cupones del negocio">
    <Notice title="No se pudieron cargar los cupones" retry={() => void cupones.refetch()} />
  </Screen>;
  const items = (cupones.data ?? []).filter(item => item.negocio === negocioId);
  const nombre = items[0]?.negocio_nombre;
  return <Screen title="Tus cupones" subtitle={nombre ?? undefined}>
    {items.length === 0 && <Notice title="Aún no tienes cupones de este negocio" />}
    {items.map(coupon => <WalletTicket key={coupon.uuid} coupon={coupon} />)}
  </Screen>;
}

function WalletTicket({ coupon }: { coupon: Cupon }) {
  const styles = useUiStyles();
  const walletStyles = useWalletStyles();
  const status = statusLabel(coupon);
  const available = status === 'Disponible';
  const detail = () => router.push({ pathname: '/coupon/[id]', params: { id: coupon.uuid } });
  return <View style={walletStyles.ticket}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver detalle de ${coupon.titulo_beneficio}`} onPress={detail}
      style={({ pressed }) => [walletStyles.ticketHead, pressed && styles.dim]}>
      <BusinessMark nombre={businessName(coupon)} logoUrl={coupon.negocio_logo_url} size={54} />
      <View style={styles.flex}>
        <View style={walletStyles.spread}>
          <Text style={walletStyles.link}>{businessName(coupon)}</Text>
          <Text style={[walletStyles.badge, available && walletStyles.badgeActive]}>{status}</Text>
        </View>
        <Heading>{coupon.titulo_beneficio}</Heading>
        <Copy>{coupon.descripcion_beneficio}</Copy>
        <Copy>{status === 'Vencido' ? 'Venció el' : 'Vigente hasta'} {formatDate(coupon.fecha_expiracion)}</Copy>
      </View>
    </Pressable>
    <View style={walletStyles.perforation}>
      <View style={walletStyles.dash} />
      <View style={[walletStyles.notch, walletStyles.notchStart]} />
      <View style={[walletStyles.notch, walletStyles.notchEnd]} />
    </View>
    <View style={walletStyles.ticketFoot}>
      <View style={styles.flex}>
        <Copy>{available ? 'Código de canje disponible' : 'Consulta el detalle del cupón'}</Copy>
      </View>
      <Button icon={available ? 'qr-code' : 'chevron-right'} label={available ? 'Mostrar QR' : 'Ver detalle'}
        kind={available ? 'primary' : 'quiet'}
        onPress={available ? () => router.push({ pathname: '/redeem/[id]', params: { id: coupon.uuid } }) : detail} />
    </View>
  </View>;
}

export function CouponScreen() {
  const { colors } = useBenefyTheme();
  const styles = useUiStyles();
  const walletStyles = useWalletStyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const cupones = useCuponesQuery();
  const coupon = cupones.data?.find(item => item.uuid === id);
  if (cupones.isLoading) return <Screen title="Detalle del cupón"><Skeleton /></Screen>;
  if (cupones.isError || !coupon) return <Screen title="Detalle del cupón">
    <Notice title="Este cupón ya no está disponible" retry={() => void cupones.refetch()} />
  </Screen>;
  const status = statusLabel(coupon);
  const available = status === 'Disponible';
  return <Screen title="Detalle del cupón" footer={available && <View style={{ paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line }}>
    <Button icon="qr-code" label="Preparar canje" onPress={() => router.push({ pathname: '/redeem/[id]', params: { id: coupon.uuid } })} />
  </View>}>
    <DetailTicket title={coupon.titulo_beneficio} subtitle={businessName(coupon)} status={status} available={available}>
      <View style={walletStyles.inline}>
        <BusinessMark nombre={businessName(coupon)} logoUrl={coupon.negocio_logo_url} size={44} />
        <View style={styles.flex}><Copy>{coupon.descripcion_beneficio}</Copy></View>
      </View>
      <View style={walletStyles.inline}>
        <MaterialIcons name="event" size={20} color={colors.green} />
        <View style={styles.flex}><Copy>Vigente hasta {formatDate(coupon.fecha_expiracion)}</Copy></View>
      </View>
      {coupon.condiciones_beneficio && <Copy>{coupon.condiciones_beneficio}</Copy>}
    </DetailTicket>
    <Card><Heading>Condiciones</Heading><Copy>Presenta el código en el comercio. El canje es de un solo uso y se valida en el servidor.</Copy></Card>
  </Screen>;
}

const qrSeconds = 60;

export function RedeemScreen() {
  const { colors } = useBenefyTheme();
  const styles = useUiStyles();
  const walletStyles = useWalletStyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const cupones = useCuponesQuery();
  const canjear = useCanjearCuponMutation();
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof canjear.mutateAsync>>>();
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(qrSeconds);
  const coupon = cupones.data?.find(item => item.uuid === id);
  const status = coupon ? statusLabel(coupon) : undefined;

  useEffect(() => {
    if (!resultado) return;
    const deadline = Date.now() + resultado.canje.duracion_segundos * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [resultado]);

  if (cupones.isLoading) return <Screen title="Canjear cupón"><Skeleton /></Screen>;
  if (cupones.isError || !coupon) return <Screen title="Canjear cupón">
    <Notice title="Este cupón ya no está disponible" retry={() => void cupones.refetch()} />
  </Screen>;

  const generar = () => {
    setError('');
    canjear.mutate(coupon.uuid, {
      onSuccess: data => { setResultado(data); setSeconds(data.canje.duracion_segundos); },
      onError: err => setError(err instanceof Error ? err.message : 'No se pudo iniciar el canje.'),
    });
  };

  if (resultado) {
    return <Screen title="Código de canje" subtitle={businessName(coupon)}>
      <View style={walletStyles.banner}>
        <View style={walletStyles.bannerIcon}><MaterialIcons name="info-outline" size={24} color={colors.onMint} /></View>
        <View style={styles.flex}><Heading>Muestra este QR al comercio</Heading>
          <Copy>El cupón ya fue reservado en el servidor. El personal verifica el código.</Copy></View>
      </View>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <DisplayQr value={resultado.canje.token_validacion} label="Código QR de canje" maxSize={240} />
        <Text style={{ color: seconds ? colors.green : colors.dangerText, fontSize: 20, fontWeight: '800' }}>
          {seconds ? `00:${String(seconds).padStart(2, '0')}` : 'Código vencido'}
        </Text>
        <Copy>{businessName(coupon)}</Copy>
        {seconds === 0 && <Button label="Volver a mi cartera" onPress={() => router.replace('/wallet')} />}
      </View>
    </Screen>;
  }

  return <Screen title="Canjear cupón" subtitle={businessName(coupon)}>
    <DetailTicket title={coupon.titulo_beneficio} subtitle={status || 'Cupón'} status={status || 'No disponible'}
      available={status === 'Disponible'}>
      <Copy>{coupon.descripcion_beneficio}</Copy>
      <Copy>Vigente hasta {formatDate(coupon.fecha_expiracion)}</Copy>
    </DetailTicket>
    {status === 'Disponible' ? <Card>
      <Heading>Validación en caja</Heading>
      <Copy>Al generar el código, el cupón quedará reservado y el personal del comercio podrá verificarlo. Solo se muestra una vez.</Copy>
      {error !== '' && <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text>}
      <Button label={canjear.isPending ? 'Generando…' : 'Generar código de canje'} icon="qr-code"
        disabled={canjear.isPending} onPress={generar} />
    </Card> : <Notice title={status === 'Canjeado' ? 'Este cupón ya fue utilizado' : 'Este cupón no está disponible'} />}
    <Button label="Ver en mi cartera" kind="quiet" onPress={() => router.navigate('/wallet')} />
  </Screen>;
}

export function HistoryScreen() {
  const styles = useUiStyles();
  const walletStyles = useWalletStyles();
  const history = useHistorialQuery();
  const [business, setBusiness] = useState('Todos');
  const [period, setPeriod] = useState<'Todo el periodo' | 'Hoy' | 'Últimos 7 días' | 'Últimos 30 días'>('Todo el periodo');
  const [selected, setSelected] = useState<HistoryItem>();
  const [now] = useState(() => Date.now());
  const allItems = history.data ? historialItems(history.data) : [];
  const names = ['Todos', ...new Set(allItems.map(item => item.business))];
  const since = period === 'Hoy'
    ? new Date(now).setHours(0, 0, 0, 0)
    : period === 'Últimos 7 días' ? now - 7 * 86400000
      : period === 'Últimos 30 días' ? now - 30 * 86400000 : 0;
  const items = allItems.filter(item => Date.parse(item.date) >= since && (business === 'Todos' || item.business === business));

  if (history.isLoading) return <Screen title="Historial de movimientos"><Skeleton /></Screen>;
  if (history.isError) return <Screen title="Historial de movimientos">
    <Notice title="No se pudo cargar el historial" retry={() => void history.refetch()} />
  </Screen>;

  return <Screen title="Historial de movimientos" scroll={{
    refreshControl: <RefreshControl refreshing={history.isFetching} onRefresh={() => void history.refetch()} />,
  }}>
    <Card>
      <Heading>Filtros</Heading>
      <Copy>Negocio</Copy><Choice values={names} value={business} onChange={setBusiness} />
      <Copy>Periodo</Copy><Choice values={['Todo el periodo', 'Hoy', 'Últimos 7 días', 'Últimos 30 días']} value={period} onChange={setPeriod} />
    </Card>
    {items.length === 0 && <Notice title="No hay movimientos para estos filtros" />}
    {items.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => setSelected(item)}
      style={({ pressed }) => [styles.card, walletStyles.inline, pressed && styles.dim]}>
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#F0F3F5', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name={item.icon} size={20} color="#006C4B" />
      </View>
      <View style={styles.flex}>
        <Text style={walletStyles.link}>{item.kind}</Text>
        <Copy>{item.business} · {formatDate(item.date)}</Copy>
        <Copy>{item.detail}</Copy>
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#626A71" />
    </Pressable>)}
    <Modal transparent visible={!!selected} animationType="slide" onRequestClose={() => setSelected(undefined)}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00182D99' }}>
        {selected && <View style={{ padding: 20, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#FFFFFF' }}>
          <Heading>{selected.kind}</Heading><Copy>{selected.detail}</Copy>
          <Copy>{selected.business} · {formatDate(selected.date)}</Copy>
          <Button label="Cerrar" onPress={() => setSelected(undefined)} />
        </View>}
      </SafeAreaView>
    </Modal>
  </Screen>;
}

export function DynamicsScreen() {
  const wallet = useBilleteraQuery();
  const styles = useUiStyles();
  if (wallet.isLoading) return <Screen title="Mis tarjetas"><Skeleton /></Screen>;
  if (wallet.isError) return <Screen title="Mis tarjetas">
    <Notice title="No se pudieron cargar tus tarjetas" retry={() => void wallet.refetch()} />
  </Screen>;
  const cards = wallet.data?.tarjetas ?? [];
  return <Screen title="Mis tarjetas" subtitle="Progreso real de sellos">
    {cards.length === 0 && <Notice title="No tienes tarjetas activas" message="Registra una visita en un comercio con tarjeta de sellos." />}
    {cards.map(card => <Card key={card.id}>
      <View style={styles.row}>
        <BusinessMark nombre={card.negocio_nombre || 'Comercio'} logoUrl={card.negocio_logo_url} size={40} />
        <View style={styles.flex}><Heading>{card.negocio_nombre || 'Comercio'}</Heading>
          <Copy>{card.recompensa_titulo || 'Recompensa de la tarjeta'}</Copy></View>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#E4E9EC', overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.min(card.sellos_actuales / card.meta, 1) * 100}%`, backgroundColor: '#006C4B' }} />
      </View>
      <Copy>{card.sellos_actuales} de {card.meta} sellos · {card.estado === 'en_curso' ? 'En curso' : card.estado}</Copy>
    </Card>)}
  </Screen>;
}

export function NotificationsScreen() {
  const styles = useUiStyles();
  const walletStyles = useWalletStyles();
  const notificaciones = useNotificacionesQuery();
  const marcar = useMarcarNotificacionMutation();
  const marcarTodas = useMarcarTodasNotificacionesMutation();
  const [filter, setFilter] = useState<'Todas' | 'No leídas'>('Todas');
  const items = notificaciones.data ?? [];
  const unread = items.filter(item => !item.leida);
  const group = filter === 'Todas' ? items : unread;

  if (notificaciones.isLoading) return <Screen title="Notificaciones"><Skeleton /></Screen>;
  if (notificaciones.isError) return <Screen title="Notificaciones">
    <Notice title="No se pudieron cargar las notificaciones" retry={() => void notificaciones.refetch()} />
  </Screen>;

  return <Screen title="Notificaciones" subtitle="Avisos de Benefy" scroll={{
    refreshControl: <RefreshControl refreshing={notificaciones.isFetching}
      onRefresh={() => void notificaciones.refetch()} tintColor="#006C4B" colors={['#006C4B']} />,
  }}>
    <View style={walletStyles.spread}>
      <Copy>{unread.length ? `${unread.length} sin leer` : 'Todo al día'}</Copy>
      <Button label="Marcar todo como leído" kind="quiet" disabled={!unread.length || marcarTodas.isPending}
        onPress={() => marcarTodas.mutate(unread.map(item => item.id))} />
    </View>
    <Choice values={['Todas', 'No leídas'] as const} value={filter} onChange={setFilter} />
    {group.length === 0 && <Notice title={filter === 'No leídas' ? 'No tienes avisos sin leer' : 'No tienes notificaciones'} />}
    {group.map(item => <Card key={item.id}>
      <View style={styles.row}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: item.leida ? '#F0F3F5' : '#64F9BC',
          alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={item.tipo === 'cupon' ? 'redeem' : 'notifications-none'} size={20} color="#002647" />
        </View>
        <View style={styles.flex}>
          <Text style={{ color: '#006C4B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{item.tipo}</Text>
          <Heading>{item.titulo}</Heading>
          <Copy>{item.cuerpo}</Copy>
          <Copy>{formatDate(item.fecha_envio)}</Copy>
        </View>
        {!item.leida && <Button label="Leída" kind="quiet" disabled={marcar.isPending}
          onPress={() => marcar.mutate(item.id)} />}
      </View>
    </Card>)}
  </Screen>;
}

const useWalletStyles = createThemedStyles(colors => StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  shortcut: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.green, fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  carousel: { gap: 12 },
  wallet: { width: 266, borderRadius: 20, backgroundColor: colors.brand, padding: 16, gap: 11 },
  walletName: { color: colors.onBrand, fontWeight: '800', fontSize: 16 },
  walletCaption: { color: colors.mint, fontWeight: '600', fontSize: 12 },
  walletPoints: { color: colors.onBrand, fontWeight: '800', fontSize: 32, fontVariant: ['tabular-nums'] },
  progress: { gap: 5 },
  track: { backgroundColor: '#31516D', height: 5, borderRadius: 4, overflow: 'hidden' },
  fill: { backgroundColor: colors.mint, height: '100%', borderRadius: 4 },
  catalogText: { color: colors.onMint },
  catalog: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, minHeight: 44,
    backgroundColor: colors.mint, borderRadius: 12, marginTop: 'auto' },
  link: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.subtle,
    borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 12 },
  bannerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.mint },
  segment: { flexDirection: 'row', backgroundColor: colors.subtle, borderRadius: 14, padding: 4, gap: 4 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, gap: 5, padding: 4, borderRadius: 11 },
  segmentSelected: { backgroundColor: colors.panel },
  segmentLabel: { color: colors.muted, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  filters: { gap: 6 },
  chip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 24, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.onPrimary },
  ticket: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  ticketHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  badge: { color: colors.muted, backgroundColor: colors.subtle, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11, fontWeight: '700' },
  badgeActive: { color: colors.onMint, backgroundColor: colors.mint },
  perforation: { justifyContent: 'center', height: 16, paddingHorizontal: 15 },
  dash: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line },
  notch: { position: 'absolute', top: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.background },
  notchStart: { left: -8 },
  notchEnd: { right: -8 },
  ticketFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 5, paddingBottom: 12 },
}));
