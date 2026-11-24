import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export type HomeBusiness = {
  id: number;
  nombre: string;
  categoria: string;
  logo_url: string | null;
  puntos: number;
  meta: number | null;
  sellos: number;
  listo: boolean;
};

type HomeDashboardProps = {
  name: string;
  points: number;
  businesses: readonly HomeBusiness[];
  readyRewards: number;
  onBusiness: (id: number) => void;
  onDynamics: () => void;
  onCoupons: () => void;
  onScan: () => void;
  onExplore: () => void;
};

function BusinessLogo({ business, size = 44 }: { business: HomeBusiness; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#E8F4EE', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#006C4B', fontSize: size * 0.4, fontWeight: '800' }}>
      {business.nombre.trim().slice(0, 1).toUpperCase() || 'B'}
    </Text>
    {business.logo_url && <Image source={{ uri: business.logo_url }}
      style={{ position: 'absolute', width: size, height: size }} />}
  </View>;
}

export default function HomeDashboard({
  name,
  points,
  businesses,
  readyRewards,
  onBusiness,
  onDynamics,
  onCoupons,
  onScan,
  onExplore,
}: HomeDashboardProps) {
  const { colors } = useBenefyTheme();
  const styles = useStyles();
  return (
    <View style={styles.dashboard}>
      <View>
        <Text accessibilityRole="header" style={styles.greeting}>Hola, {name}</Text>
        <Text style={styles.description}>Tus comercios y beneficios reales</Text>
      </View>

      <View style={styles.summary}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.summaryLabel}>TOTAL ACUMULADO</Text>
            <Text style={styles.points}>
              {points} <Text style={styles.pointsUnit}>pts Benefy</Text>
            </Text>
            <View style={styles.summaryTags}>
              <View style={styles.summaryTag}>
                <MaterialIcons name="storefront" size={14} color={colors.mint} />
                <Text style={styles.summaryTagText}>{businesses.length} activos</Text>
              </View>
              <View style={styles.summaryTag}>
                <MaterialIcons name="redeem" size={14} color={colors.mint} />
                <Text style={styles.summaryTagText}>{readyRewards} premios listos</Text>
              </View>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Escanear código QR"
            onPress={onScan} style={({ pressed }) => [styles.summaryScan, pressed && styles.pressed]}>
            <MaterialIcons name="qr-code-scanner" size={24} color={colors.onMint} />
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Tus tarjetas activas</Text>
        <Pressable accessibilityRole="button" onPress={onExplore}
          style={({ pressed }) => [styles.explore, pressed && styles.pressed]}>
          <Text style={styles.link}>Descubrir</Text>
          <MaterialIcons name="arrow-forward" size={16} color={colors.green} />
        </Pressable>
      </View>

      {businesses.length === 0 && <View style={styles.empty}>
        <MaterialIcons name="storefront" size={28} color={colors.green} />
        <Text style={styles.description}>Aún no tienes tarjetas. Escanea el QR de un comercio o descubre negocios.</Text>
        <Pressable accessibilityRole="button" onPress={onExplore}
          style={({ pressed }) => [styles.explore, pressed && styles.pressed]}>
          <Text style={styles.link}>Ver negocios</Text>
          <MaterialIcons name="arrow-forward" size={16} color={colors.green} />
        </Pressable>
      </View>}

      {businesses.map(business => (
        <Pressable key={business.id} accessibilityRole="button"
          accessibilityLabel={`${business.nombre}, ${business.puntos} puntos, ${business.meta ? `${business.sellos} de ${business.meta} sellos` : 'sin tarjeta activa'}`}
          accessibilityHint="Abre la información del negocio"
          onPress={() => onBusiness(business.id)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.merchantHeading}>
            <BusinessLogo business={business} />
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.merchantName}>{business.nombre}</Text>
              <Text style={styles.description}>{business.categoria}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <View style={styles.row}>
                <Text style={[styles.description, styles.flex]}>Tarjeta de sellos</Text>
                <MaterialIcons name="loyalty" size={16} color={colors.green} />
              </View>
              <Text style={styles.metricValue}>
                {business.meta ? `${business.sellos} de ${business.meta} sellos` : 'Sin tarjeta activa'}
              </Text>
              {business.meta && <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(business.sellos / business.meta, 1) * 100}%` }]} />
              </View>}
            </View>
            <View style={styles.metric}>
              <View style={styles.row}>
                <Text style={[styles.description, styles.flex]}>Saldo</Text>
                <MaterialIcons name="stars" size={16} color={colors.green} />
              </View>
              <Text style={styles.metricValue}>{business.puntos} pts</Text>
              <Text style={styles.description}>{business.listo ? 'Premio listo' : 'Sigue acumulando'}</Text>
            </View>
          </View>
        </Pressable>
      ))}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onCoupons}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <MaterialIcons name="confirmation-number" size={20} color={colors.green} />
          <Text style={styles.actionText}>Mis cupones</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDynamics}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <MaterialIcons name="loyalty" size={20} color={colors.green} />
          <Text style={styles.actionText}>Mis tarjetas</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={onScan}
        style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}>
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
  summaryScan: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: colors.mint },
  summaryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  summaryTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#133C64',
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  summaryTagText: { color: colors.onBrand, fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: colors.navy, flex: 1, fontSize: 19, fontWeight: '800' },
  explore: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { color: colors.green, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, padding: 20, borderRadius: 16, backgroundColor: colors.subtle },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  merchantHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  merchantName: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: colors.subtle, borderRadius: 12, padding: 10, gap: 4 },
  metricValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.green },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 14, backgroundColor: colors.subtle },
  actionText: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  scanButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 12, backgroundColor: colors.mint, borderRadius: 14 },
  scanLabel: { color: colors.onMint, flexShrink: 1, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.72 },
}));
