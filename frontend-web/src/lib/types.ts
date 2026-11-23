export type OnboardingResultado = {
  completado: boolean;
  ya_existia: boolean;
  usuario: UsuarioPortal;
  negocio_id: number;
  contexto: ContextoPortal;
};

export type RolGlobal = 'consumidor' | 'admin_sistema';
export type RolComercio = 'dueno' | 'supervisor' | 'empleado';
export type CodigoPlan = 'free' | 'premium';

export type PlanResumenNegocio = {
  id: number;
  codigo: CodigoPlan | string;
  nombre: string;
  descripcion: string;
  orden: number;
  status: boolean;
};

export type LimitePlan = {
  limite: number | null;
  uso: number;
  disponible: number | null;
  excedido: boolean;
};

export type CaracteristicasPlan = {
  metricas_avanzadas: boolean;
  exportacion_reportes: boolean;
  personalizacion_avanzada: boolean;
  alianzas: boolean;
  alianzas_proponer: boolean;
};

export type PlanNegocio = {
  negocio: number;
  plan: PlanResumenNegocio;
  suscripcion: {
    id: number;
    status: string;
    stripe_status?: string;
    origen: string;
    en_cancelacion: boolean;
    gracia_fin?: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    periodo_actual_inicio: string | null;
    periodo_actual_fin: string | null;
  } | null;
  limites: Record<string, LimitePlan>;
  caracteristicas: CaracteristicasPlan;
  caracteristicas_implementadas: string[];
  excedentes: string[];
};

export type PrecioFacturacion = {
  intervalo: 'mensual' | 'anual';
  monto: string | null;
  divisa: string;
  disponible: boolean;
};

export type SuscripcionFacturacion = {
  id: number;
  status: string;
  stripe_status: string;
  origen: string;
  en_cancelacion: boolean;
  gracia_fin: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  periodo_actual_inicio: string | null;
  periodo_actual_fin: string | null;
  proxima_renovacion: string | null;
  cancelacion_programada: boolean;
  acceso_premium: boolean;
};

export type PagoFacturacion = {
  id: number;
  fecha: string;
  monto: string;
  divisa: string;
  status: string;
  stripe_invoice_status: string;
  intentos_pago: number;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  recibo_url: string | null;
};

export type FacturacionNegocio = PlanNegocio & {
  facturacion: {
    habilitada: boolean;
    modo: 'test' | 'deshabilitado';
    motivo: string;
    aviso: string;
    webhook_configurado: boolean;
    precios: PrecioFacturacion[];
    puede_contratar: boolean;
    puede_administrar: boolean;
    cliente_stripe_configurado: boolean;
    suscripcion: SuscripcionFacturacion | null;
    pagos: PagoFacturacion[];
  };
};

export type PlanCatalogo = PlanResumenNegocio & {
  limites: Record<string, number | null>;
  caracteristicas: CaracteristicasPlan;
  caracteristicas_implementadas: string[];
  precios: {
    intervalo: 'mensual' | 'anual';
    monto: string | null;
    divisa: string;
    status: boolean;
    stripe_price_id?: string | null;
  }[];
};

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
  plan: PlanResumenNegocio | null;
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
  qr_uuid: string;
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
  fecha_emision?: string;
  fecha_expiracion: string;
};

export type CategoriaResumen = {
  id: number;
  nombre: string;
};

export type PaginaResultados<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type PaginaClientes = {
  count: number;
  page: number;
  page_size: number;
  results: ClienteResumen[];
};

export type NegocioDetalle = {
  id: number;
  nombre: string;
  descripcion: string | null;
  direccion: string;
  telefono: string | null;
  correo: string;
  logo_url: string | null;
  banner_url: string | null;
  slug: string;
  zona_horaria: string;
  qr_uuid: string;
  status: boolean;
  categoria: number;
};

export type SucursalDetalle = {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string | null;
  ciudad: string;
  codigo_postal: string | null;
  status: boolean;
  negocio: number;
  qr_uuid: string;
  nfc_uid: string | null;
};

export type DinamicaResumen = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  tipo: 'puntos' | 'cupones' | 'sellos';
  meta: number | null;
  regla_conversion?: string;
  es_repetible: boolean;
  dias_expiracion_puntos?: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  status: boolean;
  negocio: number;
};

export type RecompensaResumen = {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: 'gratis' | 'descuento' | 'descuento_fijo';
  descuento: string | null;
  costo_desbloqueo: number;
  terminos_condiciones: string;
  status: boolean;
  negocio: number | null;
  es_meta: boolean;
  dinamica: number | null;
  alianza: number | null;
  fecha_expiracion: string | null;
  vigencia_dias: number | null;
  cantidad_disponible: number | null;
};

export type EstadoAlianza = 'pendiente' | 'activa' | 'finalizada' | 'rechazada';

export type NegocioAliado = {
  id: number;
  nombre: string;
  descripcion: string | null;
  direccion: string;
  logo_url: string | null;
  categoria: number;
  categoria_nombre: string;
};

export type EventoAlianza = {
  id: number;
  accion: 'solicitud' | 'aceptacion' | 'rechazo' | 'finalizacion' | 'recompensa';
  actor_correo: string;
  detalle: string;
  fecha: string;
};

export type RecompensaAlianza = {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: RecompensaResumen['tipo'];
  descuento: string | null;
  costo_desbloqueo: number;
  terminos_condiciones: string;
  status: boolean;
  negocio: number | null;
  fecha_expiracion: string | null;
  vigencia_dias: number | null;
  cantidad_disponible: number | null;
};

export type AlianzaResumen = {
  id: number;
  negocio1: NegocioAliado;
  negocio2: NegocioAliado;
  condicion_participacion: string;
  status: EstadoAlianza;
  vigente: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  direccion: 'enviada' | 'recibida' | 'participante';
  numero_beneficios: number;
};

export type AlianzaDetalle = AlianzaResumen & {
  eventos: EventoAlianza[];
  recompensas: RecompensaAlianza[];
  creado_por_correo: string | null;
  respondido_por_correo: string | null;
  puede_responder: boolean;
  puede_finalizar: boolean;
  puede_agregar_beneficio: boolean;
};

export type CanjeResumen = {
  id: number;
  cupon: number;
  usuario_correo?: string;
  titulo_beneficio?: string;
  sucursal: number | null;
  sucursal_nombre?: string | null;
  negocio: number | null;
  origen: string;
  metodo: string;
  fecha: string;
  anulado: boolean;
};

export type ClienteResumen = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  visitas: number;
  ultima_visita: string | null;
  puntos: number;
  cupones: number;
};

export type InvitacionResumen = {
  token: string;
  correo: string;
  rol_comercio: RolComercio;
  sucursal: { id: number; nombre: string } | null;
  negocio: { id: number; nombre: string };
  estado: 'pendiente' | 'aceptada' | 'revocada' | 'expirada';
  creada_por_correo: string;
  motivo: string;
  fecha_creacion: string;
  fecha_expiracion: string;
  fecha_respuesta: string | null;
};
