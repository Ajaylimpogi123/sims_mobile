import type { InternshipStatus } from '@/api/types';

/**
 * Students may submit attendance and reports only while their internship is Ongoing. The API
 * enforces it; the app only disables the actions and explains why.
 */

/** The server's refusal text for each kind of submission (the 422 message and `reason`). */
export const CLOSED_REASON = {
  attendance: 'You can only submit attendance while your internship is Ongoing.',
  reports: 'You can only submit reports while your internship is Ongoing.',
} as const;

/**
 * The website's amber notice (Components/SubmissionClosedNotice.jsx), same text on My Attendance,
 * My Reports and Home. Falls back to the server's `reason` when the status reads Ongoing anyway.
 */
export function submissionClosedMessage(status: InternshipStatus | null | undefined, reason?: string | null): string | null {
  if (status === 'completed') return 'Your internship is Completed — attendance and reports are closed.';
  if (status === 'ongoing') return reason ?? null;
  return 'Your internship is Not Started — you can submit attendance and reports once it is Ongoing.';
}
