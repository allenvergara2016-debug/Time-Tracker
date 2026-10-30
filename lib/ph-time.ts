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
 * Formats any time representation (ISO timestamp, Date, or 24-hr string like "13:00" or "07:00:00")
 * to Philippine Time (12-hour: 01:52 PM).
 * Uses a non-breaking space (\u00A0) so "AM" or "PM" is NEVER wrapped onto a new line!
 */
export function formatPHTime(
  date: Date | string | null | undefined,
  includeSeconds = false
): string {
  if (!date) return '--';

  // 1. If it's a 24-hour time string (e.g. "12:00", "13:00", "07:30:00")
  if (typeof date === 'string') {
    const trimmed = date.trim();
    // If already in 12-hr format e.g. "01:52 PM" or "1:52 AM"
    const already12Hr = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (already12Hr) {
      const h = already12Hr[1].padStart(2, '0');
      const m = already12Hr[2];
      const ampm = already12Hr[3].toUpperCase();
      return `${h}:${m}\u00A0${ampm}`;
    }

    // Pure 24-hour format: "13:00", "12:00:00", "07:00"
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${String(h).padStart(2, '0')}:${m}\u00A0${ampm}`;
    }
  }

  // 2. Standard Date or ISO string
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';

  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(d);

  // Replace any whitespace or narrow non-breaking space before AM/PM with standard \u00A0
  return raw.replace(/[\s\u202F]+(AM|PM)$/i, '\u00A0$1');
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
