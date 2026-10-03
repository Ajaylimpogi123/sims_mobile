/** "1,234" / "120.5" / "4.25": thousands separators, at most `maxDecimals`, no trailing zeros. */
export function formatNumber(value: number | null | undefined, maxDecimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '0';
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(value * factor) / factor;
  const [whole, fraction] = Math.abs(rounded).toFixed(maxDecimals).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmed = fraction?.replace(/0+$/, '');
  return `${rounded < 0 ? '-' : ''}${grouped}${trimmed ? `.${trimmed}` : ''}`;
}

/** "Daily" from "daily". */
export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Style for numbers that should line up (KPIs, hours, counts). */
export const TABULAR = { fontVariant: ['tabular-nums' as const] };
