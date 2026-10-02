/**
 * Date/time display in Asia/Manila, 12-hour clock, regardless of the phone's time zone.
 *
 * Manila is UTC+8 all year (no daylight saving), so we shift by a fixed offset instead of
 * relying on Intl time-zone data being available in the JS engine.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type DateInput = Date | string | number;

interface ManilaParts {
  year: number;
  month: number; // 0-11
  day: number;
  weekday: number; // 0 = Sunday
  hours: number; // 0-23
  minutes: number;
}

/**
 * Parses an API value. ISO strings with an offset/Z are exact instants.
 * A naive "YYYY-MM-DD HH:mm[:ss]" or "YYYY-MM-DD" string is treated as Manila wall time
 * (the server's timezone), never as the phone's local time.
 */
export function parseApiDate(input: DateInput): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);

  const naive = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(input.trim());
  if (naive) {
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = naive;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - MANILA_OFFSET_MS);
  }
  return new Date(input);
}

function manilaParts(input: DateInput): ManilaParts | null {
  const date = parseApiDate(input);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

/** "3:05 PM" */
export function formatTime(input: DateInput): string {
  const p = manilaParts(input);
  if (!p) return '';
  const hour12 = p.hours % 12 === 0 ? 12 : p.hours % 12;
  return `${hour12}:${String(p.minutes).padStart(2, '0')} ${p.hours < 12 ? 'AM' : 'PM'}`;
}

/** "Oct 2, 2026" */
export function formatDate(input: DateInput): string {
  const p = manilaParts(input);
  return p ? `${MONTHS[p.month].slice(0, 3)} ${p.day}, ${p.year}` : '';
}

/** "Friday, October 2, 2026" */
export function formatLongDate(input: DateInput): string {
  const p = manilaParts(input);
  return p ? `${WEEKDAYS[p.weekday]}, ${MONTHS[p.month]} ${p.day}, ${p.year}` : '';
}

/** "Oct 2, 2026, 3:05 PM" */
export function formatDateTime(input: DateInput): string {
  const date = formatDate(input);
  return date ? `${date}, ${formatTime(input)}` : '';
}

/** "Good morning" / "Good afternoon" / "Good evening" by Manila time. */
export function greeting(now: DateInput = new Date()): string {
  const hours = manilaParts(now)?.hours ?? 12;
  if (hours < 12) return 'Good morning';
  if (hours < 18) return 'Good afternoon';
  return 'Good evening';
}
