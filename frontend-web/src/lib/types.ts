export type RolGlobal = 'consumidor' | 'admin_sistema';
export type RolComercio = 'dueno' | 'supervisor' | 'empleado';

export type UsuarioPortal = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: RolGlobal;
  is_active: boolean;
};

export type NegocioPortal = {
  id: number;
  nombre: string;
  logo_url: string | null;
  status: boolean;
  zona_horaria: string;
};

export type SucursalPortal = {
  id: number;
  nombre: string;
  negocio: number;
  status: boolean;
};

export type MembresiaPortal = {
  id: number;
  negocio: NegocioPortal;
  sucursal: SucursalPortal | null;
  rol_comercio: RolComercio;
  status: boolean;
};

export type ContextoPortal = {
  usuario: UsuarioPortal;
  es_admin_sistema: boolean;
  puede_portal: boolean;
  membresias: MembresiaPortal[];
  negocios: NegocioPortal[];
  sucursales: SucursalPortal[];
};

export type MetricasPortal = {
  desde: string;
  hasta: string;
  alcance: 'negocio' | 'sucursal';
  sucursales: number[];
  visitas_validas: number;
  clientes_unicos: number;
  puntos_otorgados: number | null;
  puntos_consumidos: number | null;
  cupones_emitidos: number | null;
  cupones_canjeados: number;
  tarjetas_completadas: number | null;
  top_recompensas: { titulo: string; total: number }[];
};

export type NegocioResumen = {
  id: number;
  nombre: string;
  slug: string;
  logo_url?: string | null;
  status: boolean;
  categoria: number;
};

export type SucursalResumen = {
  id: number;
  nombre: string;
  negocio: number;
  status: boolean;
  ciudad?: string;
  direccion?: string;
};

export type UsuarioResumen = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: RolGlobal;
};

export type MembresiaResumen = {
  id: number;
  usuario: number;
  usuario_nombre?: string;
  usuario_correo?: string;
  negocio: number;
  sucursal: number | null;
  sucursal_nombre?: string | null;
  rol_comercio: RolComercio;
  status: boolean;
};

export type VisitaResumen = {
  id: number;
  usuario: number;
  usuario_correo?: string;
  negocio: number;
  sucursal: number | null;
  sucursal_nombre?: string | null;
  metodo_validacion: string;
  tipo: string;
  fecha: string;
  fecha_negocio: string;
  es_valida: boolean;
};

export type CuponResumen = {
  id: number;
  uuid: string;
  usuario: number;
  usuario_correo?: string;
  recompensa: number;
  negocio: number | null;
  origen: string;
  status: string;
  titulo_beneficio?: string;
  costo_pagado: number;
  fecha_expiracion: string;
};

export type CategoriaResumen = {
  id: number;
  nombre: string;
};
