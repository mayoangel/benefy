import { StatusBar } from 'expo-status-bar';
import { type Href, useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Tab = 'Inicio' | 'Dinámicas' | 'Cupones' | 'Billetera';

const tabPaths: Record<Tab, Href> = {
  Inicio: '/',
  Dinámicas: '/dynamics',
  Cupones: '/coupons',
  Billetera: '/wallet',
};

const colors = {
  background: '#F7F6FB',
  surface: '#FFFFFF',
  ink: '#172222',
  muted: '#71807F',
  green: '#087B68',
  greenDark: '#066653',
  mint: '#DDF8EB',
  paleGreen: '#EFFAF4',
  lavender: '#F0EFFB',
  line: '#ECECF1',
};

const dynamics = [
  {
    icon: '☕',
    brand: 'Café Blend',
    name: 'Horario mañanero',
    description: 'Consume antes de las 11:00 AM · Gana 150 pts',
    progress: '4 de 5 visitas',
    remaining: 'Quedan 2 días',
    reward: 'Café latte gratis',
  },
  {
    icon: '♨',
    brand: 'Burger Shack',
    name: 'Meta Gourmet',
    description: 'Prueba 2 combos dobles este mes · Gana 300 pts',
    progress: '1 de 2 compras',
    remaining: 'En 8 días',
    reward: 'Válido en cualquier sucursal',
  },
  {
    icon: '✳',
    brand: 'Green Poke Bowl',
    name: 'Reto Saludable',
    description: 'Completa 3 pedidos con ensalada verde',
    progress: '2 de 3 pedidos',
    remaining: 'En 12 días',
    reward: 'Cupón 50% de descuento desbloqueable',
  },
];

const coupons = [
  {
    icon: '☕',
    brand: 'Café Blend',
    offer: 'GRATIS 5TA VISITA',
    expiry: 'Vence en 5 días',
    description: 'Un café de especialidad gratis a tu elección',
    code: 'BLEND-FREE-CAFE',
    action: 'Mostrar',
  },
  {
    icon: '♨',
    brand: 'Burger Shack',
    offer: '30% OFF · VENCE MAÑANA',
    expiry: 'Verificado',
    description: '30% de descuento en todos los combos dobles',
    code: 'SHACK-DOUBLE30',
    action: 'Escanear',
  },
  {
    icon: '✚',
    brand: 'Farmacia & Salud',
    offer: '15% DESCUENTO',
    expiry: 'Vence 30 Oct',
    description: 'Suplementos alimenticios y multivitamínicos',
    code: 'VITA-CARE-15',
    action: 'Ver código',
  },
];

function SectionHeading({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {count ? <Text style={styles.countBadge}>{count}</Text> : null}
    </View>
  );
}

function QuickAction({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: string;
  label: string;
  tint: 'green' | 'mint' | 'lavender' | 'white';
  onPress: () => void;
}) {
  const tintStyles = {
    green: styles.quickIcon_green,
    mint: styles.quickIcon_mint,
    lavender: styles.quickIcon_lavender,
    white: styles.quickIcon_white,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, tintStyles[tint]]}>
        <Text style={[styles.quickIconText, tint === 'green' && styles.quickIconTextLight]}>
          {icon}
        </Text>
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export default function App({ activeTab }: { activeTab: Tab }) {
  const router = useRouter();

  const goToTab = (tab: Tab) => {
    router.navigate(tabPaths[tab]);
  };

  const showUnavailableFeature = (feature: string) => {
    Alert.alert(
      feature,
      'Esta vista es una demostración visual. La conexión con la cámara y los servicios de Benefy todavía no está integrada.',
      [{ text: 'Entendido' }],
    );
  };

  const showCouponCode = (brand: string, code: string) => {
    Alert.alert(brand, `Tu código de canje es:\n\n${code}`, [{ text: 'Cerrar' }]);
  };

  const renderBalanceCard = () => (
    <View style={styles.balanceCard}>
      <View style={styles.balanceDecoration} />
      <View style={styles.balanceTopRow}>
        <Text style={styles.balanceLabel}>Balance de recompensas</Text>
        <View style={styles.monthlyBadge}>
          <Text style={styles.monthlyBadgeText}>↗  +450 pts este mes</Text>
        </View>
      </View>
      <View style={styles.pointsRow}>
        <Text style={styles.pointsValue}>1.480</Text>
        <Text style={styles.pointsCaption}>Puntos acumulados</Text>
      </View>
      <View style={styles.benefitsRow}>
        <View style={styles.benefitsIcon}>
          <Text style={styles.benefitsIconText}>✦</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.benefitsEyebrow}>BENEFICIOS ACTIVOS</Text>
          <Text style={styles.benefitsTitle}>Nivel Pro Oro · 3 retos</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => goToTab('Billetera')}
          style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailButtonText}>Detalle</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <QuickAction
        icon="⌗"
        label="Escanear"
        tint="green"
        onPress={() => showUnavailableFeature('Escanear código QR')}
      />
      <QuickAction icon="▣" label="Canjear" tint="mint" onPress={() => goToTab('Cupones')} />
      <QuickAction icon="ϟ" label="Dinámicas" tint="lavender" onPress={() => goToTab('Dinámicas')} />
      <QuickAction icon="◷" label="Historial" tint="white" onPress={() => goToTab('Billetera')} />
    </View>
  );

  const renderLoyaltyCard = () => (
    <View style={styles.loyaltyCard}>
      <View style={styles.loyaltyHeader}>
        <View style={styles.activeLabel}>
          <View style={styles.activeDot} />
          <Text style={styles.activeLabelText}>BENEFICIO ACTIVO</Text>
        </View>
        <Text style={styles.visitsBadge}>4 de 5 visitas</Text>
      </View>
      <Text style={styles.loyaltyTitle}>¡Tu próxima recompensa va por nosotros!</Text>
      <Text style={styles.loyaltyDescription}>
        Completa el último sello y desbloquea 1 mes de café de cortesía en tus marcas favoritas.
      </Text>
      <View style={styles.stampsRow}>
        {[1, 2, 3, 4].map((stamp) => (
          <View key={stamp} style={styles.stampItem}>
            <View style={styles.stampDone}>
              <Text style={styles.stampCheck}>✓</Text>
            </View>
            <Text style={styles.stampNumber}>{stamp}</Text>
          </View>
        ))}
        <View style={styles.stampItem}>
          <View style={styles.stampGoal}>
            <Text style={styles.stampGoalIcon}>♧</Text>
          </View>
          <Text style={styles.stampNumber}>Meta</Text>
        </View>
      </View>
      <View style={styles.loyaltyFooter}>
        <Text style={styles.participatingCafe}>☕  Café Blend participante</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => showUnavailableFeature('Registrar visita')}
          hitSlop={8}
        >
          <Text style={styles.registerVisit}>Registrar visita</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderDynamics = () => (
    <View style={styles.section}>
      <SectionHeading
        title="Dinámicas en progreso"
        subtitle="Completa misiones y desbloquea recompensas exclusivas"
      />
      {dynamics.map((item, index) => (
        <View key={item.brand} style={styles.dynamicCard}>
          <View style={styles.dynamicTopRow}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandIconText}>{item.icon}</Text>
            </View>
            <View style={styles.dynamicInfo}>
              <View style={styles.dynamicTitleRow}>
                <Text style={styles.dynamicTitle} numberOfLines={1}>
                  {item.brand} · {item.name}
                </Text>
                {index === 0 ? <Text style={styles.inProgressBadge}>En curso</Text> : null}
              </View>
              <Text style={styles.dynamicDescription}>{item.description}</Text>
            </View>
          </View>
          <Text style={styles.remainingText}>{item.remaining}</Text>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Progreso del reto</Text>
            <Text style={styles.progressValue}>{item.progress}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: index === 0 ? '80%' : index === 1 ? '50%' : '67%' },
              ]}
            />
          </View>
          <View style={styles.dynamicFooter}>
            <Text style={styles.rewardText}>✦  {item.reward}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => showUnavailableFeature(`Reto ${item.name}`)}
              hitSlop={8}
            >
              <Text style={styles.linkText}>{index === 0 ? 'Ver detalles' : 'Ver dinámica'}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );

  const renderCoupons = () => (
    <View style={styles.section}>
      <SectionHeading
        title="Cupones listos para usar"
        subtitle="Toca para ver el código y canjear en tienda"
        count="3"
      />
      {coupons.map((coupon, index) => (
        <View key={coupon.code} style={styles.couponCard}>
          <View style={styles.couponTopRow}>
            <Text style={styles.couponOffer}>{coupon.offer}</Text>
            <Text style={[styles.couponExpiry, index === 1 && styles.verifiedText]}>
              {index === 1 ? '✓ ' : '◷  '}
              {coupon.expiry}
            </Text>
          </View>
          <View style={styles.couponBrandRow}>
            <View style={[styles.brandIcon, styles.couponBrandIcon]}>
              <Text style={styles.brandIconText}>{coupon.icon}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.couponBrand}>{coupon.brand}</Text>
              <Text style={styles.couponDescription}>{coupon.description}</Text>
            </View>
          </View>
          <View style={styles.couponFooter}>
            <View style={styles.couponCodeBox}>
              <Text style={styles.codeCaption}>CÓDIGO DE CANJE</Text>
              <Text style={styles.couponCode}>{coupon.code}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => showCouponCode(coupon.brand, coupon.code)}
              style={({ pressed }) => [styles.couponButton, pressed && styles.pressed]}
            >
              <Text style={styles.couponButtonText}>{coupon.action}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );

  const renderHome = () => (
    <>
      <View style={styles.greetingRow}>
        <View style={styles.flex}>
          <View style={styles.membershipBadge}>
            <Text style={styles.membershipSpark}>✦</Text>
            <Text style={styles.membershipText}>MEMBRESÍA ACTIVA PRO</Text>
          </View>
          <Text style={styles.greeting}>¡Hola, Sofía!</Text>
        </View>
        <View style={styles.savingsIcon}>
          <Text style={styles.savingsIconText}>▣</Text>
        </View>
      </View>
      {renderBalanceCard()}
      {renderQuickActions()}
      {renderLoyaltyCard()}
      {renderDynamics()}
      {renderCoupons()}
      <View style={styles.savingsTip}>
        <View style={styles.tipIcon}>
          <Text style={styles.tipIconText}>✧</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.tipTitle}>Consejo de ahorro</Text>
          <Text style={styles.tipDescription}>
            Tienes 2 suscripciones con prueba anual disponible.
          </Text>
        </View>
        <Text style={styles.tipArrow}>›</Text>
      </View>
    </>
  );

  const renderWallet = () => (
    <>
      <Text style={styles.pageTitle}>Tu billetera</Text>
      <Text style={styles.pageDescription}>Tus puntos y movimientos de Benefy</Text>
      {renderBalanceCard()}
      <View style={styles.section}>
        <SectionHeading title="Actividad reciente" subtitle="Tus últimos movimientos" />
        {[
          { icon: '☕', title: 'Visita en Café Blend', date: 'Hoy · 09:42', points: '+150 pts' },
          { icon: '♨', title: 'Compra en Burger Shack', date: 'Ayer · 14:18', points: '+300 pts' },
          { icon: '✦', title: 'Bono de bienvenida', date: '12 oct · 10:03', points: '+500 pts' },
        ].map((entry) => (
          <View key={entry.title} style={styles.activityRow}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandIconText}>{entry.icon}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.activityTitle}>{entry.title}</Text>
              <Text style={styles.activityDate}>{entry.date}</Text>
            </View>
            <Text style={styles.activityPoints}>{entry.points}</Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderTabContent = () => {
    if (activeTab === 'Inicio') {
      return renderHome();
    }

    if (activeTab === 'Dinámicas') {
      return (
        <>
          <Text style={styles.pageTitle}>Tus dinámicas</Text>
          <Text style={styles.pageDescription}>Misiones activas y recompensas por desbloquear</Text>
          {renderDynamics()}
        </>
      );
    }

    if (activeTab === 'Cupones') {
      return (
        <>
          <Text style={styles.pageTitle}>Tus cupones</Text>
          <Text style={styles.pageDescription}>Beneficios listos para disfrutar</Text>
          {renderCoupons()}
        </>
      );
    }

    return renderWallet();
  };

  const tabs: { label: Tab; icon: string }[] = [
    { label: 'Inicio', icon: '▦' },
    { label: 'Dinámicas', icon: 'ϟ' },
    { label: 'Cupones', icon: '◇' },
    { label: 'Billetera', icon: '▣' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>B</Text>
        </View>
        <Text style={styles.logoText}>Benefy</Text>
        <View style={styles.headerSpacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notificaciones"
          onPress={() => Alert.alert('Notificaciones', 'No tienes notificaciones nuevas.')}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Text style={styles.headerButtonIcon}>♧</Text>
          <View style={styles.notificationDot} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Perfil de Sofía"
          onPress={() => Alert.alert('Perfil', 'Tu perfil de Benefy estará disponible próximamente.')}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
        >
          <Text style={styles.avatarText}>S</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderTabContent()}
      </ScrollView>
      <View style={styles.bottomBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.label;
          return (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => goToTab(tab.label)}
              style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '800',
  },
  logoText: {
    marginLeft: 8,
    color: colors.greenDark,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSpacer: {
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerButtonIcon: {
    color: colors.ink,
    fontSize: 22,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5484D',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0D8C8',
    borderWidth: 2,
    borderColor: '#F6ECE5',
  },
  avatarText: {
    color: '#76533F',
    fontWeight: '700',
    fontSize: 15,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  flex: {
    flex: 1,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  membershipSpark: {
    color: colors.green,
    fontSize: 13,
    marginRight: 5,
  },
  membershipText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  greeting: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  savingsIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#E9EAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  savingsIconText: {
    color: colors.green,
    fontSize: 23,
    fontWeight: '700',
  },
  balanceCard: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.green,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#075E4E',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  balanceDecoration: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -66,
    top: 24,
    borderWidth: 20,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#E4F6F0',
    fontSize: 12,
    fontWeight: '600',
  },
  monthlyBadge: {
    backgroundColor: '#8CF2C1',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  monthlyBadgeText: {
    color: '#075C47',
    fontSize: 10,
    fontWeight: '700',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    marginBottom: 15,
  },
  pointsValue: {
    color: colors.surface,
    fontSize: 37,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1,
    marginRight: 9,
  },
  pointsCaption: {
    color: '#E0F5ED',
    fontSize: 12,
  },
  benefitsRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  benefitsIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  benefitsIconText: {
    color: colors.surface,
    fontSize: 18,
  },
  benefitsEyebrow: {
    color: '#D2F1E5',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  benefitsTitle: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  detailButton: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 6,
  },
  detailButtonText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  quickAction: {
    width: '23.5%',
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: '#F0EFFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickIcon_green: {
    backgroundColor: colors.green,
  },
  quickIcon_mint: {
    backgroundColor: '#8BF0BD',
  },
  quickIcon_lavender: {
    backgroundColor: '#E3E5FA',
  },
  quickIcon_white: {
    backgroundColor: '#FFFFFF',
  },
  quickIconText: {
    color: colors.greenDark,
    fontSize: 22,
    fontWeight: '700',
  },
  quickIconTextLight: {
    color: colors.surface,
  },
  quickLabel: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '600',
  },
  loyaltyCard: {
    backgroundColor: colors.surface,
    borderRadius: 19,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F0EFF4',
  },
  loyaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  activeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    marginRight: 7,
  },
  activeLabelText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  visitsBadge: {
    overflow: 'hidden',
    color: '#455154',
    backgroundColor: '#F0EFF8',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '700',
  },
  loyaltyTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  loyaltyDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 13,
  },
  stampsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F3F3FC',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  stampItem: {
    alignItems: 'center',
    width: '19%',
  },
  stampDone: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampCheck: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: '700',
  },
  stampGoal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#A1F0C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampGoalIcon: {
    color: colors.green,
    fontSize: 20,
  },
  stampNumber: {
    color: '#536363',
    fontSize: 10,
    marginTop: 4,
  },
  loyaltyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  participatingCafe: {
    color: '#536363',
    fontSize: 11,
  },
  registerVisit: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '800',
  },
  section: {
    marginBottom: 22,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  countBadge: {
    color: colors.greenDark,
    backgroundColor: colors.mint,
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '700',
  },
  dynamicCard: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0EFF4',
  },
  dynamicTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 68,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandIconText: {
    color: colors.greenDark,
    fontSize: 21,
    fontWeight: '700',
  },
  dynamicInfo: {
    flex: 1,
  },
  dynamicTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dynamicTitle: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  inProgressBadge: {
    color: colors.greenDark,
    backgroundColor: colors.paleGreen,
    fontSize: 8,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 5,
  },
  dynamicDescription: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  remainingText: {
    position: 'absolute',
    top: 17,
    right: 14,
    color: colors.muted,
    fontSize: 9,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
    marginBottom: 6,
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 10,
  },
  progressValue: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EDEEF1',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#35BD8F',
  },
  dynamicFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 11,
  },
  rewardText: {
    flexShrink: 1,
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '600',
  },
  linkText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 8,
  },
  couponCard: {
    backgroundColor: colors.surface,
    borderRadius: 17,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0EFF4',
  },
  couponTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  couponOffer: {
    color: colors.greenDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.35,
    flexShrink: 1,
  },
  couponExpiry: {
    color: colors.muted,
    fontSize: 9,
    marginLeft: 6,
  },
  verifiedText: {
    color: colors.greenDark,
  },
  couponBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponBrandIcon: {
    backgroundColor: '#F2F1FA',
  },
  couponBrand: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  couponDescription: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  couponFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 11,
    marginTop: 11,
  },
  couponCodeBox: {
    flex: 1,
  },
  codeCaption: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  couponCode: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 3,
  },
  couponButton: {
    minWidth: 86,
    alignItems: 'center',
    backgroundColor: colors.paleGreen,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginLeft: 8,
  },
  couponButtonText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '800',
  },
  savingsTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0EFFB',
    borderRadius: 17,
    padding: 14,
    marginBottom: 10,
  },
  tipIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E2E1F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  tipIconText: {
    color: colors.greenDark,
    fontSize: 22,
  },
  tipTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  tipDescription: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  tipArrow: {
    color: colors.greenDark,
    fontSize: 28,
    marginLeft: 8,
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginBottom: 3,
  },
  pageDescription: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 18,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  activityTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  activityDate: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 3,
  },
  activityPoints: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '800',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 8,
    paddingBottom: 3,
    paddingHorizontal: 9,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  tabIcon: {
    color: '#4F595B',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  tabIconActive: {
    color: colors.greenDark,
  },
  tabLabel: {
    color: '#4F595B',
    fontSize: 9,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.greenDark,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
