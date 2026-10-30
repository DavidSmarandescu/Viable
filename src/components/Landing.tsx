import { TEMPLATES } from '../engine';

export default function Landing({ onTemplate }: { onTemplate: (id: string) => void }) {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="pill">Para emprendedores, préstamos ENISA y bancos</span>
            <h1>
              Tu plan de viabilidad, <span className="accent">listo en minutos</span>.
            </h1>
            <p className="lead">
              Introduce tus supuestos y Viable calcula la cuenta de resultados a 5 años, la tesorería mes a mes, el punto de equilibrio, el VAN y
              la TIR. Compara escenarios y descubre qué variable decide tu negocio.
            </p>
            <div className="hero-actions">
              <a href="#simulador" className="btn btn-primary">
                Empezar a simular gratis
              </a>
              <a href="#precios" className="btn btn-ghost">
                Ver precios
              </a>
            </div>
            <div className="chips">
              <span>Prueba con un ejemplo:</span>
              {TEMPLATES.map((t) => (
                <button key={t.id} className="chip" onClick={() => onTemplate(t.id)}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hero-visual" aria-hidden>
            <div className="mock card">
              <div className="mock-row">
                <span className="mock-label">VAN</span>
                <span className="mock-value">+100.425 €</span>
              </div>
              <div className="mock-bars">
                {[22, 38, 52, 66, 80].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="mock-grid">
                <div>
                  <span>TIR</span>
                  <strong>47,6 %</strong>
                </div>
                <div>
                  <span>Equilibrio</span>
                  <strong>Mes 11</strong>
                </div>
                <div>
                  <span>Payback</span>
                  <strong>2 años 3 m</strong>
                </div>
              </div>
            </div>
            <div className="mock-badge card">✓ El proyecto es viable</div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="container steps">
        {[
          ['1', 'Describe tu negocio', 'Inversión, financiación, productos, costes y equipo. O parte de una plantilla.'],
          ['2', 'Analiza al instante', 'Cuenta de resultados, tesorería, VAN, TIR y punto de equilibrio se recalculan con cada cambio.'],
          ['3', 'Presenta tu plan', 'Exporta un informe en PDF con escenarios y sensibilidad, listo para el banco o tus socios.'],
        ].map(([n, t, d]) => (
          <div key={n} className="step-card">
            <span className="step-num">{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>
    </>
  );
}

export function Pricing({ onBuy }: { onBuy: () => void }) {
  const plans = [
    {
      name: 'Gratis',
      price: '0 €',
      per: 'para siempre',
      features: ['Simulaciones ilimitadas', 'Cuenta de resultados y tesorería', 'VAN, TIR y punto de equilibrio', 'Guardado en tu navegador'],
      cta: 'Empezar',
      href: '#simulador',
    },
    {
      name: 'Informe profesional',
      price: '39 €',
      per: 'por plan exportado',
      features: ['PDF listo para banco o ENISA', 'Portada y anexo de supuestos', 'Escenarios y sensibilidad', 'Sin marca de agua'],
      cta: 'Comprar informe',
      featured: true,
    },
    {
      name: 'Instituciones',
      price: '1.490 €',
      per: 'al año',
      features: ['Incubadoras, aceleradoras y universidades', 'Hasta 200 emprendedores', 'Panel de seguimiento de proyectos', 'Marca blanca y formación'],
      cta: 'Hablar con ventas',
    },
  ];
  return (
    <section id="precios" className="pricing">
      <div className="container">
        <div className="section-intro">
          <span className="eyebrow">Precios</span>
          <h2>Simula gratis. Paga solo cuando lo necesites presentar.</h2>
          <p className="lead">Un consultor cobra entre 300 y 1.500 € por un plan de viabilidad. Viable te lo da por una fracción.</p>
        </div>
        <div className="price-grid">
          {plans.map((p) => (
            <div key={p.name} className={`price-card card ${p.featured ? 'featured' : ''}`}>
              {p.featured && <span className="ribbon">Más popular</span>}
              <h3>{p.name}</h3>
              <div className="price">
                <strong>{p.price}</strong>
                <span>{p.per}</span>
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {p.href ? (
                <a href={p.href} className="btn btn-ghost">
                  {p.cta}
                </a>
              ) : (
                <button className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'}`} onClick={onBuy}>
                  {p.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
