import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { TrackedItem, MediaType } from '@/types/media';

export interface NotificationScheduleOptions {
  enabled?: boolean;
  hour?: number; // 0-23, default 9 (9:00 AM)
  daysAhead?: number; // default 0 (day of release)
  timezone?: string;
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
 * Computes deterministic identifier for an item's release notification.
 */
export function getNotificationIdentifier(mediaType: MediaType, id: number): string {
  return `pmt_release_${mediaType}_${id}`;
}

/**
 * Computes exact Date for target date string in specified timezone.
 * Returns null if the target time is in the past.
 */
export function calculateTriggerDate(
  dateStr?: string | null,
  hour = 9,
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
    const testDate = new Date(`${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:00:00Z`);
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

    const utcMillis = Date.UTC(year, month, day, hour, 0, 0) - offsetMinutes * 60 * 1000;
    const targetDate = new Date(utcMillis);

    // Only valid if in future
    if (targetDate.getTime() <= Date.now()) {
      return null;
    }
    return targetDate;
  } catch {
    const fallback = new Date(year, month, day, hour, 0, 0);
    if (fallback.getTime() <= Date.now()) {
      return null;
    }
    return fallback;
  }
}

/**
 * Schedules a local device release notification for a tracked item.
 * Strictly no emojis.
 */
export async function scheduleReleaseNotification(
  item: TrackedItem,
  options: NotificationScheduleOptions = {}
): Promise<string | null> {
  const identifier = getNotificationIdentifier(item.mediaType, item.id);

  // If item is not in active watchlist, ensure notification is canceled
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

  const hour = options.hour ?? 9;
  const daysAhead = options.daysAhead ?? 0;
  const triggerDate = calculateTriggerDate(dateStr, hour, daysAhead, options.timezone);

  if (!triggerDate) {
    // Release date is already in the past
    await cancelReleaseNotification(item.mediaType, item.id);
    return null;
  }

  // Cancel any existing notification for this item first
  await cancelReleaseNotification(item.mediaType, item.id);

  // Build clean notification content without emojis
  let title = '';
  let body = '';

  if (item.mediaType === 'movie') {
    title = daysAhead === 1 ? `Upcoming Movie: ${item.title}` : `Release Reminder: ${item.title}`;
    const typeLabel = item.regionalReleaseType ? ` (${item.regionalReleaseType})` : '';
    body =
      daysAhead === 1
        ? `"${item.title}" releases tomorrow${typeLabel}.`
        : `"${item.title}" releases today${typeLabel}.`;
  } else {
    title = daysAhead === 1 ? `Upcoming Episode: ${item.title}` : `New Episode: ${item.title}`;
    if (item.nextEpisode) {
      const epCode = `S${item.nextEpisode.seasonNumber} E${item.nextEpisode.episodeNumber}`;
      const epName = item.nextEpisode.name ? ` "${item.nextEpisode.name}"` : '';
      body =
        daysAhead === 1
          ? `${epCode}${epName} of "${item.title}" airs tomorrow.`
          : `${epCode}${epName} of "${item.title}" airs today.`;
    } else {
      body =
        daysAhead === 1
          ? `A new episode of "${item.title}" airs tomorrow.`
          : `A new episode of "${item.title}" airs today.`;
    }
  }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        data: {
          mediaId: item.id,
          mediaType: item.mediaType,
        },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'releases',
      },
    });
    return identifier;
  } catch (error) {
    console.warn(`Failed to schedule notification for ${item.title}`, error);
    return null;
  }
}

/**
 * Cancels a single item's release notification.
 */
export async function cancelReleaseNotification(
  mediaType: MediaType,
  id: number
): Promise<void> {
  const identifier = getNotificationIdentifier(mediaType, id);
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Non-fatal if identifier does not exist
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

  let scheduledCount = 0;
  const eligibleItems = items.filter(
    (i) => i.status === 'watching' || i.status === 'plan_to_watch'
  );

  for (const item of eligibleItems) {
    const res = await scheduleReleaseNotification(item, options);
    if (res) {
      scheduledCount++;
    }
  }

  return scheduledCount;
}

/**
 * Sends a test notification 3 seconds in the future to verify device notifications.
 * Strictly no emojis.
 */
export async function sendTestNotification(): Promise<boolean> {
  try {
    const perm = await getNotificationPermissions();
    if (perm !== 'granted') {
      const granted = await requestNotificationPermissions();
      if (!granted) return false;
    }

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
        seconds: 3,
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
