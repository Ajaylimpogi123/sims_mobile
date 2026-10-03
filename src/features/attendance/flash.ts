/**
 * One-shot success message from the capture screen to My Attendance, like the website's flash
 * message after a redirect. The capture screen sets it before closing; My Attendance takes it on focus.
 */
let pending: string | null = null;

export function setAttendanceFlash(message: string) {
  pending = message;
}

export function takeAttendanceFlash(): string | null {
  const message = pending;
  pending = null;
  return message;
}
