import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { initialBranches, initialEmployees, initialPreferences, initialAlliances, type Branch, type Employee, type Dynamic, type Preferences, type Period, type Alliance } from './demoData';
type Setter<T> = Dispatch<SetStateAction<T>>;
type Snapshot = { branches: Branch[]; employees: Employee[]; dynamics: Dynamic[]; alliances: Alliance[]; preferences: Preferences; period: Period; qrDownloaded: number[]; plan: string };
type DemoData = Snapshot & { setBranches: Setter<Branch[]>; setEmployees: Setter<Employee[]>; setDynamics: Setter<Dynamic[]>; setAlliances: Setter<Alliance[]>; setPreferences: Setter<Preferences>; setPeriod: Setter<Period>; setQrDownloaded: Setter<number[]>; setPlan: Setter<string> };
// La memoria del módulo dura hasta recargar, incluso al salir del panel.
let session: Snapshot = { branches: initialBranches, employees: initialEmployees, dynamics: [], alliances: initialAlliances, preferences: initialPreferences, period: { kind: '7', start: '', end: '' }, qrDownloaded: [], plan: 'Negocio Pro' };
const DemoContext = createContext<DemoData | null>(null);
export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState(session.branches);
  const [employees, setEmployees] = useState(session.employees);
  const [dynamics, setDynamics] = useState(session.dynamics);
  const [alliances, setAlliances] = useState(session.alliances);
  const [preferences, setPreferences] = useState(session.preferences);
  const [period, setPeriod] = useState(session.period);
  const [qrDownloaded, setQrDownloaded] = useState(session.qrDownloaded);
  const [plan, setPlan] = useState(session.plan);
  useEffect(() => { session = { branches, employees, dynamics, alliances, preferences, period, qrDownloaded, plan }; }, [branches, employees, dynamics, alliances, preferences, period, qrDownloaded, plan]);
  return <DemoContext.Provider value={{ branches, setBranches, employees, setEmployees, dynamics, setDynamics, alliances, setAlliances, preferences, setPreferences, period, setPeriod, qrDownloaded, setQrDownloaded, plan, setPlan }}>{children}</DemoContext.Provider>;
}
export function useDemoData() { const data = useContext(DemoContext); if (!data) throw new Error('Falta el contexto de demostración.'); return data; }
