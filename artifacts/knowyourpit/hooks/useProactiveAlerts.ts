import { useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { createCookEvent } from "@workspace/api-client-react";

export interface ProactiveAlertOptions {
  cookId: number | null | undefined;
  cookStatus: string | undefined;
  probeInternalTempF: number | null | undefined;
  pitTempF: number | null | undefined;
  targetCookTempF: number | null | undefined;
  /** Mid-point of the current checkin phase's expected internal temp range. */
  expectedInternalTempF: number | null | undefined;
  foodType: string | null | undefined;
}

interface FiredState {
  spike: boolean;
  stall: boolean;
  pitDrop: boolean;
}

const SPIKE_THRESHOLD_F = 10;
const PIT_DROP_THRESHOLD_F = 30;
// Stall: <3 °F change over the WINDOW most-recent readings
const STALL_WINDOW = 4;
const STALL_THRESHOLD_F = 3;

/**
 * Stall zone per meat type (°F).
 * The stall alert only fires when the internal temp is inside this range,
 * avoiding false positives at cook start or near target temp.
 * Poultry cooks too fast / has too much surface area to stall meaningfully.
 * The sentinel [0, 0] means "no stall zone — never fire stall alert".
 */
const MEAT_STALL_RANGE_F: Record<string, readonly [number, number]> = {
  brisket:          [148, 180],
  "pork shoulder":  [145, 175],
  "pork butt":      [145, 175],
  ribs:             [140, 170],
  "baby back ribs": [140, 165],
  "spare ribs":     [145, 170],
  lamb:             [145, 172],
  chicken:          [0, 0],
  turkey:           [0, 0],
};

const DEFAULT_STALL_RANGE: readonly [number, number] = [135, 185];

function getMeatStallRange(foodType: string | null | undefined): readonly [number, number] {
  if (!foodType) return DEFAULT_STALL_RANGE;
  return MEAT_STALL_RANGE_F[foodType.toLowerCase().trim()] ?? DEFAULT_STALL_RANGE;
}

function safeScheduleNotification(
  title: string,
  body: string,
  cookId: number,
  alertMessage: string,
): void {
  if (Platform.OS === "web") return;
  Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { proactiveAlert: true, cookId, alertMessage },
    },
    trigger: null,
  }).catch(() => {});
}

function safePostEvent(cookId: number, note: string): void {
  createCookEvent(cookId, { eventType: "proactive_alert", note }).catch(() => {});
}

/**
 * Hook that detects deviation conditions and fires proactive local
 * notifications + server events.
 *
 * Spike detection compares against the midpoint of the current checkin
 * phase's expected internal temp range — not the cook's final target temp.
 *
 * Stall detection uses a rolling window of the last STALL_WINDOW readings
 * rather than a single delta, AND gates on a meat-type-specific stall zone
 * so it only fires during the known collagen-melting temperature range.
 * Poultry never triggers a stall alert (sentinel range [0, 0]).
 *
 * Each alert type fires at most once per cook to avoid notification spam.
 */
export function useProactiveAlerts() {
  const firedRef = useRef<FiredState>({ spike: false, stall: false, pitDrop: false });
  const tempWindowRef = useRef<number[]>([]);

  const check = useCallback((opts: ProactiveAlertOptions) => {
    const {
      cookId, cookStatus, probeInternalTempF, pitTempF,
      targetCookTempF, expectedInternalTempF, foodType,
    } = opts;

    if (!cookId || cookStatus !== "active") return;
    if (probeInternalTempF == null) return;

    const fired = firedRef.current;

    // Maintain rolling window
    const window = tempWindowRef.current;
    window.push(probeInternalTempF);
    if (window.length > STALL_WINDOW) window.shift();

    // 1. Internal temp spike — >SPIKE_THRESHOLD_F above phase-expected midpoint
    if (
      !fired.spike &&
      expectedInternalTempF != null &&
      probeInternalTempF > expectedInternalTempF + SPIKE_THRESHOLD_F
    ) {
      fired.spike = true;
      const overshoot = Math.round(probeInternalTempF - expectedInternalTempF);
      const note = `Internal temp is ${overshoot}°F above expected for this phase — possible runaway or stall ending.`;
      safeScheduleNotification(
        "🌡 Temp Running Hot",
        `${foodType ?? "Your cook"}: ${note}`,
        cookId,
        note,
      );
      safePostEvent(cookId, note);
    }

    // 2. Sustained stall — total range over last STALL_WINDOW readings is below
    //    threshold, probe is still below expected, AND probe is within the known
    //    stall zone for this meat type (prevents false positives near target temp
    //    or at the very start of a cook).
    if (!fired.stall && window.length >= STALL_WINDOW) {
      const windowMin = Math.min(...window);
      const windowMax = Math.max(...window);
      const spread = windowMax - windowMin;
      const belowTarget = probeInternalTempF < (expectedInternalTempF ?? 999);

      const [stallMin, stallMax] = getMeatStallRange(foodType);
      // stallMax === 0 is the "no-stall" sentinel for poultry
      const inStallZone =
        stallMax > stallMin &&
        probeInternalTempF >= stallMin &&
        probeInternalTempF <= stallMax;

      if (spread < STALL_THRESHOLD_F && belowTarget && inStallZone) {
        fired.stall = true;
        const note = `Internal temp has been stuck between ${Math.round(windowMin)}–${Math.round(windowMax)}°F for the last ${STALL_WINDOW} readings — stall is in progress.`;
        safeScheduleNotification(
          "⏸ Stall Detected",
          `${foodType ?? "Your cook"}: ${note}`,
          cookId,
          note,
        );
        safePostEvent(cookId, note);
      }
    }

    // 3. Pit temp drop — >PIT_DROP_THRESHOLD_F below target cook temp
    if (
      !fired.pitDrop &&
      pitTempF != null &&
      targetCookTempF != null &&
      targetCookTempF - pitTempF > PIT_DROP_THRESHOLD_F
    ) {
      fired.pitDrop = true;
      const drop = Math.round(targetCookTempF - pitTempF);
      const note = `Pit temp is ${drop}°F below target — check vents, fuel level, or add more charcoal.`;
      safeScheduleNotification(
        "📉 Pit Temp Dropping",
        `${foodType ?? "Your cook"}: ${note}`,
        cookId,
        note,
      );
      safePostEvent(cookId, note);
    }
  }, []);

  const reset = useCallback(() => {
    firedRef.current = { spike: false, stall: false, pitDrop: false };
    tempWindowRef.current = [];
  }, []);

  return { check, reset };
}
