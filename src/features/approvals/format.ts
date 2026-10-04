import type { ApprovalItem, AttendanceLeg } from '@/api/types';
import { formatDate, formatTime } from '@/lib/datetime';

/** Website wording (AttendanceApprovals/Index.jsx): "Time In", "Time Out", "Time Out (Emergency)". */
export function legLabel(item: Pick<ApprovalItem, 'is_emergency'>, leg: AttendanceLeg): string {
  if (leg === 'time_in') return 'Time In';
  return item.is_emergency ? 'Time Out (Emergency)' : 'Time Out';
}

/** "Time-in" / "Time-out" (website: AttendanceEvidence photo alt text). */
export const LEG_SHORT: Record<AttendanceLeg, string> = { time_in: 'Time-in', time_out: 'Time-out' };

/** Emergency time-out legs get the website's red pill. */
export function isEmergencyLeg(item: Pick<ApprovalItem, 'is_emergency'>, leg: AttendanceLeg): boolean {
  return leg === 'time_out' && item.is_emergency;
}

/** "2023-0001 · Acme Corp" (whatever is known). */
export function studentMeta(item: ApprovalItem): string {
  return [item.student.student_number, item.student.company?.name].filter(Boolean).join(' · ');
}

/** "Juan Dela Cruz · Oct 2, 2026 · 8:05 AM": what the reject sheet is about. */
export function rejectSubtitle(item: ApprovalItem, leg: AttendanceLeg): string {
  const time = item[leg];
  return [item.student.name, formatDate(item.date), time ? formatTime(time) : null].filter(Boolean).join(' · ');
}
