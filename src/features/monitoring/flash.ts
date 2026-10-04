/**
 * One-shot success message after an entry is added or edited (the website's flash message after a
 * redirect). The form sets it before closing; the student's Attendance Log shows it on focus.
 */
let pending: string | null = null;

export function setMonitoringFlash(message: string) {
  pending = message;
}

export function takeMonitoringFlash(): string | null {
  const message = pending;
  pending = null;
  return message;
}
