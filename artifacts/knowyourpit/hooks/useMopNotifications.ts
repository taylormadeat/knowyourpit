import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QP_MOP_FREQUENCIES, type QpMopFrequency } from "@/constants/cookQuickPicks";

const STORAGE_KEY_PREFIX = "mop_notif_ids_cook_";

export function parseMopIntervalMinutes(freq: string): number | null {
  switch (freq as QpMopFrequency) {
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

async function cancelStoredMopNotifications(cookId: number): Promise<void> {
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

async function scheduleMopNotifications(
  cookId: number,
  mopFrequency: string,
  schedule: ScheduleItem[],
  cookFoodType: string | null | undefined,
  isCurrent: () => boolean,
): Promise<void> {
  await cancelStoredMopNotifications(cookId);
  if (!isCurrent()) return;

  const intervalMinutes = parseMopIntervalMinutes(mopFrequency);
  if (!intervalMinutes) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
  } catch {
    return;
  }

  const now = Date.now();
  const intervalMs = intervalMinutes * 60_000;
  const ids: string[] = [];

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
    if (!cookFoodType && item.foodType) itemLabel = item.foodType;
  }

  if (!windowStartMs || !windowEndMs || windowEndMs <= windowStartMs) return;

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
            title: "Time to Mop!",
            body: `${itemLabel} — mop reminder (every ${intervalLabel})`,
            sound: true,
            data: { mopReminder: true, cookId },
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

interface MopScheduleData {
  schedule?: ScheduleItem[];
}

export function useMopNotifications(
  cookId: number | null | undefined,
  cookStatus: string | undefined,
  mopFrequency: string | null | undefined,
  cookFoodType: string | null | undefined,
  cookSeqData: MopScheduleData | null | undefined,
): void {
  const scheduleKey = JSON.stringify(cookSeqData?.schedule ?? null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!cookId) return;

    const gen = ++generationRef.current;
    const isCurrent = () => generationRef.current === gen;

    const intervalMinutes = mopFrequency ? parseMopIntervalMinutes(mopFrequency) : null;
    const isSchedulable = cookStatus === "active" && !!intervalMinutes;

    if (!isSchedulable) {
      cancelStoredMopNotifications(cookId).catch(() => {});
      return;
    }

    const schedule = cookSeqData?.schedule ?? [];
    scheduleMopNotifications(cookId, mopFrequency!, schedule, cookFoodType, isCurrent).catch(
      () => {},
    );
  }, [cookId, cookStatus, mopFrequency, cookFoodType, scheduleKey]);
}

export function computeNextMopMs(
  mopFrequency: string | null | undefined,
  cookSeqData: MopScheduleData | null | undefined,
  nowMs: number,
): number | null {
  if (!mopFrequency) return null;
  const intervalMinutes = parseMopIntervalMinutes(mopFrequency);
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
  let candidateMs = windowStartMs + intervalMs;
  while (candidateMs < windowEndMs) {
    if (candidateMs > nowMs) return candidateMs;
    candidateMs += intervalMs;
  }

  return null;
}

export { cancelStoredMopNotifications };
