import { useRef, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import { useDemoData } from '../data/DemoDataProvider';
import { nextId, type Branch } from '../data/demoData';
import { focusFirstError, type Errors } from '../hooks/form';
import useOperation from '../hooks/useOperation';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
export default function BranchForm({ initial, employeeBranch, onClose }: { initial?: Branch; employeeBranch?: number; onClose: () => void }) {
  const { branches, setBranches, setEmployees } = useDemoData();
  const employee = employeeBranch !== undefined;
  const [draft, setDraft] = useState({ name: initial?.name || '', address: initial?.address || '', branch: employeeBranch || branches.find(b => !b.archived)?.id || 0, role: 'Cajero' });
  const baseline = useRef(JSON.stringify(draft)); const [errors, setErrors] = useState<Errors>({});
  const { busy, run } = useOperation(); const { requestClose } = useUnsavedChanges(JSON.stringify(draft) !== baseline.current);
  const close = () => { if (!busy) requestClose(onClose); };
  const change = (key: keyof typeof draft, value: string | number) => { setDraft(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const issues: Errors = {};
    if (!draft.name.trim()) issues.name = 'Escribe un nombre.';
    if (!employee && !draft.address.trim()) issues.address = 'Escribe una dirección.';
    if (employee && !branches.some(b => b.id === draft.branch && !b.archived)) issues.branch = 'Selecciona una sucursal activa.';
    setErrors(issues); if (Object.keys(issues).length) { focusFirstError(e.currentTarget, issues); return; }
    await run(() => { if (employee) setEmployees(previous => [...previous, { id: nextId(), name: draft.name.trim(), role: draft.role, branch: draft.branch, active: true }]); else { const item = { id: initial?.id ?? nextId(), name: draft.name.trim(), address: draft.address.trim() }; setBranches(previous => initial ? previous.map(b => b.id === item.id ? item : b) : [...previous, item]); } baseline.current = JSON.stringify(draft); onClose(); }, employee ? 'Empleado agregado.' : initial ? 'Sucursal actualizada.' : 'Sucursal registrada.');
  }
  return <Modal busy={busy} title={employee ? 'Agregar empleado' : initial ? 'Editar sucursal' : 'Registrar sucursal'} onClose={close}>
    <form className="bd-form" noValidate onSubmit={submit}>
      <fieldset className="bd-fieldset" disabled={busy}>
        <FormField label="Nombre" error={errors.name}>
          <input autoFocus name="name" value={draft.name} maxLength={100} onChange={e => change('name', e.target.value)} />
        </FormField>{employee ? <>
          <FormField label="Sucursal" error={errors.branch}>
            <select name="branch" value={draft.branch} onChange={e => change('branch', Number(e.target.value))}>{branches.filter(b => !b.archived).map(b => <option value={b.id} key={b.id}>{b.name}</option>)}</select>
          </FormField>
          <FormField label="Rol">
            <select name="role" value={draft.role} onChange={e => change('role', e.target.value)}>
              <option>Cajero</option>
              <option>Gerente</option>
            </select>
          </FormField>
        </> : <FormField label="Dirección" error={errors.address}>
          <input name="address" value={draft.address} maxLength={200} onChange={e => change('address', e.target.value)} />
        </FormField>}</fieldset>
      <div className="bd-form-actions">
        <button className="bd-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar en demostración'}</button>
        <button className="bd-secondary" type="button" disabled={busy} onClick={close}>Cancelar</button>
      </div>
    </form>
  </Modal>;
}
