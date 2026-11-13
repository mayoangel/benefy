import { useState } from 'react';
import useReveal from '../hooks/useReveal.ts';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';

type Plan = {
  name: string;
  icon: IconName;
  monthly: number;
  description: string;
  features: string[];
  excluded?: string;
  button: string;
  note: string;
  popular?: boolean;
};

type ComparisonGroup = {
  group: string;
  rows: [string, string, string, string][];
};

const plans: Plan[] = [
  {
    name: 'Comercio Local',
    icon: 'storefront',
    monthly: 499,
    description:
      'Ideal para 1 sucursal, cafeterías de barrio, panaderías o boutiques individuales que inician su programa de retorno.',
    features: [
      '1 punto de cobro / terminal (app móvil o tablet web)',
      'Hasta 2 dinámicas activas (sellos digitales o puntos de consumo)',
      'Alianzas B2B con hasta 2 comercios vecinos',
      'Métricas esenciales de visitas y clientes registrados',
    ],
    excluded: 'IA predictiva de consumo recurrente',
    button: 'Elegir plan Local',
    note: 'Cancela cuando quieras sin penalidad',
  },
  {
    name: 'Negocio Pro',
    icon: 'rocket_launch',
    monthly: 999,
    description:
      'Diseñado para restaurantes, estudios boutique, salones de belleza y comercios listos para escalar lealtad y cross-selling.',
    features: [
      'Hasta 3 puntos de cobro en mostrador o mesas concurrentes',
      'Dinámicas ilimitadas: sellos, puntos y cupones flash geolocalizados',
      'Red de alianzas B2B ilimitada para canjes cruzados',
      'Analítica avanzada de afluencia, ticket promedio y retorno',
      'Asistente IA: alertas de clientes en riesgo de abandono',
    ],
    button: 'Elegir plan Pro',
    note: '14 días de prueba con todas las funciones desbloqueadas',
    popular: true,
  },
  {
    name: 'Multisede / Corporativo',
    icon: 'corporate_fare',
    monthly: 1899,
    description:
      'Para cadenas regionales, franquicias en expansión y empresas que requieren control unificado y roles de gestión.',
    features: [
      'Múltiples sucursales consolidadas con balance cruzado centralizado',
      'Terminales y roles de acceso ilimitados (Cajero, Gerente, Administrador)',
      'Exportación contable directa (SAT / CFDI / CSV conciliable)',
      'Gestor de cuenta y soporte telefónico prioritario 24/7',
      'Integración de API personalizada para sistemas POS propios',
    ],
    button: 'Elegir plan Multisede',
    note: 'Facturación corporativa disponible',
  },
];

const comparison: ComparisonGroup[] = [
  {
    group: 'Puntos de venta y hardware',
    rows: [
      ['Terminales de escaneo simultáneas', '1 dispositivo', 'Hasta 3 simultáneos', 'Ilimitadas'],
      ['Modo autoservicio (Tablet QR)', '—', '✓', '✓'],
      ['Lectores de código de barras / USB', 'Básica', '✓', '✓'],
    ],
  },
  {
    group: 'Dinámicas de lealtad y gamificación',
    rows: [
      ['Tarjetas de sellos digitales', '✓', '✓', '✓'],
      ['Cashback y monedero electrónico', '—', '✓', '✓'],
      ['Recompensas por cumpleaños', '—', '✓', '✓'],
      ['Campañas de WhatsApp automatizadas', '—', '100 msgs/mes', 'Ilimitados'],
    ],
  },
  {
    group: 'Red de Alianzas B2B',
    rows: [
      ['Alianzas de cross-promotion', 'Hasta 2 comercios', 'Ilimitadas', 'Ilimitadas'],
      ['Liquidación de vouchers cruzados', 'Manual', 'Automática semanal', 'Automática diaria'],
      ['Vitrina en catálogo Benefy', '✓', 'Posicionamiento destacado', 'Banner prioritario'],
    ],
  },
  {
    group: 'Seguridad, Analítica y Soporte',
    rows: [
      ['Roles y permisos', 'Solo cajero y admin', '3 roles configurables', 'Ilimitados'],
      ['Canal de soporte', 'Email (48 hrs)', 'Chat prioritario (4 hrs)', 'Gerente de cuenta 24/7'],
      ['Exportación contable / fiscal', 'CSV mensual', 'CSV / Excel en vivo', 'API directa SAT / ERP'],
    ],
  },
];

const faqs: [string, string][] = [
  [
    '¿Puedo cambiar de plan o cancelar en cualquier momento?',
    'Sí. Benefy opera sin plazos forzosos. Puedes subir o bajar de plan; el prorrateo se calcula en el siguiente ciclo de facturación. Al cancelar, tus datos quedan disponibles para exportación durante 60 días naturales.',
  ],
  [
    '¿Cómo se gestionan las terminales de cobro en tienda?',
    'No necesitas adquirir hardware propietario. El punto de cobro funciona en teléfonos iOS o Android, tablets y computadoras con navegador web. El cajero escanea el QR dinámico del cliente, acerca su celular por NFC o ingresa su número para registrar una visita o validar una recompensa.',
  ],
  [
    '¿Los clientes finales deben pagar algo para usar la plataforma?',
    'No. La app y el pase digital para clientes son gratuitos. Pueden sumar sellos y canjear beneficios con Apple Wallet, Google Wallet o la app de recompensas.',
  ],
  [
    '¿Cómo funciona el período de prueba de 14 días?',
    'Al crear tu cuenta comercial obtienes 14 días con acceso a las funciones del Plan Pro. No se solicita tarjeta de crédito para iniciar la prueba. Después puedes elegir el plan adecuado o dejar la cuenta en pausa.',
  ],
  [
    '¿Qué datos de mis clientes guarda Benefy?',
    'Benefy valida beneficios sin guardar ni vender datos personales de tus clientes, y no comparte información entre comercios aliados.',
  ],
  [
    '¿Cómo se liquidan las alianzas entre comercios?',
    'El libro contable B2B compensa automáticamente los canjes entre aliados: de forma manual en Comercio Local, semanal en Negocio Pro y diaria en Multisede.',
  ],
];

const assurances: [IconName, string, string][] = [
  ['verified_user', 'Sin contratos forzosos', 'Modifica o cancela cuando quieras'],
  ['percent', '0% comisiones por canje', 'Tu margen de venta se queda contigo'],
  ['support_agent', 'Acompañamiento inicial', 'Capacitación de personal incluida'],
  ['sync_alt', 'Migración sin fricción', 'Importamos tu programa actual de sellos y saldos'],
];

function formatPrice(value: number) {
  return `$${value.toLocaleString('es-MX')}`;
}

function getAnnualMonthlyPrice(plan: Plan) {
  return Math.round(plan.monthly * 0.85);
}

function PlanCard({
  plan,
  annual,
  hoveredPlan,
  onHover,
}: {
  plan: Plan;
  annual: boolean;
  hoveredPlan: string | null;
  onHover: (planName: string | null) => void;
}) {
  const price = annual ? getAnnualMonthlyPrice(plan) : plan.monthly;
  const isActive = hoveredPlan === null ? Boolean(plan.popular) : hoveredPlan === plan.name;
  const isDimmedFeatured = Boolean(plan.popular && hoveredPlan !== null && !isActive);
  const cardClassName = [
    'plan-card',
    plan.popular ? 'plan-card-featured' : '',
    isActive && !plan.popular ? 'plan-card-hovered' : '',
    isDimmedFeatured ? 'plan-card-dimmed' : '',
  ].filter(Boolean).join(' ');

  return (
    <article
      className={cardClassName}
      onMouseEnter={() => onHover(plan.name)}
      onMouseLeave={() => onHover(null)}
    >
      {plan.popular && isActive && (
        <span className="popular-badge">
          <Icon name="stars" />
          MÁS POPULAR
        </span>
      )}
      <div className="plan-head">
        <h3>{plan.name}</h3>
        <i>
          <Icon name={plan.icon} />
        </i>
      </div>
      <div className="plan-price">
        <strong>{formatPrice(price)}</strong>
        <span>MXN / mes <small>+ IVA</small></span>
      </div>
      <p className="billing-note">
        {annual
          ? `Pagas ${formatPrice(price * 12)} al año (-15% aplicado)`
          : 'Cobro mensual flexible'}
      </p>
      <p className="plan-description">{plan.description}</p>
      <ul className="plan-features">
        {plan.features.map((feature) => (
          <li key={feature}>
            <Icon name="check_circle" />
            <span>{feature}</span>
          </li>
        ))}
        {plan.excluded && (
          <li className="feature-disabled">
            <Icon name="cancel" />
            <span>{plan.excluded}</span>
          </li>
        )}
      </ul>
      <div className="plan-bottom">
        <Link
          className={`button ${isActive ? 'plan-button-primary' : 'plan-button'}`}
          to="/precios#contacto"
        >
          {plan.button}
        </Link>
        <small>{plan.note}</small>
      </div>
    </article>
  );
}

function PricingPlans() {
  const [annual, setAnnual] = useState(false);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  return (
    <section className="pricing-intro container" id="planes" aria-labelledby="plans-section-title">
      <div className="pricing-heading">
        <div className="eyebrow">
          <i />
          Membresías comerciales Benefy <span>/</span>{' '}
          <b>14 días de prueba gratis</b>
        </div>
        <h1>Planes claros y transparentes para hacer crecer tu negocio</h1>
        <h2 id="plans-section-title" className="sr-only">Planes disponibles</h2>
        <p>
          Sin comisiones ocultas por canje ni contratos forzosos. Elige el plan
          que mejor se adapte al tamaño de tu operación y fideliza a tu comunidad
          comercial.
        </p>
        <div className="billing-toggle" role="group" aria-label="Frecuencia de facturación">
          <button
            type="button"
            className={!annual ? 'selected' : ''}
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
          >
            Facturación mensual
          </button>
          <button
            type="button"
            className={annual ? 'selected' : ''}
            aria-pressed={annual}
            onClick={() => setAnnual(true)}
          >
            Facturación anual <span>Ahorra 15%</span>
          </button>
        </div>
        <small className="price-disclaimer">
          *Precios exclusivos para México, en pesos mexicanos (MXN) por mes. No incluyen IVA.
        </small>
      </div>
      <div className="plan-grid" onMouseLeave={() => setHoveredPlan(null)}>
        {plans.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            annual={annual}
            hoveredPlan={hoveredPlan}
            onHover={setHoveredPlan}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {annual ? 'Precios mensuales equivalentes con facturación anual: ' : 'Precios con facturación mensual: '}
        {plans.map((plan) => `${plan.name}: ${formatPrice(annual ? getAnnualMonthlyPrice(plan) : plan.monthly)} al mes`).join('; ')}.
      </p>
      <div className="assurance-grid">
        {assurances.map(([icon, title, copy]) => (
          <div className="assurance" key={title}>
            <Icon name={icon} />
            <span>
              <b>{title}</b>
              <small>{copy}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Comparison() {
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const planLabels = ['Comercio Local', 'Negocio Pro', 'Multisede'];

  return (
    <section className="comparison-band" aria-labelledby="comparison-title">
      <div className="container">
        <div className="comparison-heading">
          <span className="kicker">
            <span>01</span>
            MATRIZ DE CAPACIDADES
          </span>
          <h2 id="comparison-title">Comparativa detallada de funcionalidades</h2>
          <p>Analiza las herramientas operativas incluidas en cada nivel de suscripción.</p>
        </div>
        <p className="comparison-select-hint">
          Pasa el cursor o enfoca el encabezado de un plan para resaltar su columna.
        </p>
        <div className="table-scroll" onMouseLeave={() => setSelectedPlan(null)}>
          <table className="comparison-table">
            <caption className="sr-only">Comparación de características y módulos por plan Benefy</caption>
            <thead>
              <tr>
                <th scope="col" onMouseEnter={() => setSelectedPlan(null)}>Características y módulos</th>
                {planLabels.map((label, index) => (
                  <th
                    scope="col"
                    className={selectedPlan === index ? 'plan-column-active' : ''}
                    key={label}
                    tabIndex={0}
                    onMouseEnter={() => setSelectedPlan(index)}
                    onFocus={() => setSelectedPlan(index)}
                    onBlur={() => setSelectedPlan(null)}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            {comparison.map((group) => (
              <tbody key={group.group}>
                <tr className="table-group">
                  <th scope="rowgroup" colSpan={4} onMouseEnter={() => setSelectedPlan(null)}>{group.group}</th>
                </tr>
                {group.rows.map(([feature, local, pro, multisede]) => (
                  <tr key={feature}>
                    <th scope="row" onMouseEnter={() => setSelectedPlan(null)}>{feature}</th>
                    {[local, pro, multisede].map((value, index) => (
                      <td
                        className={[
                          selectedPlan === index ? 'plan-column-active' : '',
                        ].filter(Boolean).join(' ')}
                        key={index}
                        onMouseEnter={() => setSelectedPlan(index)}
                      >
                        {value === '✓' ? (
                          <><Icon name="check" /><span className="sr-only">Incluido</span></>
                        ) : value === '—' ? (
                          <><span className="not-included" aria-hidden="true">—</span><span className="sr-only">No incluido</span></>
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="table-scroll-hint" aria-hidden="true">
          Desliza para ver todos los planes →
        </p>
      </div>
    </section>
  );
}


function ROICalculator() {
  const [monthlyVisitors, setMonthlyVisitors] = useState(800);
  const [averageTicket, setAverageTicket] = useState(120);
  const [returnRate, setReturnRate] = useState(10);
  const additionalCustomers = Math.round(monthlyVisitors * (returnRate / 100));
  const additionalRevenue = additionalCustomers * averageTicket;
  const proPlanPrice = plans.find((plan) => plan.name === 'Negocio Pro')?.monthly ?? 0;
  const netReturn = additionalRevenue - proPlanPrice;

  return (
    <section className="roi-section container" aria-labelledby="roi-title">
      <div className="roi-copy">
        <span className="kicker">
          <span>02</span>
          CALCULA TU RETORNO
        </span>
        <h2 id="roi-title">
          Calcula cuánto puede <em>devolverte Benefy.</em>
        </h2>
        <p>
          Ajusta los datos de tu negocio y mira una estimación de lo que ganarías
          al lograr que más clientes regresen.
        </p>
        <div className="roi-reasons">
          <span><i aria-hidden="true">✓</i>Sin comisiones por canje</span>
          <span><i aria-hidden="true">✓</i>Tú controlas los supuestos</span>
          <span><i aria-hidden="true">✓</i>Estimación basada solo en tus datos</span>
        </div>
      </div>
      <div>
        <div className="roi-widget">
          <div className="roi-slider-label">
            <label htmlFor="roi-visitors">Clientes que visitan tu negocio al mes</label>
            <b>{monthlyVisitors.toLocaleString('es-MX')}</b>
          </div>
          <input id="roi-visitors" type="range" min="100" max="5000" step="50" value={monthlyVisitors} onChange={(event) => setMonthlyVisitors(Number(event.target.value))} />
          <div className="slider-scale"><span>100</span><span>5,000</span></div>

          <div className="roi-slider-label">
            <label htmlFor="roi-ticket">Ticket promedio (MXN)</label>
            <b>{formatPrice(averageTicket)}</b>
          </div>
          <input id="roi-ticket" type="range" min="50" max="500" step="10" value={averageTicket} onChange={(event) => setAverageTicket(Number(event.target.value))} />
          <div className="slider-scale"><span>$50</span><span>$500</span></div>

          <div className="roi-slider-label">
            <label htmlFor="roi-return-rate">Clientes adicionales que regresan gracias a Benefy</label>
            <b>{returnRate}%</b>
          </div>
          <input id="roi-return-rate" type="range" min="5" max="30" step="1" value={returnRate} onChange={(event) => setReturnRate(Number(event.target.value))} />
          <div className="slider-scale"><span>5%</span><span>30%</span></div>

          <div className="roi-results" aria-live="polite">
            <div>
              <small>Clientes que regresan de más</small>
              <b>{additionalCustomers.toLocaleString('es-MX')}</b>
            </div>
            <div>
              <small>Ingreso adicional al mes</small>
              <b>{formatPrice(additionalRevenue)}</b>
            </div>
            <div className="roi-highlight">
              <small>Retorno neto sobre Negocio Pro</small>
              <b>{netReturn < 0 ? `−${formatPrice(Math.abs(netReturn))}` : formatPrice(netReturn)}</b>
            </div>
          </div>
        </div>
        <p className="roi-note">
          Estimación con los datos que ingresas. No es una garantía de resultados.
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="faq-section container" aria-labelledby="faq-title">
      <div className="faq-heading">
        <span className="kicker">
          <span>03</span>
          RESOLUCIÓN DE DUDAS
        </span>
        <h2 id="faq-title">Preguntas frecuentes sobre la membresía</h2>
        <p>
          Todo lo que necesitas saber antes de implementar Benefy en tu caja o
          mostrador.
        </p>
      </div>
      <div className="faq-list">
        {faqs.map(([question, answer], index) => (
          <article
            className={`faq-item${open === index ? ' faq-open' : ''}`}
            key={question}
          >
            <button
              id={`faq-question-${index}`}
              type="button"
              aria-expanded={open === index}
              aria-controls={`faq-panel-${index}`}
              onClick={() => setOpen(open === index ? null : index)}
            >
              <span>{question}</span>
              <Icon name="expand_more" />
            </button>
            <div
              className="faq-panel"
              id={`faq-panel-${index}`}
              role="region"
              aria-labelledby={`faq-question-${index}`}
              aria-hidden={open !== index}
              inert={open !== index}
            >
              <div className="faq-panel-inner">
                <p>{answer}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PricingCTA() {
  return (
    <section className="container pricing-cta" id="contacto" aria-labelledby="pricing-cta-title">
      <div>
        <span className="cta-kicker">
          <i />
          EMPRESAS &amp; COMERCIOS
        </span>
        <h2 id="pricing-cta-title">¿Tienes dudas sobre qué plan se adapta a tu negocio?</h2>
        <p>
          Un especialista en alianzas locales puede darte un recorrido en vivo de
          15 minutos y ayudarte a configurar tus primeros cupones.
        </p>
      </div>
      <div className="pricing-cta-actions">
        <Link className="button button-light" to="/precios#planes">
          Probar gratis 14 días
        </Link>
        <Link className="cta-secondary" to="/precios#contacto">
          Agendar demostración
        </Link>
      </div>
    </section>
  );
}

export default function PricingPage() {
  useReveal('.pricing-page .plan-card, .pricing-page .assurance, .pricing-page .faq-item');

  return (
    <main className="pricing-page">
      <PricingPlans />
      <Comparison />
      <ROICalculator />
      <FAQ />
      <PricingCTA />
    </main>
  );
}
