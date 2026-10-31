/**
 * Universal & Philippine Standard Time (PST) utilities
 * Supports dynamic company-wide timezone configuration
 */

export const DEFAULT_TIMEZONE = 'Asia/Manila';
export const PH_TIMEZONE = DEFAULT_TIMEZONE;

export interface TimezoneOption {
  value: string;
  label: string;
  region: string;
  utcOffset: string;
}

export const SUPPORTED_TIMEZONES: TimezoneOption[] = [
  { value: 'Asia/Manila', label: 'Philippines (Manila / PST)', region: 'Asia', utcOffset: 'UTC+8' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', region: 'Asia', utcOffset: 'UTC+8' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', region: 'Asia', utcOffset: 'UTC+8' },
  { value: 'Asia/Tokyo', label: 'Japan (Tokyo / JST)', region: 'Asia', utcOffset: 'UTC+9' },
  { value: 'Asia/Seoul', label: 'South Korea (Seoul / KST)', region: 'Asia', utcOffset: 'UTC+9' },
  { value: 'Asia/Taipei', label: 'Taiwan (Taipei)', region: 'Asia', utcOffset: 'UTC+8' },
  { value: 'Asia/Bangkok', label: 'Thailand (Bangkok / ICT)', region: 'Asia', utcOffset: 'UTC+7' },
  { value: 'Asia/Jakarta', label: 'Indonesia (Jakarta / WIB)', region: 'Asia', utcOffset: 'UTC+7' },
  { value: 'Asia/Kolkata', label: 'India (New Delhi / IST)', region: 'Asia', utcOffset: 'UTC+5:30' },
  { value: 'Asia/Dubai', label: 'UAE (Dubai / GST)', region: 'Middle East', utcOffset: 'UTC+4' },
  { value: 'Australia/Sydney', label: 'Australia (Sydney / AEST)', region: 'Oceania', utcOffset: 'UTC+10/11' },
  { value: 'Pacific/Guam', label: 'Guam (Chamorro / ChST)', region: 'Pacific', utcOffset: 'UTC+10' },
  { value: 'Pacific/Auckland', label: 'New Zealand (Auckland / NZST)', region: 'Pacific', utcOffset: 'UTC+12/13' },
  { value: 'Pacific/Honolulu', label: 'USA (Hawaii / HST)', region: 'Americas', utcOffset: 'UTC-10' },
  { value: 'America/Los_Angeles', label: 'USA Pacific (Los Angeles / PST)', region: 'Americas', utcOffset: 'UTC-8/-7' },
  { value: 'America/Denver', label: 'USA Mountain (Denver / MST)', region: 'Americas', utcOffset: 'UTC-7/-6' },
  { value: 'America/Chicago', label: 'USA Central (Chicago / CST)', region: 'Americas', utcOffset: 'UTC-6/-5' },
  { value: 'America/New_York', label: 'USA Eastern (New York / EST)', region: 'Americas', utcOffset: 'UTC-5/-4' },
  { value: 'Europe/London', label: 'UK (London / GMT / BST)', region: 'Europe', utcOffset: 'UTC+0/+1' },
  { value: 'Europe/Paris', label: 'France (Paris / CET)', region: 'Europe', utcOffset: 'UTC+1/+2' },
  { value: 'Europe/Berlin', label: 'Germany (Berlin / CET)', region: 'Europe', utcOffset: 'UTC+1/+2' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', region: 'UTC', utcOffset: 'UTC+0' },
];

/**
 * Returns human-readable label for a timezone
 */
export function getTimezoneLabel(timezone: string = DEFAULT_TIMEZONE): string {
  const match = SUPPORTED_TIMEZONES.find((t) => t.value === timezone);
  if (match) return `${match.label} (${match.utcOffset})`;
  return timezone;
}

/**
 * Returns the exact ISO offset string e.g. "+08:00" or "-05:00" for a timezone on a specific date
 */
export function getTimezoneOffsetString(timezone: string = DEFAULT_TIMEZONE, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (tzPart && tzPart.value) {
      const match = tzPart.value.match(/GMT([+-]\d{2}:\d{2})/);
      if (match) return match[1];
      if (tzPart.value === 'GMT') return '+00:00';
    }
  } catch {
    // fallback
  }
  return '+08:00';
}

/**
 * Returns the current date in YYYY-MM-DD in the target timezone
 */
export function getPHDateString(date: Date = new Date(), timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formats any time representation (ISO timestamp, Date, or 24-hr string like "13:00" or "07:00:00")
 * to 12-hour format: "01:52 PM".
 * Uses a non-breaking space (\u00A0) so "AM" or "PM" is NEVER wrapped onto a new line!
 */
export function formatPHTime(
  date: Date | string | null | undefined,
  includeSeconds = false,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!date) return '--';

  const tz = timezone || DEFAULT_TIMEZONE;

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

    // Pure 24-hour format without timezone: "13:00", "12:00:00", "07:00"
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
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(d);

  // Replace any whitespace or narrow non-breaking space before AM/PM with standard \u00A0
  return raw.replace(/[\s\u202F]+(AM|PM)$/i, '\u00A0$1');
}

/**
 * Formats a date to short date string: "Oct 30, 2026"
 */
export function formatPHDate(date: Date | string | null | undefined, timezone: string = DEFAULT_TIMEZONE): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Converts a shift time string (e.g. "07:00:00" or "16:00") on a specific date (YYYY-MM-DD)
 * into an exact Date object with the target timezone offset.
 */
export function parseShiftToPHDate(timeStr: string, dateStr: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const parts = timeStr.split(':');
  const h = (parts[0] || '00').padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');

  const offset = getTimezoneOffsetString(timezone);
  return new Date(`${dateStr}T${h}:${m}:${s}${offset}`);
}
