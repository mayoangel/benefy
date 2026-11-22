import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { merchants } from '../components/HomeDashboard';

export const businesses = [
  { ...merchants[0], id: 'blend', visits: 7, goalCount: 10, points: 280, rate: 10, address: 'Sucursal Centro' },
  { ...merchants[1], id: 'fuerza', visits: 12, goalCount: 12, points: 90, rate: 10, address: 'Sucursal Zona Río' },
  { ...merchants[2], id: 'nutrimax', visits: 0, goalCount: 0, points: 150, rate: 5, address: 'Sucursal Plaza Central' },
] as const;

export type Business = typeof businesses[number];
export const businessById = (id?: string) => businesses.find(item => item.id === id);

export const rewards = [
  { id: 'latte', issuer: 'blend', redeemAt: 'blend', title: 'Latte de cortesía', cost: 100, stock: true, expiry: '2030-12-31' },
  { id: 'pase', issuer: 'blend', redeemAt: 'fuerza', title: 'Pase libre por un día', cost: 320, stock: true, expiry: '2030-12-31' },
  { id: 'batido', issuer: 'blend', redeemAt: 'nutrimax', title: 'Batido de proteína', cost: 150, stock: false, expiry: '2030-12-31' },
  { id: 'descuento', issuer: 'nutrimax', redeemAt: 'nutrimax', title: '15% de descuento', cost: 100, stock: true, expiry: '2020-01-01' },
] as const;
export type Reward = typeof rewards[number];

export const coupons = [
  { id: 'cafe-demo', issuer: 'blend', redeemAt: 'blend', title: 'Café de especialidad', expiry: '2030-12-31', origin: 'Obtenido con 100 pts', used: false },
  { id: 'pase-demo', issuer: 'blend', redeemAt: 'fuerza', title: 'Pase libre de alianza', expiry: '2030-12-31', origin: 'Ganado por 5 visitas', used: false, allianceEnded: true },
  { id: 'batido-demo', issuer: 'nutrimax', redeemAt: 'nutrimax', title: 'Batido de cortesía', expiry: '2030-12-31', origin: 'Obtenido con 100 pts', used: true },
  { id: 'descuento-demo', issuer: 'nutrimax', redeemAt: 'nutrimax', title: '15% de descuento', expiry: '2020-01-01', origin: 'Ganado por 5 visitas', used: false },
] satisfies Coupon[];

export type Coupon = {
  id: string; issuer: string; redeemAt: string; title: string; expiry: string;
  origin: string; used: boolean; allianceEnded?: boolean;
};

export function expired(date: string) {
  return Date.parse(date + 'T23:59:59') < Date.now();
}

export function couponStatus(coupon: Coupon) {
  if (coupon.used) return 'Canjeado';
  return expired(coupon.expiry) ? 'Vencido' : 'Disponible';
}

export function rewardReason(reward: Reward, points: number) {
  if (expired(reward.expiry)) return 'Vencida';
  if (!reward.stock) return 'Agotada';
  if (points < reward.cost) return `Te faltan ${reward.cost - points} puntos`;
  return null;
}

const now = Date.now();
export const movements = [
  { id: '1', business: 'blend', date: now, kind: 'Visita registrada', detail: 'Sucursal Centro' },
  { id: '2', business: 'blend', date: now - 60000, kind: 'Puntos ganados', detail: '+10 puntos' },
  { id: '3', business: 'nutrimax', date: now - 86400000, kind: 'Puntos gastados', detail: '−100 puntos' },
  { id: '4', business: 'fuerza', date: now - 172800000, kind: 'Recompensa ganada', detail: 'Pase libre por un día' },
  { id: '5', business: 'blend', date: now - 259200000, kind: 'Canje', detail: 'Pase libre de alianza', redeemAt: 'fuerza' },
];
export const notifications = [
  { id: '1', icon: '✓', title: 'Registraste una visita en Café Blend', date: now, business: 'blend' },
  { id: '2', icon: '🎁', title: 'Tienes un cupón de alianza', date: now - 86400000, coupon: 'pase-demo' },
  { id: '3', icon: '🎟', title: 'Se actualizó tu promoción', date: now - 172800000, coupon: 'promocion-anterior' },
];
export const notificationTypes = ['Visita registrada', 'Meta completada', 'Cupón desbloqueado', 'Cupón de alianza', 'Promociones'] as const;

export const profile = {
  firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.com', phone: '6641234567',
  photo: '',
};

const Session = createContext<{
  read: string[]; markRead: (ids: string[]) => void;
  preferences: Record<string, boolean>; togglePreference: (key: string, value: boolean) => void;
  notificationPrompted: boolean; markNotificationPrompted: () => void;
} | null>(null);

export function PreviewProvider({ children, accountId }: { children: ReactNode; accountId?: string }) {
  const [read, setRead] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [notificationPrompted, setNotificationPrompted] = useState(false);
  const [previousAccount, setPreviousAccount] = useState(accountId);
  if (previousAccount !== accountId) {
    setPreviousAccount(accountId);
    setRead([]);
    setPreferences({});
    setNotificationPrompted(false);
  }
  return <Session.Provider value={{
    read, markRead: ids => setRead(previous => [...new Set([...previous, ...ids])]),
    preferences, togglePreference: (key, value) => setPreferences(previous => ({ ...previous, [key]: value })),
    notificationPrompted, markNotificationPrompted: () => setNotificationPrompted(true),
  }}>{children}</Session.Provider>;
}

export function usePreview() {
  const value = useContext(Session);
  if (!value) throw new Error('Falta el proveedor de sesión móvil');
  return value;
}

export function useResource<T>(load: () => Promise<T>) {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<{ data?: T; loading: boolean; error: boolean }>({ loading: true, error: false });
  const refresh = useCallback(() => {
    setState(previous => ({ ...previous, loading: true, error: false }));
    setRequest(value => value + 1);
  }, []);
  useEffect(() => {
    let active = true;
    load().then(
      data => { if (active) setState({ data, loading: false, error: false }); },
      () => { if (active) setState(previous => ({ ...previous, loading: false, error: true })); },
    );
    return () => { active = false; };
  }, [load, request]);
  return { ...state, refresh };
}

export const loadBusinesses = async (): Promise<readonly Business[]> => businesses;
export const loadRewards = async () => rewards;
export const loadCoupons = async () => coupons;
export const loadMovements = async () => movements;
export const loadNotifications = async () => notifications;
export const loadProfile = async () => profile;

export const formatDate = (value: number) => new Date(value).toLocaleDateString('es-MX');
