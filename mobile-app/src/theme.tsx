import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export const lightColors = {
  navy: '#002647',
  mint: '#64F9BC',
  green: '#006C4B',
  ink: '#191C1E',
  muted: '#626A71',
  background: '#F7F9FB',
  panel: '#FFFFFF',
  subtle: '#F0F3F5',
  line: '#E4E9EC',
  brand: '#002647',
  onBrand: '#FFFFFF',
  onMint: '#002647',
  primary: '#002647',
  onPrimary: '#FFFFFF',
  danger: '#A4212E',
  dangerText: '#A4212E',
  onDanger: '#FFFFFF',
  inactive: '#5B6472',
  positiveSurface: '#DCF8ED',
  backdrop: '#00182D99',
};

export type ThemeColors = typeof lightColors;

const darkColors: ThemeColors = {
  ...lightColors,
  navy: '#E5F1FC',
  green: '#79E8B8',
  ink: '#EDF3F7',
  muted: '#ACBCCB',
  background: '#0D1622',
  panel: '#152333',
  subtle: '#1D3043',
  line: '#354A60',
  brand: '#102E49',
  primary: '#64F9BC',
  onPrimary: '#002647',
  danger: '#A4212E',
  dangerText: '#FFABB2',
  inactive: '#A6B6C7',
  positiveSurface: '#173D39',
  backdrop: '#050A10BB',
};

export const themePreferences = ['Sistema', 'Claro', 'Oscuro'] as const;
type ThemePreference = typeof themePreferences[number];
const storageKey = 'benefy.theme';

const ThemeContext = createContext<{
  colors: ThemeColors;
  dark: boolean;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
} | null>(null);

export function BenefyThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [storedPreference, setStoredPreference] = useState<ThemePreference | null>(null);
  const [changedPreference, setChangedPreference] = useState<ThemePreference>();
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(
      value => { if (active) setStoredPreference(themePreferences.find(option => option === value) ?? 'Sistema'); },
      () => { if (active) setStoredPreference('Sistema'); },
    );
    return () => { active = false; };
  }, []);

  const preference = changedPreference ?? storedPreference ?? 'Sistema';
  const dark = preference === 'Oscuro' || (preference === 'Sistema' && system === 'dark');
  const setPreference = (value: ThemePreference) => {
    setChangedPreference(value);
    void AsyncStorage.setItem(storageKey, value).catch(() => {});
  };
  return <ThemeContext.Provider value={{ colors: dark ? darkColors : lightColors, dark, preference, setPreference }}>
    {children}
  </ThemeContext.Provider>;
}

export function useBenefyTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('Falta el proveedor de apariencia de Benefy.');
  return theme;
}

export function createThemedStyles<T>(create: (colors: ThemeColors) => T) {
  const light = create(lightColors);
  const dark = create(darkColors);
  return function useThemedStyles() {
    return useBenefyTheme().dark ? dark : light;
  };
}
