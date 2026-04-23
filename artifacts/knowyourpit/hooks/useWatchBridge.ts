/**
 * useWatchBridge
 *
 * Phone-side bridge between KnowYourPit and the Apple Watch.
 *
 * Responsibilities:
 *   1. Poll /api/meater/readings and /api/cooks every 15 s (active cook) or
 *      60 s (idle) — cadence derived from each fresh API response
 *   2. Detect temperature stalls (probe temp flat for 30+ min)
 *   3. Push all data to the Watch via WatchConnectivity.updateApplicationContext
 *   4. Handle incoming Watch messages (stopCook, startCook, markDone, etc.)
 *   5. Forward PitMaster questions to /api/ai/chat and push the answer back
 *
 * Call this hook once inside the app root (inside ClerkProvider +
 * QueryClientProvider). It is a no-op on Android and web.
 */

import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Cook } from "@workspace/api-client-react";
import { WatchConnectivity } from "../modules/watch-connectivity";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALL_DELTA_F = 2;
const STALL_DURATION_MS = 30 * 60 * 1000;
const ACTIVE_POLL_MS = 15_000;
const IDLE_POLL_MS = 60_000;

const FUEL_TIMER_STORAGE_KEY = "knowyourpit:fuelTimer";

const DEFAULT_FUEL_TIMER = {
  intervalMinutes: 60,
  fuelType: "Apple Wood",
} as const;

async function readFuelTimerConfig(): Promise<typeof DEFAULT_FUEL_TIMER> {
  try {
    const raw = await AsyncStorage.getItem(FUEL_TIMER_STORAGE_KEY);
    if (!raw) return DEFAULT_FUEL_TIMER;
    return { ...DEFAULT_FUEL_TIMER, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FUEL_TIMER;
  }
}

export async function saveFuelTimerConfig(
  config: Partial<typeof DEFAULT_FUEL_TIMER>
): Promise<void> {
  const current = await readFuelTimerConfig();
  await AsyncStorage.setItem(
    FUEL_TIMER_STORAGE_KEY,
    JSON.stringify({ ...current, ...config })
  );
}

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface StallWindow {
  firstSeenAt: number;
  tempF: number;
}

interface MeaterProbe {
  internalTempF: number;
  ambientTempF: number;
}

interface MeaterReadings {
  probes?: MeaterProbe[];
}

interface AiChatResponse {
  reply?: string;
  suggestions?: string[];
}

interface HomeInsightsResponse {
  tips?: string[];
  pitMasterScore?: number;
  scoreLabel?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWatchBridge() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const stallWindowRef = useRef<StallWindow | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiBase =
    process.env.EXPO_PUBLIC_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "");

  // -------------------------------------------------------------------------
  // Authenticated fetch — always includes Clerk bearer token
  // -------------------------------------------------------------------------

  const apiFetch = useCallback(
    async <T>(path: string, options?: RequestInit): Promise<T> => {
      const token = await getToken();
      const resp = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers ?? {}),
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} – ${path}`);
      return resp.json() as Promise<T>;
    },
    [apiBase, getToken]
  );

  // -------------------------------------------------------------------------
  // Stall detection (client-side; moves server-side in task #64)
  // -------------------------------------------------------------------------

  const detectStall = useCallback(
    (probeTempF: number): { isStalled: boolean; stalledForMinutes: number } => {
      const now = Date.now();
      const win = stallWindowRef.current;
      if (!win || Math.abs(probeTempF - win.tempF) > STALL_DELTA_F) {
        stallWindowRef.current = { firstSeenAt: now, tempF: probeTempF };
        return { isStalled: false, stalledForMinutes: 0 };
      }
      const elapsed = now - win.firstSeenAt;
      return {
        isStalled: elapsed >= STALL_DURATION_MS,
        stalledForMinutes: Math.floor(elapsed / 60_000),
      };
    },
    []
  );

  // -------------------------------------------------------------------------
  // Main data push — builds and sends the full applicationContext to the Watch
  // Returns whether an active cook was found (drives next poll delay)
  // -------------------------------------------------------------------------

  const pushToWatch = useCallback(async (): Promise<boolean> => {
    if (!WatchConnectivity.isSupported()) return false;

    let hasActiveCook = false;

    try {
      // 1. Fetch cooks — use generated type
      const cooks = await apiFetch<Cook[]>("/api/cooks").catch(() => [] as Cook[]);
      const activeCook = cooks.find((c) => c.status === "active") ?? null;
      const plannedCook = !activeCook
        ? (cooks.find((c) => c.status === "planned") ?? null)
        : null;
      const cook = activeCook ?? plannedCook;

      hasActiveCook = activeCook !== null;

      // Invalidate query cache so the app UI stays fresh
      if (hasActiveCook) {
        queryClient.invalidateQueries({ queryKey: ["cooks"] });
      }

      // 2. MEATER readings
      let probeTempF: number | undefined;
      let ambientTempF: number | undefined;
      let stall = { isStalled: false, stalledForMinutes: 0 };

      if (activeCook) {
        try {
          const meater = await apiFetch<MeaterReadings>("/api/meater/readings");
          const probe = meater.probes?.[0];
          if (probe) {
            probeTempF = probe.internalTempF;
            ambientTempF = probe.ambientTempF;
          }
        } catch {
          // MEATER not linked or offline — non-fatal
        }

        if (probeTempF !== undefined) {
          stall = detectStall(probeTempF);
        }
      } else {
        stallWindowRef.current = null;
      }

      // 3. PitMaster home insight (non-blocking)
      let pitMasterInsight = "Ask PitMaster what to do next.";
      try {
        const insights = await apiFetch<HomeInsightsResponse>("/api/ai/home-insights");
        // Endpoint returns { tips: string[], pitMasterScore, scoreLabel, ... }
        const firstTip = insights.tips?.[0];
        if (firstTip) pitMasterInsight = firstTip;
      } catch {
        // ignore
      }

      // 4. Build payloads
      const cookPayload = cook
        ? {
            id: String(cook.id),
            name: cook.foodType,
            status: cook.status,
            probeTempF: probeTempF ?? null,
            ambientTempF: ambientTempF ?? null,
            targetTempF: cook.targetTempF ?? null,
            elapsedMs: activeCook?.actualStartAt
              ? Date.now() - new Date(activeCook.actualStartAt).getTime()
              : null,
            estimatedRemainingMs: cook.plannedEndAt
              ? new Date(cook.plannedEndAt).getTime() - Date.now()
              : null,
          }
        : null;

      const stallPayload = {
        isStalled: stall.isStalled,
        stalledForMinutes: stall.stalledForMinutes,
        probeTempF: probeTempF ?? 0,
        targetTempF: activeCook?.targetTempF ?? 0,
      };

      // Fuel timer: read from AsyncStorage (phone-configurable; task #65 adds UI)
      const fuelConfig = await readFuelTimerConfig();

      await WatchConnectivity.updateApplicationContext({
        cook: cookPayload,
        stall: stallPayload,
        fuelTimer: {
          intervalMinutes: fuelConfig.intervalMinutes,
          elapsedMinutes: 0,
          fuelType: fuelConfig.fuelType,
        },
        pitMaster: {
          insight: pitMasterInsight,
          updatedAt: Date.now(),
        },
      });
    } catch {
      // Swallow — Watch retries on next poll
    }

    return hasActiveCook;
  }, [apiFetch, detectStall, queryClient]);

  // -------------------------------------------------------------------------
  // Polling loop — cadence driven by the fresh API result, not cached state
  // -------------------------------------------------------------------------

  const scheduleNextPoll = useCallback(async () => {
    const hasActive = await pushToWatch();
    const delay = hasActive ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    pollRef.current = setTimeout(scheduleNextPoll, delay);
  }, [pushToWatch]);

  // -------------------------------------------------------------------------
  // Handle incoming messages from the Watch
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!WatchConnectivity.isSupported()) return;

    const sub = WatchConnectivity.addMessageListener(async ({ message }) => {
      const action = message.action as string | undefined;

      switch (action) {
        case "stopCook": {
          const cookId = message.cookId as string;
          await apiFetch(`/api/cooks/${cookId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "completed" }),
          }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ["cooks"] });
          pushToWatch();
          break;
        }

        case "startCook": {
          const cookId = message.cookId as string;
          await apiFetch(`/api/cooks/${cookId}`, {
            method: "PATCH",
            body: JSON.stringify({
              status: "active",
              actualStartAt: new Date().toISOString(),
            }),
          }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ["cooks"] });
          pushToWatch();
          break;
        }

        case "markDone": {
          const cookId = message.cookId as string;
          await apiFetch(`/api/cooks/${cookId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "completed" }),
          }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ["cooks"] });
          pushToWatch();
          break;
        }

        case "pitMasterAsk": {
          const question = message.question as string;
          try {
            // POST /api/ai/chat → { reply, suggestions }
            const result = await apiFetch<AiChatResponse>("/api/ai/chat", {
              method: "POST",
              body: JSON.stringify({ message: question }),
            });
            await WatchConnectivity.sendMessage({
              action: "pitMasterResponse",
              response: result.reply ?? "No response from PitMaster.",
            });
          } catch {
            await WatchConnectivity.sendMessage({
              action: "pitMasterResponse",
              response: "Couldn't reach PitMaster. Check your connection.",
            });
          }
          break;
        }

        case "stallAction": {
          // "Wrap It" — log the action to the cook's notes field
          const cookId = message.cookId as string | undefined;
          const choice = message.choice as string | undefined;
          if (cookId && choice === "wrap") {
            const timestamp = new Date().toLocaleTimeString();
            await apiFetch(`/api/cooks/${cookId}`, {
              method: "PATCH",
              body: JSON.stringify({
                notes: `[${timestamp}] Stall detected — meat wrapped in butcher paper.`,
              }),
            }).catch(() => {});
          }
          // "Ride It Out" snooze is handled on the Watch (model.snoozeStall)
          break;
        }

        case "fuelAdded": {
          // Fuel addition is tracked locally on the Watch; no server write needed
          break;
        }

        case "refreshTemps": {
          pushToWatch();
          break;
        }
      }
    });

    return () => sub.remove();
  }, [apiFetch, pushToWatch, queryClient]);

  // -------------------------------------------------------------------------
  // Start polling on mount (no-op on non-iOS)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!WatchConnectivity.isSupported()) return;

    scheduleNextPoll();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [scheduleNextPoll]);
}
