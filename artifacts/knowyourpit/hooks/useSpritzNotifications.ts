import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QP_SPRITZ_FREQUENCIES, type QpSpritzFrequency } from "@/constants/cookQuickPicks";

const STORAGE_KEY_PREFIX = "spritz_notif_ids_cook_";

/**
 * Parse a QpSpritzFrequency label into an interval in minutes, or null when
 * the frequency cannot be expressed as a fixed repeating interval (e.g.
 * "As Needed", "Once at Stall", "No Spritz").
 */
export function parseIntervalMinutes(freq: string): number | null {
  switch (freq as QpSpritzFrequency) {
    case "Every 30 min":
      return 30;
    case "Every Hour":
      return 60;
    case "Every 2 Hours":
      return 120;
    default:
      return null;
  }
}

interface ScheduleItem {
  foodType?: string | null;
  meatOnAt?: string | null;
  estimatedFinishAt?: string | null;
}

async function cancelStoredSpritzNotifications(cookId: number): Promise<void> {
  try {
    const key = `${STORAGE_KEY_PREFIX}${cookId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      await Promise.all(
        ids.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
        ),
      );
      await AsyncStorage.removeItem(key);
    }
  } catch {
  }
}

async function scheduleSpritzNotifications(
  cookId: number,
  spritzFrequency: string,
  schedule: ScheduleItem[],
  cookFoodType: string | null | undefined,
  isCurrent: () => boolean,
): Promise<void> {
  await cancelStoredSpritzNotifications(cookId);
  if (!isCurrent()) return;

  const intervalMinutes = parseIntervalMinutes(spritzFrequency);
  if (!intervalMinutes) return;

  // Respect the user's notification preferences.
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
  } catch {
    return;
  }

  const now = Date.now();
  const intervalMs = intervalMinutes * 60_000;
  const ids: string[] = [];

  // Derive the overall window: earliest meatOnAt → latest estimatedFinishAt.
  let windowStartMs: number | null = null;
  let windowEndMs: number | null = null;
  let itemLabel = cookFoodType ?? "your cook";

  for (const item of schedule) {
    if (item.meatOnAt) {
      const ms = new Date(item.meatOnAt).getTime();
      if (windowStartMs === null || ms < windowStartMs) windowStartMs = ms;
    }
    if (item.estimatedFinishAt) {
      const ms = new Date(item.estimatedFinishAt).getTime();
      if (windowEndMs === null || ms > windowEndMs) windowEndMs = ms;
    }
    // Use the first item's foodType as a fallback label if no cook-level type.
    if (!cookFoodType && item.foodType) itemLabel = item.foodType;
  }

  // Nothing to schedule if we don't have a valid window.
  if (!windowStartMs || !windowEndMs || windowEndMs <= windowStartMs) return;

  // Schedule the first spritz at meatOnAt + 1 interval, then every interval
  // thereafter until estimatedFinishAt.
  let nextMs = windowStartMs + intervalMs;

  const intervalLabel =
    intervalMinutes < 60
      ? `${intervalMinutes} min`
      : intervalMinutes === 60
        ? "1 hr"
        : `${intervalMinutes / 60} hr`;

  while (nextMs < windowEndMs) {
    if (!isCurrent()) {
      await Promise.all(
        ids.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
        ),
      );
      return;
    }

    if (nextMs > now) {
      try {
        const notifId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "Time to Spritz!",
            body: `${itemLabel} — spritz reminder (every ${intervalLabel})`,
            sound: true,
            data: { spritzReminder: true, cookId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(nextMs),
          },
        });
        if (isCurrent()) {
          ids.push(notifId);
        } else {
          Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
          return;
        }
      } catch {
      }
    }

    nextMs += intervalMs;
  }

  if (!isCurrent()) {
    await Promise.all(
      ids.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
    ));
    return;
  }

  if (ids.length > 0) {
    try {
      const key = `${STORAGE_KEY_PREFIX}${cookId}`;
      await AsyncStorage.setItem(key, JSON.stringify(ids));
    } catch {
    }
  }
}

interface SpritzScheduleData {
  schedule?: ScheduleItem[];
}

/**
 * Schedules local push notifications at the cook's saved spritz interval so
 * the pitmaster is reminded to spritz even when the app is backgrounded.
 * Only fires for fixed-interval frequencies ("Every 30 min", "Every Hour",
 * "Every 2 Hours"). Notifications are cancelled when the cook leaves the
 * `active` state or when the spritz frequency changes.
 */
export function useSpritzNotifications(
  cookId: number | null | undefined,
  cookStatus: string | undefined,
  spritzFrequency: string | null | undefined,
  cookFoodType: string | null | undefined,
  cookSeqData: SpritzScheduleData | null | undefined,
): void {
  const scheduleKey = JSON.stringify(cookSeqData?.schedule ?? null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!cookId) return;

    const gen = ++generationRef.current;
    const isCurrent = () => generationRef.current === gen;

    const intervalMinutes = spritzFrequency ? parseIntervalMinutes(spritzFrequency) : null;
    const isSchedulable = cookStatus === "active" && !!intervalMinutes;

    if (!isSchedulable) {
      cancelStoredSpritzNotifications(cookId).catch(() => {});
      return;
    }

    const schedule = cookSeqData?.schedule ?? [];
    scheduleSpritzNotifications(cookId, spritzFrequency!, schedule, cookFoodType, isCurrent).catch(
      () => {},
    );
  }, [cookId, cookStatus, spritzFrequency, cookFoodType, scheduleKey]);
}

/**
 * Given a cook's spritz frequency and sequence data, computes the timestamp
 * (in ms) of the next upcoming spritz reminder relative to `nowMs`.
 * Returns null when:
 * - the frequency has no fixed interval (No Spritz / As Needed / Once at Stall)
 * - there is no valid cook window to schedule within
 * - there are no future spritz times before the estimated finish
 */
export function computeNextSpritzMs(
  spritzFrequency: string | null | undefined,
  cookSeqData: SpritzScheduleData | null | undefined,
  nowMs: number,
): number | null {
  if (!spritzFrequency) return null;
  const intervalMinutes = parseIntervalMinutes(spritzFrequency);
  if (!intervalMinutes) return null;

  const schedule = cookSeqData?.schedule ?? [];
  let windowStartMs: number | null = null;
  let windowEndMs: number | null = null;

  for (const item of schedule) {
    if (item.meatOnAt) {
      const ms = new Date(item.meatOnAt).getTime();
      if (windowStartMs === null || ms < windowStartMs) windowStartMs = ms;
    }
    if (item.estimatedFinishAt) {
      const ms = new Date(item.estimatedFinishAt).getTime();
      if (windowEndMs === null || ms > windowEndMs) windowEndMs = ms;
    }
  }

  if (!windowStartMs || !windowEndMs || windowEndMs <= windowStartMs) return null;

  const intervalMs = intervalMinutes * 60_000;
  // Walk forward from windowStartMs + 1 interval to find the next future spritz.
  let candidateMs = windowStartMs + intervalMs;
  while (candidateMs < windowEndMs) {
    if (candidateMs > nowMs) return candidateMs;
    candidateMs += intervalMs;
  }

  return null;
}

export { cancelStoredSpritzNotifications };
