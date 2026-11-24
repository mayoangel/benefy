import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';

export const notificationTypes = [
  'Visita registrada',
  'Meta completada',
  'Cupón desbloqueado',
  'Cupón de alianza',
  'Promociones',
] as const;

type Preferences = Record<string, boolean>;

const storageKey = 'benefy.notification-preferences';

const PreferencesContext = createContext<{
  preferences: Preferences;
  notificationPrompted: boolean;
  togglePreference: (key: string, value: boolean) => void;
  markNotificationPrompted: () => void;
} | null>(null);

export function PreferencesProvider({
  children,
  accountId,
}: {
  children: ReactNode;
  accountId?: string;
}) {
  const [preferences, setPreferences] = useState<Preferences>({});
  const [notificationPrompted, setNotificationPrompted] = useState(false);
  const [previousAccount, setPreviousAccount] = useState(accountId);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(
      value => {
        if (!active) return;
        try {
          const parsed: unknown = value ? JSON.parse(value) : {};
          if (parsed && typeof parsed === 'object') {
            setPreferences(parsed as Preferences);
          }
        } catch {
          setPreferences({});
        }
      },
      () => {},
    );
    return () => { active = false; };
  }, []);

  if (previousAccount !== accountId) {
    setPreviousAccount(accountId);
    setPreferences({});
    setNotificationPrompted(false);
  }

  const togglePreference = useCallback((key: string, value: boolean) => {
    setPreferences(previous => {
      const next = { ...previous, [key]: value };
      void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return <PreferencesContext.Provider value={{
    preferences,
    notificationPrompted,
    togglePreference,
    markNotificationPrompted: () => setNotificationPrompted(true),
  }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('Falta el proveedor de preferencias móviles.');
  return value;
}
