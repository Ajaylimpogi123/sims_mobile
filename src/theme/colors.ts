/**
 * Colors for places that need a raw value (tab bar, headers, spinners, status bar).
 * Everything else uses Tailwind classes; `brand` there is the same Tailwind green palette
 * the SIMS website uses (mostly green-700).
 */
export const colors = {
  brand50: '#f0fdf4',
  brand100: '#dcfce7',
  brand600: '#16a34a',
  brand700: '#15803d',
  brand800: '#166534',
  white: '#ffffff',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate900: '#0f172a',
} as const;
