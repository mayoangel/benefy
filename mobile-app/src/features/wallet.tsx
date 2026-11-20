import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BusinessMark } from './business';
import {
  businessById, businesses, couponStatus, formatDate, loadBusinesses, loadCoupons,
  loadMovements, loadNotifications, usePreview, useResource, type Coupon,
} from './preview';
import { Button, Card, Choice, Copy, Heading, Notice, Row, Screen, Skeleton, styles } from './ui';

const businessNames = ['Todos', ...businesses.map(item => item.name)];
const matchesBusiness = (name: string, ...ids: (string | undefined)[]) =>
  name === 'Todos' || ids.some(id => businessById(id)?.name === name);
const statusIcon = { Disponible: '✓', Canjeado: '↗', Vencido: '◷' };

function CouponParties({ coupon, location }: { coupon: Coupon; location?: boolean }) {
  return <>{[{ label: 'Emitido por', id: coupon.issuer }, { label: 'Canjeable en', id: coupon.redeemAt }].map(({ label, id }) => {
    const business = businessById(id);
    return business && <Row key={label}><BusinessMark business={business} size={30} /><View style={styles.flex}>
      <Copy>{label} · {business.name}</Copy>
      {location && <Copy>{business.address}</Copy>}
    </View></Row>;
  })}</>;
}

export function WalletScreen() {
  const [section, setSection] = useState<'Cupones' | 'Puntos y visitas'>('Cupones');
  const [business, setBusiness] = useState('Todos');
  const [status, setStatus] = useState<'Todos' | 'Disponible' | 'Canjeado' | 'Vencido'>('Todos');
  const coupons = useResource(loadCoupons);
  const cards = useResource(loadBusinesses);
  const visibleCoupons = coupons.data?.filter(item =>
    matchesBusiness(business, item.issuer, item.redeemAt) && (status === 'Todos' || couponStatus(item) === status));
  const visibleCards = cards.data?.filter(item => matchesBusiness(business, item.id));
  const resource = section === 'Cupones' ? coupons : cards;
  return <Screen title="Cartera" tabs>
    <Choice values={['Cupones', 'Puntos y visitas']} value={section} onChange={setSection} />
    <Copy>Negocio</Copy><Choice values={businessNames} value={business} onChange={setBusiness} />
    {section === 'Cupones' && <><Copy>Estado</Copy>
      <Choice values={['Todos', 'Disponible', 'Canjeado', 'Vencido']} value={status} onChange={setStatus} /></>}
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar tu cartera" retry={resource.refresh} />}
    {section === 'Cupones' && visibleCoupons?.map(item => <Card key={item.id}>
      <Heading>{item.title}</Heading><CouponParties coupon={item} />
      <Copy>{statusIcon[couponStatus(item)]} {couponStatus(item)} · Vigente hasta {item.expiry}</Copy>
      <Copy>{item.origin}</Copy>
      <Button kind="quiet" label="Ver cupón" onPress={() => router.push({ pathname: '/coupon/[id]', params: { id: item.id } })} />
    </Card>)}
    {section === 'Puntos y visitas' && visibleCards?.map(item => <Card key={item.id}>
      <Row><BusinessMark business={item} /><Heading>{item.name}</Heading></Row>
      <Copy>{item.points} puntos</Copy>
      {item.goalCount > 0 && <Copy>{item.visits} de {item.goalCount} visitas</Copy>}
    </Card>)}
    {!resource.loading && !resource.error && (section === 'Cupones' ? visibleCoupons : visibleCards)?.length === 0 &&
      <Notice title="Todavía no tienes recompensas" message="Prueba con otro filtro para consultar tus recompensas." />}
  </Screen>;
}

export function CouponScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(loadCoupons);
  const coupon = resource.data?.find(item => item.id === id);
  const status = coupon && couponStatus(coupon);
  return <Screen title="Detalle del cupón">
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el cupón" retry={resource.refresh} />}
    {!resource.loading && !resource.error && !coupon && <Notice title="Este cupón ya no está disponible" />}
    {coupon && status && <Card>
      <Heading>{coupon.title}</Heading>
      <Copy>{statusIcon[status]} {status} · Vigencia hasta {coupon.expiry}</Copy>
      <Copy>{coupon.origin}</Copy><CouponParties coupon={coupon} location />
      {coupon.issuer !== coupon.redeemAt && <Heading>Alianza</Heading>}
      {'allianceEnded' in coupon && coupon.allianceEnded && status === 'Disponible' && <Copy>
        La alianza con {businessById(coupon.redeemAt)?.name} finalizó. Este cupón sigue vigente hasta {coupon.expiry}.
      </Copy>}
      <Heading>Términos y condiciones</Heading><Copy>Presenta el código en una sucursal participante. Válido para un solo uso.</Copy>
      <Button disabled={status !== 'Disponible'} label="Canjear recompensa" onPress={() =>
        Alert.alert('Canjear recompensa', 'Muestra el código al personal del negocio para que lo valide.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => router.push({ pathname: '/redeem/[id]', params: { id: coupon.id } }) },
        ])} />
    </Card>}
  </Screen>;
}

export function RedeemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(loadCoupons);
  const coupon = resource.data?.find(item => item.id === id);
  const status = coupon && couponStatus(coupon);
  return <Screen title="Código del cupón">
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo consultar el canje" retry={resource.refresh} />}
    {coupon && status === 'Disponible' && <Card>
      <Heading>{coupon.title}</Heading><Copy>Código de demostración · {coupon.id.toUpperCase()}</Copy>
      <Copy>Esperando validación del negocio. Este código de demostración no es válido para canjes reales.</Copy>
      <Button label="Consultar estado" onPress={() => Alert.alert('Validación no disponible', 'Se necesita una sesión conectada al servidor para consultar el estado del canje.')} />
    </Card>}
    {status && status !== 'Disponible' && <Notice title={status === 'Canjeado' ? 'Cupón ya utilizado' : 'Cupón vencido'} />}
    {!resource.loading && !resource.error && !coupon && <Notice title="Este cupón ya no está disponible" />}
    <Button label="Ver en mi cartera" kind="quiet" onPress={() => router.navigate('/wallet')} />
  </Screen>;
}

const periods = ['Todo el periodo', 'Hoy', 'Últimos 7 días', 'Últimos 30 días'] as const;

export function HistoryScreen() {
  const [business, setBusiness] = useState('Todos');
  const [period, setPeriod] = useState<typeof periods[number]>('Todo el periodo');
  const resource = useResource(loadMovements);
  const [selected, select] = useState<NonNullable<typeof resource.data>[number]>();
  const [referenceTime] = useState(() => Date.now());
  const today = new Date(referenceTime);
  today.setHours(0, 0, 0, 0);
  const since = period === 'Hoy' ? today.getTime() : period === 'Últimos 7 días' ? referenceTime - 7 * 86400000 :
    period === 'Últimos 30 días' ? referenceTime - 30 * 86400000 : 0;
  const visible = resource.data?.filter(item => item.date >= since && matchesBusiness(business, item.business, item.redeemAt));
  return <Screen title="Historial de movimientos">
    <Copy>Negocio</Copy><Choice values={businessNames} value={business} onChange={setBusiness} />
    <Copy>Periodo</Copy><Choice values={periods} value={period} onChange={setPeriod} />
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el historial" retry={resource.refresh} />}
    {!resource.loading && !resource.error && visible?.length === 0 && <Notice title="No hay visitas registradas en este periodo" />}
    {visible?.map(item => <Pressable accessibilityRole="button" key={item.id} onPress={() => select(item)}>
      <Card><Heading>{item.kind}</Heading>
        <Copy>{businessById(item.business)?.name} · {formatDate(item.date)}</Copy>
        {item.redeemAt && <Copy>Canje en {businessById(item.redeemAt)?.name}</Copy>}
      </Card>
    </Pressable>)}
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

export function NotificationsScreen() {
  const resource = useResource(loadNotifications);
  const registeredCoupons = useResource(loadCoupons);
  const session = usePreview();
  const open = (item: NonNullable<typeof resource.data>[number]) => {
    session.markRead([item.id]);
    if (item.coupon && registeredCoupons.data?.some(coupon => coupon.id === item.coupon)) {
      router.push({ pathname: '/coupon/[id]', params: { id: item.coupon } });
    } else if (item.business && businessById(item.business)) {
      router.push({ pathname: '/business/[id]', params: { id: item.business } });
    } else {
      Alert.alert('Contenido no disponible', 'El cupón o el negocio de este aviso ya no está disponible.');
    }
  };
  return <Screen title="Notificaciones">
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudieron cargar las notificaciones" retry={resource.refresh} />}
    {resource.data?.length === 0 && <Notice title="No tienes notificaciones" />}
    {resource.data?.some(item => !session.read.includes(item.id)) && <Button label="Marcar todo como leído"
      kind="quiet" onPress={() => session.markRead(resource.data?.map(item => item.id) ?? [])} />}
    {resource.data?.map(item => <Pressable accessibilityRole="button" key={item.id} onPress={() => open(item)}>
      <Card><Heading>{item.icon} {item.title}</Heading>
        <Copy>{formatDate(item.date)} · {session.read.includes(item.id) ? 'Leída' : 'Sin leer'}</Copy>
      </Card>
    </Pressable>)}
  </Screen>;
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00182D88' },
  panel: { padding: 20, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#FFFFFF' },
});
