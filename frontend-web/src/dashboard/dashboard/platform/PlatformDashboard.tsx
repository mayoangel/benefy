import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand';
import Icon, { type IconName } from '../../components/Icon';
import { ApiError, hasSession, request, signOut } from '../../lib/webAuth';
import Card from '../components/Card';
import Modal from '../components/Modal';
import PageHeading from '../components/PageHeading';
import { PeriodControl } from '../components/PeriodFilter';
import Skeleton from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import type { Period } from '../data/demoData';
import { UIProvider } from '../data/UIProvider';
import PlatformNotices from './PlatformNotices';
import PlatformOverview, { type OverviewData } from './PlatformOverview';
import PlatformRecords, { type RecordSection } from './PlatformRecords';
import { periodQuery, roleLabels, type Account, type Row } from './platformData';
import { previewAccount, previewData } from './previewData';
import '../dashboard-base.css';
import '../dashboard-layout.css';
import '../dashboard-components.css';
import '../dashboard-pages.css';
import './platform.css';

type Section = RecordSection | 'inicio' | 'avisos' | 'configuracion';
const menu: { path: Section; label: string; icon: IconName; description: string }[] = [
  { path: 'inicio', label: 'Inicio', icon: 'home', description: 'Consulta las métricas y alertas de Benefy.' },
  { path: 'comercios', label: 'Comercios', icon: 'storefront', description: 'Consulta y administra los comercios de la plataforma.' },
  { path: 'consumidores', label: 'Consumidores', icon: 'person', description: 'Revisa las cuentas y su actividad general.' },
  { path: 'suscripciones', label: 'Suscripciones', icon: 'receipt_long', description: 'Consulta planes, estados de pago y próximos cobros.' },
  { path: 'roles', label: 'Roles y permisos', icon: 'verified_user', description: 'Administra el acceso de las cuentas a Benefy.' },
  { path: 'auditoria', label: 'Auditoría', icon: 'shield_lock', description: 'Consulta las operaciones registradas en la plataforma.' },
  { path: 'incidencias', label: 'Incidencias y reportes', icon: 'support_agent', description: 'Da seguimiento a los casos y sus notas internas.' },
  { path: 'avisos', label: 'Avisos de mantenimiento', icon: 'notifications', description: 'Publica avisos para los dueños de negocio.' },
  { path: 'configuracion', label: 'Configuración', icon: 'settings', description: 'Consulta los datos de tu cuenta y los documentos legales.' },
];
const sectionPath = (section: Section) => section === 'inicio' ? '/administracion' : `/administracion/${section}`;
const loginPath = '/login?panel=administracion';

function accessError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

function AccessScreen({ error, retry }: { error?: string; retry?: () => void }) {
  return <div className="bd-shell bd-platform-access">
    <Card title={error ? 'No se pudo comprobar el acceso' : 'Acceso denegado'}>
      <Brand />
      <p>{error || 'El panel requiere una cuenta con el rol de administrador general de Benefy.'}</p>
      <div className="bd-form-actions">
        <Link className="bd-secondary" to="/">Regresar a Benefy</Link>
        {retry ? <button className="bd-button" onClick={retry}>Reintentar</button> :
          <Link className="bd-button" to={loginPath}>Iniciar sesión con Google</Link>}
      </div>
    </Card>
  </div>;
}

function Settings({ account, preview }: { account: Account; preview: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [document, setDocument] = useState('');
  const documents = [
    { title: 'Aviso de privacidad', url: import.meta.env.VITE_PRIVACY_URL },
    { title: 'Términos y condiciones', url: import.meta.env.VITE_TERMS_URL },
  ];

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await request('/autenticacion/sesion/cierre/', { method: 'POST' });
      await signOut();
      navigate(loginPath, { replace: true });
    } catch (issue) {
      if (accessError(issue) || !hasSession()) {
        await signOut().catch(() => undefined);
        navigate(loginPath, { replace: true });
      } else {
        setError('No se pudo registrar el cierre de sesión. Intenta de nuevo.');
        setBusy(false);
      }
    }
  }

  return <div className="bd-platform-stack">
    <Card title="Datos de la cuenta">
      <dl className="bd-platform-detail">
        <div><dt>Nombre</dt><dd>{account.nombre}</dd></div>
        <div><dt>Correo</dt><dd>{account.correo}</dd></div>
        <div><dt>Rol</dt><dd>{roleLabels[account.rol]}</dd></div>
      </dl>
      {!preview && <button className="bd-secondary" type="button" disabled={busy} onClick={() => void logout()}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>}
      {error && <p className="bd-field-error" role="alert">{error}</p>}
    </Card>
    <Card title="Documentos legales">
      <div className="bd-form-actions">{documents.map(item => item.url ?
        <a className="bd-secondary" key={item.title} href={item.url} target="_blank" rel="noreferrer">{item.title}</a> :
        <button className="bd-secondary" type="button" key={item.title} onClick={() => setDocument(item.title)}>{item.title}</button>)}</div>
      {document && <Modal title={document} onClose={() => setDocument('')}><p>Benefy aún no ha publicado este documento en el panel.</p></Modal>}
    </Card>
  </div>;
}

function SectionContent({ section, period, account, onDenied, preview }: {
  section: Section; period: Period; account: Account; onDenied: () => void; preview: boolean;
}) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [filters, setFilters] = useState('');
  const dates = section === 'inicio' || section === 'auditoria' ? periodQuery(period).toString() : '';
  const refresh = () => setVersion(value => value + 1);

  useEffect(() => {
    if (preview || section === 'configuracion') return;
    const controller = new AbortController();
    const query = [dates, filters].filter(Boolean).join('&');
    setLoading(true);
    setError('');
    void request(`/plataforma/${section}/?${query}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(issue => {
        if (controller.signal.aborted) return;
        if (accessError(issue)) onDenied();
        else setError(issue instanceof Error ? issue.message : 'No se pudieron cargar los datos.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [dates, filters, onDenied, preview, section, version]);

  if (section === 'configuracion') return <Settings account={account} preview={preview} />;
  if (preview) {
    if (section === 'inicio') return <PlatformOverview data={previewData.inicio} />;
    if (section === 'avisos') return <PlatformNotices notices={previewData.avisos} onChange={refresh} preview />;
    const query = new URLSearchParams(filters);
    const rows: Row[] = previewData[section];
    return <PlatformRecords section={section} rows={rows.filter(row => [...query].every(([field, value]) =>
      String(row[field] || '').toLocaleLowerCase().includes(value.toLocaleLowerCase())
    ))} onChange={refresh} onSearch={value => setFilters(value.toString())} preview />;
  }
  if (data === undefined && loading) return <Skeleton />;
  if (data === undefined || error) return <Card title="No se pudieron cargar los datos">
    <p role="alert">{error}</p><button className="bd-secondary" type="button" onClick={refresh}>Reintentar</button>
  </Card>;
  return <div aria-busy={loading}>
    {loading && <span className="bd-sr-only" role="status">Actualizando datos</span>}
    {section === 'inicio' ? <PlatformOverview data={data as OverviewData} /> :
      section === 'avisos' ? <PlatformNotices notices={data as Parameters<typeof PlatformNotices>[0]['notices']} onChange={refresh} /> :
        <PlatformRecords section={section} rows={data as Row[]} onChange={refresh} onSearch={query => setFilters(query.toString())} />}
  </div>;
}

function Layout({ account, onDenied, preview = false }: { account: Account; onDenied: () => void; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>({ kind: '30', start: '', end: '' });
  const { pathname } = useLocation();
  const showPeriod = pathname.replace(/\/$/, '') === '/administracion' || pathname.includes('/auditoria');
  const navigation = <>
    <Brand />
    <div className="bd-business">
      <span className="bd-business-icon"><Icon name="shield_lock" /></span>
      <div><b>Benefy</b><small>Administrador general</small></div>
    </div>
    <span className="bd-nav-label">ADMINISTRACIÓN</span>
    <nav aria-label="Menú del administrador general">
      {menu.map(item => <NavLink key={item.path} to={sectionPath(item.path)} end onClick={() => setOpen(false)}>
        <Icon name={item.icon} />{item.label}
      </NavLink>)}
    </nav>
  </>;

  return <div className="bd-shell bd-platform">
    <a className="bd-skip" href="#bd-content">Saltar al contenido</a>
    <aside className="bd-sidebar">{navigation}</aside>
    {open && <Modal title="Menú de administración" className="bd-drawer" onClose={() => setOpen(false)}>{navigation}</Modal>}
    <div className="bd-workspace">
      <header className="bd-topbar">
        <button className="bd-mobile-toggle" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
        {showPeriod && !preview && <PeriodControl period={period} setPeriod={setPeriod} />}
        <div className="bd-profile">
          <StatusBadge tone="info">Administrador general</StatusBadge>
          <Link className="bd-secondary" to="/administracion/configuracion"><Icon name="person" /> {account.nombre}</Link>
        </div>
      </header>
      {preview && <div className="bd-demo-strip">Vista previa · Datos de ejemplo · Solo lectura</div>}
      <main className="bd-main" id="bd-content" tabIndex={-1}>
        <Routes>
          {menu.map(item => <Route key={item.path} path={item.path === 'inicio' ? '/' : item.path} element={<>
            <PageHeading title={item.label} description={item.description} />
            <SectionContent key={item.path} section={item.path} account={account} period={period} onDenied={onDenied} preview={preview} />
          </>} />)}
          <Route path="*" element={<Navigate to="/administracion" replace />} />
        </Routes>
        <footer className="bd-footer">Benefy · Administración general</footer>
      </main>
    </div>
  </div>;
}

export default function PlatformDashboard() {
  const previewEnabled = import.meta.env.DEV || import.meta.env.VITE_PLATFORM_PREVIEW === 'true';
  const preview = previewEnabled && !hasSession();
  const [account, setAccount] = useState<Account>();
  const [status, setStatus] = useState<'loading' | 'denied' | 'error' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [deny] = useState(() => () => setStatus('denied'));
  useEffect(() => {
    if (preview) return;
    if (!hasSession()) {
      deny();
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    void request<Account>('/plataforma/cuenta/', { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      setAccount(value);
      setStatus('ready');
    }).catch(issue => {
      if (controller.signal.aborted) return;
      if (accessError(issue)) deny();
      else {
        setError(issue instanceof Error ? issue.message : 'Intenta de nuevo.');
        setStatus('error');
      }
    });
    return () => controller.abort();
  }, [deny, preview, retry]);
  if (preview || (previewEnabled && status === 'denied')) {
    return <UIProvider demoControls={false}><Layout account={previewAccount} onDenied={deny} preview /></UIProvider>;
  }
  if (status === 'loading') return <Skeleton />;
  if (status === 'denied') return <AccessScreen />;
  if (status === 'error') return <AccessScreen error={error} retry={() => setRetry(value => value + 1)} />;
  return account && <UIProvider demoControls={false}><Layout account={account} onDenied={deny} /></UIProvider>;
}
