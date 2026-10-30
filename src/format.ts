const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 });

export const fmtEur = (n: number) => (Number.isFinite(n) ? eur.format(n || 0) : '—');
export const fmtNum = (n: number) => (Number.isFinite(n) ? num.format(n || 0) : '—');
export const fmtPct = (n: number | null) => (n === null || !Number.isFinite(n) ? '—' : pct.format(n));

/** Formato compacto para ejes: 12,5 k€ / 1,2 M€ */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString('es-ES', { maximumFractionDigits: 0 })} k€`;
  return `${Math.round(n)} €`;
}

export function fmtMonths(m: number | null): string {
  if (m === null) return 'No se alcanza';
  const y = Math.floor((m - 1) / 12) + 1;
  const mm = ((m - 1) % 12) + 1;
  return `Mes ${m} · año ${y}, mes ${mm}`;
}

export function fmtDuration(m: number | null): string {
  if (m === null) return '> 5 años';
  if (m < 12) return `${m} meses`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  const unit = y === 1 ? 'año' : 'años';
  return r ? `${y} ${unit} ${r} m` : `${y} ${unit}`;
}
