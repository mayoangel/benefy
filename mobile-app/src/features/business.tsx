import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, RefreshControl, Text, View } from 'react-native';
import HomeDashboard from '../components/HomeDashboard';
import {
  businessById, loadBusinesses, loadCoupons, loadRewards, notifications, profile,
  rewardReason, usePreview, useResource, type Business,
} from './preview';
import { Button, Card, Copy, Heading, Notice, Row, Screen, Skeleton, styles } from './ui';

export function HomeScreen() {
  const resource = useResource(loadBusinesses);
  const session = usePreview();
  if (!session.signedIn) return <WelcomeScreen />;
  const cards = resource.data;
  return <Screen title="Benefy" subtitle="Cuenta de demostración" tabs scroll={{
    refreshControl: <RefreshControl refreshing={resource.loading && !!resource.data} onRefresh={resource.refresh} />,
  }}>
    {resource.error && <Notice title="Error al sincronizar datos" message="Tus últimos datos siguen disponibles." retry={resource.refresh} />}
    {resource.loading && !resource.data && <Skeleton />}
    {resource.data?.length === 0 && <Card>
      <Heading>Todavía no estás registrado en ningún negocio</Heading>
      <Button label="Escanear QR de un negocio" onPress={() => router.navigate('/register')} />
    </Card>}
    {cards && cards.length > 0 && <HomeDashboard name={profile.firstName} cards={cards}
      unread={notifications.filter(item => !session.read.includes(item.id)).length}
      onHistory={() => router.push('/history')} onNotifications={() => router.push('/notifications')}
      onDynamics={() => router.push('/dynamics')} onCoupons={() => router.push('/wallet')}
      onScan={() => router.navigate('/register')}
      onBusiness={index => router.push({ pathname: '/business/[id]', params: { id: cards[index].id } })}
    />}
  </Screen>;
}

export function WelcomeScreen() {
  const session = usePreview();
  return <Screen title="Benefy" subtitle="Tus comercios y recompensas" >
    <Notice title="Bienvenido a Benefy" message="Puedes explorar las pantallas con una cuenta de demostración." />
    <Button label="Entrar a la demostración" onPress={() => { session.setSignedIn(true); router.replace('/'); }} />
  </Screen>;
}

export function BusinessMark({ business, size = 48 }: { business: Business; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: size / 2 }}>{business.icon}</Text>
    <Image source={{ uri: business.logo }} style={{ position: 'absolute', width: size, height: size }} />
  </View>;
}

export function BusinessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(loadBusinesses);
  const coupons = useResource(loadCoupons);
  const catalog = useResource(loadRewards);
  const business = resource.data?.find(item => item.id === id);
  return <Screen title={business?.name ?? 'Detalle del negocio'}>
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el negocio" retry={resource.refresh} />}
    {!resource.loading && !resource.error && !business && <Notice title="Este negocio ya no está disponible" />}
    {business && <>
      <Card><Row><BusinessMark business={business} size={66} /><View style={styles.flex}>
        <Heading>{business.name}</Heading><Copy>{business.category}</Copy>
      </View></Row><Copy>{business.address}</Copy></Card>
      {business.goalCount > 0 && <Card>
        <Heading>Visitas</Heading><Copy>{business.visits} de {business.goalCount} visitas</Copy>
        <Copy>{Array.from({ length: business.goalCount }, (_, index) => index < business.visits ? '●' : '○').join(' ')}</Copy>
        <Copy>{business.id === 'blend' ? 'Café de cortesía al llegar a la meta.' : 'Pase libre por un día al llegar a la meta.'}</Copy>
        <Copy>Registra una visita válida en una sucursal participante.</Copy>
      </Card>}
      {business.rate > 0 && <Card>
        <Heading>Puntos</Heading><Copy>{business.points} pts · {business.rate} pts por visita</Copy>
        <Copy>Los puntos se usan en el catálogo de este negocio.</Copy>
        <Button label="Ver tienda de cupones" onPress={() => router.push({ pathname: '/shop/[id]', params: { id: business.id } })} />
      </Card>}
      {catalog.data?.some(item => item.issuer === business.id && item.redeemAt !== business.id) && <Card>
        <Heading>Beneficios con aliados</Heading>
        {catalog.data.filter(item => item.issuer === business.id && item.redeemAt !== business.id).map(item =>
          <Copy key={item.id}>{item.title} · {businessById(item.redeemAt)?.name}</Copy>)}
      </Card>}
      {coupons.data?.some(item => item.issuer === business.id || item.redeemAt === business.id) && <Card>
        <Heading>Tus cupones de este negocio</Heading>
        {coupons.data.filter(item => item.issuer === business.id || item.redeemAt === business.id).map(item =>
          <Button key={item.id} label={item.title} kind="quiet" onPress={() => router.push({ pathname: '/coupon/[id]', params: { id: item.id } })} />)}
      </Card>}
    </>}
  </Screen>;
}

export function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const business = businessById(id);
  const resource = useResource(loadRewards);
  const items = resource.data?.filter(item => item.issuer === id);
  return <Screen title="Tienda de cupones" subtitle={business?.name}
    header={business && <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}><Heading>Saldo · {business.points} pts</Heading></View>}>
    {!business && <Notice title="Este negocio ya no está disponible" />}
    {business && resource.loading && <Skeleton />}
    {business && resource.error && <Notice title="No se pudo cargar la tienda" retry={resource.refresh} />}
    {business && !resource.loading && !resource.error && items?.length === 0 &&
      <Notice title="Este negocio no tiene recompensas disponibles por ahora" />}
    {business && items?.map(item => {
      const reason = rewardReason(item, business.points);
      const redeemAt = businessById(item.redeemAt);
      return <Card key={item.id}>
        <Row>{redeemAt && <BusinessMark business={redeemAt} />}<Heading>{item.title}</Heading></Row>
        <Copy>{item.cost} pts · Vence el {item.expiry}</Copy>
        <Copy>{item.issuer === item.redeemAt ? 'En este negocio' : `En ${redeemAt?.name} · Alianza`}</Copy>
        <Button disabled={!!reason} label={reason ?? 'Disponible · Ver recompensa'}
          onPress={() => router.push({ pathname: '/reward/[id]', params: { id: item.id } })} />
      </Card>;
    })}
  </Screen>;
}

export function RewardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(loadRewards);
  const reward = resource.data?.find(item => item.id === id);
  const issuer = businessById(reward?.issuer);
  const redeemAt = businessById(reward?.redeemAt);
  const reason = reward && issuer ? rewardReason(reward, issuer.points) : null;
  const confirm = () => {
    if (!reward || !issuer || reason) return;
    Alert.alert('Obtener cupón', `Gastarás ${reward.cost} pts. Tu saldo quedará en ${issuer.points - reward.cost}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => Alert.alert('Compra no disponible', 'Inicia una sesión conectada al servidor para adquirir cupones. Tu saldo sigue intacto.') },
    ]);
  };
  return <Screen title="Detalle de recompensa">
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar la recompensa" retry={resource.refresh} />}
    {!resource.loading && !resource.error && !reward && <Notice title="Recompensa no disponible" />}
    {reward && <Card>
      {redeemAt && <BusinessMark business={redeemAt} size={92} />}
      <Heading>{reward.title}</Heading><Copy>Beneficio · {reward.title}</Copy>
      <Copy>Costo · {reward.cost} pts</Copy><Copy>Vigencia · {reward.expiry}</Copy>
      {redeemAt && <><Heading>Canje en {redeemAt.name}</Heading><Copy>Sucursal participante · {redeemAt.address}</Copy></>}
      <Heading>Términos y condiciones</Heading><Copy>Válido una vez en la sucursal indicada y hasta la fecha de vigencia.</Copy>
      {reason && <Copy>{reason}</Copy>}
      <Button label="Obtener cupón" onPress={confirm} disabled={!!reason} />
    </Card>}
  </Screen>;
}
