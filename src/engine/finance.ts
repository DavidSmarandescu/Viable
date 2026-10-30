/** Funciones financieras puras. Todos los tipos se expresan en tanto por uno salvo que se indique. */

/** Valor actual neto. cashFlows[0] ocurre hoy (sin descontar). */
export function npv(rate: number, cashFlows: number[]): number {
  return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

/**
 * Tasa interna de rentabilidad por bisección. Devuelve null si los flujos
 * no cambian de signo o no hay raíz en el intervalo (-99 %, 1000 %).
 */
export function irr(cashFlows: number[]): number | null {
  const hasPos = cashFlows.some((c) => c > 0);
  const hasNeg = cashFlows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return null;

  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo, cashFlows);
  const fHi = npv(hi, cashFlows);
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** Cuota constante del sistema francés. annualRate en tanto por uno. */
export function loanPayment(principal: number, annualRate: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const i = annualRate / 12;
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

export interface LoanMonth {
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Cuadro de amortización mensual (sistema francés). */
export function loanSchedule(principal: number, annualRate: number, years: number): LoanMonth[] {
  const n = Math.round(years * 12);
  const pay = loanPayment(principal, annualRate, years);
  const rows: LoanMonth[] = [];
  let balance = principal;
  for (let m = 0; m < n; m++) {
    const interest = balance * (annualRate / 12);
    const principalPart = pay - interest;
    balance = Math.max(0, balance - principalPart);
    rows.push({ payment: pay, interest, principal: principalPart, balance });
  }
  return rows;
}

/**
 * Impuesto de Sociedades por ejercicio con compensación de bases negativas.
 * Si newCompany, se aplica el 15 % en el primer ejercicio con base positiva y
 * en el siguiente (art. 29.1 LIS, entidades de nueva creación).
 */
export function corporateTax(
  profitsBeforeTax: number[],
  generalRate: number,
  newCompany: boolean,
  reducedRate = 0.15,
): number[] {
  let carryForward = 0;
  let firstPositive: number | null = null;
  return profitsBeforeTax.map((ebt, y) => {
    if (ebt <= 0) {
      carryForward += -ebt;
      return 0;
    }
    const offset = Math.min(carryForward, ebt);
    carryForward -= offset;
    const base = ebt - offset;
    if (base <= 0) return 0;
    if (firstPositive === null) firstPositive = y;
    const rate = newCompany && y - firstPositive < 2 ? reducedRate : generalRate;
    return base * rate;
  });
}

/** Punto de equilibrio en ingresos: costes fijos / margen de contribución. */
export function breakEvenRevenue(fixedCosts: number, contributionMarginRatio: number): number {
  if (contributionMarginRatio <= 0) return Infinity;
  return fixedCosts / contributionMarginRatio;
}
