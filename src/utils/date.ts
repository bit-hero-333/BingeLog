import {
  DateFormatOption,
  DEFAULT_DATE_FORMAT,
  CountdownInfo,
  TimeFormatOption,
  DEFAULT_TIME_FORMAT,
} from '@/types/media';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/**
 * Format any valid date string or Date object into the specified user format.
 */
export function formatDate(
  dateInput?: string | Date | null,
  format: DateFormatOption = DEFAULT_DATE_FORMAT
): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';
    const day = String(d.getDate()).padStart(2, '0');
    const dayNum = d.getDate();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const monthName = SHORT_MONTHS[d.getMonth()] || month;
    const year = d.getFullYear();

    switch (format) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'MMM D, YYYY':
        return `${monthName} ${dayNum}, ${year}`;
      case 'D MMM YYYY':
        return `${dayNum} ${monthName} ${year}`;
      case 'DD.MM.YYYY':
      default:
        return `${day}.${month}.${year}`;
    }
  } catch {
    return typeof dateInput === 'string' ? dateInput : '';
  }
}

/**
 * Formats a date for display labels, returning 'Not set' when empty.
 */
export function formatDateDisplay(
  dateStr?: string | null,
  format: DateFormatOption = DEFAULT_DATE_FORMAT
): string {
  if (!dateStr) return 'Not set';
  const formatted = formatDate(dateStr, format);
  return formatted || String(dateStr);
}

/**
 * Formats a date specifically for text inputs.
 */
export function formatDateInput(
  dateStr?: string | null,
  format: DateFormatOption = DEFAULT_DATE_FORMAT
): string {
  if (!dateStr) return '';
  return formatDate(dateStr, format);
}

/**
 * Backwards compatibility helper for DD.MM.YYYY
 */
export function formatDateDDMMYYYY(dateStr?: string | null): string {
  return formatDate(dateStr, 'DD.MM.YYYY');
}

/**
 * Robust date parser converting user-formatted strings into ISO 8601 strings.
 */
export function parseFormattedDateToIso(
  dateStr: string,
  format: DateFormatOption = DEFAULT_DATE_FORMAT
): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();

  // If already standard ISO YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Written month format check: "Oct 14, 2026" or "14 Oct 2026"
  const writtenMatch1 = trimmed.match(/^([a-zA-Z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (writtenMatch1) {
    const mStr = writtenMatch1[1].slice(0, 3).toLowerCase();
    const month = MONTH_MAP[mStr];
    const day = parseInt(writtenMatch1[2], 10);
    const year = parseInt(writtenMatch1[3], 10);
    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  const writtenMatch2 = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]{3,})\s+(\d{4})$/);
  if (writtenMatch2) {
    const day = parseInt(writtenMatch2[1], 10);
    const mStr = writtenMatch2[2].slice(0, 3).toLowerCase();
    const month = MONTH_MAP[mStr];
    const year = parseInt(writtenMatch2[3], 10);
    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Split by common delimiters: dot, slash, dash
  const parts = trimmed.split(/[./-]/).map((p) => p.trim());
  if (parts.length === 3) {
    let day = 1;
    let month = 0;
    let year = 2026;

    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (format === 'MM/DD/YYYY') {
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else {
      // Default: DD.MM.YYYY or DD/MM/YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
  }

  return null;
}

/**
 * Backwards compatibility helper for parseDDMMYYYYtoIso
 */
export function parseDDMMYYYYtoIso(ddmmyyyy: string): string | null {
  return parseFormattedDateToIso(ddmmyyyy, 'DD.MM.YYYY');
}

/**
 * Returns today formatted in the specified date format.
 */
export function getTodayFormatted(format: DateFormatOption = DEFAULT_DATE_FORMAT): string {
  return formatDate(new Date(), format);
}

/**
 * Returns yesterday formatted in the specified date format.
 */
export function getYesterdayFormatted(format: DateFormatOption = DEFAULT_DATE_FORMAT): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d, format);
}

/**
 * Backwards compatibility helpers
 */
export function getTodayDDMMYYYY(): string {
  return getTodayFormatted('DD.MM.YYYY');
}

export function getYesterdayDDMMYYYY(): string {
  return getYesterdayFormatted('DD.MM.YYYY');
}

export function getRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nowDate.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  } catch {
    return '';
  }
}

export function getDaysDifference(
  startDateStr?: string | null,
  endDateStr?: string | null
): number | null {
  if (!startDateStr || !endDateStr) return null;
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffMs = end.getTime() - start.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  } catch {
    return null;
  }
}

export function getDurationLabel(
  startDateStr?: string | null,
  endDateStr?: string | null,
  isCompleted?: boolean
): string | null {
  if (!startDateStr) return null;

  if (endDateStr && isCompleted) {
    const days = getDaysDifference(startDateStr, endDateStr);
    if (days === null) return null;
    if (days === 0) return 'Completed on same day';
    if (days === 1) return 'Completed in 1 day';
    return `Completed in ${days} days`;
  }

  const days = getDaysDifference(startDateStr, new Date().toISOString());
  if (days === null) return null;
  if (days === 0) return 'Started today';
  if (days === 1) return 'Started yesterday (1 day)';
  return `Watching for ${days} days`;
}

export function formatRuntime(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

/**
 * Formats hour and minute into the specified time format (24h vs 12h).
 */
export function formatTime(
  hour: number,
  minute = 0,
  format: TimeFormatOption = DEFAULT_TIME_FORMAT
): string {
  const clampedHour = Math.max(0, Math.min(23, Math.floor(hour)));
  const clampedMin = Math.max(0, Math.min(59, Math.floor(minute)));
  const pad = (n: number) => String(n).padStart(2, '0');

  if (format === '24h') {
    return `${pad(clampedHour)}:${pad(clampedMin)}`;
  }
  const period = clampedHour >= 12 ? 'PM' : 'AM';
  const displayHour = clampedHour % 12 === 0 ? 12 : clampedHour % 12;
  return `${pad(displayHour)}:${pad(clampedMin)} ${period}`;
}

/**
 * Formats an hour integer (0-23) into the specified time format (24h vs 12h).
 */
export function formatHour(
  hour: number,
  format: TimeFormatOption = DEFAULT_TIME_FORMAT
): string {
  return formatTime(hour, 0, format);
}

/**
 * Calculates countdown information for unreleased titles or upcoming broadcast episodes.
 * Strictly text-based (no emojis).
 */
export function getCountdownInfo(
  dateInput?: string | Date | null,
  timezone?: string
): CountdownInfo {
  if (!dateInput) {
    return {
      status: 'released',
      daysDiff: 0,
      formattedCountdown: '',
      isUpcoming: false,
    };
  }

  try {
    const rawStr = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
    // Parse YYYY-MM-DD
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawStr);
    let targetYear: number;
    let targetMonth: number;
    let targetDay: number;

    if (match) {
      targetYear = parseInt(match[1], 10);
      targetMonth = parseInt(match[2], 10) - 1;
      targetDay = parseInt(match[3], 10);
    } else {
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) {
        return { status: 'released', daysDiff: 0, formattedCountdown: '', isUpcoming: false };
      }
      targetYear = parsed.getFullYear();
      targetMonth = parsed.getMonth();
      targetDay = parsed.getDate();
    }

    let nowYear: number;
    let nowMonth: number;
    let nowDay: number;

    try {
      const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
      const parts = formatter.formatToParts(new Date());
      nowYear = parseInt(parts.find((p) => p.type === 'year')?.value || '1970', 10);
      nowMonth = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10) - 1;
      nowDay = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
    } catch {
      const fallback = new Date();
      nowYear = fallback.getFullYear();
      nowMonth = fallback.getMonth();
      nowDay = fallback.getDate();
    }

    const todayMid = new Date(nowYear, nowMonth, nowDay).getTime();
    const targetMid = new Date(targetYear, targetMonth, targetDay).getTime();

    const diffMs = targetMid - todayMid;
    const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      return {
        status: 'released',
        daysDiff,
        formattedCountdown: 'Released',
        isUpcoming: false,
      };
    }

    if (daysDiff === 0) {
      return {
        status: 'today',
        daysDiff: 0,
        formattedCountdown: 'Today',
        isUpcoming: true,
      };
    }

    if (daysDiff === 1) {
      return {
        status: 'tomorrow',
        daysDiff: 1,
        formattedCountdown: 'Tomorrow',
        isUpcoming: true,
      };
    }

    if (daysDiff < 14) {
      return {
        status: 'upcoming',
        daysDiff,
        formattedCountdown: `In ${daysDiff} days`,
        isUpcoming: true,
      };
    }

    if (daysDiff < 60) {
      const weeks = Math.round(daysDiff / 7);
      return {
        status: 'upcoming',
        daysDiff,
        formattedCountdown: `In ${weeks} weeks`,
        isUpcoming: true,
      };
    }

    const months = Math.round(daysDiff / 30);
    return {
      status: 'upcoming',
      daysDiff,
      formattedCountdown: `In ${months} months`,
      isUpcoming: true,
    };
  } catch {
    return { status: 'released', daysDiff: 0, formattedCountdown: '', isUpcoming: false };
  }
}

