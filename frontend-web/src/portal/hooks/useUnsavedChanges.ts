import { useCallback, useEffect } from 'react';

/**
 * Protege formularios con cambios sin guardar.
 *
 * En una navegación completa (recarga o cierre de pestaña) usa beforeunload.
 * Para cerrar un diálogo interno expone `confirmClose`, que pide confirmación
 * antes de ejecutar el cierre.
 */
export function useUnsavedChanges(
  dirty: boolean,
  message = 'Hay cambios sin guardar. ¿Quieres descartarlos?',
) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const confirmClose = useCallback((close: () => void) => {
    if (!dirty || window.confirm(message)) close();
  }, [dirty, message]);

  return { confirmClose };
}
