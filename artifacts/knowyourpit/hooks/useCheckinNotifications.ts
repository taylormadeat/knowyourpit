import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  generateCheckinSchedule,
  getCheckinSchedule,
  CHECKIN_NOTIF_IDS_KEY_PREFIX,
  CHECKIN_AUTO_DISMISS_KEY,
  type ScheduledCheckin,
  type CheckinSequenceAnchor,
} from "@/constants/checkinKnowledge";
import { customFetch } from "@workspace/api-client-react";
import type { SequenceData } from "@/components/cook-detail/types";

// ---------------------------------------------------------------------------
// Internal scheduling helpers
// ---------------------------------------------------------------------------

export async function cancelStoredCheckinNotifications(cookId: number): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const key = `${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      await Promise.all(
        ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch((err) => {
          console.warn("[checkin] cancel notification failed:", err);
        })),
      );
      await AsyncStorage.removeItem(key);
    }
  } catch (err) {
    console.warn("[checkin] cancelStoredCheckinNotifications failed:", err);
  }
}

const CHECKIN_PHASE_MAP_SUFFIX = "_phasemap";

async function storeCheckinNotificationIds(
  cookId: number,
  ids: string[],
  phaseMap: Record<string, string>,
): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [`${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}`, JSON.stringify(ids)],
      [`${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}${CHECKIN_PHASE_MAP_SUFFIX}`, JSON.stringify(phaseMap)],
    ]);
  } catch (err) {
    console.warn("[checkin] storeCheckinNotificationIds failed:", err);
  }
}

/**
 * Cancel only the scheduled notification for a single phase key.
 * Removes the notification from the device and updates persisted state.
 */
export async function cancelCheckinNotificationForPhase(
  cookId: number,
  phaseKey: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const mapKey = `${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}${CHECKIN_PHASE_MAP_SUFFIX}`;
    const idsKey = `${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}`;

    const [mapStr, idsStr] = await AsyncStorage.multiGet([mapKey, idsKey]).then(
      (pairs) => pairs.map((p) => p[1]),
    );

    const phaseMap: Record<string, string> = mapStr ? JSON.parse(mapStr) : {};
    const ids: string[] = idsStr ? JSON.parse(idsStr) : [];

    const notifId = phaseMap[phaseKey];
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId).catch((err) => {
        console.warn("[checkin] cancelCheckinNotificationForPhase failed:", err);
      });
      delete phaseMap[phaseKey];
      const updatedIds = ids.filter((id) => id !== notifId);
      await AsyncStorage.multiSet([
        [mapKey, JSON.stringify(phaseMap)],
        [idsKey, JSON.stringify(updatedIds)],
      ]);
    }
  } catch (err) {
    console.warn("[checkin] cancelCheckinNotificationForPhase error:", err);
  }
}

export async function scheduleCheckinNotifications(
  cookId: number,
  checkins: ScheduledCheckin[],
  foodType: string | null | undefined,
  isCurrent: () => boolean,
): Promise<void> {
  await cancelStoredCheckinNotifications(cookId);
  if (!isCurrent()) return;

  const { status } = await Notifications.getPermissionsAsync().catch(() => ({
    status: "undetermined" as const,
  }));
  if (status !== "granted") return;

  const now = Date.now();
  const ids: string[] = [];
  const phaseMap: Record<string, string> = {};
  const label = foodType ?? "your cook";

  for (const checkin of checkins) {
    if (!isCurrent()) return;
    if (checkin.scheduledAt <= now) continue;

    try {
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Check-in: ${checkin.phaseLabel}`,
          body: `PitMaster wants to check on your ${label} — tap to log temps and get coaching.`,
          sound: true,
          data: {
            checkin: true,
            cookId,
            phaseKey: checkin.phaseKey,
            phaseLabel: checkin.phaseLabel,
            scheduledAt: checkin.scheduledAt,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(checkin.scheduledAt),
        },
      });

      if (isCurrent()) {
        ids.push(notifId);
        phaseMap[checkin.phaseKey] = notifId;
      } else {
        Notifications.cancelScheduledNotificationAsync(notifId).catch((err) => {
          console.warn("[checkin] cancel superseded notification failed:", err);
        });
        return;
      }
    } catch (err) {
      console.warn("[checkin] schedule notification failed:", err);
    }
  }

  if (isCurrent()) await storeCheckinNotificationIds(cookId, ids, phaseMap);
}

// ---------------------------------------------------------------------------
// Adaptive rescheduling — call after a check-in is saved
// ---------------------------------------------------------------------------

/**
 * After a check-in is saved, recompute the remaining notification schedule
 * based on actual vs expected temperature progress.  Cancels old notifications
 * and schedules adjusted ones in their place.
 */
export async function rescheduleCheckinNotifications(opts: {
  cookId: number;
  foodType: string | null | undefined;
  weightLbs: number | null | undefined;
  meatOnAt: string;
  estimatedFinishAt: string;
  wrapAtMinutes: number | null | undefined;
  completedPhaseKeys: Set<string>;
  actualInternalTempF: number | null;
}): Promise<void> {
  if (Platform.OS === "web") return;
  const {
    cookId,
    foodType,
    weightLbs,
    meatOnAt,
    estimatedFinishAt,
    wrapAtMinutes,
    completedPhaseKeys,
    actualInternalTempF,
  } = opts;

  const meatOnAtMs = new Date(meatOnAt).getTime();
  const estimatedFinishAtMs = new Date(estimatedFinishAt).getTime();
  const nowMs = Date.now();

  if (estimatedFinishAtMs <= meatOnAtMs) return;

  const anchor: CheckinSequenceAnchor = {
    meatOnAt,
    estimatedFinishAt,
    wrapAtMinutes: wrapAtMinutes ?? null,
  };

  // Generate base schedule then apply adaptive adjustments
  const baseSchedule = generateCheckinSchedule(foodType, meatOnAtMs, estimatedFinishAtMs, anchor, weightLbs);

  let adjustedSchedule = baseSchedule;
  if (actualInternalTempF != null) {
    const { rescheduleCheckins } = await import("@/constants/checkinKnowledge");
    adjustedSchedule = rescheduleCheckins(
      baseSchedule,
      completedPhaseKeys,
      actualInternalTempF,
      nowMs,
      estimatedFinishAtMs,
    );
  }

  const upcoming = adjustedSchedule.filter(
    (sc) => !completedPhaseKeys.has(sc.phaseKey) && sc.scheduledAt > nowMs,
  );

  let gen = 0;
  const isCurrent = () => gen === 0;
  await scheduleCheckinNotifications(cookId, upcoming, foodType, isCurrent);
}

// ---------------------------------------------------------------------------
// Auto-dismiss evaluation (pure logic — no API calls; save via mutation)
// ---------------------------------------------------------------------------

export interface AutoDismissEvaluation {
  shouldDismiss: boolean;
  reason: string;
}

export async function evaluateAutoDismiss(opts: {
  probeInternalTempF: number | null;
  lastCheckinInternalTempF: number | null;
  expectedRange: [number, number] | null;
  stallThresholdF?: number;
}): Promise<AutoDismissEvaluation> {
  const enabled = await AsyncStorage.getItem(CHECKIN_AUTO_DISMISS_KEY).catch(() => null);
  if (enabled !== "1") return { shouldDismiss: false, reason: "disabled" };

  const { probeInternalTempF, lastCheckinInternalTempF, expectedRange, stallThresholdF = 3 } = opts;

  if (probeInternalTempF == null) {
    return { shouldDismiss: false, reason: "no_probe_data" };
  }

  const stall =
    lastCheckinInternalTempF != null &&
    Math.abs(probeInternalTempF - lastCheckinInternalTempF) < stallThresholdF;
  if (stall) return { shouldDismiss: false, reason: "stall_detected" };

  if (expectedRange != null) {
    const [lo, hi] = expectedRange;
    if (probeInternalTempF < lo - 10 || probeInternalTempF > hi + 10) {
      return { shouldDismiss: false, reason: "out_of_range" };
    }
  }

  return { shouldDismiss: true, reason: "ok" };
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Schedule smart check-in notifications anchored to the AI plan milestones.
 * Cancels and reschedules whenever the cook status or sequence data changes.
 */
export function useCheckinNotifications(
  cookId: number | null | undefined,
  cookStatus: string | undefined,
  cookSeqData: SequenceData | null | undefined,
): void {
  const generationRef = useRef(0);

  const firstScheduleItem = cookSeqData?.schedule?.[0];
  const depKey = JSON.stringify({
    cookId,
    cookStatus,
    meatOnAt: firstScheduleItem?.meatOnAt ?? null,
    estimatedFinishAt: firstScheduleItem?.estimatedFinishAt ?? null,
    foodType: firstScheduleItem?.foodType ?? null,
    wrapAtMinutes: firstScheduleItem?.wrapAtMinutes ?? null,
  });

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!cookId) return;

    const gen = ++generationRef.current;
    const isCurrent = () => generationRef.current === gen;

    if (cookStatus !== "active") {
      cancelStoredCheckinNotifications(cookId).catch(() => {});
      return;
    }

    const schedule = cookSeqData?.schedule;
    if (!schedule?.length) return;

    const first = schedule[0];
    if (!first.meatOnAt || !first.estimatedFinishAt) return;

    const meatOnAtMs = new Date(first.meatOnAt).getTime();
    const estimatedFinishAtMs = new Date(first.estimatedFinishAt).getTime();
    const foodType = first.foodType ?? null;

    const anchor: CheckinSequenceAnchor = {
      meatOnAt: first.meatOnAt,
      estimatedFinishAt: first.estimatedFinishAt,
      wrapAtMinutes: first.wrapAtMinutes ?? null,
    };

    // Fetch schedule from the server (single source of truth for timing).
    // Fall back to client-side generation when the request fails or is empty.
    (async () => {
      if (!isCurrent()) return;

      let checkins: ScheduledCheckin[];
      try {
        const serverData = await customFetch<
          Array<{ phaseKey: string; phaseLabel: string; scheduledAt: string; anchorType: string }>
        >(`/api/cooks/${cookId}/checkins/schedule`);

        if (!Array.isArray(serverData) || serverData.length === 0) {
          throw new Error("empty");
        }
        if (!isCurrent()) return;

        const meatSchedule = getCheckinSchedule(foodType);
        const mapped = serverData
          .map((item) => {
            const phase =
              meatSchedule.phases.find((p) => p.key === item.phaseKey) ??
              meatSchedule.phases[0];
            return {
              id: `${item.phaseKey}_srv`,
              phaseKey: item.phaseKey,
              phaseLabel: item.phaseLabel,
              scheduledAt: new Date(item.scheduledAt).getTime(),
              phase,
            };
          })
          .filter((sc) => !isNaN(sc.scheduledAt));

        checkins = mapped;
      } catch (err) {
        // Server unavailable or cook has no AI plan — use client-side schedule
        console.warn("[checkin] server schedule fetch failed, falling back to client schedule:", err);
        const weightLbs =
          typeof first.weightLbs === "number" ? first.weightLbs : null;
        checkins = generateCheckinSchedule(foodType, meatOnAtMs, estimatedFinishAtMs, anchor, weightLbs);
      }

      if (!isCurrent()) return;
      await scheduleCheckinNotifications(cookId, checkins, foodType, isCurrent);
    })().catch(() => {});
  }, [cookId, cookStatus, depKey]);
}

/**
 * Listens for notification taps. When a check-in notification is tapped for
 * the correct cook (cookId must match), calls `onCheckinOpen` with the phase
 * data. This handles the foreground case where the user is already on the
 * cook detail screen; the background/lock-screen case is handled by the
 * app-level router in _layout.tsx via the pending notification store.
 */
export function useCheckinDeepLink(
  cookId: number | null,
  onCheckinOpen: (data: { phaseKey: string; phaseLabel: string; scheduledAt: number }) => void,
): void {
  const onOpenRef = useRef(onCheckinOpen);
  onOpenRef.current = onCheckinOpen;
  const cookIdRef = useRef(cookId);
  cookIdRef.current = cookId;

  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (
        data?.checkin === true &&
        typeof data.phaseKey === "string" &&
        typeof data.scheduledAt === "number" &&
        typeof data.cookId === "number" &&
        data.cookId === cookIdRef.current
      ) {
        onOpenRef.current({
          phaseKey: data.phaseKey,
          phaseLabel: typeof data.phaseLabel === "string" ? data.phaseLabel : data.phaseKey,
          scheduledAt: data.scheduledAt,
        });
      }
    });

    return () => sub.remove();
  }, []);
}
