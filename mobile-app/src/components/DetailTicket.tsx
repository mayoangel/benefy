import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function DetailTicket({ title, subtitle, status, available, children }: {
  title: string; subtitle: string; status: string; available: boolean; children: ReactNode;
}) {
  const { colors } = useBenefyTheme();
  const styles = useStyles();
  return <View style={styles.ticket}>
    <View style={styles.hero}>
      <View style={styles.top}>
        <MaterialIcons name="confirmation-number" size={28} color={colors.mint} />
        <Text style={[styles.badge, available && styles.active]}>{status}</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.caption}>{subtitle}</Text>
    </View>
    <View style={styles.perforation}>
      <View style={styles.dash} />
      <View style={[styles.notch, styles.leading]} />
      <View style={[styles.notch, styles.trailing]} />
    </View>
    <View style={styles.details}>{children}</View>
  </View>;
}

const useStyles = createThemedStyles(colors => StyleSheet.create({
  ticket: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  hero: { backgroundColor: colors.brand, padding: 18, gap: 8 },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  title: { color: colors.onBrand, fontSize: 25, fontWeight: '800' },
  caption: { color: colors.mint, fontSize: 12, fontWeight: '600' },
  badge: { color: colors.muted, backgroundColor: colors.subtle, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11, fontWeight: '700' },
  active: { color: colors.onMint, backgroundColor: colors.mint },
  perforation: { justifyContent: 'center', height: 16, paddingHorizontal: 15 },
  dash: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line },
  notch: { position: 'absolute', top: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.background },
  leading: { left: -8 },
  trailing: { right: -8 },
  details: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
}));
