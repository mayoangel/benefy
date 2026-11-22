import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DisplayQr } from '../components/DisplayQr';
import { DetailTicket } from '../components/DetailTicket';
import { BusinessMark } from './business';
import {
  businessById, businesses, couponStatus, formatDate, loadBusinesses, loadCoupons,
  loadMovements, loadNotifications, usePreview, useResource, type Coupon,
} from './preview';
import { Button, Card, Choice, Copy, Heading, Notice, Screen, Skeleton, useUiStyles } from './ui';

const businessNames = ['Todos', ...businesses.map(item => item.name)];
const matchesBusiness = (name: string, ...ids: (string | undefined)[]) =>
  name === 'Todos' || ids.some(id => businessById(id)?.name === name);

const walletTabs = [
  { label: 'Disponibles', icon: 'confirmation-number' },
  { label: 'Historial', icon: 'history' },
] as const;

export function WalletScreen() {
  const { colors } = useBenefyTheme();
  const walletStyles = useWalletStyles();
  const styles = useUiStyles();
  const [section, setSection] = useState<'Disponibles' | 'Historial'>('Disponibles');
  const [business, setBusiness] = useState('Todos');
  const coupons = useResource(loadCoupons);
  const cards = useResource(loadBusinesses);
  const allCoupons = coupons.data ?? [];
  const available = allCoupons.filter(item => couponStatus(item) === 'Disponible');
  const past = allCoupons.filter(item => couponStatus(item) !== 'Disponible');
  const active = section === 'Disponibles';
  const group = active ? available : past;
  const visible = group.filter(item => matchesBusiness(business, item.issuer, item.redeemAt));

  return <Screen title="Mi cartera" subtitle="Benefy Club" tabs headerActions={<>
    <WalletShortcut icon="receipt-long" label="Historial de movimientos" onPress={() => router.push('/history')} />
    <WalletShortcut icon="notifications-none" label="Notificaciones" onPress={() => router.push('/notifications')} />
  </>}>
    <View style={walletStyles.spread}>
      <View style={styles.flex}>
        <Text style={walletStyles.eyebrow}>Monederos activos</Text>
        <Heading>Puntos acumulados</Heading>
      </View>
      {!!cards.data && <Copy>{cards.data.length} comercios</Copy>}
    </View>
    {cards.loading && !cards.data && <Skeleton />}
    {cards.error && <Notice title="No se pudieron cargar los monederos" retry={cards.refresh} />}
    {cards.data?.length === 0 && <Copy>Tus monederos aparecerán cuando te registres en un comercio.</Copy>}
    {!!cards.data?.length && <ScrollView horizontal showsHorizontalScrollIndicator={false}
      snapToInterval={278} decelerationRate="fast" contentContainerStyle={walletStyles.carousel}>
      {cards.data.map(item => <View key={item.id} style={walletStyles.wallet}>
        <View style={walletStyles.inline}>
          <BusinessMark business={item} size={40} />
          <View style={styles.flex}>
            <Text style={walletStyles.walletName}>{item.name}</Text>
            <Text style={walletStyles.walletCaption}>{item.category}</Text>
          </View>
        </View>
        <Text style={walletStyles.walletPoints}>{item.points} <Text style={walletStyles.walletCaption}>puntos</Text></Text>
        {item.goalCount > 0 && <View style={walletStyles.progress}>
          <View style={walletStyles.track}><View style={[walletStyles.fill, { width: `${Math.min(item.visits / item.goalCount, 1) * 100}%` }]} /></View>
          <View style={walletStyles.spread}>
            <Text style={walletStyles.walletCaption}>{item.visits} de {item.goalCount} visitas</Text>
            <Text style={walletStyles.walletCaption}>{item.visits >= item.goalCount ? 'Premio listo' : `Faltan ${item.goalCount - item.visits}`}</Text>
          </View>
        </View>}
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver catálogo de ${item.name}`}
          onPress={() => router.push({ pathname: '/shop/[id]', params: { id: item.id } })}
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
      {walletTabs.map(({ label, icon }) => {
        const selected = section === label;
        const count = label === 'Disponibles' ? available.length : past.length;
        return <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setSection(label)}
          style={({ pressed }) => [walletStyles.segmentItem, selected && walletStyles.segmentSelected, pressed && styles.dim]}>
          <MaterialIcons name={icon} size={18} color={selected ? colors.green : colors.muted} />
          <Text style={[walletStyles.segmentLabel, selected && walletStyles.link]}>{label}{coupons.data ? ` (${count})` : ''}</Text>
        </Pressable>;
      })}
    </View>
    {!!group.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={walletStyles.filters}>
      {businessNames.map(name => {
        const selected = name === business;
        const count = group.filter(item => matchesBusiness(name, item.issuer, item.redeemAt)).length;
        return <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setBusiness(name)}
          style={({ pressed }) => [walletStyles.chip, selected && walletStyles.chipSelected, pressed && styles.dim]}>
          <Text style={[walletStyles.link, selected && walletStyles.chipText]}>{name} ({count})</Text>
        </Pressable>;
      })}
    </ScrollView>}
    {coupons.loading && !coupons.data && <Skeleton />}
    {coupons.error && <Notice title="No se pudieron cargar tus cupones" retry={coupons.refresh} />}
    {coupons.data && !visible.length && <Notice title={active ? 'No hay cupones disponibles' : 'No hay cupones en el historial'}
      message={business !== 'Todos' && group.length > 0 ? 'Selecciona otro comercio para ver más cupones.' : undefined} />}
    {visible.map(item => <WalletTicket key={item.id} coupon={item} />)}

    <Pressable accessibilityRole="button" onPress={() => router.push('/help')}
      style={({ pressed }) => [styles.card, walletStyles.inline, pressed && styles.dim]}>
      <MaterialIcons name="help-outline" size={24} color={colors.green} />
      <View style={styles.flex}><Heading>Ayuda con tus beneficios</Heading><Copy>Consulta cómo registrar tus visitas y revisar tus canjes.</Copy></View>
      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
    </Pressable>
  </Screen>;
}

function WalletShortcut({ icon, label, onPress }: { icon: 'receipt-long' | 'notifications-none' | 'help-outline'; label: string; onPress: () => void }) {
  const { colors } = useBenefyTheme();
  const walletStyles = useWalletStyles();
  const styles = useUiStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [walletStyles.shortcut, pressed && styles.dim]}>
    <MaterialIcons name={icon} size={22} color={colors.navy} />
  </Pressable>;
}

export function BusinessCouponsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const business = businessById(id);
  const resource = useResource(loadCoupons);
  const coupons = resource.data?.filter(item => item.issuer === id || item.redeemAt === id);
  return <Screen title="Tus cupones" subtitle={business?.name}>
    {!business && <Notice title="Este negocio ya no está disponible" />}
    {business && resource.loading && <Skeleton />}
    {business && resource.error && <Notice title="No se pudieron cargar los cupones" retry={resource.refresh} />}
    {business && !resource.error && coupons?.length === 0 && <Notice title="Todavía no tienes cupones de este negocio" />}
    {business && coupons?.map(coupon => <WalletTicket key={coupon.id} coupon={coupon} />)}
  </Screen>;
}

function WalletTicket({ coupon }: { coupon: Coupon }) {
  const walletStyles = useWalletStyles();
  const styles = useUiStyles();
  const issuer = businessById(coupon.issuer);
  const location = businessById(coupon.redeemAt);
  const status = couponStatus(coupon);
  const available = status === 'Disponible';
  const detail = () => router.push({ pathname: '/coupon/[id]', params: { id: coupon.id } });
  return <View style={walletStyles.ticket}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver detalle de ${coupon.title}`} onPress={detail}
      style={({ pressed }) => [walletStyles.ticketHead, pressed && styles.dim]}>
      {issuer && <BusinessMark business={issuer} size={54} />}
      <View style={styles.flex}>
        <View style={walletStyles.spread}>
          <Text style={walletStyles.link}>{issuer?.name}</Text>
          <Text style={[walletStyles.badge, available && walletStyles.badgeActive]}>{status}</Text>
        </View>
        <Heading>{coupon.title}</Heading>
        <Copy>{coupon.origin}</Copy>
        <Copy>{location?.name} · {location?.address}</Copy>
        <Copy>{status === 'Vencido' ? 'Venció el' : 'Vigente hasta'} {coupon.expiry}</Copy>
      </View>
    </Pressable>
    <View style={walletStyles.perforation}>
      <View style={walletStyles.dash} />
      <View style={[walletStyles.notch, walletStyles.notchStart]} />
      <View style={[walletStyles.notch, walletStyles.notchEnd]} />
    </View>
    <View style={walletStyles.ticketFoot}>
      <View style={styles.flex}>
        {available && <><Copy>Código de demostración</Copy><Text style={walletStyles.link}>{coupon.id.toUpperCase()}</Text></>}
      </View>
      <Button icon={available ? 'qr-code' : 'chevron-right'} label={available ? 'Mostrar QR' : 'Ver detalle'}
        kind={available ? 'primary' : 'quiet'}
        onPress={available ? () => router.push({ pathname: '/redeem/[id]', params: { id: coupon.id } }) : detail} />
    </View>
  </View>;
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


export function CouponScreen() {
  const { colors } = useBenefyTheme();
  const walletStyles = useWalletStyles();
  const couponDetail = useCouponDetail();
  const styles = useUiStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(loadCoupons);
  const coupon = resource.data?.find(item => item.id === id);
  const status = coupon && couponStatus(coupon);
  const location = businessById(coupon?.redeemAt);
  const issuer = businessById(coupon?.issuer);
  const available = status === 'Disponible';
  const alliance = coupon && coupon.issuer !== coupon.redeemAt;
  return <Screen title="Detalle del cupón" footer={coupon && available && <View style={couponDetail.footer}>
    <Button icon="qr-code" label="Canjear recompensa" onPress={() =>
      Alert.alert('Canjear recompensa', 'Muestra el código al personal del negocio para que lo valide.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => router.push({ pathname: '/redeem/[id]', params: { id: coupon.id } }) },
      ])} />
  </View>}>
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el cupón" retry={resource.refresh} />}
    {!resource.loading && !resource.error && !coupon && <Notice title="Este cupón ya no está disponible" />}
    {coupon && status && <>
      <DetailTicket title={coupon.title} subtitle={coupon.origin} status={status} available={available}>
          {location && <View style={walletStyles.inline}>
            <BusinessMark business={location} size={44} />
            <View style={styles.flex}>
              <Copy>Canjeable en</Copy>
              <Heading>{location.name}</Heading>
              <Copy>{location.address}</Copy>
            </View>
          </View>}
          <View style={walletStyles.inline}>
            <MaterialIcons name="event" size={20} color={colors.green} />
            <View style={styles.flex}><Copy>{status === 'Vencido' ? 'Venció el' : 'Vigente hasta'} {coupon.expiry}</Copy></View>
          </View>
          {alliance && issuer && <View style={walletStyles.inline}>
            <MaterialIcons name="handshake" size={20} color={colors.green} />
            <View style={styles.flex}><Copy>Cupón de alianza emitido por {issuer.name}</Copy></View>
          </View>}
      </DetailTicket>
      {coupon.allianceEnded && available && <Notice title="Alianza finalizada"
        message="Puedes usar tu cupón hasta la fecha indicada." />}
      <Card>
        <Heading>Condiciones de uso</Heading>
        <Copy>Presenta el código en la sucursal participante. El cupón es válido para un solo uso.</Copy>
      </Card>
    </>}
  </Screen>;
}

const useCouponDetail = createThemedStyles(colors => StyleSheet.create({
  footer: { backgroundColor: colors.panel, borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
}));

export function RedeemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(loadCoupons);
  const coupon = resource.data?.find(item => item.id === id);
  const status = coupon && couponStatus(coupon);
  return <Screen title="Canjear cupón" headerActions={
    <WalletShortcut icon="help-outline" label="Ayuda de canje" onPress={() => router.push('/help')} />
  }>
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo consultar el canje" retry={resource.refresh} />}
    {coupon && status === 'Disponible' && <RedemptionTicket key={coupon.id} coupon={coupon} />}
    {status && status !== 'Disponible' && <Notice title={status === 'Canjeado' ? 'Cupón ya utilizado' : 'Cupón vencido'} />}
    {!resource.loading && !resource.error && !coupon && <Notice title="Este cupón ya no está disponible" />}
    <Button label="Ver en mi cartera" kind="quiet" onPress={() => router.navigate('/wallet')} />
  </Screen>;
}

const qrDisplaySeconds = 60;
const newQrDeadline = () => Date.now() + qrDisplaySeconds * 1000;

function RedemptionTicket({ coupon }: { coupon: Coupon }) {
  const { colors } = useBenefyTheme();
  const walletStyles = useWalletStyles();
  const redeemStyles = useRedeemStyles();
  const styles = useUiStyles();
  const business = businessById(coupon.redeemAt);
  const { width } = useWindowDimensions();
  const [deadline, setDeadline] = useState(newQrDeadline);
  const [seconds, setSeconds] = useState(qrDisplaySeconds);
  const [expanded, setExpanded] = useState(false);
  const expired = seconds === 0;
  const qrValue = `benefy-demo-coupon:${encodeURIComponent(coupon.id)}`;
  const qrLabel = `Código QR de demostración de ${coupon.title}`;

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) clearInterval(timer);
    };
    const timer = setInterval(tick, 250);
    tick();
    return () => clearInterval(timer);
  }, [deadline]);

  return <>
    <View style={walletStyles.banner}>
      <View style={walletStyles.bannerIcon}><MaterialIcons name="info-outline" size={24} color={colors.onMint} /></View>
      <View style={styles.flex}>
        <Heading>Validación presencial en caja</Heading>
        <Copy>Muestra el QR al personal del comercio. Este código es de demostración.</Copy>
      </View>
    </View>

    <View style={walletStyles.ticket}>
      <View style={redeemStyles.ticketTop}>
        <View style={walletStyles.inline}>
          {business && <BusinessMark business={business} size={48} />}
          <View style={styles.flex}>
            <Text style={walletStyles.link}>{business?.name ?? 'Comercio participante'}</Text>
            {business && <Copy>{business.address}</Copy>}
          </View>
          <Text style={[walletStyles.badge, walletStyles.badgeActive]}>Disponible</Text>
        </View>
        <View style={redeemStyles.couponSummary}>
          <MaterialIcons name="confirmation-number" size={28} color={colors.mint} />
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={walletStyles.walletName}>{coupon.title}</Text>
            <Text style={walletStyles.walletCaption}>{coupon.origin} · Vigente hasta {coupon.expiry}</Text>
          </View>
        </View>
      </View>
      <View style={walletStyles.perforation}>
        <View style={walletStyles.dash} />
        <View style={[walletStyles.notch, walletStyles.notchStart]} />
        <View style={[walletStyles.notch, walletStyles.notchEnd]} />
      </View>
      <View style={redeemStyles.ticketBottom}>
        <View style={redeemStyles.timer}>
          <View style={walletStyles.spread}>
            <Text accessibilityLiveRegion="polite" style={walletStyles.eyebrow}>{expired ? 'Exhibición finalizada' : 'QR visible'}</Text>
            <View style={walletStyles.inline}>
              <MaterialIcons name="timer" size={19} color={colors.green} />
              <Text style={redeemStyles.clock}>{seconds === 60 ? '01:00' : `00:${String(seconds).padStart(2, '0')}`}</Text>
            </View>
          </View>
          <View style={redeemStyles.track}><View style={[redeemStyles.fill, { width: `${seconds / qrDisplaySeconds * 100}%` }]} /></View>
          <Copy>{expired ? 'Puedes volver a mostrar el QR. El cupón sigue disponible.' : 'Tiempo restante para mostrar el código'}</Copy>
        </View>
        {expired ? <Button label="Volver a mostrar QR" icon="refresh" onPress={() => {
          setExpanded(false);
          setSeconds(qrDisplaySeconds);
          setDeadline(newQrDeadline());
        }} /> : <>
          <DisplayQr value={qrValue} label={qrLabel} maxSize={Math.min(220, width - 68)} />
          <Text style={redeemStyles.code}>Código de demostración · {coupon.id.toUpperCase()}</Text>
          <Button label="Ampliar QR" icon="fullscreen" kind="quiet" onPress={() => setExpanded(true)} />
        </>}
      </View>
    </View>
    <Button label="Consultar validación con el cajero" icon="how-to-reg"
      onPress={() => Alert.alert('Validación no disponible', 'Se necesita una sesión conectada al servidor para confirmar el canje.')} />
    <Pressable accessibilityRole="button" onPress={() => router.push('/help')}
      style={({ pressed }) => [styles.card, walletStyles.inline, pressed && styles.dim]}>
      <MaterialIcons name="help-outline" size={24} color={colors.green} />
      <View style={styles.flex}><Heading>¿Problemas al validar en caja?</Heading><Copy>Consulta la ayuda de Benefy.</Copy></View>
      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
    </Pressable>
    <Modal transparent animationType="fade" visible={expanded && !expired} onRequestClose={() => setExpanded(false)}>
      <View style={redeemStyles.modal}>
        <View accessibilityViewIsModal style={redeemStyles.modalPanel}>
          <Heading>{coupon.title}</Heading>
          {expanded && !expired && <DisplayQr value={qrValue} label={qrLabel} maxSize={Math.min(320, width - 76)} />}
          <Copy>Código de demostración</Copy>
          <Button label="Cerrar" onPress={() => setExpanded(false)} />
        </View>
      </View>
    </Modal>
  </>;
}

const useRedeemStyles = createThemedStyles(colors => StyleSheet.create({
  ticketTop: { padding: 16, gap: 14 },
  couponSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brand, borderRadius: 14, padding: 14 },
  ticketBottom: { padding: 16, gap: 12 },
  timer: { backgroundColor: colors.subtle, borderRadius: 14, padding: 12, gap: 8 },
  clock: { color: colors.navy, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.green },
  code: { color: colors.muted, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.backdrop },
  modalPanel: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 18, gap: 12, backgroundColor: colors.panel, alignItems: 'center' },
}));

const periods = ['Todo el periodo', 'Hoy', 'Últimos 7 días', 'Últimos 30 días'] as const;

export function HistoryScreen() {
  const { colors } = useBenefyTheme();
  const walletStyles = useWalletStyles();
  const historyStyles = useHistoryStyles();
  const sheet = useSheet();
  const styles = useUiStyles();
  const [business, setBusiness] = useState('Todos');
  const [period, setPeriod] = useState<typeof periods[number]>('Todo el periodo');
  const [showFilters, setShowFilters] = useState(false);
  const resource = useResource(loadMovements);
  const [selected, select] = useState<NonNullable<typeof resource.data>[number]>();
  const [referenceTime] = useState(() => Date.now());
  const today = new Date(referenceTime);
  today.setHours(0, 0, 0, 0);
  const since = period === 'Hoy' ? today.getTime() : period === 'Últimos 7 días' ? referenceTime - 7 * 86400000 :
    period === 'Últimos 30 días' ? referenceTime - 30 * 86400000 : 0;
  const visible = resource.data?.filter(item => item.date >= since && matchesBusiness(business, item.business, item.redeemAt))
    .sort((first, second) => second.date - first.date);
  const days = new Map<string, NonNullable<typeof visible>>();
  for (const item of visible ?? []) {
    const date = formatDate(item.date);
    const items = days.get(date);
    if (items) items.push(item);
    else days.set(date, [item]);
  }
  return <Screen title="Historial de movimientos">
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showFilters }}
      onPress={() => setShowFilters(previous => !previous)}
      style={({ pressed }) => [styles.card, walletStyles.inline, pressed && styles.dim]}>
      <MaterialIcons name="tune" size={21} color={colors.green} />
      <View style={styles.flex}>
        <Heading>Filtros</Heading>
        <Copy>{business === 'Todos' ? period : `${business} · ${period}`}</Copy>
      </View>
      <MaterialIcons name={showFilters ? 'expand-less' : 'expand-more'} size={22} color={colors.muted} />
    </Pressable>
    {showFilters && <Card>
      <Copy>Negocio</Copy><Choice values={businessNames} value={business} onChange={setBusiness} />
      <Copy>Periodo</Copy><Choice values={periods} value={period} onChange={setPeriod} />
      <Button label="Listo" kind="quiet" onPress={() => setShowFilters(false)} />
    </Card>}
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el historial" retry={resource.refresh} />}
    {!resource.loading && !resource.error && visible?.length === 0 && <Notice title="No hay movimientos para estos filtros" />}
    {Array.from(days, ([date, items]) => <View key={date} style={historyStyles.day}>
      <Text accessibilityRole="header" style={historyStyles.date}>{date}</Text>
      <View style={historyStyles.group}>
        {items.map((item, index) => <Pressable accessibilityRole="button" key={item.id} onPress={() => select(item)}
          style={({ pressed }) => [historyStyles.row, index > 0 && historyStyles.divider, pressed && styles.dim]}>
          <View style={historyStyles.icon}>
            <MaterialIcons name={item.kind === 'Visita registrada' ? 'storefront' : 'receipt-long'} size={20} color={colors.green} />
          </View>
          <View style={styles.flex}>
            <Text style={walletStyles.link}>{item.kind}</Text>
            <Copy>{businessById(item.business)?.name}</Copy>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
        </Pressable>)}
      </View>
    </View>)}
    <Modal transparent visible={!!selected} animationType="slide" onRequestClose={() => select(undefined)}>
      <SafeAreaView style={sheet.backdrop}>
        {selected && <View accessibilityViewIsModal style={sheet.panel}>
          <Heading>{selected.kind}</Heading><Copy>{selected.detail}</Copy>
          <Copy>{businessById(selected.business)?.name} · {formatDate(selected.date)}</Copy>
          {selected.redeemAt && <Copy>Canje en {businessById(selected.redeemAt)?.name}</Copy>}
          <Button label="Cerrar" onPress={() => select(undefined)} />
        </View>}
      </SafeAreaView>
    </Modal>
  </Screen>;
}

const useHistoryStyles = createThemedStyles(colors => StyleSheet.create({
  day: { gap: 6 },
  date: { color: colors.muted, fontSize: 13, fontWeight: '700', marginStart: 4 },
  group: { backgroundColor: colors.panel, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, minHeight: 52 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.subtle, justifyContent: 'center', alignItems: 'center' },
}));

const notificationFilters = ['Todas', 'No leídas', 'Promociones'] as const;

export function NotificationsScreen() {
  const { colors } = useBenefyTheme();
  const inbox = useInbox();
  const styles = useUiStyles();
  const resource = useResource(loadNotifications);
  const registeredCoupons = useResource(loadCoupons);
  const session = usePreview();
  const [filter, setFilter] = useState<(typeof notificationFilters)[number]>('Todas');
  const items = resource.data ?? [];
  const unread = items.filter(item => !session.read.includes(item.id));
  const promotions = items.filter(item => item.coupon);
  const groups = { Todas: items, 'No leídas': unread, Promociones: promotions };
  const refresh = () => {
    resource.refresh();
    registeredCoupons.refresh();
  };

  return <Screen title="Notificaciones" subtitle="Benefy Club"
    headerActions={<MaterialIcons name="notifications-none" size={24} color={colors.navy} />}
    scroll={{ refreshControl: <RefreshControl refreshing={resource.loading && !!resource.data} onRefresh={refresh}
      tintColor={colors.green} colors={[colors.green]} progressBackgroundColor={colors.panel} /> }}>
    <View style={inbox.row}>
      <View style={inbox.status}>
        {unread.length > 0 && <View style={inbox.dot} />}
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {unread.length ? `${unread.length} sin leer` : 'Todo al día'}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !unread.length }} disabled={!unread.length}
        onPress={() => session.markRead(unread.map(item => item.id))}
        style={({ pressed }) => [inbox.action, (pressed || !unread.length) && styles.dim]}>
        <MaterialIcons name="done-all" size={18} color={colors.green} />
        <Text style={inbox.link}>Marcar todo como leído</Text>
      </Pressable>
    </View>

    <View style={inbox.filters}>
      {notificationFilters.map(label => {
        const selected = label === filter;
        return <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected }}
          accessibilityLabel={`${label}, ${groups[label].length}`}
          onPress={() => setFilter(label)} style={({ pressed }) => [inbox.chip, selected && inbox.selected, pressed && styles.dim]}>
          <Text style={[inbox.chipText, selected && inbox.selectedText]}>{label}</Text>
          <Text style={[inbox.count, selected && inbox.selectedCount]}>{groups[label].length}</Text>
        </Pressable>;
      })}
    </View>

    {resource.loading && !resource.data && <Skeleton />}
    {resource.error && <Notice title="No se pudieron cargar las notificaciones" retry={refresh} />}
    {registeredCoupons.error && <Notice title="No se pudieron consultar los cupones de los avisos" retry={refresh} />}
    {resource.data && !resource.error && groups[filter].length === 0 && <View style={inbox.empty}>
      <View style={inbox.emptyIcon}><MaterialIcons name="notifications-off" size={40} color={colors.green} /></View>
      <Heading>{filter === 'Promociones' ? 'No tienes avisos de promociones' : 'Todo al día por aquí'}</Heading>
      <Copy>{filter === 'No leídas' ? 'Ya leíste todos tus avisos.' : 'Los avisos nuevos aparecerán aquí.'}</Copy>
      {filter !== 'Todas' && <Button label="Ver todas las notificaciones" kind="quiet" onPress={() => setFilter('Todas')} />}
    </View>}

    {groups[filter].map(item => {
      const isUnread = !session.read.includes(item.id);
      const business = businessById(item.business);
      const coupon = registeredCoupons.data?.find(entry => entry.id === item.coupon);
      const unavailable = !!item.coupon && !!registeredCoupons.data && !coupon;
      const category = unavailable ? 'Promoción retirada' : item.coupon ? 'Promoción' : 'Visita registrada';
      const icon = unavailable ? 'event-busy' : item.coupon ? 'redeem' : 'storefront';
      const action = coupon ? 'Ver cupón' : business ? 'Ver negocio' : unavailable ? 'Ver aviso' : undefined;
      const open = () => {
        session.markRead([item.id]);
        if (coupon) router.push({ pathname: '/coupon/[id]', params: { id: coupon.id } });
        else if (business) router.push({ pathname: '/business/[id]', params: { id: business.id } });
        else Alert.alert('Promoción no disponible', 'Este cupón ya no está disponible. Puedes consultar tus cupones en Cartera.');
      };
      return <View key={item.id} style={[inbox.card, isUnread && inbox.unreadCard, unavailable && inbox.unavailable]}>
        {isUnread && <View style={inbox.stripe} />}
        <View style={inbox.cardRow}>
          <View style={[inbox.icon, isUnread && !unavailable && inbox.activeIcon]}>
            <MaterialIcons name={icon} size={22} color={unavailable ? colors.muted : isUnread ? colors.onMint : colors.navy} />
            {isUnread && <View style={inbox.iconDot} />}
          </View>
          <View style={styles.flex}>
            <View style={inbox.row}>
              <Text style={[inbox.category, unavailable && inbox.muted]}>{category}</Text>
              <Text style={inbox.date}>{formatDate(item.date)}</Text>
            </View>
            <Heading>{item.title}</Heading>
            {coupon && <Copy>{coupon.title}</Copy>}
            {business && <Copy>{business.address}</Copy>}
            {unavailable && <Copy>Este cupón ya no está disponible.</Copy>}
            <View style={inbox.row}>
              {action && <Pressable accessibilityRole="button" onPress={open}
                style={({ pressed }) => [inbox.action, pressed && styles.dim]}>
                <Text style={inbox.link}>{action}</Text>
                <MaterialIcons name="arrow-forward" size={16} color={colors.green} />
              </Pressable>}
              {isUnread && <Pressable accessibilityRole="button" accessibilityLabel={`Marcar como leído: ${item.title}`}
                onPress={() => session.markRead([item.id])} style={({ pressed }) => [inbox.readButton, pressed && styles.dim]}>
                <MaterialIcons name="check-circle-outline" size={21} color={colors.green} />
              </Pressable>}
            </View>
          </View>
        </View>
      </View>;
    })}

    <View style={inbox.refresh}>
      <MaterialIcons name="sync" size={20} color={colors.muted} />
      <View style={styles.flex}><Copy>Avisos de Benefy</Copy></View>
      <Button label={resource.loading || registeredCoupons.loading ? 'Actualizando…' : 'Actualizar'}
        kind="quiet" disabled={resource.loading || registeredCoupons.loading} onPress={refresh} />
    </View>
  </Screen>;
}

const useInbox = createThemedStyles(colors => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 24,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.subtle },
  selected: { backgroundColor: colors.primary },
  chipText: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  selectedText: { color: colors.onPrimary },
  count: { backgroundColor: colors.line, color: colors.navy, borderRadius: 10, paddingHorizontal: 6, fontSize: 11, fontWeight: '800' },
  selectedCount: { backgroundColor: colors.mint, color: colors.onMint },
  card: { backgroundColor: colors.subtle, borderRadius: 16, borderColor: colors.line, borderWidth: 1, padding: 14, overflow: 'hidden' },
  unreadCard: { backgroundColor: colors.panel },
  unavailable: { borderStyle: 'dashed' },
  stripe: { position: 'absolute', start: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.green },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: colors.mint },
  iconDot: { position: 'absolute', top: 0, end: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2,
    borderColor: colors.panel, backgroundColor: colors.green },
  category: { color: colors.green, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  muted: { color: colors.muted },
  date: { color: colors.muted, fontSize: 12 },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  link: { color: colors.green, fontSize: 13, fontWeight: '700' },
  readButton: { marginStart: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 24, gap: 10 },
  emptyIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.subtle, borderRadius: 14, padding: 10 },
}));


const useSheet = createThemedStyles(colors => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  panel: { padding: 20, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.panel },
}));
