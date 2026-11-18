export type Errors = Record<string, string>;
export function focusFirstError(form: HTMLFormElement, errors: Errors) { const name = Object.keys(errors)[0]; form.querySelector<HTMLElement>(`[name="${name}"]`)?.focus(); }
export function required(value: string, label: string) { return value.trim() ? '' : `Escribe ${label}.`; }
