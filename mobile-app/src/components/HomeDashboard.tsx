import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

export const demoPoints = 520;

export const homeColors = {
  navy: '#002647',
  mint: '#64F9BC',
  green: '#006C4B',
  ink: '#191C1E',
  muted: '#626A71',
  background: '#F7F9FB',
  panel: '#FFFFFF',
  subtle: '#F0F3F5',
  line: '#E4E9EC',
};

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
  unread?: number;
  onNotifications?: () => void;
  onBusiness?: (index: number) => void;
  onHistory: () => void;
  onDynamics: () => void;
  onCoupons: () => void;
  onScan: () => void;
};

export default function HomeDashboard({
  cards = merchants,
  name = 'Alex',
  unread = 0,
  onNotifications,
  onBusiness,
  onHistory,
  onDynamics,
  onCoupons,
  onScan,
}: HomeDashboardProps) {
  return (
    <View style={styles.dashboard}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.greeting}>¡Hola, {name}! 👋</Text>
          <Text style={styles.description}>Tus comercios favoritos</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Historial" onPress={onHistory} style={styles.historyButton}>
          <Text style={styles.link}>↶</Text>
        </Pressable>
        {onNotifications && (
          <Pressable accessibilityRole="button" accessibilityLabel={`Notificaciones, ${unread} sin leer`}
            onPress={onNotifications} style={styles.historyButton}>
            <Text style={styles.link}>🔔{unread > 0 ? ` ${unread}` : ''}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.summary}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.summaryLabel}>TOTAL ACUMULADO</Text>
            <Text style={styles.points}>
              {demoPoints} <Text style={styles.pointsUnit}>pts Benefy</Text>
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escanear código QR"
            onPress={onScan}
            style={({ pressed }) => [styles.summaryScan, pressed && styles.pressed]}
          >
            <Text style={styles.link}>QR</Text>
          </Pressable>
        </View>
        <View style={styles.summaryTags}>
          <Text style={styles.summaryTag}>{cards.length} comercios activos</Text>
          <Text style={styles.summaryTag}>1 premio listo</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Tus tarjetas activas</Text>
        <Text style={styles.sectionCount}>{cards.length} comercios</Text>
      </View>

      {cards.map((merchant, index) => (
        <View key={merchant.name} style={styles.card}>
          <View style={styles.merchantHeading}>
            <View accessible={false} style={styles.merchantIcon}>
              <Text style={styles.emoji}>{merchant.icon}</Text>
              <Image source={{ uri: merchant.logo }} style={styles.merchantLogo} />
            </View>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.merchantName}>{merchant.name}</Text>
              <Text style={styles.description}>{merchant.category}</Text>
            </View>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.description}>{merchant.progress ? '◉' : '◇'} {merchant.goalLabel}</Text>
              <Text style={styles.metricValue}>{merchant.goal}</Text>
              {merchant.progress && (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: merchant.progress }]} />
                </View>
              )}
            </View>
            <View style={styles.metric}>
              <Text style={styles.description}>★ {merchant.balanceLabel}</Text>
              <Text style={styles.metricValue}>{merchant.balance}</Text>
              <Text style={styles.description}>{merchant.note}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.tag}>{merchant.tag}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${merchant.action} de ${merchant.name}`}
              onPress={onBusiness ? () => onBusiness(index) : index === 0 ? onDynamics : index === 1
                ? () => Alert.alert('Gimnasio Fuerza', 'El canje del pase libre estará disponible cuando se conecten los servicios de Benefy.')
                : onCoupons}
              style={styles.cardAction}
            >
              <Text style={styles.link}>{merchant.action} ›</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={onScan}
        style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
      >
        <Text style={styles.scanLabel}>Escanear QR de un nuevo comercio</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1 },
  greeting: { color: homeColors.navy, fontSize: 27, fontWeight: '800' },
  description: { color: homeColors.muted, fontSize: 13 },
  historyButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: homeColors.subtle,
  },
  summary: { backgroundColor: homeColors.navy, borderRadius: 20, padding: 18, gap: 6 },
  summaryLabel: { color: homeColors.mint, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  points: { color: homeColors.panel, fontSize: 38, fontWeight: '800' },
  pointsUnit: { color: homeColors.mint, fontSize: 15, fontWeight: '600' },
  summaryScan: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: homeColors.mint,
  },
  summaryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  summaryTag: {
    color: homeColors.panel,
    backgroundColor: '#133C64',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: { color: homeColors.navy, flex: 1, fontSize: 19, fontWeight: '800' },
  sectionCount: { color: homeColors.muted, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: homeColors.panel,
    borderColor: homeColors.line,
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
    backgroundColor: homeColors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  merchantLogo: { position: 'absolute', width: 44, height: 44 },
  emoji: { fontSize: 22 },
  merchantName: { color: homeColors.navy, fontSize: 16, fontWeight: '800' },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: homeColors.subtle, borderRadius: 12, padding: 10, gap: 4 },
  metricValue: { color: homeColors.ink, fontSize: 14, fontWeight: '700' },
  track: { height: 5, borderRadius: 3, backgroundColor: homeColors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: homeColors.green },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  tag: {
    color: homeColors.green,
    backgroundColor: '#DCF8ED',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  cardAction: { minHeight: 44, justifyContent: 'center' },
  link: { color: homeColors.green, fontSize: 13, fontWeight: '700' },
  scanButton: {
    minHeight: 48,
    justifyContent: 'center',
    padding: 12,
    backgroundColor: homeColors.mint,
    borderRadius: 14,
  },
  scanLabel: { color: homeColors.navy, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
