import type { ReviewReportStudent } from '@/api/types';

/** "2023-0001 · Acme Corp" (company "Unassigned" like the website's Company columns). */
export function reviewStudentMeta(student: ReviewReportStudent): string {
  return [student.student_number, student.company?.name ?? 'Unassigned'].filter(Boolean).join(' · ');
}

/** "BSIT 4-A" when known. */
export function courseSection(student: ReviewReportStudent): string | null {
  return [student.course, student.section].filter(Boolean).join(' ') || null;
}
