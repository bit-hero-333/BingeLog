import {
  DateFormatOption,
  DEFAULT_DATE_FORMAT,
  CountdownInfo,
  TimeFormatOption,
  DEFAULT_TIME_FORMAT,
  MediaStatus,
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
  statusOrCompleted?: MediaStatus | boolean | null,
  pausedDays = 0
): string | null {
  if (!startDateStr) return null;

  // Resolve media status
  let status: MediaStatus | undefined;
  if (typeof statusOrCompleted === 'boolean') {
    status = statusOrCompleted ? 'completed' : 'watching';
  } else if (statusOrCompleted) {
    status = statusOrCompleted;
  } else {
    status = endDateStr ? 'completed' : 'watching';
  }

  // If endDateStr is provided, calculate duration between startDate and endDate
  if (endDateStr) {
    const totalDays = getDaysDifference(startDateStr, endDateStr);
    if (totalDays === null) return null;
    const netDays = Math.max(0, totalDays - Math.max(0, pausedDays));

    if (status === 'dropped') {
      if (pausedDays > 0) {
        if (netDays === 0) return `Dropped on same day (${pausedDays}d paused)`;
        if (netDays === 1) return `Dropped after 1 active day (${pausedDays}d paused)`;
        return `Dropped after ${netDays} active days (${pausedDays}d paused)`;
      }
      if (netDays === 0) return 'Dropped on same day';
      if (netDays === 1) return 'Dropped after 1 day';
      return `Dropped after ${netDays} days`;
    }

    if (status === 'watching') {
      if (pausedDays > 0) {
        if (netDays === 0) return `Watched on same day (${pausedDays}d paused)`;
        if (netDays === 1) return `Watched for 1 active day (${pausedDays}d paused)`;
        return `Watched for ${netDays} active days (${pausedDays}d paused)`;
      }
      if (netDays === 0) return 'Watched on same day';
      if (netDays === 1) return 'Watched for 1 day';
      return `Watched for ${netDays} days`;
    }

    // Default / completed
    if (pausedDays > 0) {
      if (netDays === 0) return `Completed on same day (${pausedDays}d paused)`;
      if (netDays === 1) return `Completed in 1 active day (${pausedDays}d paused)`;
      return `Completed in ${netDays} active days (${pausedDays}d paused)`;
    }
    if (netDays === 0) return 'Completed on same day';
    if (netDays === 1) return 'Completed in 1 day';
    return `Completed in ${netDays} days`;
  }

  // When NO endDateStr is provided:
  // If status is NOT watching (e.g. dropped, completed, plan_to_watch), one is not watching it.
  if (status === 'dropped' || status === 'completed' || status === 'plan_to_watch') {
    return null;
  }

  if (status === 'on_hold') {
    const totalDays = getDaysDifference(startDateStr, new Date().toISOString());
    if (totalDays === null) return null;
    const netDays = Math.max(0, totalDays - Math.max(0, pausedDays));
    if (pausedDays > 0) {
      return `On hold: ${netDays} active days (${pausedDays}d paused)`;
    }
    return `On hold (${netDays} days)`;
  }

  // Active 'watching' status
  const totalDays = getDaysDifference(startDateStr, new Date().toISOString());
  if (totalDays === null) return null;
  const netDays = Math.max(0, totalDays - Math.max(0, pausedDays));
  if (pausedDays > 0) {
    return `Watching for ${netDays} active days (${pausedDays}d paused)`;
  }
  if (netDays === 0) return 'Started today';
  if (netDays === 1) return 'Started yesterday (1 day)';
  return `Watching for ${netDays} days`;
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
 * Formats a Date or ISO date string into a time string including seconds (HH:MM:SS), respecting 24h vs 12h.
 */
export function formatTimeWithSeconds(
  dateInput?: Date | string | null,
  format: TimeFormatOption = DEFAULT_TIME_FORMAT
): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const pad = (n: number) => String(n).padStart(2, '0');

  if (format === '24h') {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${pad(displayHour)}:${pad(m)}:${pad(s)} ${period}`;
}

/**
 * Combines a formatted date string with a time string (12h or 24h) into a standard ISO string.
 */
export function combineDateAndTimeToIso(
  dateStr?: string | null,
  timeStr?: string | null,
  dateFormat: DateFormatOption = DEFAULT_DATE_FORMAT
): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const baseIso = parseFormattedDateToIso(dateStr, dateFormat);
  if (!baseIso) return null;
  const d = new Date(baseIso);
  if (timeStr && timeStr.trim()) {
    const trimmed = timeStr.trim();
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const s = match12[3] ? parseInt(match12[3], 10) : 0;
      const period = match12[4].toUpperCase();
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      d.setHours(h, m, s, 0);
    } else if (match24) {
      const h = parseInt(match24[1], 10);
      const m = parseInt(match24[2], 10);
      const s = match24[3] ? parseInt(match24[3], 10) : 0;
      d.setHours(h, m, s, 0);
    }
  }
  return d.toISOString();
}

/**
 * Merges a newly chosen formatted date into an existing ISO string, preserving existing time components.
 */
export function updateIsoDate(
  existingIso: string | null | undefined,
  newDateFormatted: string,
  dateFormat: DateFormatOption = DEFAULT_DATE_FORMAT
): string {
  const parsedIso = parseFormattedDateToIso(newDateFormatted, dateFormat);
  if (!parsedIso) return new Date().toISOString();
  const newDate = new Date(parsedIso);
  if (existingIso) {
    const oldDate = new Date(existingIso);
    if (!isNaN(oldDate.getTime())) {
      newDate.setHours(
        oldDate.getHours(),
        oldDate.getMinutes(),
        oldDate.getSeconds(),
        oldDate.getMilliseconds()
      );
    }
  }
  return newDate.toISOString();
}

/**
 * Updates the hour and minute (and optional second) of an existing ISO string, preserving date components.
 */
export function updateIsoTime(
  existingIso: string | null | undefined,
  hour: number,
  minute: number,
  second: number = 0
): string {
  const base = existingIso ? new Date(existingIso) : new Date();
  const d = isNaN(base.getTime()) ? new Date() : base;
  d.setHours(hour, minute, second, 0);
  return d.toISOString();
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

/**
 * Determines whether a tracked media item is unreleased (has not yet premiered or released).
 * Strictly text-based (zero emojis).
 */
export function isTrackedItemUnreleased(
  item: {
    mediaType: string;
    releaseDate?: string;
    regionalReleaseDate?: string;
    releaseYear?: string;
    nextEpisode?: { seasonNumber?: number; episodeNumber?: number; airDate?: string };
  },
  timezone?: string
): boolean {
  // 1. Primary release / premiere date check
  const premiereDateStr =
    item.mediaType === 'movie'
      ? item.regionalReleaseDate || item.releaseDate
      : item.releaseDate;

  if (premiereDateStr) {
    const countdown = getCountdownInfo(premiereDateStr, timezone);
    // If countdown indicates the date is strictly in the future (daysDiff > 0)
    if (countdown.daysDiff > 0) {
      return true;
    }
  }

  // 2. Check if releaseYear itself is a full ISO or YYYY-MM-DD date
  if (item.releaseYear && item.releaseYear.includes('-') && item.releaseYear.length >= 10) {
    const countdown = getCountdownInfo(item.releaseYear, timezone);
    if (countdown.daysDiff > 0) {
      return true;
    }
  }

  // 3. Year check: If item has a future release year (e.g. "2027", "2028")
  if (item.releaseYear) {
    const match = /^(\d{4})/.exec(item.releaseYear.trim());
    if (match) {
      const yearNum = parseInt(match[1], 10);
      const currentYear = new Date().getFullYear();
      if (yearNum > currentYear) {
        return true;
      }
    }
  }

  // 4. For TV shows: if Season 1 Episode 1 has a future air date
  if (item.mediaType === 'tv' && item.nextEpisode) {
    const sNum = item.nextEpisode.seasonNumber;
    const eNum = item.nextEpisode.episodeNumber;
    if ((sNum === 1 || sNum === undefined) && (eNum === 1 || eNum === undefined) && item.nextEpisode.airDate) {
      const epCountdown = getCountdownInfo(item.nextEpisode.airDate, timezone);
      if (epCountdown.daysDiff > 0) {
        return true;
      }
    }
  }

  return false;
}

