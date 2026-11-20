import { usePathname, useRouter, type Href } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeColors as colors } from '../components/HomeDashboard';

export function Screen({ title, subtitle, children, tabs = false, scroll, header }: {
  title: string; subtitle?: string; children: ReactNode; tabs?: boolean;
  scroll?: Pick<ScrollViewProps, 'refreshControl'>; header?: ReactNode;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        {!tabs && <Button label="‹" accessibilityLabel="Volver" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} kind="quiet" />}
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
        </View>
      </View>
      {header}
      <ScrollView {...scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {children}
      </ScrollView>
      {tabs && <Navigation />}
    </SafeAreaView>
  );
}

const tabs: { label: string; href: Href }[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Cartera', href: '/wallet' },
  { label: 'Registrar', href: '/register' },
  { label: 'Perfil', href: '/profile' },
];

export function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  return <View style={styles.tabs}>{tabs.map(({ label, href }) => {
    const selected = pathname === href;
    return <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected }}
      onPress={() => router.navigate(href)} style={[styles.button, selected && styles.selected]}>
      <Text style={styles.quietText}>{label}</Text>
    </Pressable>;
  })}</View>;
}

export function Button({ label, onPress, disabled, accessibilityLabel, kind = 'primary' }: {
  label: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string;
  kind?: 'primary' | 'quiet' | 'danger';
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, styles[kind], (pressed || disabled) && styles.dim]}>
      <Text style={[styles.buttonText, kind === 'quiet' && styles.quietText]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
}

export function Copy({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Choice<T extends string>({ values, value, onChange }: {
  values: readonly T[]; value: T; onChange: (value: T) => void;
}) {
  return <Row>{values.map(option => (
    <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: value === option }}
      onPress={() => onChange(option)} style={[styles.choice, value === option && styles.selected]}>
      <Text style={styles.quietText}>{option}</Text>
    </Pressable>
  ))}</Row>;
}

export function Notice({ title, message, retry }: { title: string; message?: string; retry?: () => void }) {
  return <Card><Heading>{title}</Heading>{message && <Copy>{message}</Copy>}
    {retry && <Button label="Reintentar" onPress={retry} />}</Card>;
}

export function Skeleton() {
  return <View accessibilityLabel="Cargando" accessibilityState={{ busy: true }} style={styles.skeletons}>
    {[1, 2, 3].map(item => <View key={item} style={styles.skeleton} />)}
  </View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.panel },
  flex: { flex: 1 },
  title: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  heading: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  body: { gap: 14, padding: 16, paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, padding: 14, borderRadius: 16, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  tabs: { backgroundColor: colors.panel, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', paddingVertical: 3 },
  button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  primary: { backgroundColor: colors.navy },
  quiet: { backgroundColor: colors.subtle },
  danger: { backgroundColor: '#A4212E' },
  dim: { opacity: 0.55 },
  buttonText: { color: colors.panel, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  quietText: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  choice: { backgroundColor: colors.subtle, padding: 10, minHeight: 44, justifyContent: 'center', borderRadius: 10 },
  selected: { backgroundColor: colors.mint },
  skeletons: { gap: 12 },
  skeleton: { borderRadius: 16, backgroundColor: colors.line, height: 100 },
  field: { minHeight: 46, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 10, color: colors.ink, padding: 10 },
  error: { color: '#A4212E', fontSize: 14 },
});
