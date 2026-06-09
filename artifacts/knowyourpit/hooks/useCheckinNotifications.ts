import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  generateCheckinSchedule,
  getCheckinSchedule,
  CHECKIN_NOTIF_IDS_KEY_PREFIX,
  type AiCheckinItem,
  type ScheduledCheckin,
  type CheckinSequenceAnchor,
} from "@/constants/checkinKnowledge";
import { customFetch } from "@workspace/api-client-react";
import type { SequenceData } from "@/components/cook-detail/types";

// ---------------------------------------------------------------------------
// In-process event emitter — signals that the persisted schedule changed
// ---------------------------------------------------------------------------

/** Listeners registered by useStoredScheduledCheckins instances. */
const _scheduleChangeListeners = new Set<() => void>();

/**
 * Fire after any write to the `_scheduled` AsyncStorage key so that
 * useStoredScheduledCheckins re-reads without needing a full remount.
 */
export function notifyCheckinScheduleChanged(): void {
  _scheduleChangeListeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Storage key constants
// ---------------------------------------------------------------------------

const CHECKIN_PHASE_MAP_SUFFIX = "_phasemap";
const CHECKIN_SCHEDULED_SUFFIX = "_scheduled";
/** Keys of phases that the user has explicitly dismissed/removed. */
const CHECKIN_REMOVED_SUFFIX = "_removed";

// ---------------------------------------------------------------------------
// Removed-phase persistence — source of truth for "user deleted this reminder"
// ---------------------------------------------------------------------------

/**
 * Load the set of phase keys that the user has removed for a given cook.
 * Returns an empty Set on failure or when nothing has been removed.
 */
export async function loadRemovedCheckinPhaseKeys(cookId: number): Promise<Set<string>> {
  if (Platform.OS === "web") return new Set();
  try {
    const key = `${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}${CHECKIN_REMOVED_SUFFIX}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? new Set<string>(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Persist a phase key as "removed" for this cook so future scheduling passes
 * can filter it out even after app restarts.
 */
async function persistRemovedCheckinPhaseKey(cookId: number, phaseKey: string): Promise<void> {
  try {
    const key = `${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}${CHECKIN_REMOVED_SUFFIX}`;
    const stored = await AsyncStorage.getItem(key);
    const current: string[] = stored ? JSON.parse(stored) : [];
    if (!current.includes(phaseKey)) {
      await AsyncStorage.setItem(key, JSON.stringify([...current, phaseKey]));
    }
  } catch (err) {
    console.warn("[checkin] persistRemovedCheckinPhaseKey failed:", err);
  }
}

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

async function storeCheckinNotificationIds(
  cookId: number,
  ids: string[],
  phaseMap: Record<string, string>,
  checkins: ScheduledCheckin[],
): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [`${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}`, JSON.stringify(ids)],
      [`${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}${CHECKIN_PHASE_MAP_SUFFIX}`, JSON.stringify(phaseMap)],
      [`${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}${CHECKIN_SCHEDULED_SUFFIX}`, JSON.stringify(checkins)],
    ]);
    notifyCheckinScheduleChanged();
  } catch (err) {
    console.warn("[checkin] storeCheckinNotificationIds failed:", err);
  }
}

/**
 * Cancel only the scheduled notification for a single phase key.
 * Removes the notification from the device, updates persisted schedule state,
 * and records the phaseKey as "removed" so future rescheduling passes skip it.
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

    const scheduledKey = `${CHECKIN_NOTIF_IDS_KEY_PREFIX}${cookId}${CHECKIN_SCHEDULED_SUFFIX}`;
    const notifId = phaseMap[phaseKey];
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId).catch((err) => {
        console.warn("[checkin] cancelCheckinNotificationForPhase failed:", err);
      });
      delete phaseMap[phaseKey];
      const updatedIds = ids.filter((id) => id !== notifId);
      const [scheduledStr] = await AsyncStorage.multiGet([scheduledKey]).then((p) => p.map((x) => x[1]));
      const storedCheckins: ScheduledCheckin[] = scheduledStr ? JSON.parse(scheduledStr) : [];
      const updatedCheckins = storedCheckins.filter((sc) => sc.phaseKey !== phaseKey);
      await AsyncStorage.multiSet([
        [mapKey, JSON.stringify(phaseMap)],
        [idsKey, JSON.stringify(updatedIds)],
        [scheduledKey, JSON.stringify(updatedCheckins)],
      ]);
      notifyCheckinScheduleChanged();
    }

    // Persist the removal so future rescheduling passes never recreate this reminder.
    await persistRemovedCheckinPhaseKey(cookId, phaseKey);
  } catch (err) {
    console.warn("[checkin] cancelCheckinNotificationForPhase error:", err);
  }
}

export async function scheduleCheckinNotifications(
  cookId: number,
  checkins: ScheduledCheckin[],
  foodType: string | null | undefined,
  isCurrent: () => boolean,
  aiCheckins?: AiCheckinItem[] | null,
): Promise<void> {
  // Always filter out phases the user has explicitly removed before scheduling.
  const removedKeys = await loadRemovedCheckinPhaseKeys(cookId);
  const toSchedule = removedKeys.size > 0
    ? checkins.filter((sc) => !removedKeys.has(sc.phaseKey))
    : checkins;

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

  for (const checkin of toSchedule) {
    if (!isCurrent()) return;
    if (checkin.scheduledAt <= now) continue;

    // Resolve the best coaching note for this check-in.
    // AI check-ins use the personalized note from sequenceData.aiCheckins;
    // static phase check-ins fall back to the phase's coachingTemplate;
    // if neither is available, use a generic reminder.
    const aiCheckinIndexMatch = /^ai_checkin_(\d+)$/.exec(checkin.phaseKey);
    const aiCoachingNote = aiCheckinIndexMatch
      ? (aiCheckins?.[parseInt(aiCheckinIndexMatch[1], 10)]?.coachingNote ?? null)
      : null;
    const notifBody =
      aiCoachingNote ??
      (checkin.phase.coachingTemplate || null) ??
      `PitMaster wants to check on your ${label} — tap to log temps and get coaching.`;

    try {
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Check-in: ${checkin.phaseLabel}`,
          body: notifBody,
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

  if (isCurrent()) await storeCheckinNotificationIds(cookId, ids, phaseMap, toSchedule.filter(sc => !isNaN(sc.scheduledAt)));
}

// ---------------------------------------------------------------------------
// Adaptive rescheduling — call after a check-in is saved
// ---------------------------------------------------------------------------

/**
 * After a check-in is saved, recompute the remaining notification schedule
 * based on actual vs expected temperature progress.  Cancels old notifications
 * and schedules adjusted ones in their place.
 * Phases that the user has explicitly removed are never recreated.
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
  aiCheckins?: AiCheckinItem[] | null;
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
    aiCheckins,
  } = opts;

  const meatOnAtMs = new Date(meatOnAt).getTime();
  const estimatedFinishAtMs = new Date(estimatedFinishAt).getTime();
  const nowMs = Date.now();

  if (estimatedFinishAtMs <= meatOnAtMs) return;

  // Load user-removed phase keys so they are never recreated on reschedule.
  const removedKeys = await loadRemovedCheckinPhaseKeys(cookId);

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
    (sc) =>
      !completedPhaseKeys.has(sc.phaseKey) &&
      !removedKeys.has(sc.phaseKey) &&
      sc.scheduledAt > nowMs,
  );

  let gen = 0;
  const isCurrent = () => gen === 0;
  await scheduleCheckinNotifications(cookId, upcoming, foodType, isCurrent, aiCheckins);
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Schedule smart check-in notifications anchored to the AI plan milestones.
 * Cancels and reschedules whenever the cook status or sequence data changes.
 * Returns the scheduled checkins filtered by user-removed phases.
 */
export function useCheckinNotifications(
  cookId: number | null | undefined,
  cookStatus: string | undefined,
  cookSeqData: SequenceData | null | undefined,
): ScheduledCheckin[] {
  const generationRef = useRef(0);
  const [scheduledCheckins, setScheduledCheckins] = useState<ScheduledCheckin[]>([]);

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
      setScheduledCheckins([]);
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

      // Load removed keys up-front so the UI never shows dismissed reminders.
      const removedKeys = await loadRemovedCheckinPhaseKeys(cookId);

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
      const aiCheckins = cookSeqData?.aiCheckins ?? null;
      await scheduleCheckinNotifications(cookId, checkins, foodType, isCurrent, aiCheckins);
      // Expose only the non-removed, still-future checkins to the UI.
      const nowMs = Date.now();
      if (isCurrent()) {
        setScheduledCheckins(
          checkins.filter((sc) => !removedKeys.has(sc.phaseKey) && sc.scheduledAt > nowMs),
        );
      }
    })().catch(() => {});
  }, [cookId, cookStatus, depKey]);

  return scheduledCheckins;
}

/**
 * Returns the set of ScheduledCheckin items that are currently scheduled on
 * this device for the given cook. Reads from AsyncStorage (persisted by
 * scheduleCheckinNotifications) so the UI reflects the actual device state
 * rather than a re-generated estimate. Returns an empty array on web or
 * when no schedule has been persisted yet.
 *
 * Re-reads automatically when rescheduleCheckinNotifications or
 * cancelCheckinNotificationForPhase updates the stored schedule, so the
 * Home card countdown refreshes without requiring a remount.
 */
export function useStoredScheduledCheckins(
  cookId: number | null | undefined,
): ScheduledCheckin[] {
  const [checkins, setCheckins] = useState<ScheduledCheckin[]>([]);

  const readFromStorage = useCallback(
    (id: number) => {
      const key = `${CHECKIN_NOTIF_IDS_KEY_PREFIX}${id}${CHECKIN_SCHEDULED_SUFFIX}`;
      AsyncStorage.getItem(key)
        .then((stored) => {
          setCheckins(stored ? (JSON.parse(stored) as ScheduledCheckin[]) : []);
        })
        .catch(() => setCheckins([]));
    },
    [],
  );

  useEffect(() => {
    if (!cookId || Platform.OS === "web") {
      setCheckins([]);
      return;
    }

    // Initial read
    readFromStorage(cookId);

    // Re-read whenever the persisted schedule is updated by any scheduling call
    const handleChange = () => readFromStorage(cookId);
    _scheduleChangeListeners.add(handleChange);
    return () => {
      _scheduleChangeListeners.delete(handleChange);
    };
  }, [cookId, readFromStorage]);

  return checkins;
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
