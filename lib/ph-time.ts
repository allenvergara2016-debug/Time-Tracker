/**
 * Philippine Standard Time (PST) utilities: UTC+8 (Asia/Manila)
 */

export const PH_TIMEZONE = 'Asia/Manila';

/**
 * Returns the current date in YYYY-MM-DD in Asia/Manila (UTC+8)
 */
export function getPHDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formats an ISO string or Date object to Philippine Time (12-hour: 11:58 AM)
 */
export function formatPHTime(
  date: Date | string | null | undefined,
  includeSeconds = false
): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(d);
}

/**
 * Formats a date to short Philippine date string: "Oct 30, 2026"
 */
export function formatPHDate(date: Date | string | null | undefined): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Converts a shift time string (e.g. "07:00:00" or "16:00") on a specific date (YYYY-MM-DD)
 * into an exact Date object with the +08:00 (Asia/Manila) offset.
 */
export function parseShiftToPHDate(timeStr: string, dateStr: string): Date {
  const parts = timeStr.split(':');
  const h = (parts[0] || '00').padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');

  return new Date(`${dateStr}T${h}:${m}:${s}+08:00`);
}

