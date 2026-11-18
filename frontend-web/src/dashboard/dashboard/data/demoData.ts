export type Branch = { id: number; name: string; address: string; archived?: boolean };
export type Employee = { id: number; name: string; role: string; branch: number; active: boolean };
export type Dynamic = { id: number; name: string; type: 'puntos' | 'sellos' | 'cupones'; goal: number; conversion: number; reward: string; start: string; end: string; active: boolean };
export type Preferences = { name: string; email: string; phone: string; category: string; summary: boolean; alerts: boolean };
export type Period = { kind: string; start: string; end: string };
export const initialBranches: Branch[] = [{ id: 1, name: 'Centro', address: 'Av. Revolución 120, Tijuana' }, { id: 2, name: 'Río', address: 'Paseo de los Héroes 240, Tijuana' }];
export const initialEmployees: Employee[] = [{ id: 1, name: 'Ana López', role: 'Gerente', branch: 1, active: true }, { id: 2, name: 'Luis García', role: 'Cajero', branch: 2, active: true }];
export const initialPreferences: Preferences = { name: 'Mi negocio', email: 'hola@minegocio.com', phone: '', category: 'Cafetería', summary: true, alerts: true };
let sequence = 100;
export const nextId = () => ++sequence;

export type Alliance = { id: number; merchantId: number; direction: 'sent' | 'received'; condition: string; benefit: string; start: string; end: string; status: 'Pendiente' | 'Activa' | 'Rechazada' };
export const ownMerchantId = 1;
export const merchants = [{ id: 1, name: 'Mi negocio', category: 'Cafetería' }, { id: 2, name: 'Pan de Barrio', category: 'Panadería' }, { id: 3, name: 'Librería Norte', category: 'Librería' }, { id: 4, name: 'Verde Local', category: 'Comercio' }];
export const clients = Array.from({ length: 26 }, (_, i) => ({ id: i + 1, name: ['Julia', 'Andrés', 'María', 'José', 'Carolina', 'Daniel', 'Lucía', 'Miguel', 'Sofía', 'Diego', 'Ana', 'Luis', 'Valeria'][i % 13] + ' ' + ['López', 'García'][Math.floor(i / 13)], email: `cliente${i + 1}@ejemplo.com`, visits: 64 - i * 2 }));

export const initialAlliances: Alliance[] = [{ id: 1, merchantId: 2, direction: 'received', condition: 'Acumular 5 visitas', benefit: '10 % en pan dulce', start: '2026-01-01', end: '2027-12-31', status: 'Pendiente' }];
