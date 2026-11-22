import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import HomeDashboard from '../components/HomeDashboard';
import { DetailTicket } from '../components/DetailTicket';
import {
  businessById, loadBusinesses, loadRewards, notifications, profile,
  rewardReason, usePreview, useResource, type Business,
} from './preview';
import { Button, Card, Copy, Heading, Notice, Screen, Skeleton, useUiStyles } from './ui';

export function HomeScreen() {
  const { colors } = useBenefyTheme();
  const homeStyles = useHomeStyles();
  const styles = useUiStyles();
  const resource = useResource(loadBusinesses);
  const session = usePreview();
  const cards = resource.data;
  const unread = notifications.filter(item => !session.read.includes(item.id)).length;
  return <Screen title="Benefy" tabs headerActions={<>
    <Pressable accessibilityRole="button" accessibilityLabel={`Notificaciones, ${unread} sin leer`}
      onPress={() => router.navigate('/notifications')} style={({ pressed }) => [homeStyles.headerButton, pressed && styles.dim]}>
      <MaterialIcons name="notifications-none" size={22} color={colors.navy} />
      {unread > 0 && <View style={homeStyles.unreadDot} />}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Historial de movimientos"
      onPress={() => router.navigate('/history')} style={({ pressed }) => [homeStyles.headerButton, pressed && styles.dim]}>
      <MaterialIcons name="history" size={22} color={colors.navy} />
    </Pressable>
  </>} scroll={{
    refreshControl: <RefreshControl refreshing={resource.loading && !!resource.data} onRefresh={resource.refresh}
      tintColor={colors.green} colors={[colors.green]} progressBackgroundColor={colors.panel} />,
  }}>
    {resource.error && <Notice title="Error al sincronizar datos" message="Tus últimos datos siguen disponibles." retry={resource.refresh} />}
    {resource.loading && !resource.data && <Skeleton />}
    {resource.data?.length === 0 && <Card>
      <Heading>Todavía no estás registrado en ningún negocio</Heading>
      <Button label="Escanear QR de un negocio" icon="qr-code-scanner" onPress={() => router.navigate('/register')} />
    </Card>}
    {cards && cards.length > 0 && <HomeDashboard name={profile.firstName} cards={cards}
      onDynamics={() => router.push('/dynamics')} onCoupons={() => router.push('/wallet')}
      onScan={() => router.navigate('/register')}
      onBusiness={index => router.push({ pathname: '/business/[id]', params: { id: cards[index].id } })}
    />}
  </Screen>;
}

const useHomeStyles = createThemedStyles(colors => StyleSheet.create({
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
}));

export function BusinessMark({ business, size = 48 }: { business: Business; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: size / 2 }}>{business.icon}</Text>
    <Image source={{ uri: business.logo }} style={{ position: 'absolute', width: size, height: size }} />
  </View>;
}

export function BusinessScreen() {
  const { colors } = useBenefyTheme();
  const homeStyles = useHomeStyles();
  const detailStyles = useDetailStyles();
  const styles = useUiStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(loadBusinesses);
  const catalog = useResource(loadRewards);
  const business = resource.data?.find(item => item.id === id);
  const rewards = catalog.data?.filter(item => item.issuer === id) ?? [];
  const redeemable = business ? rewards.filter(item => !rewardReason(item, business.points)).length : 0;

  return <Screen title="Detalle del negocio" subtitle="Benefy Club"
    headerActions={<Pressable accessibilityRole="button" accessibilityLabel="Notificaciones"
      onPress={() => router.push('/notifications')} style={({ pressed }) => [homeStyles.headerButton, pressed && styles.dim]}>
      <MaterialIcons name="notifications-none" size={22} color={colors.navy} />
    </Pressable>}
    footer={business && business.rate > 0 && <View style={detailStyles.footer}>
      <Button icon="storefront" label={catalog.data ? `Ver tienda de cupones · ${redeemable} canjeables` : 'Ver tienda de cupones'}
        onPress={() => router.push({ pathname: '/shop/[id]', params: { id: business.id } })} />
    </View>}>
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar el negocio" retry={resource.refresh} />}
    {!resource.loading && !resource.error && !business && <Notice title="Este negocio ya no está disponible" />}
    {business && <>
      <View style={detailStyles.hero}>
        <View style={detailStyles.line}>
          <BusinessMark business={business} size={64} />
          <View style={styles.flex}>
            <Text style={detailStyles.label}>Negocio asociado</Text>
            <Text accessibilityRole="header" style={detailStyles.name}>{business.name}</Text>
            <Copy>{business.category}</Copy>
          </View>
          <Text accessibilityLabel={`${business.points} puntos disponibles`} style={detailStyles.points}>{business.points} pts</Text>
        </View>
        <View style={detailStyles.inset}>
          <MaterialIcons name="storefront" size={20} color={colors.green} />
          <Copy>{business.address}</Copy>
        </View>
      </View>

      {business.goalCount > 0 && <VisitProgram business={business} />}

      <View style={detailStyles.links}>
        <Button label="Beneficios con aliados" icon="handshake" kind="quiet"
          onPress={() => router.push({ pathname: '/business-allies/[id]', params: { id: business.id } })} />
        <Button label="Tus cupones de este negocio" icon="confirmation-number" kind="quiet"
          onPress={() => router.push({ pathname: '/business-coupons/[id]', params: { id: business.id } })} />
      </View>

    </>}
  </Screen>;
}

function VisitProgram({ business }: { business: Business }) {
  const { colors } = useBenefyTheme();
  const detailStyles = useDetailStyles();
  const styles = useUiStyles();
  const { visits, goalCount } = business;
  return <Card>
    <View style={detailStyles.line}>
      <MaterialIcons name="fact-check" size={22} color={colors.green} />
      <View style={styles.flex}>
        <Heading>Programa de visitas</Heading>
        <Copy>{visits} de {goalCount} visitas registradas</Copy>
      </View>
    </View>
    <View style={detailStyles.visitGrid}>
      {Array.from({ length: goalCount }, (_, index) => {
        const number = index + 1;
        const registered = number <= visits;
        const final = number === goalCount;
        const status = registered ? 'registrada' : 'pendiente';
        return <View key={number} accessible accessibilityLabel={`Visita ${number}, ${status}${final ? ', meta de recompensa' : ''}`}
          style={detailStyles.visitCell}>
          <View style={[detailStyles.visitCircle, registered && detailStyles.registered, final && detailStyles.finalVisit]}>
            <MaterialIcons name={final ? 'redeem' : registered ? 'check' : 'hourglass-empty'}
              size={20} color={registered ? colors.onMint : final ? colors.green : colors.muted} />
          </View>
          <Text style={detailStyles.visitNumber}>#{number}</Text>
        </View>;
      })}
    </View>
    <View style={detailStyles.inset}>
      <MaterialIcons name="workspace-premium" size={21} color={colors.green} />
      <View style={styles.flex}>
        <Heading>{visits >= goalCount ? 'Meta completada' : 'Recompensa al completar'}</Heading>
        <Copy>{business.id === 'blend' ? 'Café de cortesía' : 'Pase libre por un día'}</Copy>
      </View>
    </View>
    <Copy>Escanea el código QR de una sucursal participante para registrar una visita.</Copy>
  </Card>;
}

const useDetailStyles = createThemedStyles(colors => StyleSheet.create({
  hero: { backgroundColor: colors.subtle, borderRadius: 18, padding: 14, gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: colors.navy, fontSize: 24, fontWeight: '800' },
  label: { color: colors.green, fontSize: 12, fontWeight: '700' },
  inset: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.subtle, borderRadius: 12, padding: 10 },
  visitGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, paddingVertical: 12 },
  visitCell: { width: '20%', alignItems: 'center', gap: 4 },
  visitCircle: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted,
    backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  registered: { backgroundColor: colors.mint, borderColor: colors.mint, borderStyle: 'solid' },
  finalVisit: { borderColor: colors.green },
  visitNumber: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 14, backgroundColor: colors.brand },
  balanceLabel: { color: colors.mint, fontSize: 12, fontWeight: '700' },
  balanceValue: { color: colors.onBrand, fontSize: 28, fontWeight: '800' },
  points: { color: colors.green, fontSize: 13, fontWeight: '800', backgroundColor: colors.panel,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  links: { gap: 8 },
  footer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.panel,
    borderTopWidth: 1, borderTopColor: colors.line },
}));


export function ShopScreen() {
  return <RewardCatalog />;
}

export function BusinessAlliesScreen() {
  return <RewardCatalog alliesOnly />;
}

function RewardCatalog({ alliesOnly = false }: { alliesOnly?: boolean }) {
  const { colors } = useBenefyTheme();
  const detailStyles = useDetailStyles();
  const shopStyles = useShopStyles();
  const styles = useUiStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const business = businessById(id);
  const resource = useResource(loadRewards);
  const items = resource.data?.filter(item => item.issuer === id && (!alliesOnly || item.redeemAt !== id));
  return <Screen title={alliesOnly ? 'Beneficios con aliados' : 'Tienda de cupones'} subtitle={business?.name}>
    {!business && <Notice title="Este negocio ya no está disponible" />}
    {business && <View style={shopStyles.balance}>
      <View style={styles.flex}>
        <Text style={detailStyles.balanceLabel}>Saldo disponible</Text>
        <Text style={detailStyles.balanceValue}>{business.points} pts</Text>
      </View>
      <View style={shopStyles.balanceIcon}>
        <MaterialIcons name="account-balance-wallet" size={24} color={colors.onMint} />
      </View>
    </View>}
    {business && resource.loading && <Skeleton />}
    {business && resource.error && <Notice title="No se pudo cargar la tienda" retry={resource.refresh} />}
    {business && !resource.loading && !resource.error && items?.length === 0 &&
      <Notice title={alliesOnly ? 'Este negocio aún no tiene beneficios con aliados' : 'Este negocio no tiene recompensas disponibles por ahora'} />}
    {business && !!items?.length && <Heading>Recompensas</Heading>}
    {business && items?.map(item => {
      const redeemAt = businessById(item.redeemAt);
      const reason = redeemAt ? rewardReason(item, business.points) : 'No disponible';
      const status = reason ?? 'Disponible';
      return <Pressable key={item.id} accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.cost} puntos, ${status}`}
        accessibilityHint="Abre el detalle de la recompensa"
        onPress={() => router.push({ pathname: '/reward/[id]', params: { id: item.id } })}
        style={({ pressed }) => [styles.card, shopStyles.reward, pressed && styles.dim]}>
        <View style={detailStyles.line}>
          {redeemAt && <BusinessMark business={redeemAt} size={44} />}
          <View style={styles.flex}>
            <Heading>{item.title}</Heading>
            {redeemAt && <Copy>{redeemAt.name}{item.issuer !== item.redeemAt ? ' · Alianza' : ''}</Copy>}
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
        </View>
        <View style={shopStyles.rewardFooter}>
          <Text style={shopStyles.cost}>{item.cost} pts</Text>
          <Text style={[shopStyles.status, !reason && shopStyles.available]}>{status}</Text>
        </View>
      </Pressable>;
    })}
  </Screen>;
}

const useShopStyles = createThemedStyles(colors => StyleSheet.create({
  balance: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brand, padding: 18, borderRadius: 18 },
  balanceIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.mint,
    alignItems: 'center', justifyContent: 'center' },
  reward: { gap: 12 },
  rewardFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 10,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cost: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  status: { backgroundColor: colors.subtle, color: colors.muted, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 12, fontSize: 12, fontWeight: '700' },
  available: { color: colors.onMint, backgroundColor: colors.mint },
}));

export function RewardScreen() {
  const { colors } = useBenefyTheme();
  const detailStyles = useDetailStyles();
  const styles = useUiStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource(loadRewards);
  const reward = resource.data?.find(item => item.id === id);
  const issuer = businessById(reward?.issuer);
  const redeemAt = businessById(reward?.redeemAt);
  const reason = reward && issuer && redeemAt ? rewardReason(reward, issuer.points) : 'No disponible';
  const available = reason === null;
  const confirm = () => {
    if (!reward || !issuer || reason) return;
    Alert.alert('Obtener cupón', `Gastarás ${reward.cost} pts. Tu saldo quedará en ${issuer.points - reward.cost}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => Alert.alert('Compra no disponible', 'Inicia una sesión conectada al servidor para adquirir cupones. Tu saldo sigue intacto.') },
    ]);
  };
  return <Screen title="Detalle de recompensa" footer={reward && available && <View style={detailStyles.footer}>
    <Button icon="redeem" label={`Obtener cupón por ${reward.cost} pts`} onPress={confirm} />
  </View>}>
    {resource.loading && <Skeleton />}
    {resource.error && <Notice title="No se pudo cargar la recompensa" retry={resource.refresh} />}
    {!resource.loading && !resource.error && !reward && <Notice title="Recompensa no disponible" />}
    {reward && <>
      <DetailTicket title={reward.title} subtitle={`Costo: ${reward.cost} pts`} status={reason ?? 'Disponible'} available={available}>
        {redeemAt && <View style={detailStyles.line}>
          <BusinessMark business={redeemAt} size={44} />
          <View style={styles.flex}>
            <Copy>Canjeable en</Copy>
            <Heading>{redeemAt.name}</Heading>
            <Copy>{redeemAt.address}</Copy>
          </View>
        </View>}
        <View style={detailStyles.line}>
          <MaterialIcons name="event" size={20} color={colors.green} />
          <View style={styles.flex}><Copy>{reason === 'Vencida' ? 'Venció el' : 'Vigente hasta'} {reward.expiry}</Copy></View>
        </View>
        {issuer && issuer.id !== reward.redeemAt && <View style={detailStyles.line}>
          <MaterialIcons name="handshake" size={20} color={colors.green} />
          <View style={styles.flex}><Copy>Recompensa de alianza emitida por {issuer.name}</Copy></View>
        </View>}
      </DetailTicket>
      <Card>
        <Heading>Condiciones de uso</Heading>
        <Copy>Válido una vez en la sucursal indicada y hasta la fecha de vigencia.</Copy>
      </Card>
    </>}
  </Screen>;
}
