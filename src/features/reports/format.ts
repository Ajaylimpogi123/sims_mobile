import type { Report, ReportStatus, ReportType } from '@/api/types';
import { formatDate } from '@/lib/datetime';
import { formatNumber } from '@/lib/format';

export const TYPE_LABEL: Record<ReportType, string> = { daily: 'Daily', weekly: 'Weekly' };
export const STATUS_LABEL: Record<ReportStatus, string> = { pending: 'Pending', reviewed: 'Reviewed' };

/** "Oct 3, 2026" for a daily report, "Sep 28, 2026 – Oct 3, 2026" for a weekly one (website: Period column). */
export function formatPeriod(report: Pick<Report, 'type' | 'period_start' | 'period_end'>): string {
  return report.type === 'daily' || report.period_start === report.period_end
    ? formatDate(report.period_start)
    : `${formatDate(report.period_start)} – ${formatDate(report.period_end)}`;
}

/** "48 KB", "1.2 MB" */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 0)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} MB`;
}

/** "PDF" / "Image" / "File" (attachment.kind; 'file' is the API's fallback for any other type). */
export const KIND_LABEL: Record<'image' | 'pdf' | 'file', string> = { image: 'Image', pdf: 'PDF', file: 'File' };
