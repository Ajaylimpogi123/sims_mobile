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

/** Whole Manila calendar days from `input` to `now` (0 = same day, 1 = yesterday). */
function manilaDaysAgo(input: DateInput, now: DateInput): number | null {
  const a = manilaParts(input);
  const b = manilaParts(now);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.year, b.month, b.day) - Date.UTC(a.year, a.month, a.day)) / 86_400_000);
}

/**
 * When something happened, relative plus the 12-hour Manila time:
 * "Just now", "5 min ago · 3:05 PM", "2 hours ago · 1:10 PM", "Yesterday · 3:05 PM",
 * "3 days ago · Sep 29, 2026, 3:05 PM", then just "Sep 2, 2026, 3:05 PM" after a week.
 */
export function formatRelativeDateTime(input: DateInput, now: DateInput = new Date()): string {
  const date = parseApiDate(input);
  const nowDate = parseApiDate(now);
  if (Number.isNaN(date.getTime())) return '';

  const minutes = Math.floor((nowDate.getTime() - date.getTime()) / 60_000);
  const days = manilaDaysAgo(date, nowDate) ?? 0;
  const time = formatTime(date);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago · ${time}`;
  if (days === 0) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago · ${time}`;
  }
  if (days === 1) return `Yesterday · ${time}`;
  if (days < 7) return `${days} days ago · ${formatDateTime(date)}`;
  return formatDateTime(date);
}

/** "Oct 2" (chart axes and compact ranges). */
export function formatShortDate(input: DateInput): string {
  const p = manilaParts(input);
  return p ? `${MONTHS[p.month].slice(0, 3)} ${p.day}` : '';
}

/**
 * "YYYY-MM-DD" for the calendar day the user picked in a date picker. The picker returns a Date
 * at the phone's local midnight, so read the local parts (the API treats the string as a Manila date).
 */
export function toApiDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Local Date (midnight) for an API "YYYY-MM-DD", to seed a date picker. */
export function fromApiDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Today's date in Manila as "YYYY-MM-DD". */
export function todayApiDate(now: DateInput = new Date()): string {
  const p = manilaParts(now);
  return p ? `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}` : '';
}
