import { useState, type ReactNode } from 'react';
import { loanPayment, type FixedCost, type Plan, type Product, type StaffMember } from '../engine';
import { fmtEur } from '../format';

interface Props {
  plan: Plan;
  onChange: (plan: Plan) => void;
}

let idCounter = 0;
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${idCounter++}`;

export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const { label, value, onChange, suffix, step = 1, min = 0, max, hint } = props;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            onChange(Number.isFinite(v) ? v : 0);
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

const isNarrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

function Section({ title, step, children, defaultOpen = true }: { title: string; step: number; children: ReactNode; defaultOpen?: boolean }) {
  // En móvil las secciones empiezan plegadas para que los resultados queden a la vista
  const [open, setOpen] = useState(() => defaultOpen && (step === 1 || !isNarrow()));
  return (
    <section className={`card input-section ${open ? 'open' : ''}`}>
      <button type="button" className="section-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="step">{step}</span>
        <span className="section-title">{title}</span>
        <span className="chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

function ListEditor<T extends { id: string }>(props: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  create: () => T;
  addLabel: string;
}) {
  const { items, onChange, render, create, addLabel } = props;
  return (
    <div className="list">
      {items.map((item) => (
        <div className="list-item" key={item.id}>
          {render(item, (patch) => onChange(items.map((i) => (i.id === item.id ? { ...i, ...patch } : i))))}
          <button
            type="button"
            className="icon-btn remove"
            aria-label="Eliminar"
            title="Eliminar"
            onClick={() => onChange(items.filter((i) => i.id !== item.id))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost add" onClick={() => onChange([...items, create()])}>
        + {addLabel}
      </button>
    </div>
  );
}

export default function Inputs({ plan, onChange }: Props) {
  const set = <K extends keyof Plan>(key: K, value: Plan[K]) => onChange({ ...plan, [key]: value });
  const quota = loanPayment(plan.loanAmount, plan.loanRate / 100, plan.loanYears);
  const funding = plan.equity + plan.loanAmount;

  return (
    <div className="inputs">
      <Section title="Tu negocio" step={1}>
        <label className="field">
          <span className="field-label">Nombre del proyecto</span>
          <input type="text" value={plan.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Descripción breve</span>
          <textarea rows={2} value={plan.description} onChange={(e) => set('description', e.target.value)} />
        </label>
      </Section>

      <Section title="Inversión y financiación" step={2}>
        <div className="grid-2">
          <NumberField label="Inversión inicial" value={plan.investment} onChange={(v) => set('investment', v)} suffix="€" step={1000} />
          <NumberField label="Vida útil" value={plan.usefulLifeYears} onChange={(v) => set('usefulLifeYears', v)} suffix="años" min={1} />
          <NumberField label="Capital propio" value={plan.equity} onChange={(v) => set('equity', v)} suffix="€" step={1000} />
          <NumberField label="Préstamo" value={plan.loanAmount} onChange={(v) => set('loanAmount', v)} suffix="€" step={1000} />
          <NumberField label="Tipo de interés" value={plan.loanRate} onChange={(v) => set('loanRate', v)} suffix="%" step={0.1} />
          <NumberField label="Plazo" value={plan.loanYears} onChange={(v) => set('loanYears', v)} suffix="años" min={1} />
        </div>
        <p className="note">
          Cuota mensual (sistema francés): <strong>{fmtEur(quota)}</strong> · Fondos disponibles tras la inversión:{' '}
          <strong className={funding - plan.investment < 0 ? 'neg' : ''}>{fmtEur(funding - plan.investment)}</strong>
        </p>
      </Section>

      <Section title="Ventas" step={3}>
        <ListEditor<Product>
          items={plan.products}
          onChange={(v) => set('products', v)}
          addLabel="Añadir producto o servicio"
          create={() => ({ id: newId('p'), name: 'Nuevo producto', price: 0, unitsMonth1: 0, monthlyGrowth: 0, variableCostPct: 0 })}
          render={(p, update) => (
            <div className="row-fields">
              <label className="field span-2">
                <span className="field-label">Producto o servicio</span>
                <input type="text" value={p.name} onChange={(e) => update({ name: e.target.value })} />
              </label>
              <NumberField label="Precio (sin IVA)" value={p.price} onChange={(v) => update({ price: v })} suffix="€" step={0.5} />
              <NumberField label="Unidades mes 1" value={p.unitsMonth1} onChange={(v) => update({ unitsMonth1: v })} step={10} />
              <NumberField label="Crecimiento mensual" value={p.monthlyGrowth} onChange={(v) => update({ monthlyGrowth: v })} suffix="%" step={0.5} hint="Años 1 y 2" />
              <NumberField label="Coste variable" value={p.variableCostPct} onChange={(v) => update({ variableCostPct: v })} suffix="%" max={100} hint="Sobre el precio" />
            </div>
          )}
        />
        <NumberField
          label="Crecimiento anual a partir del año 3"
          value={plan.growthAfterYear2}
          onChange={(v) => set('growthAfterYear2', v)}
          suffix="%"
          min={-50}
        />
      </Section>

      <Section title="Costes fijos mensuales" step={4}>
        <ListEditor<FixedCost>
          items={plan.fixedCosts}
          onChange={(v) => set('fixedCosts', v)}
          addLabel="Añadir gasto"
          create={() => ({ id: newId('f'), name: 'Nuevo gasto', monthly: 0 })}
          render={(f, update) => (
            <div className="row-fields compact">
              <label className="field span-2">
                <span className="field-label">Concepto</span>
                <input type="text" value={f.name} onChange={(e) => update({ name: e.target.value })} />
              </label>
              <NumberField label="Importe / mes" value={f.monthly} onChange={(v) => update({ monthly: v })} suffix="€" step={50} />
            </div>
          )}
        />
      </Section>

      <Section title="Equipo" step={5}>
        <ListEditor<StaffMember>
          items={plan.staff}
          onChange={(v) => set('staff', v)}
          addLabel="Añadir puesto"
          create={() => ({ id: newId('s'), role: 'Nuevo puesto', count: 1, grossAnnual: 20000, startMonth: 1 })}
          render={(s, update) => (
            <div className="row-fields">
              <label className="field span-2">
                <span className="field-label">Puesto</span>
                <input type="text" value={s.role} onChange={(e) => update({ role: e.target.value })} />
              </label>
              <NumberField label="Personas" value={s.count} onChange={(v) => update({ count: v })} min={0} />
              <NumberField label="Bruto anual" value={s.grossAnnual} onChange={(v) => update({ grossAnnual: v })} suffix="€" step={1000} />
              <NumberField label="Se incorpora en" value={s.startMonth} onChange={(v) => update({ startMonth: Math.max(1, v) })} suffix="mes" min={1} max={60} />
            </div>
          )}
        />
        <NumberField
          label="Seguridad Social a cargo de la empresa"
          value={plan.socialSecurityPct}
          onChange={(v) => set('socialSecurityPct', v)}
          suffix="%"
          step={0.1}
        />
      </Section>

      <Section title="Impuestos y supuestos" step={6} defaultOpen={false}>
        <div className="grid-2">
          <NumberField label="Impuesto de Sociedades" value={plan.corporateTaxRate} onChange={(v) => set('corporateTaxRate', v)} suffix="%" />
          <NumberField label="Tasa de descuento" value={plan.discountRate} onChange={(v) => set('discountRate', v)} suffix="%" step={0.5} hint="Rentabilidad exigida" />
          <NumberField label="Días de cobro" value={plan.collectionDays} onChange={(v) => set('collectionDays', v)} suffix="días" step={15} />
          <NumberField label="Días de pago" value={plan.paymentDays} onChange={(v) => set('paymentDays', v)} suffix="días" step={15} />
        </div>
        <label className="check">
          <input type="checkbox" checked={plan.newCompany} onChange={(e) => set('newCompany', e.target.checked)} />
          <span>
            Empresa de nueva creación <small>(15 % los dos primeros ejercicios con beneficio)</small>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={plan.terminalValue} onChange={(e) => set('terminalValue', e.target.checked)} />
          <span>
            Incluir valor residual en el VAN <small>(renta perpetua del flujo del año 5)</small>
          </span>
        </label>
        <p className="note">Todos los importes se expresan sin IVA: el IVA repercutido y soportado se compensa y no afecta al resultado.</p>
      </Section>
    </div>
  );
}
