import { Link } from 'react-router-dom';

import type { CaracteristicasPlan, PlanNegocio } from '../../lib/types.ts';

const RECURSOS: { clave: string; etiqueta: string }[] = [
  { clave: 'sucursales', etiqueta: 'Sucursales activas' },
  { clave: 'tarjetas_sellos', etiqueta: 'Tarjetas de sellos' },
  { clave: 'recompensas', etiqueta: 'Recompensas activas' },
  { clave: 'supervisores', etiqueta: 'Supervisores' },
  { clave: 'empleados', etiqueta: 'Empleados' },
  { clave: 'programas_puntos', etiqueta: 'Programa de puntos' },
  { clave: 'alianzas_activas', etiqueta: 'Alianzas activas (total)' },
  { clave: 'alianzas_con_free', etiqueta: 'Alianzas con negocios Free' },
  { clave: 'alianzas_con_premium', etiqueta: 'Alianzas con negocios Premium' },
];

const CARACTERISTICAS: {
  clave: keyof CaracteristicasPlan;
  etiqueta: string;
}[] = [
  { clave: 'metricas_avanzadas', etiqueta: 'Analíticas avanzadas' },
  { clave: 'exportacion_reportes', etiqueta: 'Exportación de reportes' },
  { clave: 'personalizacion_avanzada', etiqueta: 'Personalización avanzada' },
  { clave: 'alianzas', etiqueta: 'Alianzas comerciales' },
  { clave: 'alianzas_proponer', etiqueta: 'Proponer alianzas' },
];

function estadoCaracteristica(
  incluida: boolean,
  implementada: boolean,
): { texto: string; clase: string } {
  if (incluida && implementada) {
    return { texto: 'Disponible', clase: 'is-on' };
  }
  if (incluida && !implementada) {
    return { texto: 'Incluida · próximamente', clase: 'is-soon' };
  }
  if (!incluida && implementada) {
    return { texto: 'Solo Premium', clase: '' };
  }
  return { texto: 'Premium · próximamente', clase: '' };
}

export default function PlanPanel({ plan }: { plan: PlanNegocio }) {
  const esFree = plan.plan.codigo === 'free';

  return (
    <article className="portal-panel portal-plan">
      <div className="portal-plan-head">
        <div>
          <span className="portal-eyebrow">Suscripción</span>
          <h2>Plan {plan.plan.nombre}</h2>
          <p className="portal-muted">{plan.plan.descripcion}</p>
        </div>
        <span className={`portal-plan-badge${esFree ? '' : ' is-premium'}`}>
          {plan.plan.nombre}
        </span>
      </div>

      {plan.excedentes.length > 0 ? (
        <div className="portal-plan-warning" role="status">
          <strong>Tu negocio supera los límites del plan actual.</strong>
          <p>
            No se eliminó ningún dato. Puedes seguir consultando y operando lo
            existente, pero no crear nuevos recursos de las categorías excedidas
            hasta regularizarlas o volver a Premium.
          </p>
        </div>
      ) : null}

      <div className="portal-plan-usage">
        {RECURSOS.map(({ clave, etiqueta }) => {
          const uso = plan.limites[clave];
          if (!uso) return null;
          const porcentaje = uso.limite && uso.limite > 0
            ? Math.min(Math.round((uso.uso / uso.limite) * 100), 100)
            : 0;
          return (
            <div className="portal-plan-metric" key={clave}>
              <div className="portal-plan-metric-head">
                <span>{etiqueta}</span>
                <strong>
                  {uso.limite === null
                    ? `${uso.uso} · Ilimitado`
                    : `${uso.uso} / ${uso.limite}`}
                </strong>
              </div>
              {uso.limite !== null ? (
                <div
                  className={`portal-plan-bar${uso.excedido ? ' is-over' : ''}`}
                  aria-hidden="true"
                >
                  <span style={{ width: `${porcentaje}%` }} />
                </div>
              ) : null}
              {uso.excedido ? (
                <small className="portal-plan-alert">
                  Excedente de {uso.uso - (uso.limite ?? 0)}
                </small>
              ) : uso.limite !== null && uso.disponible === 0 ? (
                <small className="portal-plan-alert">Límite alcanzado</small>
              ) : null}
            </div>
          );
        })}
      </div>

      {plan.limites.alianzas_activas ? (
        <p className="portal-muted portal-plan-limits-note">
          Los topes con negocios Free y Premium se aplican dentro del total de
          alianzas activas; no son cupos adicionales.
        </p>
      ) : null}

      <div className="portal-plan-features">
        <h3>Funciones del plan</h3>
        <ul>
          {CARACTERISTICAS.map(({ clave, etiqueta }) => {
            const incluida = plan.caracteristicas[clave];
            const implementada = plan.caracteristicas_implementadas.includes(clave);
            const estado = estadoCaracteristica(incluida, implementada);
            return (
              <li key={clave}>
                <span>{etiqueta}</span>
                <span className={`portal-badge ${estado.clase}`}>{estado.texto}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {esFree ? (
        <div className="portal-plan-cta">
          <p>
            Premium amplía la capacidad de sucursales, tarjetas, recompensas y
            equipo. La activación es manual por el equipo de Benefy.
          </p>
          <Link className="portal-button-secondary" to="/precios">
            Conocer Premium
          </Link>
        </div>
      ) : (
        <p className="portal-muted">
          Plan Premium activo. Las funciones marcadas como disponibles ya están
          habilitadas; las demás se incorporarán en próximas fases.
        </p>
      )}
    </article>
  );
}
