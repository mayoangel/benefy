import { useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import { useDemoData } from '../data/DemoDataProvider';
import { merchants, ownMerchantId, nextId } from '../data/demoData';
import { validateAlliance, type AllianceDraft } from '../data/allianceValidation';
import { date } from '../data/format';
import { focusFirstError, type Errors } from '../hooks/form';
import useOperation from '../hooks/useOperation';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
export default function AllianceWizard({ merchantId, onClose }: { merchantId?: number; onClose: () => void }) {
  const { setAlliances } = useDemoData();
  const [draft, setDraft] = useState<AllianceDraft>({ merchantId: merchantId ? String(merchantId) : '', condition: '', benefit: '', start: '', end: '' });
  const baseline = useRef(JSON.stringify(draft)); const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0); const [errors, setErrors] = useState<Errors>({});
  const { busy, run } = useOperation(); const { requestClose } = useUnsavedChanges(JSON.stringify(draft) !== baseline.current);
  const close = () => { if (!busy) requestClose(onClose); };
  const change = (key: keyof AllianceDraft, value: string) => { setDraft(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); };
  const move = (value: number) => { setStep(value); setErrors({}); requestAnimationFrame(() => heading.current?.focus()); };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget;
    const issues = step < 2 ? validateAlliance(draft, step) : { ...validateAlliance(draft, 0), ...validateAlliance(draft, 1) };
    setErrors(issues); if (Object.keys(issues).length) { if (step === 2) setStep(issues.merchantId ? 0 : 1); requestAnimationFrame(() => focusFirstError(form, issues)); return; }
    if (step < 2) { move(step + 1); return; }
    await run(() => { setAlliances(previous => [...previous, { id: nextId(), merchantId: Number(draft.merchantId), direction: 'sent', condition: draft.condition.trim(), benefit: draft.benefit.trim(), start: draft.start, end: draft.end, status: 'Pendiente' }]); baseline.current = JSON.stringify(draft); onClose(); }, 'Solicitud enviada. Queda pendiente de aceptación.');
  }
  const labels = ['Comercio', 'Condición y beneficio', 'Revisión'];
  return <Modal busy={busy} title="Proponer alianza" onClose={close}>
    <ol className="bd-steps">{labels.map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined}>
      <span>{i + 1}</span>{label}</li>)}</ol>
    <form noValidate className="bd-form" onSubmit={submit}>
      <h3 ref={heading} tabIndex={-1}>{labels[step]}</h3>
      <fieldset disabled={busy} className="bd-fieldset">{step === 0 && <FormField label="Comercio" error={errors.merchantId}>
        <select name="merchantId" value={draft.merchantId} onChange={e => change('merchantId', e.target.value)}>
          <option value="">Seleccionar comercio</option>{merchants.filter(m => m.id !== ownMerchantId).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </FormField>}{step === 1 && <>
        <FormField label="Condición de participación" error={errors.condition}>
          <input name="condition" value={draft.condition} maxLength={200} onChange={e => change('condition', e.target.value)} />
        </FormField>
        <FormField label="Beneficio" error={errors.benefit}>
          <input name="benefit" value={draft.benefit} maxLength={200} onChange={e => change('benefit', e.target.value)} />
        </FormField>
        <FormField label="Fecha inicial" error={errors.start}>
          <input name="start" type="date" value={draft.start} onChange={e => change('start', e.target.value)} />
        </FormField>
        <FormField label="Fecha final" error={errors.end}>
          <input name="end" type="date" value={draft.end} onChange={e => change('end', e.target.value)} />
        </FormField>
      </>}{step === 2 && <dl className="bd-review">
        <dt>Comercio</dt>
        <dd>{merchants.find(m => m.id === Number(draft.merchantId))?.name}</dd>
        <dt>Condición</dt>
        <dd>{draft.condition}</dd>
        <dt>Beneficio</dt>
        <dd>{draft.benefit}</dd>
        <dt>Vigencia</dt>
        <dd>{date(draft.start)} – {date(draft.end)}</dd>
      </dl>}</fieldset>
      <div className="bd-form-actions">{step > 0 && <button className="bd-secondary" type="button" disabled={busy} onClick={() => move(step - 1)}>Atrás</button>}<button className="bd-button" disabled={busy} type="submit">{busy ? 'Enviando…' : step < 2 ? 'Siguiente' : 'Enviar solicitud'}</button>
        <button className="bd-text-button" type="button" disabled={busy} onClick={close}>Cancelar</button>
      </div>
    </form>
  </Modal>;
}
