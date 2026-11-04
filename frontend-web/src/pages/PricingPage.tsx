import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';

type Plan = {
  name: string;
  icon: IconName;
  monthly: number;
  annual: number;
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
    annual: 424,
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
    annual: 849,
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
    annual: 1614,
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
    'No necesitas adquirir hardware propietario. El punto de cobro funciona en teléfonos iOS o Android, tablets y computadoras con navegador web. El cajero escanea el QR del cliente o ingresa su número para registrar una visita o validar una recompensa.',
  ],
  [
    '¿Los clientes finales deben pagar algo para usar la plataforma?',
    'No. La app y el pase digital para clientes son gratuitos. Pueden sumar sellos y canjear beneficios con Apple Wallet, Google Wallet o la app de recompensas.',
  ],
  [
    '¿Cómo funciona el período de prueba de 14 días?',
    'Al crear tu cuenta comercial obtienes 14 días con acceso a las funciones del Plan Pro. No se solicita tarjeta de crédito para iniciar la prueba. Después puedes elegir el plan adecuado o dejar la cuenta en pausa.',
  ],
];

const assurances: [IconName, string, string][] = [
  ['verified_user', 'Sin contratos forzosos', 'Modifica o cancela cuando quieras'],
  ['percent', '0% comisiones por canje', 'Tu margen de venta se queda contigo'],
  ['support_agent', 'Acompañamiento inicial', 'Capacitación de personal incluida'],
  ['sync_alt', 'Migración sin fricción', 'Importamos tu base de clientes actual'],
];

function formatPrice(value: number) {
  return `$${value.toLocaleString('en-US')}`;
}

function PlanCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const price = annual ? plan.annual : plan.monthly;

  return (
    <article className={`plan-card${plan.popular ? ' plan-card-featured' : ''}`}>
      {plan.popular && (
        <span className="popular-badge">
          <Icon name="stars" />
          MÁS POPULAR
        </span>
      )}
      <div className="plan-head">
        <span>{plan.name}</span>
        <i>
          <Icon name={plan.icon} />
        </i>
      </div>
      <div className="plan-price">
        <strong>{formatPrice(price)}</strong>
        <span>MXN / mes</span>
      </div>
      <p className="billing-note">
        {annual ? 'Facturado anualmente (-15% aplicado)' : 'Cobro mensual flexible'}
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
          className={`button ${plan.popular ? 'plan-button-primary' : 'plan-button'}`}
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

  return (
    <section className="pricing-intro container" id="planes">
      <div className="pricing-heading">
        <div className="eyebrow">
          <i />
          Membresías comerciales Benefy 2025 <span>/</span>{' '}
          <b>14 días de prueba gratis</b>
        </div>
        <h1>Planes claros y transparentes para hacer crecer tu negocio</h1>
        <p>
          Sin comisiones ocultas por canje ni contratos forzosos. Elige el plan
          que mejor se adapte al tamaño de tu operación y fideliza a tu comunidad
          comercial.
        </p>
        <div className="billing-toggle" role="group" aria-label="Frecuencia de facturación">
          <button
            className={!annual ? 'selected' : ''}
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
          >
            Facturación mensual
          </button>
          <button
            className={annual ? 'selected' : ''}
            aria-pressed={annual}
            onClick={() => setAnnual(true)}
          >
            Facturación anual <span>Ahorra 15%</span>
          </button>
        </div>
        <small className="price-disclaimer">
          *Valores expresados en pesos mexicanos (MXN). No incluyen IVA.
          Propuesta ilustrativa.
        </small>
      </div>
      <div className="plan-grid">
        {plans.map((plan) => (
          <PlanCard key={plan.name} plan={plan} annual={annual} />
        ))}
      </div>
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
  return (
    <section className="comparison-band">
      <div className="container">
        <div className="comparison-heading">
          <span className="kicker">
            <span>01</span>
            MATRIZ DE CAPACIDADES
          </span>
          <h2>Comparativa detallada de funcionalidades</h2>
          <p>Analiza las herramientas operativas incluidas en cada nivel de suscripción.</p>
        </div>
        <div className="table-scroll">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Características y módulos</th>
                <th>Comercio Local</th>
                <th>Negocio Pro</th>
                <th>Multisede</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((group) => (
                <Fragment key={group.group}>
                  <tr className="table-group">
                    <th colSpan={4}>{group.group}</th>
                  </tr>
                  {group.rows.map(([feature, local, pro, multisede]) => (
                    <tr key={feature}>
                      <td>{feature}</td>
                      {[local, pro, multisede].map((value, index) => (
                        <td className={index === 1 ? 'pro-column' : ''} key={index}>
                          {value === '✓' ? (
                            <Icon name="check" />
                          ) : value === '—' ? (
                            <span className="not-included">—</span>
                          ) : (
                            value
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function RoiCalculator() {
  const [clients, setClients] = useState(350);
  const extraVisits = Math.round(clients * 0.28);
  const extraRevenue = extraVisits * 150;
  const multiplier = (extraRevenue / 999).toFixed(1);

  return (
    <section className="container roi-section">
      <div className="roi-copy">
        <span className="kicker">
          <span>02</span>
          SIMULADOR DE RETORNO
        </span>
        <h2>Tu membresía se paga sola desde el primer mes</h2>
        <p>
          Al aumentar la recompra y recibir clientes referidos de alianzas
          vecinas, el beneficio neto puede superar la inversión mensual.
        </p>
        <div className="roi-reasons">
          <span>
            <i>1</i>
            +28% de retención promedio en clientes recurrentes.
          </span>
          <span>
            <i>2</i>
            Cero cobros extra de pasarela sobre tus tickets físicos.
          </span>
        </div>
      </div>
      <div className="roi-widget">
        <div className="roi-slider-label">
          <label htmlFor="clients-slider">Clientes atendidos al mes en tu negocio</label>
          <b>{clients.toLocaleString('es-MX')} clientes</b>
        </div>
        <input
          id="clients-slider"
          type="range"
          min="50"
          max="2000"
          step="25"
          value={clients}
          onChange={(event) => setClients(Number(event.target.value))}
        />
        <div className="slider-scale">
          <span>50</span>
          <span>1,000</span>
          <span>2,000+</span>
        </div>
        <div className="roi-results">
          <div>
            <small>Visitas adicionales</small>
            <b>+{extraVisits.toLocaleString('es-MX')}</b>
          </div>
          <div>
            <small>Ingreso extra estimado</small>
            <b>${extraRevenue.toLocaleString('es-MX')} MXN</b>
          </div>
          <div className="roi-highlight">
            <small>Retorno sobre membresía</small>
            <b>{multiplier}x</b>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="faq-section container">
      <div className="faq-heading">
        <span className="kicker">
          <span>03</span>
          RESOLUCIÓN DE DUDAS
        </span>
        <h2>Preguntas frecuentes sobre la membresía</h2>
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
              aria-expanded={open === index}
              onClick={() => setOpen(open === index ? null : index)}
            >
              <span>{question}</span>
              <Icon name={open === index ? 'expand_less' : 'expand_more'} />
            </button>
            {open === index && <p>{answer}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function PricingCTA() {
  return (
    <section className="container pricing-cta" id="contacto">
      <div>
        <span className="cta-kicker">
          <i />
          EMPRESAS &amp; COMERCIOS
        </span>
        <h2>¿Tienes dudas sobre qué plan se adapta a tu negocio?</h2>
        <p>
          Un especialista en alianzas locales puede darte un recorrido en vivo de
          15 minutos y ayudarte a configurar tus primeros cupones.
        </p>
      </div>
      <div>
        <Link className="button cta-demo" to="/about#valores">
          Agendar demostración
        </Link>
        <Link className="button button-light" to="/precios#planes">
          Probar gratis 14 días
        </Link>
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <PricingPlans />
      <Comparison />
      <RoiCalculator />
      <FAQ />
      <PricingCTA />
    </main>
  );
}
