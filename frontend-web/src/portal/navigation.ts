import type { RolComercio } from '../lib/types.ts';

export type PortalNavItem = {
  path: string;
  label: string;
  icon: string;
  roles: RolComercio[];
};

export type PortalNavArea = {
  key: string;
  label: string;
  icon: string;
  roles: RolComercio[];
  /** Las áreas con `path` son enlaces directos; las demás agrupan subsecciones. */
  path?: string;
  items?: PortalNavItem[];
};

const OWNER: RolComercio[] = ['dueno'];
const OPERATION: RolComercio[] = ['dueno', 'supervisor', 'empleado'];

export const PORTAL_NAV_AREAS: PortalNavArea[] = [
  {
    key: 'inicio',
    label: 'Inicio',
    icon: 'inicio',
    roles: OPERATION,
    path: '',
  },
  {
    key: 'actividad',
    label: 'Actividad',
    icon: 'actividad',
    roles: OPERATION,
    items: [
      {
        path: 'clientes',
        label: 'Clientes',
        icon: 'clientes',
        roles: OWNER,
      },
      {
        path: 'visitas',
        label: 'Visitas',
        icon: 'visitas',
        roles: OPERATION,
      },
      {
        path: 'cupones',
        label: 'Cupones',
        icon: 'cupones',
        roles: OWNER,
      },
      {
        path: 'canjes',
        label: 'Canjes',
        icon: 'canjes',
        roles: OPERATION,
      },
    ],
  },
  {
    key: 'fidelizacion',
    label: 'Fidelización',
    icon: 'fidelizacion',
    roles: OWNER,
    items: [
      {
        path: 'puntos',
        label: 'Puntos',
        icon: 'puntos',
        roles: OWNER,
      },
      {
        path: 'tarjetas',
        label: 'Tarjetas de sellos',
        icon: 'tarjetas',
        roles: OWNER,
      },
      {
        path: 'recompensas',
        label: 'Recompensas',
        icon: 'recompensas',
        roles: OWNER,
      },
    ],
  },
  {
    key: 'alianzas',
    label: 'Alianzas',
    icon: 'alianzas',
    roles: OWNER,
    path: 'alianzas',
  },
  {
    key: 'administracion',
    label: 'Administración',
    icon: 'administracion',
    roles: ['dueno', 'supervisor'],
    items: [
      {
        path: 'sucursales',
        label: 'Sucursales',
        icon: 'sucursales',
        roles: OWNER,
      },
      {
        path: 'equipo',
        label: 'Equipo',
        icon: 'equipo',
        roles: ['dueno', 'supervisor'],
      },
      {
        path: 'suscripcion',
        label: 'Suscripción',
        icon: 'suscripcion',
        roles: OWNER,
      },
      {
        path: 'configuracion',
        label: 'Configuración',
        icon: 'configuracion',
        roles: OWNER,
      },
    ],
  },
];

export function areasForRole(rol: RolComercio | null): PortalNavArea[] {
  if (!rol) return [];
  return PORTAL_NAV_AREAS.flatMap((area) => {
    if (!area.roles.includes(rol)) return [];
    if (area.path !== undefined) return [area];
    const items = (area.items ?? []).filter((item) => item.roles.includes(rol));
    return items.length ? [{ ...area, items }] : [];
  });
}

export function areaForRelativePath(
  areas: PortalNavArea[],
  relativePath: string,
): PortalNavArea | null {
  const path = relativePath.replace(/^\/+|\/+$/g, '');
  for (const area of areas) {
    if (area.path !== undefined) {
      if (area.path === path) return area;
      continue;
    }
    if ((area.items ?? []).some((item) => item.path === path)) {
      return area;
    }
  }
  return null;
}
