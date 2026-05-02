import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ScheduleItem {
  foodType?: string;
  grillLightAt?: string | null;
  meatOnAt?: string | null;
  estimatedFinishAt?: string | null;
  restMinutes?: number;
  wrapMethod?: string | null;
  wrapAtMinutes?: number | null;
}

interface SequenceData {
  schedule: ScheduleItem[];
}

const STORAGE_KEY_PREFIX = "schedule_step_notif_ids_cook_";

const STEP_LABELS: Record<string, string> = {
  grillLight: "Light the Grill",
  meatOn: "Meat On",
  wrap: "Wrap",
  pullOff: "Pull Off",
  serve: "Serve",
};

async function cancelStoredStepNotifications(cookId: number): Promise<void> {
  try {
    const key = `${STORAGE_KEY_PREFIX}${cookId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      await Promise.all(
        ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
      );
      await AsyncStorage.removeItem(key);
    }
  } catch {
  }
}

async function scheduleStepNotifications(
  cookId: number,
  schedule: ScheduleItem[],
  isCurrent: () => boolean,
): Promise<void> {
  await cancelStoredStepNotifications(cookId);
  if (!isCurrent()) return;

  const now = Date.now();
  const ids: string[] = [];

  for (let idx = 0; idx < schedule.length; idx++) {
    if (!isCurrent()) return;
    const item = schedule[idx];
    const itemLabel = item.foodType ?? `Item ${idx + 1}`;

    const steps: Array<{ key: string; ms: number | null; label?: string }> = [
      { key: "grillLight", ms: item.grillLightAt ? new Date(item.grillLightAt).getTime() : null },
      { key: "meatOn", ms: item.meatOnAt ? new Date(item.meatOnAt).getTime() : null },
      { key: "pullOff", ms: item.estimatedFinishAt ? new Date(item.estimatedFinishAt).getTime() : null },
    ];

    // Wrap is only schedulable when we have an explicit minute offset; the
    // "around the stall" inference used in the timeline is too imprecise to
    // fire a real-time push.
    if (
      item.wrapMethod &&
      item.wrapMethod !== "none" &&
      (item.wrapAtMinutes ?? 0) > 0 &&
      item.meatOnAt
    ) {
      const wrapLabel =
        item.wrapMethod === "foil"
          ? "Wrap in foil"
          : item.wrapMethod === "butcher_paper"
            ? "Wrap in butcher paper"
            : "Wrap";
      steps.push({
        key: "wrap",
        ms: new Date(item.meatOnAt).getTime() + (item.wrapAtMinutes ?? 0) * 60_000,
        label: wrapLabel,
      });
    }

    if ((item.restMinutes ?? 0) > 0 && item.estimatedFinishAt) {
      steps.push({
        key: "serve",
        ms: new Date(item.estimatedFinishAt).getTime() + (item.restMinutes ?? 0) * 60_000,
      });
    }

    for (const { key, ms, label } of steps) {
      if (ms === null || ms <= now) continue;
      const title = label ?? STEP_LABELS[key] ?? key;
      try {
        const notifId = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body: `${itemLabel} — ${title}`,
            sound: true,
            data: { scheduleStep: true, cookId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(ms),
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
  }

  if (!isCurrent()) return;

  try {
    const key = `${STORAGE_KEY_PREFIX}${cookId}`;
    await AsyncStorage.setItem(key, JSON.stringify(ids));
  } catch {
  }
}

export function useScheduleStepNotifications(
  cookId: number | null | undefined,
  cookStatus: string | undefined,
  cookSeqData: SequenceData | null | undefined,
): void {
  const scheduleKey = JSON.stringify(cookSeqData?.schedule ?? null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!cookId) return;

    const gen = ++generationRef.current;
    const isCurrent = () => generationRef.current === gen;

    if (cookStatus !== "active" || !cookSeqData?.schedule?.length) {
      cancelStoredStepNotifications(cookId).catch(() => {});
      return;
    }

    scheduleStepNotifications(cookId, cookSeqData.schedule, isCurrent).catch(() => {});
  }, [cookId, cookStatus, scheduleKey]);
}
