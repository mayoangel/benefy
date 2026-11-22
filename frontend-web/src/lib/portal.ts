import type { ContextoPortal } from '../lib/types.ts';

export function portalDestination(context: ContextoPortal | null): string {
  if (!context?.puede_portal) {
    return '/acceso-restringido';
  }
  if (context.es_admin_sistema) {
    return '/portal/admin';
  }
  const membresia = context.membresias[0];
  return membresia
    ? `/portal/negocio/${membresia.negocio.id}`
    : '/acceso-restringido';
}

export function membresiaDelNegocio(
  context: ContextoPortal | null,
  negocioId: number,
) {
  return context?.membresias.find(
    (membresia) => membresia.negocio.id === negocioId && membresia.status,
  ) ?? null;
}

export function puedeEditarNegocio(
  context: ContextoPortal | null,
  negocioId: number,
) {
  return membresiaDelNegocio(context, negocioId)?.rol_comercio === 'dueno';
}

export function puedeGestionarEquipo(
  context: ContextoPortal | null,
  negocioId: number,
) {
  const rol = membresiaDelNegocio(context, negocioId)?.rol_comercio;
  return rol === 'dueno' || rol === 'supervisor';
}

export function nombreRol(rol: string | null | undefined) {
  return ({dueno:'Propietario',supervisor:'Supervisor',empleado:'Empleado',admin_sistema:'Administrador'} as Record<string,string>)[rol ?? ''] ?? rol ?? '';
}
