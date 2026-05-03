import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface FrozenStageData {
  method?: "fridge" | "cold_water";
  thawStartAt?: string | null;
  // Meat fully thawed — also the start of the temper window. The planner
  // uses thawEndAt === temperStartAt by construction (see
  // components/plan-screen/frozenSchedule.ts), so we only persist this one
  // timestamp to avoid two sources of truth.
  thawEndAt?: string | null;
  foodType?: string | null;
}

interface SequenceWithFrozen {
  schedule?: unknown[];
  frozen?: FrozenStageData | null;
}

const STORAGE_KEY_PREFIX = "frozen_stage_notif_ids_cook_";

export async function cancelStoredFrozenNotifications(cookId: number): Promise<void> {
  if (Platform.OS === "web") return;
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

interface ScheduleArgs {
  cookId: number;
  frozen: FrozenStageData | null | undefined;
  preheatStartAt: string | null | undefined;
  foodType?: string | null;
  /**
   * Skip the preheat notification when the regular schedule-step hook will
   * already cover it (i.e. once the cook is active and grillLightAt fires
   * via useScheduleStepNotifications).
   */
  includePreheat: boolean;
  /**
   * Optional staleness check used by useFrozenStageNotifications so an older
   * concurrent run can't cancel notifications that a newer run already
   * scheduled. When this returns false, scheduling exits early without
   * touching AsyncStorage or pending notifications.
   */
  isCurrent?: () => boolean;
}

export async function scheduleFrozenStageNotifications({
  cookId,
  frozen,
  preheatStartAt,
  foodType,
  includePreheat,
  isCurrent,
}: ScheduleArgs): Promise<void> {
  if (Platform.OS === "web") return;
  const stillCurrent = isCurrent ?? (() => true);

  if (!stillCurrent()) return;
  await cancelStoredFrozenNotifications(cookId);
  if (!stillCurrent()) return;

  const hasFrozen = !!(frozen?.thawStartAt || frozen?.thawEndAt);
  if (!hasFrozen && !(includePreheat && preheatStartAt)) return;

  // Respect the user's notification preferences. Don't prompt — just skip
  // silently if permissions haven't been granted (the app requests them at
  // launch via _layout.tsx).
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
  } catch {
    return;
  }

  const now = Date.now();
  const ids: string[] = [];
  const label = foodType ?? frozen?.foodType ?? "your cook";

  const steps: Array<{ key: string; ms: number; title: string; body: string }> = [];

  if (frozen?.thawStartAt) {
    const ms = new Date(frozen.thawStartAt).getTime();
    const isColdWater = frozen.method === "cold_water";
    steps.push({
      key: "thawStart",
      ms,
      title: isColdWater ? "Start cold-water thaw" : "Move to fridge to thaw",
      body: isColdWater
        ? `${label}: submerge in cold water and change the water every 30 minutes.`
        : `${label}: move from the freezer to the fridge to start thawing.`,
    });
  }

  if (frozen?.thawEndAt) {
    const ms = new Date(frozen.thawEndAt).getTime();
    steps.push({
      key: "thawEnd",
      ms,
      title: "Meat fully thawed — start tempering",
      body: `${label}: pull from the fridge and rest on the counter to temper before the cook.`,
    });
  }

  if (includePreheat && preheatStartAt) {
    const ms = new Date(preheatStartAt).getTime();
    steps.push({
      key: "preheatStart",
      ms,
      title: "Start preheat",
      body: `${label}: light the grill and bring it up to cooking temperature.`,
    });
  }

  for (const step of steps) {
    if (!stillCurrent()) {
      // A newer run superseded us. Cancel anything we already queued so we
      // don't leak duplicate notifications, then bail without touching
      // storage (the newer run owns it now).
      await Promise.all(
        ids.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
        ),
      );
      return;
    }
    if (step.ms <= now) continue;
    try {
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: step.title,
          body: step.body,
          sound: true,
          data: { frozenStage: true, cookId, step: step.key },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(step.ms),
        },
      });
      ids.push(notifId);
    } catch {
    }
  }

  if (!stillCurrent()) {
    await Promise.all(
      ids.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
      ),
    );
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

export function useFrozenStageNotifications(
  cookId: number | null | undefined,
  cookStatus: string | undefined,
  sequenceData: SequenceWithFrozen | null | undefined,
  preheatStartAt: string | null | undefined,
): void {
  const frozen = sequenceData?.frozen ?? null;
  const depKey = JSON.stringify({
    method: frozen?.method ?? null,
    thawStartAt: frozen?.thawStartAt ?? null,
    thawEndAt: frozen?.thawEndAt ?? null,
    foodType: frozen?.foodType ?? null,
    preheatStartAt: preheatStartAt ?? null,
  });
  const generationRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!cookId) return;

    const gen = ++generationRef.current;
    const isCurrent = () => generationRef.current === gen;

    // Frozen alerts are only useful for upcoming cooks. Once a cook is
    // completed/cancelled (or any other terminal state) we cancel anything
    // still pending.
    if (cookStatus !== "planned" && cookStatus !== "active") {
      cancelStoredFrozenNotifications(cookId).catch(() => {});
      return;
    }

    // Avoid double-firing the preheat alert: useScheduleStepNotifications
    // already schedules grillLight while the cook is active.
    const includePreheat = cookStatus === "planned";

    scheduleFrozenStageNotifications({
      cookId,
      frozen,
      preheatStartAt,
      foodType: frozen?.foodType ?? null,
      includePreheat,
      isCurrent,
    }).catch(() => {});
  }, [cookId, cookStatus, depKey]);
}
