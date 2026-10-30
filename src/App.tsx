import { useEffect, useMemo, useState } from 'react';
import Inputs from './components/Inputs';
import Results, { DEFAULT_SCENARIOS, type Scenario } from './components/Results';
import Landing, { Pricing } from './components/Landing';
import { blankPlan, simulate, TEMPLATES, type Plan } from './engine';
import { fmtEur } from './format';
import { load, save } from './storage';

const PLAN_KEY = 'viable.plan.v1';
const SCEN_KEY = 'viable.scenarios.v1';

export default function App() {
  const [plan, setPlan] = useState<Plan>(() => load(PLAN_KEY, TEMPLATES[0].plan));
  const [scenarios, setScenarios] = useState<Scenario[]>(() => load(SCEN_KEY, DEFAULT_SCENARIOS));
  const [printing, setPrinting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => save(PLAN_KEY, plan), [plan]);
  useEffect(() => save(SCEN_KEY, scenarios), [scenarios]);

  const result = useMemo(() => simulate(plan), [plan]);

  useEffect(() => {
    if (!printing) return;
    // Dejamos que los gráficos de todas las pestañas se midan antes de imprimir
    const t = window.setTimeout(() => window.print(), 600);
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const loadTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    setPlan(t ? structuredClone(t.plan) : blankPlan());
    document.getElementById('simulador')?.scrollIntoView({ behavior: 'smooth' });
  };

  const demoPay = () => setToast('Versión demo: los pagos no están activos.');

  return (
    <div className={printing ? 'printing' : ''}>
      <header className="topbar no-print">
        <div className="container topbar-inner">
          <a href="#" className="logo" aria-label="Viable, inicio">
            <span className="logo-mark">V</span>
            Viable
          </a>
          <nav className="nav">
            <a href="#simulador">Simulador</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precios">Precios</a>
          </nav>
          <button className="btn btn-primary btn-sm" onClick={() => setExportOpen(true)}>
            Exportar PDF
          </button>
        </div>
      </header>

      <div className="no-print">
        <Landing onTemplate={loadTemplate} />
      </div>

      <main id="simulador" className="container simulator">
        <div className="sim-head no-print">
          <div>
            <span className="eyebrow">Simulador</span>
            <h2>{plan.name || 'Tu plan'}</h2>
          </div>
          <div className="template-picker">
            <label htmlFor="tpl">Plantilla</label>
            <select id="tpl" value="" onChange={(e) => e.target.value && loadTemplate(e.target.value)}>
              <option value="">Cargar…</option>
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.emoji} {t.label}
                </option>
              ))}
              <option value="blank">Empezar en blanco</option>
            </select>
          </div>
        </div>

        <PrintCover plan={plan} />

        <div className="sim-grid">
          <aside className="no-print">
            <Inputs plan={plan} onChange={setPlan} />
          </aside>
          <Results plan={plan} result={result} scenarios={scenarios} onScenarios={setScenarios} printing={printing} />
        </div>

        <footer className="print-only print-footer">
          Plan generado con Viable · Proyección orientativa basada en los supuestos introducidos por el usuario.
        </footer>
      </main>

      <div className="no-print">
        <Pricing onBuy={demoPay} />
        <footer className="site-footer">
          <div className="container">
            <span className="logo small">
              <span className="logo-mark">V</span>Viable
            </span>
            <span>Proyecto de portfolio · Todos los cálculos se hacen en tu navegador: tus datos no salen de tu dispositivo.</span>
          </div>
        </footer>
      </div>

      {exportOpen && (
        <div className="modal-backdrop no-print" onClick={() => setExportOpen(false)}>
          <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="export-title">Exportar informe</h3>
            <p>
              El informe incluye portada con los supuestos, KPIs, cuenta de resultados a 5 años, tesorería, punto de equilibrio, escenarios y
              sensibilidad.
            </p>
            <div className="modal-price">
              <span>Informe profesional</span>
              <strong>39 €</strong>
            </div>
            <p className="note">Demo de portfolio: puedes descargarlo gratis. Elige «Guardar como PDF» en el diálogo de impresión.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setExportOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setExportOpen(false);
                  setPrinting(true);
                }}
              >
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast no-print" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function PrintCover({ plan }: { plan: Plan }) {
  const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const sales = plan.products.map((p) => `${p.name}: ${fmtEur(p.price)} · ${p.unitsMonth1} uds/mes · +${p.monthlyGrowth} %/mes`);
  return (
    <section className="print-only print-cover">
      <div className="logo">
        <span className="logo-mark">V</span>Viable
      </div>
      <h1>{plan.name}</h1>
      {plan.description && <p className="lead">{plan.description}</p>}
      <p className="muted">Plan de viabilidad a 5 años · {date}</p>
      <table className="table assumptions">
        <tbody>
          <tr>
            <td>Inversión inicial</td>
            <td>
              {fmtEur(plan.investment)} (amortización {plan.usefulLifeYears} años)
            </td>
          </tr>
          <tr>
            <td>Financiación</td>
            <td>
              Capital {fmtEur(plan.equity)} · Préstamo {fmtEur(plan.loanAmount)} al {plan.loanRate} % a {plan.loanYears} años
            </td>
          </tr>
          <tr>
            <td>Ventas</td>
            <td>{sales.join(' / ')}</td>
          </tr>
          <tr>
            <td>Costes fijos</td>
            <td>{fmtEur(plan.fixedCosts.reduce((a, f) => a + f.monthly, 0))} al mes</td>
          </tr>
          <tr>
            <td>Equipo</td>
            <td>{plan.staff.map((s) => `${s.count} × ${s.role} (${fmtEur(s.grossAnnual)} brutos, desde el mes ${s.startMonth})`).join(' / ') || '—'}</td>
          </tr>
          <tr>
            <td>Supuestos</td>
            <td>
              IS {plan.corporateTaxRate} %{plan.newCompany ? ' (15 % nueva creación)' : ''} · SS empresa {plan.socialSecurityPct} % · Descuento{' '}
              {plan.discountRate} % · Cobro {plan.collectionDays} d · Pago {plan.paymentDays} d
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
