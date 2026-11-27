import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider.tsx';
import { ApiError, api } from '../../lib/api.ts';
import { planLabel } from '../../lib/planLabels.ts';
import { membresiaDelNegocio } from '../../lib/portal.ts';
import type {
  FacturacionNegocio,
  PagoFacturacion,
  PrecioFacturacion,
} from '../../lib/types.ts';
import PlanPanel from '../components/PlanPanel.tsx';
import { PortalPageHeader, PortalTable } from '../components/PortalUI.tsx';
import { PortalEmpty, PortalError, PortalLoading } from '../components/PortalState.tsx';
import { clearPlanCache } from '../hooks/planCache';

const ETIQUETAS_PAGO: Record<string, string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  fallido: 'Fallido',
  anulado: 'Anulado',
  reembolsado: 'Reembolsado',
};

function moneda(monto: string | null, divisa: string): string {
  if (monto === null || monto === '') return '—';
  const valor = Number(monto);
  if (!Number.isFinite(valor)) return `${monto} ${divisa}`;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: divisa || 'MXN',
    maximumFractionDigits: 2,
  }).format(valor);
}

function fecha(valor: string | null): string {
  if (!valor) return '—';
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.codigo === 'stripe_no_configurado' || error.codigo === 'stripe_modo_invalido') {
      return 'La facturación de prueba no está configurada. Un administrador debe completar las variables correspondientes.';
    }
    if (error.codigo === 'premium_activo') {
      return 'Tu negocio ya tiene el plan premium. Administra la suscripción en lugar de crear otra.';
    }
    if (error.codigo === 'plan_no_facturable') {
      return 'El plan premium aún no está vinculado al entorno de facturación.';
    }
    if (error.codigo === 'stripe_error') {
      return 'El servicio de facturación no respondió. No se realizó ningún cargo; intenta de nuevo.';
    }
    if (error.codigo === 'portal_no_disponible') {
      return 'No se pudo abrir el Customer Portal. Intenta de nuevo en unos segundos.';
    }
    if (error.status === 403) {
      return 'Solo el propietario del negocio puede administrar la suscripción.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

function estadoFacturacion(datos: FacturacionNegocio) {
  const suscripcion = datos.facturacion.suscripcion;
  const premium = datos.plan.codigo === 'premium';
  if (premium && suscripcion?.gracia_fin) {
    return {
      texto: `Pago pendiente · gracia hasta ${fecha(suscripcion.gracia_fin)}`,
      clase: 'is-pending',
    };
  }
  if (premium && suscripcion?.cancelacion_programada) {
    return {
      texto: `Cancelación programada para ${fecha(suscripcion.periodo_actual_fin)}`,
      clase: 'is-cancel',
    };
  }
  if (premium) {
    return { texto: 'Plan premium activo', clase: 'is-premium' };
  }
  if (suscripcion?.stripe_status === 'incomplete') {
    return { texto: 'Pago incompleto', clase: 'is-pending' };
  }
  if (suscripcion?.stripe_status === 'canceled') {
    return { texto: 'Suscripción cancelada · plan gratis', clase: 'is-cancel' };
  }
  if (suscripcion?.stripe_status === 'unpaid') {
    return { texto: 'Pago vencido · plan gratis', clase: 'is-failed' };
  }
  return { texto: 'Plan gratis', clase: '' };
}

function precioSeleccionado(
  precios: PrecioFacturacion[],
  intervalo: 'mensual' | 'anual',
): PrecioFacturacion | null {
  return precios.find((precio) => precio.intervalo === intervalo) ?? null;
}

function filaPago(pago: PagoFacturacion) {
  return (
    <tr key={pago.id}>
      <td>{fecha(pago.fecha)}</td>
      <td>{moneda(pago.monto, pago.divisa)}</td>
      <td>
        <span className={`portal-payment-status is-${pago.status}`}>
          {ETIQUETAS_PAGO[pago.status] ?? pago.status}
        </span>
      </td>
      <td>{fecha(pago.periodo_inicio)} – {fecha(pago.periodo_fin)}</td>
      <td>
        {pago.recibo_url ? (
          <a href={pago.recibo_url} target="_blank" rel="noopener noreferrer">
            Ver recibo de prueba
          </a>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}

export default function SubscriptionPage({
  onRedirect = (url: string) => window.location.assign(url),
}: {
  onRedirect?: (url: string) => void;
}) {
  const { context, refreshContext } = useAuth();
  const { negocioId } = useParams();
  const id = Number(negocioId);
  const [searchParams, setSearchParams] = useSearchParams();
  const membresia = membresiaDelNegocio(context, id);
  const esDueno = membresia?.rol_comercio === 'dueno' || Boolean(context?.es_admin_sistema);

  const [datos, setDatos] = useState<FacturacionNegocio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [intervalo, setIntervalo] = useState<'mensual' | 'anual'>('mensual');
  const [busy, setBusy] = useState<'checkout' | 'portal' | 'sync' | null>(null);
  const [verificando, setVerificando] = useState(false);
  const parametrosIniciales = useRef(searchParams);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const respuesta = await api.getBilling(id);
      setDatos(respuesta);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let activo = true;
    const parametros = parametrosIniciales.current;
    const iniciar = async () => {
      const checkout = parametros.get('checkout');
      const sessionId = parametros.get('session_id');
      const portal = parametros.get('portal');
      setLoading(true);
      setError(null);
      try {
        let respuesta: FacturacionNegocio;
        if (checkout === 'success' && sessionId) {
          setVerificando(true);
          respuesta = await api.getBilling(id);
          for (let intento = 0; intento < 5 && activo; intento += 1) {
            try {
              respuesta = await api.syncBilling(id, sessionId);
            } catch {
              // El webhook puede tardar; se reintenta sin activar nada localmente.
            }
            if (respuesta.plan.codigo === 'premium') break;
            if (intento < 4) {
              await new Promise((resolve) => window.setTimeout(resolve, 2000));
            }
          }
          setMensaje(
            respuesta.plan.codigo === 'premium'
              ? 'Pago de prueba confirmado. El plan premium ya está activo.'
              : 'Stripe todavía está confirmando el pago. Actualiza el estado en unos segundos.',
          );
          clearPlanCache();
          await refreshContext();
        } else if (portal === 'return') {
          respuesta = await api.syncBilling(id);
          setMensaje('Estado actualizado desde Stripe. El plan no cambia por el retorno.');
          clearPlanCache();
          await refreshContext();
        } else {
          respuesta = await api.getBilling(id);
          if (checkout === 'cancel') {
            setMensaje('Checkout cancelado. No se realizó ningún cargo.');
          }
        }
        if (activo) setDatos(respuesta);
        if (
          parametros.has('checkout')
          || parametros.has('session_id')
          || parametros.has('portal')
        ) {
          const limpios = new URLSearchParams(parametros);
          limpios.delete('checkout');
          limpios.delete('session_id');
          limpios.delete('portal');
          setSearchParams(limpios, { replace: true });
        }
      } catch (err) {
        if (activo) setError(mensajeError(err));
      } finally {
        if (activo) {
          setLoading(false);
          setVerificando(false);
        }
      }
    };
    void iniciar();
    return () => {
      activo = false;
    };
  }, [id, refreshContext, setSearchParams]);

  const precio = useMemo(
    () => (datos ? precioSeleccionado(datos.facturacion.precios, intervalo) : null),
    [datos, intervalo],
  );

  if (!membresia) {
    return <Navigate to="/portal" replace />;
  }

  if (!esDueno) {
    return (
      <section className="portal-page">
        <PortalPageHeader
          eyebrow="Administración"
          title="Suscripción del negocio"
          description="La facturación solo puede administrarla el propietario del negocio."
        />
        <PortalError
          message="Tu rol no permite contratar ni administrar la suscripción."
        />
      </section>
    );
  }

  async function actualizarEstado() {
    setBusy('sync');
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await api.syncBilling(id);
      setDatos(respuesta);
      clearPlanCache();
      await refreshContext();
      setMensaje('Estado sincronizado con el entorno de prueba.');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setBusy(null);
    }
  }

  async function contratar() {
    if (!precio?.disponible) return;
    setBusy('checkout');
    setError(null);
    setMensaje(null);
    try {
      const sesion = await api.createCheckout(id, intervalo);
      onRedirect(sesion.url);
    } catch (err) {
      setError(mensajeError(err));
      setBusy(null);
    }
  }

  async function administrar() {
    setBusy('portal');
    setError(null);
    setMensaje(null);
    try {
      const sesion = await api.createBillingPortal(id);
      onRedirect(sesion.url);
    } catch (err) {
      setError(mensajeError(err));
      setBusy(null);
    }
  }

  const estado = datos ? estadoFacturacion(datos) : null;
  const facturacion = datos?.facturacion;
  const suscripcion = facturacion?.suscripcion;
  const precioMensual = datos
    ? precioSeleccionado(datos.facturacion.precios, 'mensual')
    : null;
  const precioAnual = datos
    ? precioSeleccionado(datos.facturacion.precios, 'anual')
    : null;

  return (
    <section className="portal-page">
      <PortalPageHeader
        eyebrow="Administración"
        title="Tu plan y facturación"
        description="Consulta tu plan, contrata el plan premium y administra la suscripción desde el portal."
      >
        <button
          type="button"
          className="portal-button-secondary"
          onClick={() => void actualizarEstado()}
          disabled={busy !== null || loading}
        >
          {busy === 'sync' ? 'Sincronizando…' : 'Actualizar estado'}
        </button>
      </PortalPageHeader>

      {mensaje ? <p className="portal-note" role="status" aria-live="polite">{mensaje}</p> : null}
      {error ? <PortalError message={error} onRetry={() => void cargar()} /> : null}
      {verificando ? <PortalLoading label="Verificando el pago con Stripe…" /> : null}
      {loading && !datos ? <PortalLoading /> : null}

      {datos && facturacion && estado ? (
        <>
          <div className="portal-billing-demo" role="note">
            <div>
              <strong>Pagos de prueba</strong>
              <p>{facturacion.aviso} No uses números de tarjeta reales.</p>
            </div>
            <span className="portal-billing-mode">modo de prueba</span>
          </div>

          <article className="portal-panel portal-billing-hero">
            <div className="portal-billing-hero-main">
              <span className="portal-eyebrow">Plan actual</span>
              <h2>{planLabel(datos.plan)}</h2>
              <p className="portal-muted">{datos.plan.descripcion}</p>
              <span className={`portal-billing-status ${estado.clase}`}>
                {estado.texto}
              </span>
            </div>
            <div className="portal-billing-prices">
              {[precioMensual, precioAnual].map((item) => item ? (
                <div className="portal-billing-price" key={item.intervalo}>
                  <span>{item.intervalo === 'mensual' ? 'Mensual' : 'Anual'}</span>
                  <strong>{moneda(item.monto, item.divisa)}</strong>
                  <small>{item.disponible ? 'Disponible para pago de prueba' : 'No disponible'}</small>
                </div>
              ) : null)}
            </div>
            <div className="portal-billing-meta">
              {suscripcion?.proxima_renovacion ? (
                <div>
                  <span>Próxima renovación</span>
                  <strong>{fecha(suscripcion.proxima_renovacion)}</strong>
                </div>
              ) : null}
              {suscripcion?.cancelacion_programada ? (
                <div className="is-warning">
                  <span>Plan premium hasta</span>
                  <strong>{fecha(suscripcion.periodo_actual_fin)}</strong>
                </div>
              ) : null}
              {suscripcion?.gracia_fin ? (
                <div className="is-warning">
                  <span>Gracia por pago pendiente</span>
                  <strong>{fecha(suscripcion.gracia_fin)}</strong>
                </div>
              ) : null}
              {suscripcion?.stripe_status ? (
                <div>
                  <span>Estado Stripe</span>
                  <strong>{suscripcion.stripe_status}</strong>
                </div>
              ) : null}
            </div>
          </article>

          {suscripcion?.cancelacion_programada ? (
            <p className="portal-billing-notice is-warning" role="status">
              <strong>Cancelación programada.</strong> Conservas el plan premium hasta el
              final del periodo pagado. Después el negocio pasa al plan gratis. Las
              alianzas existentes no se eliminan y los cupones conservan su
              vigencia.
            </p>
          ) : null}

          {suscripcion?.gracia_fin && datos.plan.codigo === 'premium' ? (
            <p className="portal-billing-notice is-warning" role="status">
              <strong>Pago pendiente.</strong> Mantienes el plan premium durante la gracia
              acotada. Actualiza el método de pago antes de{' '}
              {fecha(suscripcion.gracia_fin)} para evitar el cambio al plan gratis.
            </p>
          ) : null}

          {!facturacion.habilitada ? (
            <p className="portal-billing-notice is-error" role="status">
              <strong>La facturación de prueba no está disponible.</strong>{' '}
              {facturacion.motivo || 'Completa la configuración de pagos de prueba para contratar el plan premium.'}
            </p>
          ) : null}

          {facturacion.habilitada && !facturacion.webhook_configurado ? (
            <p className="portal-billing-notice is-warning" role="status">
              <strong>Webhook de Stripe sin configurar.</strong> El retorno de
              Checkout puede sincronizar el estado, pero las renovaciones y
              cancelaciones requieren completar la configuración del webhook.
            </p>
          ) : null}

          <div className="portal-billing-actions">
            {facturacion.puede_contratar ? (
              <div className="portal-billing-checkout">
                <fieldset>
                  <legend>Elige la modalidad de prueba</legend>
                  {(['mensual', 'anual'] as const).map((opcion) => {
                    const item = precioSeleccionado(facturacion.precios, opcion);
                    return (
                      <label
                        key={opcion}
                        className={`portal-billing-option${intervalo === opcion ? ' is-selected' : ''}${!item?.disponible ? ' is-disabled' : ''}`}
                      >
                        <input
                          type="radio"
                          name="intervalo-premium"
                          value={opcion}
                          checked={intervalo === opcion}
                          disabled={!item?.disponible}
                          onChange={() => setIntervalo(opcion)}
                        />
                        <span>
                          <strong>{opcion === 'mensual' ? 'Mensual' : 'Anual'}</strong>
                          <small>
                            {item?.disponible
                              ? moneda(item.monto, item.divisa)
                              : 'No disponible'}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
                <button
                  type="button"
                  className="portal-button"
                  onClick={() => void contratar()}
                  disabled={busy !== null || !precio?.disponible}
                >
                  {busy === 'checkout' ? 'Abriendo Checkout…' : 'Contratar plan premium'}
                </button>
                <small className="portal-muted">
                  Serás redirigido a Stripe Checkout. Usa tarjetas de prueba
                  documentadas; no se realizará ningún cargo real.
                </small>
              </div>
            ) : null}

            {facturacion.puede_administrar ? (
              <div className="portal-billing-manage">
                <button
                  type="button"
                  className="portal-button-secondary"
                  onClick={() => void administrar()}
                  disabled={busy !== null}
                >
                  {busy === 'portal' ? 'Abriendo portal…' : 'Administrar suscripción'}
                </button>
                <small className="portal-muted">
                  Actualiza el método de pago de prueba, consulta facturas o
                  programa la cancelación al final del periodo.
                </small>
              </div>
            ) : null}
          </div>

          <PlanPanel
            plan={datos}
            pie={
              <p className="portal-muted portal-billing-plan-note">
                Precio de referencia: {moneda(precioMensual?.monto ?? null, precioMensual?.divisa ?? 'MXN')} al mes
                o {moneda(precioAnual?.monto ?? null, precioAnual?.divisa ?? 'MXN')} al año.
                El monto y las condiciones provienen del catálogo de facturación.
              </p>
            }
          />

          <article className="portal-panel portal-billing-history">
            <h2>Historial de pagos de prueba</h2>
            {facturacion.pagos.length ? (
              <PortalTable label="Historial de pagos de prueba">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Monto</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Periodo</th>
                    <th scope="col">Recibo</th>
                  </tr>
                </thead>
                <tbody>{facturacion.pagos.map(filaPago)}</tbody>
              </PortalTable>
            ) : (
              <PortalEmpty message="Todavía no hay pagos de prueba registrados para este negocio." />
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}
