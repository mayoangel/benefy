import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { request } from '../../lib/webAuth';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { dateTime, incidentLabels, roleLabels, type Row } from './platformData';

const labels: Record<string, string> = {
  id: 'Folio', nombre: 'Nombre', categoria: 'Categoría', estado: 'Estado', plan: 'Plan',
  fecha: 'Fecha de registro', correo: 'Correo', comercio: 'Comercio', rol: 'Rol',
  usuario: 'Usuario', operacion: 'Operación', resultado: 'Resultado', tipo: 'Tipo',
  relacionado: 'Relacionado con', descripcion: 'Descripción', direccion: 'Dirección',
  suscripcion: 'Estado de suscripción', dinamicas: 'Dinámicas', alianzas: 'Alianzas activas',
  visitas: 'Visitas', canjes: 'Canjes', detalle: 'Detalle',
};

const sections = {
  comercios: { title: 'Directorio de comercios', fields: ['nombre', 'categoria', 'estado', 'plan', 'fecha'], filters: ['estado', 'categoria', 'plan'], detail: ['correo', 'direccion', 'suscripcion', 'dinamicas', 'alianzas', 'visitas', 'canjes'] },
  consumidores: { title: 'Cuentas de consumidores', fields: ['nombre', 'correo', 'estado', 'fecha'], filters: ['estado'], detail: ['visitas', 'canjes'] },
  suscripciones: { title: 'Suscripciones por comercio', fields: ['comercio', 'plan', 'estado', 'fecha'], filters: ['estado', 'plan'], detail: [], dateLabel: 'Próximo cobro' },
  roles: { title: 'Usuarios y roles', fields: ['nombre', 'correo', 'rol', 'estado'], filters: ['rol', 'estado'], detail: [] },
  auditoria: { title: 'Registro de auditoría', fields: ['fecha', 'usuario', 'rol', 'operacion', 'comercio', 'resultado', 'detalle'], filters: [], detail: [], dateLabel: 'Fecha y hora' },
  incidencias: { title: 'Incidencias y reportes', fields: ['id', 'tipo', 'relacionado', 'estado', 'fecha'], filters: ['estado', 'tipo'], detail: ['descripcion'] },
};

export type RecordSection = keyof typeof sections;
const auditFilters = ['usuario', 'operacion', 'comercio'];
const pageSize = 25;

function labelValue(field: string, value: string) {
  if (field === 'rol') return roleLabels[value] || value;
  if (field === 'estado') return incidentLabels[value] || value;
  return value;
}

function display(row: Row, field: string) {
  const value = row[field];
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'fecha') return dateTime.format(new Date(String(value)));
  return labelValue(field, String(value));
}

function cell(row: Row, field: string) {
  const value = display(row, field);
  if (field !== 'estado') return value;
  const tone = ['Activo', 'Activa', 'Resuelta'].includes(value) ? 'success' :
    ['Suspendido', 'Cancelada'].includes(value) ? 'danger' : 'warning';
  return <StatusBadge tone={tone}>{value}</StatusBadge>;
}

export default function PlatformRecords({ section, rows, onChange, onSearch, preview = false }: {
  section: RecordSection; rows: Row[]; onChange: () => void; onSearch: (query: URLSearchParams) => void; preview?: boolean;
}) {
  const config = sections[section];
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<Record<string, string>>(() => ({ estado: params.get('estado') || '' }));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Row>();
  const [opening, setOpening] = useState<number>();
  const [error, setError] = useState('');
  const filtered = rows.filter(row => config.filters.every(field => !filters[field] || row[field] === filters[field])
    && config.fields.some(field => display(row, field).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const currentPage = Math.min(page, maxPage);
  const fieldLabel = (field: string) => field === 'fecha' && 'dateLabel' in config ? config.dateLabel : labels[field];

  async function open(row: Row) {
    setError('');
    if (preview || section === 'roles') {
      setSelected(row);
      return;
    }
    setOpening(row.id);
    try {
      setSelected(await request<Row>(`/plataforma/${section}/${row.id}/`));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'No se pudo consultar el detalle.');
    } finally {
      setOpening(undefined);
    }
  }

  return <Card title={config.title}>
    {(section === 'auditoria' || section === 'roles') && <form className="bd-platform-filters" onSubmit={event => {
      event.preventDefault();
      const template = new FormData(event.currentTarget);
      const query = new URLSearchParams();
      template.forEach((value, key) => { if (String(value).trim()) query.set(key, String(value).trim()); });
      setPage(0);
      onSearch(query);
    }}>
      {section === 'auditoria' ? auditFilters.map(field => <label key={field}>{labels[field]}<input name={field} /></label>) :
        <label>Asignar rol a una cuenta existente<input type="email" name="correo" placeholder="Correo exacto" /></label>}
      <button className="bd-secondary" type="submit">{section === 'auditoria' ? 'Aplicar filtros' : 'Buscar cuenta'}</button>
    </form>}
    {section !== 'auditoria' && <div className="bd-platform-filters">
      <label>Buscar<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
      {config.filters.map(field => <label key={field}>{labels[field]}
        <select value={filters[field] || ''} onChange={event => {
          setFilters({ ...filters, [field]: event.target.value }); setPage(0);
        }}>
          <option value="">Todos</option>
          {[...new Set([...rows.map(row => String(row[field] || '')), filters[field] || ''])].filter(Boolean).sort()
            .map(value => <option key={value} value={value}>{labelValue(field, value)}</option>)}
        </select>
      </label>)}
    </div>}
    {error && <p className="bd-field-error" role="alert">{error}</p>}
    {filtered.length ? <div className="bd-table-scroll" tabIndex={0} aria-label={config.title}>
      <table className="bd-platform-table">
        <thead><tr>{config.fields.map(field => <th scope="col" key={field}>{fieldLabel(field)}</th>)}
          {section !== 'auditoria' && <th scope="col">Acciones</th>}</tr></thead>
        <tbody>{filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(row => <tr key={row.id}>
          {config.fields.map(field => <td key={field}>{cell(row, field)}</td>)}
          {section !== 'auditoria' && <td><button className="bd-secondary" disabled={opening !== undefined} type="button" onClick={() => void open(row)}>
            {opening === row.id ? 'Cargando…' : section === 'roles' && !preview ? 'Cambiar rol' : 'Ver detalle'}
          </button></td>}
        </tr>)}</tbody>
      </table>
    </div> : <EmptyState message="No hay registros que coincidan con los filtros." />}
    {maxPage > 0 && <div className="bd-platform-pagination">
      <button className="bd-secondary" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Anterior</button>
      <span>Página {currentPage + 1} de {maxPage + 1}</span>
      <button className="bd-secondary" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
    </div>}
    {selected && <RecordDetail row={selected} section={section} close={() => setSelected(undefined)} onChange={onChange} preview={preview} />}
  </Card>;
}

function RecordDetail({ row, section, close, onChange, preview }: {
  row: Row; section: RecordSection; close: () => void; onChange: () => void; preview: boolean;
}) {
  const config = sections[section];
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState(String(row.rol || ''));
  const statusChange = section === 'comercios' || section === 'consumidores';
  const action = row.estado === 'Activo' ? 'Suspender' : 'Reactivar';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (section === 'roles') {
        await request(`/usuario/rol/${row.id}/`, { method: 'PATCH', body: JSON.stringify({ rol: role }) });
      } else {
        const body = statusChange ? { activo: row.estado !== 'Activo', motivo: data.get('motivo') } : Object.fromEntries(data);
        await request(`/plataforma/${section}/${row.id}/`, { method: 'POST', body: JSON.stringify(body) });
      }
      close();
      onChange();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'No se pudo guardar el cambio.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal title={String(row.nombre || row.comercio || `Incidencia #${row.id}`)} busy={busy} onClose={() => { if (!busy) close(); }}>
    <dl className="bd-platform-detail">
      {[...config.fields, ...config.detail].map(field => <div key={field}>
        <dt>{field === 'fecha' && 'dateLabel' in config ? config.dateLabel : labels[field]}</dt><dd>{cell(row, field)}</dd>
      </div>)}
    </dl>
    {row.historial && <section className="bd-platform-stack">
      <h3>{section === 'suscripciones' ? 'Historial de estados' : 'Seguimiento y notas internas'}</h3>
      {row.historial.length ? <ul className="bd-platform-history">{row.historial.map((entry, index) => <li key={index}>
        <small>{dateTime.format(new Date(entry.fecha))}{entry.usuario && ` · ${entry.usuario}`}</small>
        <p>{entry.detalle}</p>
      </li>)}</ul> : <p className="bd-muted">Sin movimientos registrados.</p>}
    </section>}
    {!preview && statusChange && !confirm && <button type="button" className={action === 'Suspender' ? 'bd-button bd-platform-danger' : 'bd-button'} onClick={() => setConfirm(true)}>{action}</button>}
    {!preview && section === 'roles' && !confirm && <div className="bd-platform-stack">
      <label className="bd-platform-field">Nuevo rol<select value={role} onChange={event => setRole(event.target.value)}>
        {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className="bd-secondary" disabled={role === row.rol} onClick={() => setConfirm(true)}>Revisar cambio</button>
    </div>}
    {!preview && (confirm || section === 'incidencias') && <form onSubmit={submit} className="bd-platform-stack">
      {confirm && statusChange && <label className="bd-platform-field">Motivo para {action.toLowerCase()}
        <textarea name="motivo" required maxLength={1000} /></label>}
      {confirm && section === 'roles' && <p>¿Confirmas el cambio de rol a <strong>{roleLabels[role]}</strong>?</p>}
      {section === 'incidencias' && <>
        <label className="bd-platform-field">Estado<select name="estado" defaultValue={String(row.estado)}>
          {Object.entries(incidentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="bd-platform-field">Nota interna<textarea name="nota" maxLength={3000} /></label>
      </>}
      {error && <p className="bd-field-error" role="alert">{error}</p>}
      <div className="bd-form-actions">
        {confirm && <button type="button" className="bd-secondary" disabled={busy} onClick={() => { setConfirm(false); setError(''); }}>Cancelar</button>}
        <button type="submit" className="bd-button" disabled={busy}>{busy ? 'Guardando…' :
          statusChange ? `Confirmar: ${action}` : section === 'roles' ? 'Confirmar cambio de rol' : 'Guardar seguimiento'}</button>
      </div>
    </form>}
  </Modal>;
}
