/**
 * Required hours, as the API accepts them: blank / 0 = not set, otherwise a whole number up to 2000.
 * The server enforces it; this only answers before sending, in Laravel's own wording.
 */
export const REQUIRED_HOURS_MAX = 2000;

/** Enough characters for the max; anything longer is over it anyway. */
export const REQUIRED_HOURS_MAX_LENGTH = String(REQUIRED_HOURS_MAX).length;

/** The client-side 422 for a typed value, or null when the server would accept it. */
export function requiredHoursError(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return 'The required hours field must be an integer.';
  if (Number(trimmed) > REQUIRED_HOURS_MAX) return `The required hours field must not be greater than ${REQUIRED_HOURS_MAX}.`;
  return null;
}
