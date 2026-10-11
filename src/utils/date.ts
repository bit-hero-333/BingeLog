export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return 'Not set';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return String(dateStr);
  }
}

export function formatDateDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return '';
  }
}

export function parseDDMMYYYYtoIso(ddmmyyyy: string): string | null {
  if (!ddmmyyyy) return null;
  const parts = ddmmyyyy.trim().split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day, 12, 0, 0);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return null;
}

export function getTodayDDMMYYYY(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function getYesterdayDDMMYYYY(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function getRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    // Normalize to date without time for day comparison
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

  // Still watching / in progress
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
