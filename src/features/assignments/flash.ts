/**
 * One-shot success messages, like the website's flash after a redirect ("Student updated
 * successfully.", "Student status updated."). A form or the detail sets one before closing; the
 * screen underneath takes it on focus.
 */
let listPending: string | null = null;
let detailPending: string | null = null;

export function setAssignmentsFlash(message: string) {
  listPending = message;
}

export function takeAssignmentsFlash(): string | null {
  const message = listPending;
  listPending = null;
  return message;
}

export function setAssignmentDetailFlash(message: string) {
  detailPending = message;
}

export function takeAssignmentDetailFlash(): string | null {
  const message = detailPending;
  detailPending = null;
  return message;
}

/** Shown when a student id no longer exists (removed meanwhile). */
export const STUDENT_NOT_FOUND = "We couldn't find that student. They may have been removed.";
