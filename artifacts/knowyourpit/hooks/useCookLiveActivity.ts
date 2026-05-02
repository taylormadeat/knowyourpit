import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { LiveActivity, type CookActivityState } from "live-activity";
import {
  useRegisterCookLiveActivity,
  useEndCookLiveActivity,
} from "@workspace/api-client-react";

interface UseCookLiveActivityArgs {
  cookId: number | null | undefined;
  status: string | null | undefined;
  meatLabel: string;
  startedAtIso: string | null | undefined;
  currentTempF: number | null | undefined;
  targetTempF: number | null | undefined;
  cookTempF: number | null | undefined;
}

/**
 * Owns the iOS Live Activity lifecycle for the cook detail screen.
 *
 * - When the cook becomes `active`, request a Live Activity (with push token).
 * - On every change of probe / target / pit temp, push an update to the
 *   running activity so the lock screen and Dynamic Island stay current.
 * - When the cook leaves the active state (completed / cancelled / unmount
 *   while active and id changes), end the activity and tell the server to
 *   stop pushing.
 *
 * Silently no-ops on Android, in Expo Go, and on iPhones that don't support
 * Live Activities.
 */
export function useCookLiveActivity({
  cookId,
  status,
  meatLabel,
  startedAtIso,
  currentTempF,
  targetTempF,
  cookTempF,
}: UseCookLiveActivityArgs) {
  const activityIdRef = useRef<string | null>(null);
  const ownerCookIdRef = useRef<number | null>(null);

  const registerToken = useRegisterCookLiveActivity();
  const endOnServer = useEndCookLiveActivity();

  // Forward push tokens to the server so background pushes (MEATER webhooks
  // etc.) can reach the activity even when the app is closed. Tokens can
  // rotate over the lifetime of an activity, so we listen for updates.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = LiveActivity.addPushTokenListener(({ activityId, pushToken }) => {
      const cid = ownerCookIdRef.current;
      if (cid == null) return;
      if (activityIdRef.current && activityIdRef.current !== activityId) return;
      registerToken.mutate({ id: cid, data: { activityId, pushToken } });
    });
    return () => sub.remove();
  }, [registerToken]);

  // Start / end the activity as the cook transitions in and out of "active".
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!LiveActivity.isSupported()) return;
    if (cookId == null) return;

    const isActive = status === "active";

    const startedAtSec = startedAtIso
      ? new Date(startedAtIso).getTime() / 1000
      : Date.now() / 1000;

    const stateNow: CookActivityState = {
      currentTempF: currentTempF ?? null,
      targetTempF: targetTempF ?? null,
      cookTempF: cookTempF ?? null,
      meatLabel,
      startedAtEpochSec: startedAtSec,
      status: isActive ? "active" : status === "cancelled" ? "cancelled" : "completed",
    };

    let cancelled = false;

    const start = async () => {
      const result = await LiveActivity.start(stateNow);
      if (cancelled) {
        // If we got cancelled mid-start, end the activity we just made.
        if (result?.activityId) await LiveActivity.end(result.activityId);
        return;
      }
      if (result?.activityId) {
        activityIdRef.current = result.activityId;
        ownerCookIdRef.current = cookId;
      }
    };

    if (isActive && (activityIdRef.current == null || ownerCookIdRef.current !== cookId)) {
      // Switching to a new active cook — end any prior activity from a
      // different cook before starting the new one.
      if (activityIdRef.current && ownerCookIdRef.current !== cookId) {
        const prevId = activityIdRef.current;
        const prevCook = ownerCookIdRef.current;
        activityIdRef.current = null;
        ownerCookIdRef.current = null;
        LiveActivity.end(prevId).catch(() => {});
        if (prevCook != null) endOnServer.mutate({ id: prevCook });
      }
      start();
    } else if (!isActive && activityIdRef.current) {
      const prevId = activityIdRef.current;
      const prevCook = ownerCookIdRef.current;
      activityIdRef.current = null;
      ownerCookIdRef.current = null;
      LiveActivity.end(prevId).catch(() => {});
      if (prevCook != null) endOnServer.mutate({ id: prevCook });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookId, status, startedAtIso, meatLabel]);

  // Stream temperature updates into the running activity. Kept on its own
  // effect so the start/end lifecycle isn't re-fired every poll.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const id = activityIdRef.current;
    if (!id) return;
    if (status !== "active") return;
    const startedAtSec = startedAtIso
      ? new Date(startedAtIso).getTime() / 1000
      : Date.now() / 1000;
    LiveActivity.update(id, {
      currentTempF: currentTempF ?? null,
      targetTempF: targetTempF ?? null,
      cookTempF: cookTempF ?? null,
      meatLabel,
      startedAtEpochSec: startedAtSec,
      status: "active",
    }).catch(() => {});
  }, [currentTempF, targetTempF, cookTempF, meatLabel, status, startedAtIso]);
}
