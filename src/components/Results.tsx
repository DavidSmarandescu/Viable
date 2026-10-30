import { useMemo, useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { sensitivity, simulate, type Plan, type Result, type YearRow } from '../engine';
import { fmtCompact, fmtDuration, fmtEur, fmtMonths, fmtNum, fmtPct } from '../format';

export interface Scenario {
  id: 'pess' | 'base' | 'opt';
  name: string;
  volume: number;
  cost: number;
}

export const DEFAULT_SCENARIOS: Scenario[] = [
  { id: 'pess', name: 'Pesimista', volume: 0.8, cost: 1.1 },
  { id: 'base', name: 'Base', volume: 1, cost: 1 },
  { id: 'opt', name: 'Optimista', volume: 1.2, cost: 0.95 },
];

const C = {
  orange: '#F97316',
  orangeDark: '#C2410C',
  orangeSoft: '#FED7AA',
  ink: '#1C1917',
  slate: '#A8A29E',
  grid: '#EFEBE7',
  red: '#DC2626',
  green: '#15803D',
};

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'pyg', label: 'Cuenta de resultados' },
  { id: 'tesoreria', label: 'Tesorería' },
  { id: 'equilibrio', label: 'Punto de equilibrio' },
  { id: 'escenarios', label: 'Escenarios' },
  { id: 'sensibilidad', label: 'Sensibilidad' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const axis = { tick: { fill: '#78716C', fontSize: 12 }, axisLine: false, tickLine: false } as const;
const tooltipProps = {
  formatter: (v: number) => fmtEur(v),
  contentStyle: { borderRadius: 12, border: '1px solid #EDE7E1', boxShadow: '0 8px 24px rgba(28,25,23,.08)', fontSize: 13 },
};

interface Props {
  plan: Plan;
  result: Result;
  scenarios: Scenario[];
  onScenarios: (s: Scenario[]) => void;
  printing: boolean;
}

export default function Results({ plan, result, scenarios, onScenarios, printing }: Props) {
  const [tab, setTab] = useState<TabId>('resumen');
  const show = (id: TabId) => printing || tab === id;

  return (
    <div className="results">
      <Verdict result={result} />
      <Kpis result={result} />

      <div className="tabs no-print" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {show('resumen') && <Summary result={result} />}
      {show('pyg') && <IncomeStatement years={result.years} />}
      {show('tesoreria') && <Treasury result={result} />}
      {show('equilibrio') && <BreakEvenView result={result} />}
      {show('escenarios') && <Scenarios plan={plan} scenarios={scenarios} onChange={onScenarios} />}
      {show('sensibilidad') && <Sensitivity plan={plan} />}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card panel">
      <header className="panel-head">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Verdict({ result }: { result: Result }) {
  const viable = result.npv > 0;
  const gap = result.fundingGap > 0;
  let tone = 'ok';
  let title = 'El proyecto es viable';
  let text = `Genera valor (VAN ${fmtEur(result.npv)}) y la tesorería no entra en negativo en ningún mes.`;
  if (viable && gap) {
    tone = 'warn';
    title = 'Viable, pero falta financiación';
    text = `Crea valor, pero la caja llega a ${fmtEur(result.minCash)} en el mes ${result.minCashMonth}. Necesitas ${fmtEur(result.fundingGap)} adicionales.`;
  } else if (!viable) {
    tone = 'bad';
    title = 'Con estos supuestos no es viable';
    text = `El VAN es ${fmtEur(result.npv)}: el proyecto no alcanza la rentabilidad exigida. Revisa precio, volumen o costes.`;
  }
  return (
    <div className={`verdict ${tone}`}>
      <span className="verdict-dot" aria-hidden />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'neg' | 'pos' }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value ${tone ?? ''}`}>{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function Kpis({ result }: { result: Result }) {
  return (
    <div className="kpis">
      <Kpi label="VAN" value={fmtEur(result.npv)} tone={result.npv < 0 ? 'neg' : 'pos'} sub="Valor actual neto" />
      <Kpi label="TIR" value={fmtPct(result.irr)} sub="Rentabilidad del proyecto" />
      <Kpi label="Recuperación" value={fmtDuration(result.paybackMonths)} sub="Payback de la inversión" />
      <Kpi label="Equilibrio" value={result.breakEven.month ? `Mes ${result.breakEven.month}` : 'No'} sub="Primer mes con beneficio operativo" />
      <Kpi
        label="Financiación extra"
        value={fmtEur(result.fundingGap)}
        tone={result.fundingGap > 0 ? 'neg' : undefined}
        sub={result.fundingGap > 0 ? `Caja mínima en el mes ${result.minCashMonth}` : 'La caja aguanta'}
      />
      <Kpi label="Margen EBITDA" value={fmtPct(result.ratios.ebitdaMargin)} sub="Año 5" />
    </div>
  );
}

function Summary({ result }: { result: Result }) {
  const data = result.years.map((y) => ({
    name: `Año ${y.year}`,
    Ingresos: y.revenue,
    Costes: y.variableCost + y.staffCost + y.fixedCost,
    'Beneficio neto': y.netIncome,
  }));
  return (
    <Panel title="Evolución a 5 años" subtitle="Ingresos, costes operativos y beneficio neto anual">
      <div className="chart">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" {...axis} />
            <YAxis tickFormatter={fmtCompact} {...axis} width={64} />
            <Tooltip {...tooltipProps} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
            <ReferenceLine y={0} stroke="#D6D3D1" />
            <Bar dataKey="Ingresos" fill={C.orange} radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false} />
            <Bar dataKey="Costes" fill={C.slate} radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false} />
            <Line dataKey="Beneficio neto" stroke={C.ink} strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="ratios">
        <div>
          <span>Margen bruto</span>
          <strong>{fmtPct(result.ratios.grossMargin)}</strong>
        </div>
        <div>
          <span>Margen EBITDA</span>
          <strong>{fmtPct(result.ratios.ebitdaMargin)}</strong>
        </div>
        <div>
          <span>Margen neto</span>
          <strong>{fmtPct(result.ratios.netMargin)}</strong>
        </div>
        <div>
          <span>Cuota del préstamo</span>
          <strong>{fmtEur(result.loanPayment)}/mes</strong>
        </div>
      </div>
      <p className="note">Ratios calculados sobre el año 5, con el negocio ya estabilizado.</p>
    </Panel>
  );
}

function IncomeStatement({ years }: { years: YearRow[] }) {
  const rows: { label: string; key: keyof YearRow; sign?: -1; strong?: boolean }[] = [
    { label: 'Ingresos', key: 'revenue', strong: true },
    { label: 'Coste de ventas', key: 'variableCost', sign: -1 },
    { label: 'Margen bruto', key: 'grossMargin', strong: true },
    { label: 'Personal', key: 'staffCost', sign: -1 },
    { label: 'Otros gastos fijos', key: 'fixedCost', sign: -1 },
    { label: 'EBITDA', key: 'ebitda', strong: true },
    { label: 'Amortizaciones', key: 'depreciation', sign: -1 },
    { label: 'Resultado de explotación (EBIT)', key: 'ebit', strong: true },
    { label: 'Gastos financieros', key: 'interest', sign: -1 },
    { label: 'Resultado antes de impuestos', key: 'ebt', strong: true },
    { label: 'Impuesto de Sociedades', key: 'tax', sign: -1 },
    { label: 'Resultado neto', key: 'netIncome', strong: true },
    { label: 'Flujo de caja libre', key: 'freeCashFlow' },
  ];
  return (
    <Panel title="Cuenta de resultados previsional" subtitle="Importes anuales en euros, sin IVA">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Concepto</th>
              {years.map((y) => (
                <th key={y.year}>Año {y.year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.strong ? 'strong' : ''}>
                <td>{r.label}</td>
                {years.map((y) => {
                  const v = (y[r.key] as number) * (r.sign ?? 1);
                  return (
                    <td key={y.year} className={v < 0 ? 'neg' : ''}>
                      {fmtNum(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Treasury({ result }: { result: Result }) {
  const data = result.months.map((m) => ({ name: m.month, Caja: m.cashBalance }));
  const min = Math.min(0, ...data.map((d) => d.Caja));
  const max = Math.max(0, ...data.map((d) => d.Caja));
  const zeroOffset = max === min ? 0 : max / (max - min);
  const neg = result.negativeMonths;
  return (
    <Panel title="Tesorería mensual" subtitle="Saldo de caja acumulado mes a mes durante 60 meses">
      {neg.length > 0 ? (
        <div className="alert">
          <strong>⚠ {neg.length} meses con caja negativa</strong> (del mes {neg[0]} al {neg[neg.length - 1]}). Necesidad máxima de financiación:{' '}
          <strong>{fmtEur(result.fundingGap)}</strong> en el mes {result.minCashMonth}.
        </div>
      ) : (
        <div className="alert ok">La caja se mantiene positiva todo el horizonte. Mínimo: {fmtEur(result.minCash)} (mes {result.minCashMonth}).</div>
      )}
      <div className="chart">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.orange} stopOpacity={0.35} />
                <stop offset={zeroOffset} stopColor={C.orange} stopOpacity={0.08} />
                <stop offset={zeroOffset} stopColor={C.red} stopOpacity={0.12} />
                <stop offset="1" stopColor={C.red} stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="cashStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zeroOffset} stopColor={C.orangeDark} />
                <stop offset={zeroOffset} stopColor={C.red} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" {...axis} interval={11} tickFormatter={(m) => `M${m}`} />
            <YAxis tickFormatter={fmtCompact} {...axis} width={64} />
            <Tooltip {...tooltipProps} labelFormatter={(m) => `Mes ${m}`} />
            <ReferenceLine y={0} stroke="#A8A29E" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="Caja" stroke="url(#cashStroke)" strokeWidth={2.5} fill="url(#cashFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Año</th>
              <th>Cobros</th>
              <th>Pagos operativos</th>
              <th>Préstamo</th>
              <th>Impuestos</th>
              <th>Caja final</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((y) => {
              const ms = result.months.slice(y * 12, y * 12 + 12);
              const s = (f: (m: (typeof ms)[number]) => number) => ms.reduce((a, m) => a + f(m), 0);
              const end = ms[ms.length - 1].cashBalance;
              return (
                <tr key={y}>
                  <td>Año {y + 1}</td>
                  <td>{fmtNum(s((m) => m.cashIn))}</td>
                  <td>{fmtNum(-s((m) => m.cashOut))}</td>
                  <td>{fmtNum(-s((m) => m.loanPayment))}</td>
                  <td>{fmtNum(-s((m) => m.taxPaid))}</td>
                  <td className={end < 0 ? 'neg strong-cell' : 'strong-cell'}>{fmtNum(end)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function BreakEvenView({ result }: { result: Result }) {
  const be = result.breakEven;
  const data = result.months.slice(0, 36).map((m) => ({ name: m.month, Ingresos: m.revenue }));
  return (
    <Panel title="Punto de equilibrio" subtitle="Ventas mensuales necesarias para cubrir todos los costes fijos con la plantilla completa">
      <div className="ratios">
        <div>
          <span>Ventas de equilibrio</span>
          <strong>{fmtEur(be.monthlyRevenue)}/mes</strong>
        </div>
        <div>
          <span>Unidades equivalentes</span>
          <strong>{fmtNum(be.monthlyUnits)}/mes</strong>
        </div>
        <div className="wide">
          <span>Se alcanza en</span>
          <strong>{fmtMonths(be.month)}</strong>
        </div>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" {...axis} interval={5} tickFormatter={(m) => `M${m}`} />
            <YAxis tickFormatter={fmtCompact} {...axis} width={64} />
            <Tooltip {...tooltipProps} labelFormatter={(m) => `Mes ${m}`} />
            {Number.isFinite(be.monthlyRevenue) && (
              <ReferenceLine
                y={be.monthlyRevenue}
                stroke={C.ink}
                strokeDasharray="5 5"
                label={{ value: 'Equilibrio', position: 'insideTopLeft', fill: C.ink, fontSize: 12 }}
              />
            )}
            <Line dataKey="Ingresos" stroke={C.orange} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="note">Unidades calculadas con el precio medio ponderado de la cartera del primer mes. Primeros 36 meses.</p>
    </Panel>
  );
}

function Scenarios({ plan, scenarios, onChange }: { plan: Plan; scenarios: Scenario[]; onChange: (s: Scenario[]) => void }) {
  const results = useMemo(
    () => scenarios.map((s) => simulate(plan, { price: 1, volume: s.volume, variableCost: s.cost, fixedCost: s.cost })),
    [plan, scenarios],
  );
  const colors = [C.slate, C.orange, C.ink];
  const chart = results[0].months.map((m, i) => {
    const row: Record<string, number> = { name: m.month };
    scenarios.forEach((s, j) => (row[s.name] = results[j].months[i].cashBalance));
    return row;
  });
  const update = (id: Scenario['id'], patch: Partial<Scenario>) => onChange(scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <Panel title="Escenarios" subtitle="Ajusta los multiplicadores de ventas y costes de cada escenario">
      <div className="scenarios">
        {scenarios.map((s, i) => {
          const r = results[i];
          return (
            <div key={s.id} className={`scenario ${s.id}`}>
              <h4>{s.name}</h4>
              <div className="grid-2">
                <label className="field">
                  <span className="field-label">Ventas</span>
                  <span className="input-wrap">
                    <input type="number" step={5} value={Math.round(s.volume * 100)} onChange={(e) => update(s.id, { volume: (e.target.valueAsNumber || 0) / 100 })} />
                    <span className="suffix">%</span>
                  </span>
                </label>
                <label className="field">
                  <span className="field-label">Costes</span>
                  <span className="input-wrap">
                    <input type="number" step={5} value={Math.round(s.cost * 100)} onChange={(e) => update(s.id, { cost: (e.target.valueAsNumber || 0) / 100 })} />
                    <span className="suffix">%</span>
                  </span>
                </label>
              </div>
              <dl>
                <dt>VAN</dt>
                <dd className={r.npv < 0 ? 'neg' : ''}>{fmtEur(r.npv)}</dd>
                <dt>TIR</dt>
                <dd>{fmtPct(r.irr)}</dd>
                <dt>Beneficio año 5</dt>
                <dd className={r.years[4].netIncome < 0 ? 'neg' : ''}>{fmtEur(r.years[4].netIncome)}</dd>
                <dt>Financiación extra</dt>
                <dd className={r.fundingGap > 0 ? 'neg' : ''}>{fmtEur(r.fundingGap)}</dd>
              </dl>
            </div>
          );
        })}
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="name" {...axis} interval={11} tickFormatter={(m) => `M${m}`} />
            <YAxis tickFormatter={fmtCompact} {...axis} width={64} />
            <Tooltip {...tooltipProps} labelFormatter={(m) => `Mes ${m}`} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
            <ReferenceLine y={0} stroke="#A8A29E" strokeDasharray="4 4" />
            {scenarios.map((s, i) => (
              <Line key={s.id} dataKey={s.name} stroke={colors[i]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="note">Saldo de caja mensual por escenario. 100 % = supuesto base.</p>
    </Panel>
  );
}

function Sensitivity({ plan }: { plan: Plan }) {
  const { base, rows } = useMemo(() => sensitivity(plan, 0.1), [plan]);
  const data = rows.map((r) => ({ name: r.variable, '−10 %': r.low, '+10 %': r.high }));
  return (
    <Panel title="Análisis de sensibilidad" subtitle={`Cambio en el VAN (base ${fmtEur(base)}) al mover cada variable un ±10 %`}>
      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} horizontal={false} />
            <XAxis type="number" tickFormatter={fmtCompact} {...axis} />
            <YAxis type="category" dataKey="name" {...axis} width={130} />
            <Tooltip {...tooltipProps} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
            <ReferenceLine x={0} stroke="#A8A29E" />
            <Bar dataKey="−10 %" stackId="s" fill={C.slate} radius={4} barSize={26} isAnimationActive={false} />
            <Bar dataKey="+10 %" stackId="s" fill={C.orange} radius={4} barSize={26} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>VAN con −10 %</th>
              <th>VAN con +10 %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.variable}>
                <td>{r.variable}</td>
                <td className={base + r.low < 0 ? 'neg' : ''}>{fmtEur(base + r.low)}</td>
                <td className={base + r.high < 0 ? 'neg' : ''}>{fmtEur(base + r.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">Ordenado de mayor a menor impacto: céntrate en validar primero las variables de arriba.</p>
    </Panel>
  );
}
