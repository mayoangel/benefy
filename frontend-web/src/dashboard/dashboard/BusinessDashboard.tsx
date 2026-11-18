import { UIProvider } from './data/UIProvider';
import { UnsavedChangesProvider } from './hooks/useUnsavedChanges';
import ScreenState from './components/ScreenState';
import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Brand from '../components/Brand';
import Icon, { type IconName } from '../components/Icon';
import { DemoDataProvider, useDemoData } from './data/DemoDataProvider';
import Overview from './pages/Overview';
import Programs from './pages/Programs';
import Clients from './pages/Clients';
import Branches from './pages/Branches';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';
import Alliances from './pages/Alliances';
import PageHeading from './components/PageHeading';
import Modal from './components/Modal';
import StatusBadge from './components/StatusBadge';
import PeriodFilter from './components/PeriodFilter';
import AccountMenu from './components/AccountMenu';
import { BusinessMaintenance } from './platform/PlatformNotices';
import './platform/platform.css';
import './dashboard-base.css';
import './dashboard-layout.css';
import './dashboard-components.css';
import './dashboard-pages.css';

const menu: { path: string; label: string; icon: IconName; description: string }[] = [
  { path: '', label: 'Inicio', icon: 'home', description: 'Una mirada a lo que está pasando en tu negocio.' },
  { path: 'dinamicas', label: 'Dinámicas', icon: 'stars', description: 'Más motivos para que tus clientes vuelvan.' },
  { path: 'alianzas', label: 'Alianzas', icon: 'handshake', description: 'Crece junto a los comercios de tu comunidad.' },
  { path: 'clientes', label: 'Clientes y métricas', icon: 'person', description: 'Conoce los hábitos de quienes eligen tu negocio.' },
  { path: 'sucursales', label: 'Sucursales', icon: 'storefront', description: 'Tus ubicaciones y equipos, en un solo lugar.' },
  { path: 'suscripcion', label: 'Suscripción', icon: 'receipt_long', description: 'El plan que acompaña el crecimiento de tu negocio.' },
  { path: 'configuracion', label: 'Configuración', icon: 'settings', description: 'Personaliza tu negocio y tus preferencias.' },
];
function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(true);
  const { preferences } = useDemoData();
  const navigation = <>
    <Brand />
    <div className="bd-business">
      <span className="bd-business-icon">
        <Icon name="storefront" />
      </span>
      <div>
        <b>{preferences.name}</b>
        <small>Administrador de negocio</small>
      </div>
    </div>
    <span className="bd-nav-label">ESPACIO DE TRABAJO</span>
    <nav aria-label="Menú del administrador">{menu.map(item => <NavLink end={!item.path} to={`/negocio${item.path ? `/${item.path}` : ''}`} key={item.path} onClick={() => setOpen(false)}>
      <Icon name={item.icon} />{item.label}</NavLink>)}</nav>
    <div className="bd-sidebar-bottom">
      <div className="bd-help">
        <Icon name="rocket_launch" />
        <b>Tu negocio, un paso adelante</b>
        <p>Conoce todo lo que Benefy tiene para ti.</p>
        <Link to="/negocio/suscripcion">Explorar planes →</Link>
      </div>
    </div>
  </>;
  return <div className="bd-shell">
    <a className="bd-skip" href="#bd-content">Saltar al contenido</a>
    <aside className="bd-sidebar">{navigation}</aside>{open && <Modal title="Menú del negocio" className="bd-drawer" onClose={() => setOpen(false)}>{navigation}</Modal>}<div className="bd-workspace">
      <header className="bd-topbar">
        <button className="bd-mobile-toggle" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)}>
          <Icon name="menu" />
        </button>
        <PeriodFilter />
        <div className="bd-profile">
          <StatusBadge tone="neutral">Vista de demostración</StatusBadge>
          <AccountMenu />
        </div>
      </header><BusinessMaintenance />{notice && <div className="bd-demo-strip">
        <span>Datos de ejemplo · Los cambios se conservan mientras no recargues la página.</span>
        <button aria-label="Ocultar aviso de demostración" onClick={() => setNotice(false)}>
          <Icon name="close" />
        </button>
      </div>}<main className="bd-main" id="bd-content" tabIndex={-1}>
        <Routes>{menu.map(item => <Route key={item.path} path={item.path === 'sucursales' ? 'sucursales/*' : item.path || '/'} element={<>
          <PageHeading title={item.label} description={item.description} />
          <ScreenState>{item.path === '' ? <Overview /> : item.path === 'dinamicas' ? <Programs /> : item.path === 'alianzas' ? <Alliances /> : item.path === 'clientes' ? <Clients /> : item.path === 'sucursales' ? <Branches /> : item.path === 'suscripcion' ? <Subscription /> : <Settings />}</ScreenState>
        </>} />)}<Route path="programas" element={<Navigate to="/negocio/dinamicas" replace />} />
          <Route path="*" element={<Navigate to="/negocio" replace />} />
        </Routes>
        <footer className="bd-footer">Benefy · Conexiones que hacen crecer tu negocio.</footer>
      </main>
    </div>
  </div>;
}
export default function BusinessDashboard() {
  return <DemoDataProvider>
    <UIProvider>
      <UnsavedChangesProvider>
        <DashboardLayout />
      </UnsavedChangesProvider>
    </UIProvider>
  </DemoDataProvider>;
}
