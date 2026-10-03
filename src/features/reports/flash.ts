/**
 * One-shot success message after a report is created, updated or deleted, like the website's flash
 * message after a redirect. The screen that finishes the action sets it before closing; the screen
 * underneath (My Reports or the report) takes it on focus.
 */
let pending: string | null = null;

export function setReportsFlash(message: string) {
  pending = message;
}

export function takeReportsFlash(): string | null {
  const message = pending;
  pending = null;
  return message;
}
