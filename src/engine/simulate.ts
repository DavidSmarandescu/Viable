import { breakEvenRevenue, corporateTax, irr, loanPayment, loanSchedule, npv } from './finance';
import { NEUTRAL, type Adjustments, type MonthRow, type Plan, type Result, type YearRow } from './types';

export const HORIZON_MONTHS = 60;
const YEARS = HORIZON_MONTHS / 12;
/** El Impuesto de Sociedades se liquida en julio del ejercicio siguiente. */
const TAX_PAYMENT_MONTH_OFFSET = 6;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const daysToMonths = (days: number) => Math.max(0, Math.round(days / 30));

/** Unidades vendidas de un producto en el mes m (0-indexado). */
export function unitsAt(unitsMonth1: number, monthlyGrowth: number, growthAfterYear2: number, m: number): number {
  const g = monthlyGrowth / 100;
  if (m < 24) return unitsMonth1 * Math.pow(1 + g, m);
  const atMonth24 = unitsMonth1 * Math.pow(1 + g, 23);
  return atMonth24 * Math.pow(1 + growthAfterYear2 / 100, (m - 23) / 12);
}

export function simulate(plan: Plan, adj: Adjustments = NEUTRAL): Result {
  const ss = 1 + plan.socialSecurityPct / 100;
  const lagIn = daysToMonths(plan.collectionDays);
  const lagOut = daysToMonths(plan.paymentDays);
  const monthlyDep = plan.usefulLifeYears > 0 ? plan.investment / (plan.usefulLifeYears * 12) : 0;
  const depMonths = Math.round(plan.usefulLifeYears * 12);
  const schedule = loanSchedule(plan.loanAmount, plan.loanRate / 100, plan.loanYears);

  // Cuenta de resultados mensual
  const revenue: number[] = [];
  const variableCost: number[] = [];
  const staffCost: number[] = [];
  const fixedCost: number[] = [];
  for (let m = 0; m < HORIZON_MONTHS; m++) {
    let rev = 0;
    let vc = 0;
    for (const p of plan.products) {
      const units = unitsAt(p.unitsMonth1, p.monthlyGrowth, plan.growthAfterYear2, m) * adj.volume;
      const r = units * p.price * adj.price;
      rev += r;
      // El coste variable depende de las unidades, no del precio de venta ajustado
      vc += units * p.price * (p.variableCostPct / 100) * adj.variableCost;
    }
    revenue.push(rev);
    variableCost.push(vc);
    staffCost.push(
      sum(plan.staff.filter((s) => m + 1 >= s.startMonth).map((s) => (s.count * s.grossAnnual * ss) / 12)) *
        adj.fixedCost,
    );
    fixedCost.push(sum(plan.fixedCosts.map((f) => f.monthly)) * adj.fixedCost);
  }

  const ebitda = revenue.map((r, m) => r - variableCost[m] - staffCost[m] - fixedCost[m]);
  const depreciation = revenue.map((_, m) => (m < depMonths ? monthlyDep : 0));
  const interest = revenue.map((_, m) => schedule[m]?.interest ?? 0);
  const loanPay = revenue.map((_, m) => schedule[m]?.payment ?? 0);
  const ebt = ebitda.map((e, m) => e - depreciation[m] - interest[m]);

  // Impuesto anual (devengado) y su pago
  const annual = (xs: number[]) => Array.from({ length: YEARS }, (_, y) => sum(xs.slice(y * 12, y * 12 + 12)));
  const ebtYear = annual(ebt);
  const taxYear = corporateTax(ebtYear, plan.corporateTaxRate / 100, plan.newCompany);
  const taxPaid = new Array(HORIZON_MONTHS).fill(0);
  taxYear.forEach((t, y) => {
    const m = (y + 1) * 12 + TAX_PAYMENT_MONTH_OFFSET;
    if (m < HORIZON_MONTHS) taxPaid[m] += t;
  });

  // Tesorería
  const opex = revenue.map((_, m) => variableCost[m] + fixedCost[m]);
  let balance = plan.equity + plan.loanAmount - plan.investment;
  const months: MonthRow[] = [];
  for (let m = 0; m < HORIZON_MONTHS; m++) {
    const cashIn = m - lagIn >= 0 ? revenue[m - lagIn] : 0;
    const cashOut = (m - lagOut >= 0 ? opex[m - lagOut] : 0) + staffCost[m];
    const net = cashIn - cashOut - loanPay[m] - taxPaid[m];
    balance += net;
    months.push({
      month: m + 1,
      revenue: revenue[m],
      variableCost: variableCost[m],
      staffCost: staffCost[m],
      fixedCost: fixedCost[m],
      ebitda: ebitda[m],
      depreciation: depreciation[m],
      interest: interest[m],
      ebt: ebt[m],
      cashIn,
      cashOut,
      loanPayment: loanPay[m],
      taxPaid: taxPaid[m],
      netCashFlow: net,
      cashBalance: balance,
    });
  }

  // Cuenta de resultados anual y flujo de caja libre (sin financiación)
  const ebitYear = annual(ebitda.map((e, m) => e - depreciation[m]));
  const unleveredTax = corporateTax(ebitYear, plan.corporateTaxRate / 100, plan.newCompany);
  const workingCapitalAt = (endMonth: number) => {
    const receivables = sum(revenue.slice(Math.max(0, endMonth - lagIn), endMonth));
    const payables = sum(opex.slice(Math.max(0, endMonth - lagOut), endMonth));
    return receivables - payables;
  };
  const years: YearRow[] = [];
  for (let y = 0; y < YEARS; y++) {
    const s = (xs: number[]) => sum(xs.slice(y * 12, y * 12 + 12));
    const rev = s(revenue);
    const vc = s(variableCost);
    const eb = s(ebitda);
    const dep = s(depreciation);
    const int = s(interest);
    const deltaWC = workingCapitalAt((y + 1) * 12) - workingCapitalAt(y * 12);
    years.push({
      year: y + 1,
      revenue: rev,
      variableCost: vc,
      grossMargin: rev - vc,
      staffCost: s(staffCost),
      fixedCost: s(fixedCost),
      ebitda: eb,
      depreciation: dep,
      ebit: eb - dep,
      interest: int,
      ebt: ebtYear[y],
      tax: taxYear[y],
      netIncome: ebtYear[y] - taxYear[y],
      freeCashFlow: eb - unleveredTax[y] - deltaWC,
    });
  }

  const rate = plan.discountRate / 100;
  const flows = [-plan.investment, ...years.map((y) => y.freeCashFlow)];
  if (plan.terminalValue && rate > 0) flows[YEARS] += years[YEARS - 1].freeCashFlow / rate;

  // Plazo de recuperación sobre caja operativa mensual
  let cumulative = -plan.investment;
  let paybackMonths: number | null = null;
  for (const row of months) {
    cumulative += row.cashIn - row.cashOut - row.taxPaid;
    if (cumulative >= 0) {
      paybackMonths = row.month;
      break;
    }
  }

  // Punto de equilibrio con la estructura de costes a plena plantilla
  const year1Revenue = sum(revenue.slice(0, 12));
  const cmRatio = year1Revenue > 0 ? 1 - sum(variableCost.slice(0, 12)) / year1Revenue : 0;
  const fullStaff = sum(plan.staff.map((s) => (s.count * s.grossAnnual * ss) / 12)) * adj.fixedCost;
  const monthlyFixed = sum(plan.fixedCosts.map((f) => f.monthly)) * adj.fixedCost + fullStaff + monthlyDep;
  const beRevenue = breakEvenRevenue(monthlyFixed, cmRatio);
  const totalUnits = sum(plan.products.map((p) => p.unitsMonth1));
  const avgPrice =
    totalUnits > 0 ? sum(plan.products.map((p) => p.unitsMonth1 * p.price * adj.price)) / totalUnits : 0;
  const beMonthIdx = months.findIndex((r) => r.ebitda - r.depreciation >= 0);

  let minCash = Infinity;
  let minCashMonth = 0;
  months.forEach((r) => {
    if (r.cashBalance < minCash) {
      minCash = r.cashBalance;
      minCashMonth = r.month;
    }
  });

  const last = years[YEARS - 1];
  const ratio = (x: number) => (last.revenue > 0 ? x / last.revenue : 0);

  return {
    months,
    years,
    npv: npv(rate, flows),
    irr: irr(flows),
    paybackMonths,
    breakEven: {
      monthlyRevenue: beRevenue,
      monthlyUnits: avgPrice > 0 ? beRevenue / avgPrice : Infinity,
      month: beMonthIdx >= 0 ? beMonthIdx + 1 : null,
    },
    minCash,
    minCashMonth,
    negativeMonths: months.filter((r) => r.cashBalance < 0).map((r) => r.month),
    fundingGap: Math.max(0, -minCash),
    loanPayment: loanPayment(plan.loanAmount, plan.loanRate / 100, plan.loanYears),
    ratios: { grossMargin: ratio(last.grossMargin), ebitdaMargin: ratio(last.ebitda), netMargin: ratio(last.netIncome) },
  };
}

export interface SensitivityRow {
  variable: string;
  low: number;
  high: number;
}

/** Variación del VAN al mover cada variable ±delta manteniendo el resto. */
export function sensitivity(plan: Plan, delta = 0.1): { base: number; rows: SensitivityRow[] } {
  const base = simulate(plan).npv;
  const vars: { key: keyof typeof NEUTRAL; label: string }[] = [
    { key: 'price', label: 'Precio de venta' },
    { key: 'volume', label: 'Volumen de ventas' },
    { key: 'variableCost', label: 'Coste variable' },
    { key: 'fixedCost', label: 'Costes fijos y personal' },
  ];
  const rows = vars.map(({ key, label }) => ({
    variable: label,
    low: simulate(plan, { ...NEUTRAL, [key]: 1 - delta }).npv - base,
    high: simulate(plan, { ...NEUTRAL, [key]: 1 + delta }).npv - base,
  }));
  rows.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, rows };
}
