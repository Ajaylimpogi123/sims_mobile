import type { FeedbackSummary } from '@/api/types';
import { formatDate } from '@/lib/datetime';

/** "Sep 1, 2026 – Sep 30, 2026" (website card title: evaluation period). */
export function formatFeedbackPeriod(item: Pick<FeedbackSummary, 'period_start' | 'period_end'>): string {
  return item.period_start === item.period_end
    ? formatDate(item.period_start)
    : `${formatDate(item.period_start)} – ${formatDate(item.period_end)}`;
}

/** "4.25" or "—", as the website's "Overall Rating: 4.25/5". */
export function formatRating(rating: number | null): string {
  return rating === null || !Number.isFinite(rating) ? '—' : rating.toFixed(2);
}

/** "Acme Corp · Supervisor: Maria Santos" (website subtitle under the period). */
export function companySupervisorLine(item: Pick<FeedbackSummary, 'company' | 'supervisor'>): string {
  return `${item.company?.name || '—'} · Supervisor: ${item.supervisor?.name || '—'}`;
}
