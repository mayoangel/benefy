import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

export const demoPoints = 520;

export { lightColors as homeColors } from '../theme';

export const merchants = [
  {
    name: 'Café Blend', category: 'Cafetería de especialidad', icon: '☕',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTIydDDtiuSFM0upz57AX79OP192lhjMecBJ9cKEib_8TReUqTpKMAera01uE3ydfqZj_fDnQv4sbSAneB6RlmlQ2XJQ1Jikg6hItYlDGqSqlxuo9apvy_eq6b1J3W-6AxkjCxK2JHvjiWPpMMsEOLQQVY5YFuCjuivq2W18b7QdNsJT9QQvyzwSdK2OTV7B-RiShJfdyWbX3rHv0AcJS9MrFGjqv9cg9cYCLsOUo',
    goalLabel: 'Sellos', goal: '7 de 10 visitas', progress: '70%',
    balanceLabel: 'Monedero', balance: '280 pts', note: 'Equivale a 2,80 €',
    tag: '2 alianzas', action: 'Ver progreso',
  },
  {
    name: 'Gimnasio Fuerza', category: 'Fitness y entrenamiento', icon: '🏋',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBtc0qklTgjt07-gGqoop6IWtqJQPbO-vU2WtqaBdO3tZ3pnF4voUeFZnEksAvCHTSjX9qPSZ1lbaC0n3ekpJnsFvN4fBo3DXpeui9HalZJiV3E8KRty88lV85F1-wBSE8zlOUim9QiJ6VSDnB53i9F4J8HG5Wb3PhAstbSKUztx55a0Nq9vAK3Emf8pnR34mq5CE5ROpZ0J_R303607KG1xLmQBJ3rJ0xXPqaNi4Q',
    goalLabel: 'Objetivo', goal: '12 de 12 visitas', progress: '100%',
    balanceLabel: 'Puntos acumulados', balance: '90 pts', note: 'Nivel Plata',
    tag: '¡Premio listo!', action: 'Canjear pase libre',
  },
  {
    name: 'Nutrimax Suplementos', category: 'Nutrición y salud deportiva', icon: '🌿',
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDtDd2L2NYh3tia7tXMOsqNLtUrc4pjcIolflFsVc8tivRA2l9bE7eoh5gmiY4ot7XiOvykqftJz0TzLwiCvw5kbxmmCqwzNJ0_v9QLq2lmbAtUAdpPdaarIC7f0HqAZ9SO9R8N91th1LgxxGG3u_FC_XZyixr9Z9vAzJUTf-vayVIruk-wxEE57FI4yrAWukj-SGx62iqn81vepMDceMMQlrc7swMf5U5X0L71o-k',
    goalLabel: 'Convenio', goal: 'Alianza con Café Blend', progress: null,
    balanceLabel: 'Balance', balance: '150 pts', note: 'Descuento del 15%',
    tag: '1 cupón disponible', action: 'Ver beneficios',
  },
] as const;

type HomeDashboardProps = {
  cards?: readonly (typeof merchants)[number][];
  name?: string;
  onBusiness?: (index: number) => void;
  onDynamics: () => void;
  onCoupons: () => void;
  onScan: () => void;
};

export default function HomeDashboard({
  cards = merchants,
  name = 'Alex',
  onBusiness,
  onDynamics,
  onCoupons,
  onScan,
}: HomeDashboardProps) {
  const { colors } = useBenefyTheme();
  const styles = useStyles();
  return (
    <View style={styles.dashboard}>
      <View>
        <Text accessibilityRole="header" style={styles.greeting}>¡Hola, {name}! 👋</Text>
        <Text style={styles.description}>Tus comercios favoritos</Text>
      </View>

      <View style={styles.summary}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.summaryLabel}>TOTAL ACUMULADO</Text>
            <Text style={styles.points}>
              {demoPoints} <Text style={styles.pointsUnit}>pts Benefy</Text>
            </Text>
            <View style={styles.summaryTags}>
              <View style={styles.summaryTag}>
                <MaterialIcons name="storefront" size={14} color={colors.mint} />
                <Text style={styles.summaryTagText}>{cards.length} activos</Text>
              </View>
              <View style={styles.summaryTag}>
                <MaterialIcons name="redeem" size={14} color={colors.mint} />
                <Text style={styles.summaryTagText}>1 premio listo</Text>
              </View>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escanear código QR"
            onPress={onScan}
            style={({ pressed }) => [styles.summaryScan, pressed && styles.pressed]}
          >
            <MaterialIcons name="qr-code-scanner" size={24} color={colors.onMint} />
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Tus tarjetas activas</Text>
        <Text style={styles.sectionCount}>{cards.length} comercios</Text>
      </View>

      {cards.map((merchant, index) => (
        <Pressable
          key={merchant.name}
          accessibilityRole="button"
          accessibilityLabel={`${merchant.name}, ${merchant.category}. ${merchant.goal}. ${merchant.balance}.`}
          accessibilityHint={onBusiness ? 'Abre la información del negocio' : merchant.action}
          onPress={onBusiness ? () => onBusiness(index) : index === 0 ? onDynamics : index === 1
            ? () => Alert.alert('Gimnasio Fuerza', 'El canje del pase libre estará disponible cuando se conecten los servicios de Benefy.')
            : onCoupons}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.merchantHeading}>
            <View accessible={false} style={styles.merchantIcon}>
              <Text style={styles.emoji}>{merchant.icon}</Text>
              <Image source={{ uri: merchant.logo }} style={styles.merchantLogo} />
            </View>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.merchantName}>{merchant.name}</Text>
              <Text style={styles.description}>{merchant.category}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <View style={styles.row}>
                <Text style={[styles.description, styles.flex]}>{merchant.goalLabel}</Text>
                <MaterialIcons name={merchant.progress ? 'loyalty' : 'handshake'} size={16} color={colors.green} />
              </View>
              <Text style={styles.metricValue}>{merchant.goal}</Text>
              {merchant.progress && (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: merchant.progress }]} />
                </View>
              )}
            </View>
            <View style={styles.metric}>
              <View style={styles.row}>
                <Text style={[styles.description, styles.flex]}>{merchant.balanceLabel}</Text>
                <MaterialIcons name="stars" size={16} color={colors.green} />
              </View>
              <Text style={styles.metricValue}>{merchant.balance}</Text>
              <Text style={styles.description}>{merchant.note}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.tag}>{merchant.tag}</Text>
            <Text style={styles.link}>{merchant.action}</Text>
          </View>
        </Pressable>
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={onScan}
        style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
      >
        <MaterialIcons name="qr-code-scanner" size={21} color={colors.onMint} />
        <Text style={styles.scanLabel}>Escanear QR de un nuevo comercio</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(colors => StyleSheet.create({
  dashboard: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1 },
  greeting: { color: colors.navy, fontSize: 27, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 13 },
  summary: { backgroundColor: colors.brand, borderRadius: 20, padding: 18, gap: 6 },
  summaryLabel: { color: colors.mint, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  points: { color: colors.onBrand, fontSize: 38, fontWeight: '800' },
  pointsUnit: { color: colors.mint, fontSize: 15, fontWeight: '600' },
  summaryScan: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.mint,
  },
  summaryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  summaryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#133C64',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  summaryTagText: { color: colors.onBrand, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: colors.navy, flex: 1, fontSize: 19, fontWeight: '800' },
  sectionCount: { color: colors.muted, backgroundColor: colors.subtle, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  merchantHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  merchantIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  merchantLogo: { position: 'absolute', width: 44, height: 44 },
  emoji: { fontSize: 22 },
  merchantName: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: colors.subtle, borderRadius: 12, padding: 10, gap: 4 },
  metricValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.green },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  tag: {
    color: colors.green,
    backgroundColor: colors.positiveSurface,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  link: { color: colors.green, fontSize: 13, fontWeight: '700' },
  scanButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.mint,
    borderRadius: 14,
  },
  scanLabel: { color: colors.onMint, flexShrink: 1, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.72 },
}));
