/**
 * useAutoCheckin
 *
 * Watches the cook's scheduled check-in milestones and, when a scheduled
 * milestone time is reached AND a live probe reading is available, records
 * a check-in automatically — no user action required.
 *
 * Rules:
 *  - Only fires when cookStatus === "active".
 *  - Only fires within a ±2 minute tolerance window of the scheduled milestone.
 *  - Only fires when a probe reading is present (internalTempF != null).
 *  - Deduplicates against already-logged check-ins (by phaseKey).
 *  - Never fires for the same phase key twice in the same app session (session ref guard).
 *  - Does NOT replace manual check-ins — the modal and FAB still work as before.
 */

import { useEffect, useRef, useCallback } from "react";
import { useCreateCookCheckin } from "@workspace/api-client-react";
import type { ScheduledCheckin } from "@/constants/checkinKnowledge";
import type { CookCheckin } from "@workspace/api-client-react";

/** ±2 minutes tolerance window for milestone matching (ms). */
const AUTO_CHECKIN_TOLERANCE_MS = 2 * 60 * 1000;

/** Maximum age of a probe reading considered "fresh" (ms). */
const PROBE_FRESH_MS = 60 * 1000;

export interface AutoCheckinProbeReading {
  internalTempF: number | null;
  pitTempF?: number | null;
  probeSource: "meater" | "thermoworks";
  fetchedAtMs: number;
}

export interface UseAutoCheckinOptions {
  cookId: number | null | undefined;
  cookStatus: string | undefined;
  scheduledCheckins: ScheduledCheckin[];
  existingCheckins: CookCheckin[];
  probeReading: AutoCheckinProbeReading | null;
  onAutoCheckinFired: (opts: {
    phaseKey: string;
    phaseLabel: string;
    internalTempF: number;
    pitTempF: number | null;
  }) => void;
}

export function useAutoCheckin({
  cookId,
  cookStatus,
  scheduledCheckins,
  existingCheckins,
  probeReading,
  onAutoCheckinFired,
}: UseAutoCheckinOptions): void {
  const createCheckin = useCreateCookCheckin();

  /**
   * Session-level guard: phase keys that have already been auto-fired in
   * this app session (even before the server-side checkins list refreshes).
   * Prevents double-firing during the brief window between optimistic fire
   * and the next query invalidation cycle completing.
   */
  const firedKeysRef = useRef<Set<string>>(new Set());

  /**
   * Track the last cook ID so we reset the fired set when the user
   * navigates between different cooks.
   */
  const lastCookIdRef = useRef<number | null | undefined>(undefined);
  if (lastCookIdRef.current !== cookId) {
    firedKeysRef.current = new Set();
    lastCookIdRef.current = cookId;
  }

  const onAutoCheckinFiredRef = useRef(onAutoCheckinFired);
  onAutoCheckinFiredRef.current = onAutoCheckinFired;

  const existingCheckinsRef = useRef(existingCheckins);
  existingCheckinsRef.current = existingCheckins;

  const checkAndFire = useCallback(async () => {
    if (!cookId || cookStatus !== "active") return;
    if (!probeReading || probeReading.internalTempF == null) return;

    const nowMs = Date.now();

    const readingAge = nowMs - probeReading.fetchedAtMs;
    if (readingAge > PROBE_FRESH_MS) return;

    const internalTempF = probeReading.internalTempF;

    for (const sc of scheduledCheckins) {
      const diff = Math.abs(nowMs - sc.scheduledAt);
      if (diff > AUTO_CHECKIN_TOLERANCE_MS) continue;

      if (firedKeysRef.current.has(sc.phaseKey)) continue;

      const alreadyLogged = existingCheckinsRef.current.some(
        (ci) => ci.phaseKey === sc.phaseKey,
      );
      if (alreadyLogged) {
        firedKeysRef.current.add(sc.phaseKey);
        continue;
      }

      firedKeysRef.current.add(sc.phaseKey);

      try {
        await createCheckin.mutateAsync({
          id: cookId,
          data: {
            scheduledAt: new Date(sc.scheduledAt).toISOString(),
            internalTempF,
            pitTempF: probeReading.pitTempF ?? null,
            statusFlag: null,
            userNote: null,
            photoKey: null,
            aiGuidanceShown: null,
            isAutomatic: true,
            probeSource: probeReading.probeSource,
            phaseLabel: sc.phaseLabel,
            phaseKey: sc.phaseKey,
          },
        });

        onAutoCheckinFiredRef.current({
          phaseKey: sc.phaseKey,
          phaseLabel: sc.phaseLabel,
          internalTempF,
          pitTempF: probeReading.pitTempF ?? null,
        });
      } catch (err) {
        console.warn("[useAutoCheckin] auto check-in POST failed:", err);
        firedKeysRef.current.delete(sc.phaseKey);
      }

      break;
    }
  }, [cookId, cookStatus, scheduledCheckins, probeReading, createCheckin]);

  useEffect(() => {
    checkAndFire().catch(() => {});
  }, [checkAndFire]);
}
