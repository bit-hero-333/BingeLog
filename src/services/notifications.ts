import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  TrackedItem,
  MediaType,
  NotificationTimingOption,
  TimeFormatOption,
} from '@/types/media';

export interface NotificationScheduleOptions {
  enabled?: boolean;
  hour?: number; // 0-23, default 9
  minute?: number; // 0-59, default 0
  daysAhead?: number; // default 0
  timing?: NotificationTimingOption; // 'release_day' | 'advance' | 'both', default 'both'
  timezone?: string;
  timeFormat?: TimeFormatOption;
}

/**
 * Configure foreground notification behavior and Android notification channel.
 * NO emojis are used anywhere in titles, descriptions, or messages.
 */
export async function initNotifications(): Promise<void> {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('releases', {
        name: 'Upcoming Releases',
        description: 'Device reminders for movie premieres and TV broadcast episodes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
        sound: 'default',
        showBadge: false,
      });
    }
  } catch (error) {
    console.error('Failed to initialize notifications', error);
  }
}

/**
 * Checks existing notification permissions on device.
 */
export async function getNotificationPermissions(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return 'granted';
    if (settings.status === 'denied') return 'denied';
    return 'undetermined';
  } catch (error) {
    console.warn('Failed to query notification permissions', error);
    return 'undetermined';
  }
}

/**
 * Prompts user for notification permissions on device.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request notification permissions', error);
    return false;
  }
}

/**
 * Deterministic identifier for an item's release-day notification.
 */
export function getReleaseNotificationIdentifier(mediaType: MediaType, id: number): string {
  return `pmt_rel_${mediaType}_${id}`;
}

/**
 * Deterministic identifier for an item's advance notification.
 */
export function getAdvanceNotificationIdentifier(mediaType: MediaType, id: number): string {
  return `pmt_adv_${mediaType}_${id}`;
}

/**
 * Legacy identifier helper for backwards compatibility.
 */
export function getLegacyNotificationIdentifier(mediaType: MediaType, id: number): string {
  return `pmt_release_${mediaType}_${id}`;
}

/**
 * Computes exact Date for target date string in specified timezone.
 * Returns null if the target time is in the past.
 */
export function calculateTriggerDate(
  dateStr?: string | null,
  hour = 9,
  minute = 0,
  daysAhead = 0,
  timezone?: string
): Date | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  let day = parseInt(match[3], 10);

  if (daysAhead > 0) {
    day -= daysAhead;
  }

  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const pad = (n: number) => String(n).padStart(2, '0');

  try {
    const testDate = new Date(`${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).formatToParts(testDate);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;

    let offsetMinutes = 0;
    if (tzPart) {
      const gmtMatch = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(tzPart);
      if (gmtMatch) {
        const sign = gmtMatch[1] === '-' ? -1 : 1;
        const h = parseInt(gmtMatch[2], 10);
        const m = gmtMatch[3] ? parseInt(gmtMatch[3], 10) : 0;
        offsetMinutes = sign * (h * 60 + m);
      }
    }

    const utcMillis = Date.UTC(year, month, day, hour, minute, 0) - offsetMinutes * 60 * 1000;
    const targetDate = new Date(utcMillis);

    // If target timestamp is strictly in the future, return it
    if (targetDate.getTime() > Date.now()) {
      return targetDate;
    }

    return null;
  } catch {
    const fallback = new Date(year, month, day, hour, minute, 0);
    if (fallback.getTime() > Date.now()) {
      return fallback;
    }
    return null;
  }
}

/**
 * Schedules local device release notifications for a tracked item.
 * Supports:
 * - On release day
 * - In advance (1, 2, 3, 7, 14 days, or custom)
 * - Both (in advance and on release day)
 * - Per-item custom reminder overrides via item.reminder
 * Strictly zero emojis.
 */
export async function scheduleReleaseNotification(
  item: TrackedItem,
  options: NotificationScheduleOptions = {}
): Promise<string[] | null> {
  // If item explicitly disabled reminders in its custom config, cancel and exit
  if (item.reminder && item.reminder.enabled === false) {
    await cancelReleaseNotification(item.mediaType, item.id);
    return null;
  }

  // If item is not in active watchlist, ensure notifications are canceled
  if (item.status !== 'watching' && item.status !== 'plan_to_watch') {
    await cancelReleaseNotification(item.mediaType, item.id);
    return null;
  }

  // Determine target release or broadcast air date
  let dateStr: string | undefined;
  if (item.mediaType === 'movie') {
    dateStr = item.regionalReleaseDate || item.releaseDate;
  } else {
    dateStr = item.nextAirDate || item.nextEpisode?.airDate;
  }

  if (!dateStr) {
    await cancelReleaseNotification(item.mediaType, item.id);
    return null;
  }

  // Resolve effective settings: item override takes priority over global settings
  const effectiveHour = item.reminder?.hour ?? options.hour ?? 9;
  const effectiveMinute = item.reminder?.minute ?? options.minute ?? 0;
  const effectiveTiming: NotificationTimingOption =
    item.reminder?.timing ?? options.timing ?? 'both';
  const effectiveDaysAhead = item.reminder?.daysAhead ?? options.daysAhead ?? 1;

  // Always cancel any existing scheduled alerts for this item first to prevent stale duplicates
  await cancelReleaseNotification(item.mediaType, item.id);

  const scheduledIds: string[] = [];

  // 1. Release Day Reminder
  if (effectiveTiming === 'release_day' || effectiveTiming === 'both') {
    const releaseTrigger = calculateTriggerDate(
      dateStr,
      effectiveHour,
      effectiveMinute,
      0,
      options.timezone
    );

    if (releaseTrigger) {
      const relId = getReleaseNotificationIdentifier(item.mediaType, item.id);
      let title = '';
      let body = '';

      if (item.mediaType === 'movie') {
        title = `Release Reminder: ${item.title}`;
        const typeLabel = item.regionalReleaseType ? ` (${item.regionalReleaseType})` : '';
        body = `"${item.title}" releases today${typeLabel}.`;
      } else {
        title = `New Episode: ${item.title}`;
        if (item.nextEpisode) {
          const epCode = `S${item.nextEpisode.seasonNumber} E${item.nextEpisode.episodeNumber}`;
          const epName = item.nextEpisode.name ? ` "${item.nextEpisode.name}"` : '';
          body = `${epCode}${epName} of "${item.title}" airs today.`;
        } else {
          body = `A new episode of "${item.title}" airs today.`;
        }
      }

      try {
        await Notifications.scheduleNotificationAsync({
          identifier: relId,
          content: {
            title,
            body,
            data: {
              mediaId: item.id,
              mediaType: item.mediaType,
              alertType: 'release_day',
            },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: releaseTrigger,
            channelId: 'releases',
          },
        });
        scheduledIds.push(relId);
      } catch (err) {
        console.warn(`Failed to schedule release notification for ${item.title}`, err);
      }
    }
  }

  // 2. Advance Reminder
  if ((effectiveTiming === 'advance' || effectiveTiming === 'both') && effectiveDaysAhead > 0) {
    const advanceTrigger = calculateTriggerDate(
      dateStr,
      effectiveHour,
      effectiveMinute,
      effectiveDaysAhead,
      options.timezone
    );

    if (advanceTrigger) {
      const advId = getAdvanceNotificationIdentifier(item.mediaType, item.id);
      let title = '';
      let body = '';

      const daysText =
        effectiveDaysAhead === 1
          ? 'tomorrow'
          : effectiveDaysAhead === 7
          ? 'in 1 week'
          : effectiveDaysAhead === 14
          ? 'in 2 weeks'
          : `in ${effectiveDaysAhead} days`;

      if (item.mediaType === 'movie') {
        title = `Upcoming Movie: ${item.title}`;
        const typeLabel = item.regionalReleaseType ? ` (${item.regionalReleaseType})` : '';
        body = `"${item.title}" releases ${daysText}${typeLabel}.`;
      } else {
        title = `Upcoming Episode: ${item.title}`;
        if (item.nextEpisode) {
          const epCode = `S${item.nextEpisode.seasonNumber} E${item.nextEpisode.episodeNumber}`;
          const epName = item.nextEpisode.name ? ` "${item.nextEpisode.name}"` : '';
          body = `${epCode}${epName} of "${item.title}" airs ${daysText}.`;
        } else {
          body = `A new episode of "${item.title}" airs ${daysText}.`;
        }
      }

      try {
        await Notifications.scheduleNotificationAsync({
          identifier: advId,
          content: {
            title,
            body,
            data: {
              mediaId: item.id,
              mediaType: item.mediaType,
              alertType: 'advance',
            },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: advanceTrigger,
            channelId: 'releases',
          },
        });
        scheduledIds.push(advId);
      } catch (err) {
        console.warn(`Failed to schedule advance notification for ${item.title}`, err);
      }
    }
  }

  return scheduledIds.length > 0 ? scheduledIds : null;
}

/**
 * Cancels all notifications for a specific item (release day, advance, and legacy).
 */
export async function cancelReleaseNotification(
  mediaType: MediaType,
  id: number
): Promise<void> {
  const relId = getReleaseNotificationIdentifier(mediaType, id);
  const advId = getAdvanceNotificationIdentifier(mediaType, id);
  const legacyId = getLegacyNotificationIdentifier(mediaType, id);

  try {
    await Promise.all([
      Notifications.cancelScheduledNotificationAsync(relId).catch(() => {}),
      Notifications.cancelScheduledNotificationAsync(advId).catch(() => {}),
      Notifications.cancelScheduledNotificationAsync(legacyId).catch(() => {}),
    ]);
  } catch {
    // Non-fatal
  }
}

/**
 * Cancels all scheduled release notifications created by BingeLog.
 */
export async function cancelAllReleaseNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const req of scheduled) {
      if (req.identifier.startsWith('pmt_')) {
        await Notifications.cancelScheduledNotificationAsync(req.identifier);
      }
    }
  } catch (error) {
    console.error('Failed to cancel notifications', error);
  }
}

/**
 * Counts currently scheduled notifications managed by BingeLog.
 */
export async function getScheduledNotificationsCount(): Promise<number> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.filter((req) => req.identifier.startsWith('pmt_')).length;
  } catch {
    return 0;
  }
}

/**
 * Synchronizes scheduled notifications for all tracked items.
 */
export async function syncAllReleaseReminders(
  items: TrackedItem[],
  options: NotificationScheduleOptions = {}
): Promise<number> {
  if (options.enabled === false) {
    await cancelAllReleaseNotifications();
    return 0;
  }

  const eligibleItems = items.filter(
    (i) => i.status === 'watching' || i.status === 'plan_to_watch'
  );

  for (const item of eligibleItems) {
    await scheduleReleaseNotification(item, options);
  }

  return await getScheduledNotificationsCount();
}

/**
 * Sends a test notification to verify device notifications.
 * Defaults to 10 seconds in the future so the user has time to lock their screen or exit the app.
 * Strictly zero emojis.
 */
export async function sendTestNotification(delaySeconds = 10): Promise<boolean> {
  try {
    const perm = await getNotificationPermissions();
    if (perm !== 'granted') {
      const granted = await requestNotificationPermissions();
      if (!granted) return false;
    }

    const safeSeconds = Math.max(1, delaySeconds);

    await Notifications.scheduleNotificationAsync({
      identifier: `pmt_test_${Date.now()}`,
      content: {
        title: 'BingeLog Test Alert',
        body: 'Device notifications for release days and broadcast air dates are active.',
        data: { type: 'test' },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: safeSeconds,
        channelId: 'releases',
      },
    });

    return true;
  } catch (error) {
    console.error('Failed to schedule test notification', error);
    return false;
  }
}

export const NotificationService = {
  init: initNotifications,
  getPermissions: getNotificationPermissions,
  requestPermissions: requestNotificationPermissions,
  scheduleRelease: scheduleReleaseNotification,
  cancelRelease: cancelReleaseNotification,
  cancelAll: cancelAllReleaseNotifications,
  getScheduledCount: getScheduledNotificationsCount,
  syncAll: syncAllReleaseReminders,
  sendTest: sendTestNotification,
};
