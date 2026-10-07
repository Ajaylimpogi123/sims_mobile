/**
 * Colors for places that need a raw value (tab bar, headers, spinners, status bar, icons, charts).
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
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  red600: '#dc2626',
  emerald600: '#059669',
} as const;

/**
 * Chart series colours, the same as the website's dashboard charts (Dashboard/Partials/*Charts.jsx),
 * so a series is the same colour on web and app.
 */
export const chartColors = {
  /** hsl(160 84% 39%): present, locked, "Students" / "Evaluations" totals, hours progress */
  positive: '#10b981',
  /** hsl(0 84% 60%) */
  rejected: '#ef4444',
  /** hsl(217 91% 60%) */
  submitted: '#3b82f6',
  /** hsl(220 9% 60%): draft and unknown statuses */
  neutral: '#9096a2',
  /** hsl(262 83% 58%): average rating */
  rating: '#8b5cf6',
  /** hsl(199 89% 48%): report totals */
  reports: '#0ea5e9',
  grid: '#e5e7eb',
  axisText: '#6b7280',
} as const;

/** StatCard icon colours, matching the website's per-card iconColor / iconBg (text-*-600 on bg-*-50). */
export const kpiTones = {
  blue: { icon: '#2563eb', bg: 'bg-blue-50' },
  emerald: { icon: '#059669', bg: 'bg-emerald-50' },
  sky: { icon: '#0284c7', bg: 'bg-sky-50' },
  amber: { icon: '#d97706', bg: 'bg-amber-50' },
  cyan: { icon: '#0891b2', bg: 'bg-cyan-50' },
  fuchsia: { icon: '#c026d3', bg: 'bg-fuchsia-50' },
  green: { icon: '#16a34a', bg: 'bg-green-50' },
  red: { icon: '#dc2626', bg: 'bg-red-50' },
  purple: { icon: '#9333ea', bg: 'bg-purple-50' },
  indigo: { icon: '#4f46e5', bg: 'bg-indigo-50' },
  orange: { icon: '#ea580c', bg: 'bg-orange-50' },
  teal: { icon: '#0d9488', bg: 'bg-teal-50' },
} as const;

export type KpiTone = keyof typeof kpiTones;
