/** One-shot success message from the term form to the Terms list (the website's flash after a redirect). */
let pending: string | null = null;

export function setTermsFlash(message: string) {
  pending = message;
}

export function takeTermsFlash(): string | null {
  const message = pending;
  pending = null;
  return message;
}
