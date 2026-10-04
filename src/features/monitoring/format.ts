import type { MonitoredStudent } from '@/api/types';
import { formatNumber } from '@/lib/format';

/** Website columns: "Rendered Hours", "Required Hours" ("Not set"), "Remaining Hours" ("—"). */
export function hoursColumns(student: MonitoredStudent) {
  return [
    { label: 'Rendered Hours', value: formatNumber(student.rendered_hours) },
    { label: 'Required Hours', value: student.required_hours !== null ? formatNumber(student.required_hours) : 'Not set' },
    { label: 'Remaining Hours', value: student.remaining_hours !== null ? formatNumber(student.remaining_hours) : '—' },
  ];
}

/** "2023-0001 · Acme Corp" (company "Unassigned" like the website's Company column). */
export function studentMeta(student: MonitoredStudent): string {
  return [student.student_number, student.company?.name ?? 'Unassigned'].filter(Boolean).join(' · ');
}

/** Website (ProgressMonitoring): a missing status shows as Not Started. */
export function internshipStatus(student: MonitoredStudent): string {
  return student.internship_status ?? 'not_started';
}
