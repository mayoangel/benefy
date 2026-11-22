import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ title, subtitle, children, tabs = false, scroll, header, headerActions, footer }: {
  title: string; subtitle?: string; children: ReactNode; tabs?: boolean;
  scroll?: Pick<ScrollViewProps, 'refreshControl'>; header?: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
}) {
  const styles = useUiStyles();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen} edges={tabs ? ['left', 'right'] : ['bottom', 'left', 'right']}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          {!tabs && <Button label="‹" accessibilityLabel="Volver" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} kind="quiet" />}
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
          </View>
          {headerActions}
        </View>
      </SafeAreaView>
      {header}
      <ScrollView {...scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

export function Button({ label, onPress, disabled, accessibilityLabel, icon, kind = 'primary' }: {
  label: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  kind?: 'primary' | 'quiet' | 'danger';
}) {
  const { colors } = useBenefyTheme();
  const styles = useUiStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[kind], icon && styles.iconButton, (pressed || disabled) && styles.dim]}>
      {icon && <MaterialIcons name={icon} size={20} color={kind === 'quiet' ? colors.navy : kind === 'danger' ? colors.onDanger : colors.onPrimary} />}
      <Text style={[styles.buttonText, kind === 'quiet' && styles.quietText, kind === 'danger' && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const styles = useUiStyles();
  return <View style={styles.card}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  const styles = useUiStyles();
  return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
}

export function Copy({ children }: { children: ReactNode }) {
  const styles = useUiStyles();
  return <Text style={styles.muted}>{children}</Text>;
}

export function Row({ children }: { children: ReactNode }) {
  const styles = useUiStyles();
  return <View style={styles.row}>{children}</View>;
}

export function Choice<T extends string>({ values, value, onChange }: {
  values: readonly T[]; value: T; onChange: (value: T) => void;
}) {
  const styles = useUiStyles();
  return <Row>{values.map(option => (
    <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: value === option }}
      onPress={() => onChange(option)} style={[styles.choice, value === option && styles.selected]}>
      <Text style={[styles.quietText, value === option && styles.selectedText]}>{option}</Text>
    </Pressable>
  ))}</Row>;
}

export function Notice({ title, message, retry }: { title: string; message?: string; retry?: () => void }) {
  return <Card><Heading>{title}</Heading>{message && <Copy>{message}</Copy>}
    {retry && <Button label="Reintentar" onPress={retry} />}</Card>;
}

export function Skeleton() {
  const styles = useUiStyles();
  return <View accessibilityLabel="Cargando" accessibilityState={{ busy: true }} style={styles.skeletons}>
    {[1, 2, 3].map(item => <View key={item} style={styles.skeleton} />)}
  </View>;
}

export const useUiStyles = createThemedStyles(colors => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.panel },
  header: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.panel },
  flex: { flex: 1 },
  title: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  heading: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  body: { gap: 14, padding: 16, paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, padding: 14, borderRadius: 16, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  iconButton: { flexDirection: 'row', gap: 8 },
  button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  primary: { backgroundColor: colors.primary },
  quiet: { backgroundColor: colors.subtle },
  danger: { backgroundColor: colors.danger },
  dim: { opacity: 0.55 },
  buttonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  dangerText: { color: colors.onDanger },
  quietText: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  choice: { backgroundColor: colors.subtle, padding: 10, minHeight: 44, justifyContent: 'center', borderRadius: 10 },
  selected: { backgroundColor: colors.mint },
  selectedText: { color: colors.onMint },
  skeletons: { gap: 12 },
  skeleton: { borderRadius: 16, backgroundColor: colors.line, height: 100 },
  field: { minHeight: 46, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 10, color: colors.ink, padding: 10 },
  error: { color: colors.dangerText, fontSize: 14 },
}));
