import type { InternshipStatus, TermRef } from '@/api/types';
import { isPastTerm } from '@/terms/selected-term';

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
 * A student whose term is past gets the website's ended-term text (ArchivedTermBanner); an upcoming
 * term says it hasn't started yet (the server's reason "Your internship term hasn't started yet.").
 */
export function submissionClosedMessage(
  status: InternshipStatus | null | undefined,
  reason?: string | null,
  term?: TermRef | null,
): string | null {
  if (term && !term.is_current) {
    return isPastTerm(term)
      ? `Your internship term (${term.label}) has ended. Your records are read-only.`
      : `Your internship term (${term.label}) hasn't started yet.`;
  }
  if (status === 'completed') return 'Your internship is Completed — attendance and reports are closed.';
  if (status === 'ongoing') return reason ?? null;
  return 'Your internship is Not Started — you can submit attendance and reports once it is Ongoing.';
}
