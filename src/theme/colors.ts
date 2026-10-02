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
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray900: '#111827',
} as const;
