export default function Skeleton() {
  return <div className="bd-skeleton" role="status" aria-label="Cargando página" style={{ padding: 32, minHeight: '60vh', background: '#f8fafc', color: '#123946' }}>
    <p>Cargando tu espacio de trabajo…</p>{[1, 2, 3].map(n => <div key={n} className="bd-skeleton-block" style={{ minHeight: 100, marginBlock: 16, borderRadius: 14, background: '#e4e9ec' }} />)}</div>;
}
