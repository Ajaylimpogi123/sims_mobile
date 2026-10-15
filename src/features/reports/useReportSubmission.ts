import { useQuery } from '@tanstack/react-query';

import { meQueryOptions } from '@/api/auth';
import { CLOSED_REASON, submissionClosedMessage } from '@/lib/submission';

/**
 * Whether the student may submit / edit reports now (internship Ongoing), from GET /me (`student.can_submit`),
 * re-checked each time a report screen opens. `closed` is null while unknown; the API re-checks on save anyway.
 * `message` is the website's amber notice, or the server's reason if /me still reads Ongoing.
 */
export function useReportSubmission(): { closed: boolean | null; message: string } {
  const me = useQuery({ ...meQueryOptions, staleTime: 0 });
  const student = me.data?.student;
  if (!student) return { closed: null, message: CLOSED_REASON.reports };
  return {
    closed: student.can_submit === false,
    message: submissionClosedMessage(student.internship_status, CLOSED_REASON.reports) ?? CLOSED_REASON.reports,
  };
}
