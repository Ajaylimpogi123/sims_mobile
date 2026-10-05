/**
 * One-shot success message after a review ("Report reviewed."), like the website's flash message
 * after the redirect back to Report Reviews. The report screen sets it before closing; the list
 * underneath takes it on focus.
 */
let pending: string | null = null;

export function setReviewsFlash(message: string) {
  pending = message;
}

export function takeReviewsFlash(): string | null {
  const message = pending;
  pending = null;
  return message;
}
