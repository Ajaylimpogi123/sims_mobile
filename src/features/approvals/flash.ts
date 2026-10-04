/**
 * One-shot success message when the evidence screen closes after its last pending leg was decided;
 * Pending Approvals shows it on focus (like the website's flash message after a redirect).
 */
let pending: string | null = null;

export function setApprovalsFlash(message: string) {
  pending = message;
}

export function takeApprovalsFlash(): string | null {
  const message = pending;
  pending = null;
  return message;
}
