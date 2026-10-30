export interface Product {
  id: string;
  name: string;
  /** Precio de venta unitario sin IVA (€) */
  price: number;
  /** Unidades vendidas el primer mes */
  unitsMonth1: number;
  /** Crecimiento mensual de unidades durante los dos primeros años (%) */
  monthlyGrowth: number;
  /** Coste variable como % del precio */
  variableCostPct: number;
}

export interface FixedCost {
  id: string;
  name: string;
  /** Importe mensual sin IVA (€) */
  monthly: number;
}

export interface StaffMember {
  id: string;
  role: string;
  count: number;
  /** Salario bruto anual por persona (€) */
  grossAnnual: number;
  /** Mes de incorporación (1 = primer mes) */
  startMonth: number;
}

export interface Plan {
  name: string;
  description: string;
  /** Inversión inicial en activos (€) */
  investment: number;
  /** Vida útil para la amortización lineal (años) */
  usefulLifeYears: number;
  equity: number;
  loanAmount: number;
  /** Tipo de interés nominal anual (%) */
  loanRate: number;
  loanYears: number;
  products: Product[];
  fixedCosts: FixedCost[];
  staff: StaffMember[];
  /** Seguridad Social a cargo de la empresa (%) */
  socialSecurityPct: number;
  /** Crecimiento anual de ventas a partir del tercer año (%) */
  growthAfterYear2: number;
  /** Tipo general del Impuesto de Sociedades (%) */
  corporateTaxRate: number;
  /** Aplicar el tipo reducido del 15 % de empresas de nueva creación */
  newCompany: boolean;
  /** Días medios de cobro a clientes */
  collectionDays: number;
  /** Días medios de pago a proveedores */
  paymentDays: number;
  /** Tasa de descuento para el VAN (%) */
  discountRate: number;
  /** Añadir valor residual (renta perpetua sin crecimiento) al VAN */
  terminalValue: boolean;
}

/** Multiplicadores aplicados sobre el plan base */
export interface Adjustments {
  price: number;
  volume: number;
  variableCost: number;
  fixedCost: number;
}

export const NEUTRAL: Adjustments = { price: 1, volume: 1, variableCost: 1, fixedCost: 1 };

export interface MonthRow {
  month: number;
  revenue: number;
  variableCost: number;
  staffCost: number;
  fixedCost: number;
  ebitda: number;
  depreciation: number;
  interest: number;
  ebt: number;
  cashIn: number;
  cashOut: number;
  loanPayment: number;
  taxPaid: number;
  netCashFlow: number;
  cashBalance: number;
}

export interface YearRow {
  year: number;
  revenue: number;
  variableCost: number;
  grossMargin: number;
  staffCost: number;
  fixedCost: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  freeCashFlow: number;
}

export interface BreakEven {
  /** Ingresos mensuales necesarios para cubrir los costes fijos */
  monthlyRevenue: number;
  /** Unidades mensuales equivalentes al precio medio ponderado */
  monthlyUnits: number;
  /** Primer mes con resultado de explotación positivo (null si no se alcanza) */
  month: number | null;
}

export interface Result {
  months: MonthRow[];
  years: YearRow[];
  npv: number;
  irr: number | null;
  /** Meses hasta recuperar la inversión (null si no se recupera en el horizonte) */
  paybackMonths: number | null;
  breakEven: BreakEven;
  minCash: number;
  minCashMonth: number;
  negativeMonths: number[];
  /** Financiación adicional necesaria para no quedar en negativo */
  fundingGap: number;
  loanPayment: number;
  ratios: { grossMargin: number; ebitdaMargin: number; netMargin: number };
}
