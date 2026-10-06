/**
 * One-shot success messages, like the website's flash after a redirect ("Company added
 * successfully.", "Company deleted successfully."). A form or the detail sets one before closing;
 * the screen underneath takes it on focus.
 */
let listPending: string | null = null;
let detailPending: string | null = null;

export function setCompaniesFlash(message: string) {
  listPending = message;
}

export function takeCompaniesFlash(): string | null {
  const message = listPending;
  listPending = null;
  return message;
}

export function setCompanyDetailFlash(message: string) {
  detailPending = message;
}

export function takeCompanyDetailFlash(): string | null {
  const message = detailPending;
  detailPending = null;
  return message;
}

/** Shown when a company id no longer exists (deleted meanwhile). */
export const COMPANY_NOT_FOUND = "We couldn't find that company. It may have been deleted.";
