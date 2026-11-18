import { cloneElement, useId, type ReactElement } from 'react';
export default function FormField({ label, error, children }: { label: string; error?: string; children: ReactElement }) {
  const id = useId(); return <div className="bd-field">
    <label htmlFor={id}>{label}</label>{cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined })}{error && <span id={`${id}-error`} className="bd-field-error" role="alert">{error}</span>}</div>;
}
