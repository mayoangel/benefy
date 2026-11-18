import { useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import DynamicPreview from './DynamicPreview';
import { useDemoData } from '../data/DemoDataProvider';
import { nextId, type Dynamic } from '../data/demoData';
import { validateDynamic, type DynamicDraft } from '../data/dynamicValidation';
import { date, number } from '../data/format';
import { focusFirstError, type Errors } from '../hooks/form';
import useOperation from '../hooks/useOperation';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
export default function DynamicWizard({ initial, onClose }: { initial?: Dynamic; onClose: () => void }) {
  const { setDynamics } = useDemoData();
  const [draft, setDraft] = useState<DynamicDraft>(() => initial ? { ...initial, goal: String(initial.goal), conversion: String(initial.conversion) } : { name: '', type: 'sellos', goal: '', conversion: '', reward: '', start: '', end: '' });
  const baseline = useRef(JSON.stringify(draft));
  const [step, setStep] = useState(0); const [errors, setErrors] = useState<Errors>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const { busy, run } = useOperation();
  const { requestClose } = useUnsavedChanges(JSON.stringify(draft) !== baseline.current);
  const close = () => { if (!busy) requestClose(onClose); };
  const change = (key: keyof DynamicDraft, value: string) => { setDraft(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); };
  const move = (value: number) => { setStep(value); setErrors({}); requestAnimationFrame(() => heading.current?.focus()); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const issues = validateDynamic(draft, step); setErrors(issues);
    if (Object.keys(issues).length) { focusFirstError(form, issues); return; }
    if (step < 3) { move(step + 1); return; }
    for (let i = 0; i < 3; i++) { const all = validateDynamic(draft, i); if (Object.keys(all).length) { setStep(i); setErrors(all); requestAnimationFrame(() => focusFirstError(form, all)); return; } }
    await run(() => {
      const item: Dynamic = { id: initial?.id ?? nextId(), name: draft.name.trim(), type: draft.type, goal: Number(draft.goal), conversion: Number(draft.conversion), reward: draft.reward.trim(), start: draft.start, end: draft.end, active: initial?.active ?? true };
      setDynamics(previous => initial ? previous.map(row => row.id === item.id ? item : row) : [...previous, item]); baseline.current = JSON.stringify(draft); onClose();
    }, initial ? 'Dinámica actualizada.' : 'Dinámica creada.');
  }
  const labels = ['Tipo', 'Reglas', 'Recompensa y vigencia', 'Revisión'];
  return <Modal busy={busy} className="bd-modal-wide" title={initial ? 'Editar dinámica' : 'Crear dinámica'} onClose={close}>
    <ol className="bd-steps" aria-label="Pasos del asistente">{labels.map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined}>
      <span>{i + 1}</span>{label}</li>)}</ol>
    <div className="bd-wizard-layout">
      <form className="bd-form" noValidate onSubmit={submit}>
        <h3 ref={heading} tabIndex={-1} className="bd-form-wide">{labels[step]}</h3>
        <fieldset disabled={busy} className="bd-fieldset">
          {step === 0 && <FormField label="Tipo de dinámica" error={errors.type}>
            <select name="type" value={draft.type} onChange={e => change('type', e.target.value)}>
              <option value="sellos">Tarjeta de sellos</option>
              <option value="puntos">Programa de puntos</option>
              <option value="cupones">Cupón de descuento</option>
            </select>
          </FormField>}
          {step === 1 && <>
            <FormField label="Nombre de la dinámica" error={errors.name}>
              <input name="name" value={draft.name} maxLength={100} onChange={e => change('name', e.target.value)} />
            </FormField>
            <FormField label={draft.type === 'cupones' ? 'Descuento (%)' : draft.type === 'sellos' ? 'Meta de sellos' : 'Meta de puntos'} error={errors.goal}>
              <input name="goal" type="number" min="0" step={draft.type === 'sellos' ? '1' : 'any'} value={draft.goal} onChange={e => change('goal', e.target.value)} />
            </FormField>{draft.type === 'puntos' && <FormField label="MXN de consumo por cada punto" error={errors.conversion}>
              <input name="conversion" type="number" min="0" step="any" value={draft.conversion} onChange={e => change('conversion', e.target.value)} />
            </FormField>}</>}
          {step === 2 && <>
            <FormField label="Recompensa" error={errors.reward}>
              <input name="reward" value={draft.reward} maxLength={200} onChange={e => change('reward', e.target.value)} />
            </FormField>
            <FormField label="Fecha inicial" error={errors.start}>
              <input name="start" type="date" value={draft.start} onChange={e => change('start', e.target.value)} />
            </FormField>
            <FormField label="Fecha final" error={errors.end}>
              <input name="end" type="date" value={draft.end} onChange={e => change('end', e.target.value)} />
            </FormField>
          </>}
          {step === 3 && <dl className="bd-review">
            <dt>Nombre</dt>
            <dd>{draft.name}</dd>
            <dt>Tipo</dt>
            <dd>{draft.type}</dd>
            <dt>{draft.type === 'cupones' ? 'Descuento' : 'Meta'}</dt>
            <dd>{number(Number(draft.goal), 2)}{draft.type === 'cupones' ? ' %' : ''}</dd>{draft.type === 'puntos' && <>
              <dt>Conversión</dt>
              <dd>1 punto por {number(Number(draft.conversion), 2)} MXN</dd>
            </>}<dt>Recompensa</dt>
            <dd>{draft.reward}</dd>
            <dt>Vigencia</dt>
            <dd>{date(draft.start)} – {date(draft.end)}</dd>
          </dl>}
        </fieldset>
        <div className="bd-form-actions">{step > 0 && <button className="bd-secondary" type="button" disabled={busy} onClick={() => move(step - 1)}>Atrás</button>}<button className="bd-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : step === 3 ? 'Guardar dinámica' : 'Siguiente'}</button>
          <button className="bd-text-button" type="button" disabled={busy} onClick={close}>Cancelar</button>
        </div>
      </form>
      <DynamicPreview draft={draft} />
    </div>
  </Modal>;
}
