import { createThemedStyles, useBenefyTheme } from '../../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { type ComponentProps } from 'react';


function TabIcon({ name, focused, size }: { name: ComponentProps<typeof MaterialIcons>['name']; focused: boolean; size: number }) {
  const { colors } = useBenefyTheme();
  const styles = useStyles();
  const scan = name === 'qr-code-scanner';
  return <View style={styles.iconFrame}>
    {focused && <View style={[styles.indicator, scan && styles.scanIndicator]} />}
    <View style={scan && styles.scan}>
      <MaterialIcons name={name} size={size} color={scan ? colors.onMint : focused ? colors.green : colors.inactive} />
    </View>
  </View>;
}

export default function TabsLayout() {
  const { colors } = useBenefyTheme();
  const styles = useStyles();
  return (
    <Tabs backBehavior="history" screenOptions={{
      headerShown: false,
      animation: 'fade',
      sceneStyle: { backgroundColor: colors.background },
      tabBarActiveTintColor: colors.green,
      tabBarInactiveTintColor: colors.inactive,
      tabBarStyle: styles.bar,
      tabBarLabelPosition: 'below-icon',
      tabBarLabel: ({ focused, children }) => <Text style={[styles.label, focused && styles.activeLabel]}>{children}</Text>,
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Inicio',
        tabBarIcon: ({ focused, size }) => <TabIcon name="storefront" focused={focused} size={size} />,
      }} />
      <Tabs.Screen name="wallet" options={{
        title: 'Cartera',
        tabBarIcon: ({ focused, size }) => <TabIcon name="account-balance-wallet" focused={focused} size={size} />,
      }} />
      <Tabs.Screen name="register" options={{
        title: 'Escanear QR',
        tabBarIcon: ({ focused, size }) => <TabIcon name="qr-code-scanner" focused={focused} size={size} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Perfil',
        tabBarIcon: ({ focused, size }) => <TabIcon name="person-outline" focused={focused} size={size} />,
      }} />
    </Tabs>
  );
}

const useStyles = createThemedStyles(colors => StyleSheet.create({
  bar: { backgroundColor: colors.panel, borderTopColor: colors.line, paddingTop: 7 },
  label: { color: colors.inactive, textAlign: 'center', fontWeight: '600', fontSize: 11 },
  activeLabel: { color: colors.green, fontWeight: '800' },
  iconFrame: { width: 40, height: 28, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: -6, borderRadius: 2, width: 24, height: 3, backgroundColor: colors.green },
  scanIndicator: { top: -14 },
  scan: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint, borderRadius: 17,
    width: 34, height: 34, transform: [{ translateY: -6 }] },
}));
