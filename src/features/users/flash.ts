/**
 * One-shot success messages, like the website's flash after a redirect ("User registered
 * successfully.", "User updated successfully."). A form sets one before closing; the screen
 * underneath takes it on focus.
 */
let listPending: string | null = null;
let detailPending: string | null = null;

export function setUsersFlash(message: string) {
  listPending = message;
}

export function takeUsersFlash(): string | null {
  const message = listPending;
  listPending = null;
  return message;
}

export function setUserDetailFlash(message: string) {
  detailPending = message;
}

export function takeUserDetailFlash(): string | null {
  const message = detailPending;
  detailPending = null;
  return message;
}
