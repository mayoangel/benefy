import { useState, type FormEvent } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { useDemoData } from '../data/DemoDataProvider';
import { focusFirstError, type Errors } from '../hooks/form';
import useOperation from '../hooks/useOperation';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
export default function Settings() {
  const { preferences, setPreferences } = useDemoData(); const [draft, setDraft] = useState(preferences);
  const [errors, setErrors] = useState<Errors>({}); const [legal, setLegal] = useState('');
  const { busy, run } = useOperation(); const { requestClose } = useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(preferences));
  const change = (key: keyof typeof draft, value: string | boolean) => { setDraft(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const issues: Errors = {};
    if (!draft.name.trim()) issues.name = 'Escribe el nombre comercial.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) issues.email = 'Escribe un correo válido.';
    if (draft.phone.trim() && !/^[+\d\s()-]{7,20}$/.test(draft.phone.trim())) issues.phone = 'Escribe un teléfono válido (7 a 20 caracteres).';
    setErrors(issues); if (Object.keys(issues).length) { focusFirstError(e.currentTarget, issues); return; }
    await run(() => { const value = { ...draft, name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() }; setPreferences(value); setDraft(value); }, 'Preferencias guardadas.');
  }
  return <>
    <Card title="Perfil del negocio">
      <form className="bd-form" noValidate onSubmit={submit}>
        <fieldset className="bd-fieldset bd-settings-grid" disabled={busy}>
          <FormField label="Nombre comercial" error={errors.name}>
            <input name="name" maxLength={100} value={draft.name} onChange={e => change('name', e.target.value)} />
          </FormField>
          <FormField label="Correo comercial" error={errors.email}>
            <input name="email" type="email" maxLength={200} value={draft.email} onChange={e => change('email', e.target.value)} />
          </FormField>
          <FormField label="Teléfono" error={errors.phone}>
            <input name="phone" type="tel" value={draft.phone} onChange={e => change('phone', e.target.value)} />
          </FormField>
          <FormField label="Categoría del negocio">
            <select name="category" value={draft.category} onChange={e => change('category', e.target.value)}>
              <option>Cafetería</option>
              <option>Restaurante</option>
              <option>Comercio</option>
              <option>Servicios</option>
            </select>
          </FormField>
          <div className="bd-form-wide">
            <h3>Notificaciones</h3>
            <label className="bd-checkbox">
              <input type="checkbox" checked={draft.summary} onChange={e => change('summary', e.target.checked)} /> Resumen de actividad por correo</label>
            <label className="bd-checkbox">
              <input type="checkbox" checked={draft.alerts} onChange={e => change('alerts', e.target.checked)} /> Alertas de dinámicas y recompensas</label>
          </div>
        </fieldset>
        <div className="bd-form-actions">
          <button className="bd-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar preferencias'}</button>
          <button className="bd-secondary" type="button" disabled={busy} onClick={() => requestClose(() => setDraft(preferences))}>Restablecer formulario</button>
        </div>
      </form>
    </Card>
    <div className="bd-row-actions">
      <a className="bd-text-button" href="#terminos" onClick={e => { e.preventDefault(); setLegal('Términos de uso'); }}>Términos de uso</a>
      <a className="bd-text-button" href="#privacidad" onClick={e => { e.preventDefault(); setLegal('Aviso de privacidad'); }}>Aviso de privacidad</a>
    </div>{legal && <Modal title={legal} onClose={() => setLegal('')}>
      <p>El documento legal estará disponible al publicar la versión final de Benefy. Esta demostración no recoge datos reales.</p>
      <button className="bd-secondary" onClick={() => setLegal('')}>Cerrar</button>
    </Modal>}</>;
}
