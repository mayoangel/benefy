import { isISODate, validatePeriod } from '../data/period';
import { useState } from 'react';
import { useDemoData } from '../data/DemoDataProvider';
import FormField from './FormField';
import type { Period } from '../data/demoData';
export default function PeriodFilter() {
  const { period, setPeriod } = useDemoData();
  return <PeriodControl period={period} setPeriod={setPeriod} />;
}

export function PeriodControl({ period, setPeriod }: { period: Period; setPeriod: (period: Period) => void }) {
  const [kind, setKind] = useState(period.kind);
  const [start, setStart] = useState(period.start);
  const [end, setEnd] = useState(period.end);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return <form className="bd-period" noValidate onSubmit={event => {
    event.preventDefault(); const issue = validatePeriod(start, end);
    if (issue) {
      const field = !isISODate(start) ? 'start' : !isISODate(end) ? 'end' : 'start';
      setErrors({ [field]: issue });
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();
      return;
    }
    setErrors({});
    setPeriod({ kind: 'custom', start, end });
  }}>
    <label>Periodo<select value={kind} onChange={event => { const value = event.target.value; setKind(value); setErrors({}); if (value !== 'custom') setPeriod({ ...period, kind: value }); }}>
      <option value="1">Hoy</option>
      <option value="7">Últimos 7 días</option>
      <option value="30">Últimos 30 días</option>
      <option value="custom">Personalizado</option>
    </select>
    </label>
    {kind === 'custom' && <>
      <FormField label="Fecha inicial" error={errors.start}>
        <input name="start" type="date" value={start} onChange={e => { setStart(e.target.value); setErrors({}); }} />
      </FormField>
      <FormField label="Fecha final" error={errors.end}>
        <input name="end" type="date" value={end} onChange={e => { setEnd(e.target.value); setErrors({}); }} />
      </FormField>
      <button className="bd-secondary" type="submit">Aplicar filtros</button>
    </>}
    <span className="bd-sr-only" role="status">Periodo aplicado: {period.kind === 'custom' ? `${period.start} a ${period.end}` : `${period.kind} días`}</span>
  </form>;
}
