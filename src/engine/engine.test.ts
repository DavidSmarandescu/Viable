import { breakEvenRevenue, corporateTax, irr, loanPayment, loanSchedule, npv } from './finance';
import { simulate, sensitivity, unitsAt } from './simulate';
import { TEMPLATES } from './templates';
import { NEUTRAL } from './types';

describe('VAN', () => {
  it('descuenta los flujos a partir del periodo 1', () => {
    expect(npv(0.1, [-1000, 1100])).toBeCloseTo(0, 6);
    expect(npv(0.1, [-1000, 500, 500, 500])).toBeCloseTo(243.43, 2);
  });
  it('con tasa 0 es la suma simple', () => {
    expect(npv(0, [-100, 30, 30, 30])).toBe(-10);
  });
});

describe('TIR', () => {
  it('encuentra la tasa que anula el VAN', () => {
    expect(irr([-1000, 1100])!).toBeCloseTo(0.1, 6);
    const r = irr([-1000, 500, 500, 500])!;
    expect(r).toBeCloseTo(0.23375, 4);
    expect(npv(r, [-1000, 500, 500, 500])).toBeCloseTo(0, 4);
  });
  it('devuelve null si no hay cambio de signo', () => {
    expect(irr([100, 200])).toBeNull();
    expect(irr([-100, -200])).toBeNull();
  });
});

describe('Préstamo francés', () => {
  it('calcula la cuota constante', () => {
    // 100.000 € al 6 % a 10 años → 1.110,21 €/mes
    expect(loanPayment(100000, 0.06, 10)).toBeCloseTo(1110.21, 2);
  });
  it('sin interés reparte el principal', () => {
    expect(loanPayment(12000, 0, 1)).toBe(1000);
  });
  it('el cuadro amortiza todo el principal', () => {
    const rows = loanSchedule(50000, 0.05, 5);
    expect(rows).toHaveLength(60);
    expect(rows[59].balance).toBeCloseTo(0, 4);
    expect(rows.reduce((a, r) => a + r.principal, 0)).toBeCloseTo(50000, 4);
    expect(rows[0].interest).toBeCloseTo(50000 * 0.05 / 12, 6);
  });
});

describe('Impuesto de Sociedades', () => {
  it('aplica el tipo general', () => {
    expect(corporateTax([100000], 0.25, false)).toEqual([25000]);
  });
  it('compensa bases negativas de ejercicios anteriores', () => {
    expect(corporateTax([-40000, 100000, 50000], 0.25, false)).toEqual([0, 15000, 12500]);
  });
  it('aplica el 15 % los dos primeros ejercicios con base positiva', () => {
    expect(corporateTax([-10000, 50000, 50000, 50000], 0.25, true)).toEqual([0, 6000, 7500, 12500]);
  });
  it('no tributa si las pérdidas acumuladas absorben el beneficio', () => {
    expect(corporateTax([-80000, 30000, 30000], 0.25, true)).toEqual([0, 0, 0]);
  });
});

describe('Punto de equilibrio', () => {
  it('divide costes fijos entre el margen de contribución', () => {
    expect(breakEvenRevenue(7000, 0.7)).toBeCloseTo(10000, 6);
    expect(breakEvenRevenue(1000, 0)).toBe(Infinity);
  });
  it('se refleja en la simulación', () => {
    const plan = { ...TEMPLATES[0].plan };
    const res = simulate(plan);
    // Ingresos de equilibrio × ratio de margen = costes fijos mensuales
    expect(res.breakEven.monthlyRevenue).toBeGreaterThan(0);
    expect(res.breakEven.month).not.toBeNull();
    const m = res.months[res.breakEven.month! - 1];
    expect(m.ebitda - m.depreciation).toBeGreaterThanOrEqual(0);
  });
});

describe('Simulación', () => {
  const plan = TEMPLATES[0].plan;
  const res = simulate(plan);

  it('genera 60 meses y 5 años coherentes', () => {
    expect(res.months).toHaveLength(60);
    expect(res.years).toHaveLength(5);
    const y1 = res.months.slice(0, 12).reduce((a, m) => a + m.revenue, 0);
    expect(res.years[0].revenue).toBeCloseTo(y1, 6);
    for (const y of res.years) {
      expect(y.netIncome).toBeCloseTo(y.ebt - y.tax, 6);
      expect(y.ebit).toBeCloseTo(y.ebitda - y.depreciation, 6);
    }
  });

  it('la tesorería parte de capital + préstamo − inversión', () => {
    const first = res.months[0];
    expect(first.cashBalance).toBeCloseTo(plan.equity + plan.loanAmount - plan.investment + first.netCashFlow, 6);
  });

  it('el crecimiento se modera a partir del segundo año', () => {
    expect(unitsAt(100, 10, 0, 23)).toBeCloseTo(unitsAt(100, 10, 0, 40), 6);
  });

  it('más volumen mejora el VAN y más costes lo empeoran', () => {
    expect(simulate(plan, { ...NEUTRAL, volume: 1.2 }).npv).toBeGreaterThan(res.npv);
    expect(simulate(plan, { ...NEUTRAL, fixedCost: 1.2 }).npv).toBeLessThan(res.npv);
  });

  it('la sensibilidad ordena las variables por impacto', () => {
    const { rows } = sensitivity(plan);
    const spans = rows.map((r) => Math.abs(r.high - r.low));
    expect(spans).toEqual([...spans].sort((a, b) => b - a));
  });

  it('detecta necesidad de financiación cuando la caja es negativa', () => {
    const tight = simulate({ ...plan, equity: 0, loanAmount: 0 });
    expect(tight.negativeMonths.length).toBeGreaterThan(0);
    expect(tight.fundingGap).toBeCloseTo(-tight.minCash, 6);
  });
});
