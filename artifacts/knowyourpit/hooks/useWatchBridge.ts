/**
 * useWatchBridge
 *
 * The phone-side bridge between the KnowYourPit app and the Apple Watch.
 *
 * Responsibilities:
 *   1. Poll /api/meater/readings and /api/cooks every 15 s (active cook) or 60 s (idle)
 *   2. Detect temperature stalls (probe temp flat for 30+ min)
 *   3. Push all data to the Watch via WatchConnectivity.updateApplicationContext
 *   4. Handle incoming Watch messages (stopCook, startCook, markDone, pitMasterAsk, etc.)
 *   5. Forward PitMaster questions to the AI chat endpoint and push the answer back
 *
 * Call this hook once at the app root (e.g. in _layout.tsx) when signed in.
 * It is a no-op on Android and web.
 */

import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { WatchConnectivity } from "../modules/watch-connectivity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StallWindow {
  firstSeenAt: number;   // ms epoch when we first saw this temp
  tempF: number;
}

const STALL_DELTA = 2;          // °F — if temp moves less than this it's stalled
const STALL_DURATION_MS = 30 * 60 * 1000;   // 30 min
const ACTIVE_POLL_MS = 15_000;
const IDLE_POLL_MS = 60_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWatchBridge() {
  const queryClient = useQueryClient();
  const stallWindowRef = useRef<StallWindow | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "";

  // -------------------------------------------------------------------------
  // Helpers — fetching from the API with the user's auth token
  // -------------------------------------------------------------------------

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const resp = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers ?? {}),
        },
        credentials: "include",
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      return resp.json();
    },
    [apiBase]
  );

  // -------------------------------------------------------------------------
  // Stall detection
  // -------------------------------------------------------------------------

  const detectStall = useCallback(
    (probeTempF: number): { isStalled: boolean; stalledForMinutes: number } => {
      const now = Date.now();
      const win = stallWindowRef.current;

      if (!win || Math.abs(probeTempF - win.tempF) > STALL_DELTA) {
        // Temp moved — reset window
        stallWindowRef.current = { firstSeenAt: now, tempF: probeTempF };
        return { isStalled: false, stalledForMinutes: 0 };
      }

      const elapsed = now - win.firstSeenAt;
      const isStalled = elapsed >= STALL_DURATION_MS;
      return { isStalled, stalledForMinutes: Math.floor(elapsed / 60_000) };
    },
    []
  );

  // -------------------------------------------------------------------------
  // Main push — build context and send to Watch
  // -------------------------------------------------------------------------

  const pushToWatch = useCallback(async () => {
    if (!WatchConnectivity.isSupported()) return;

    try {
      // 1. Fetch active cook
      const cooks: any[] = await apiFetch("/api/cooks").catch(() => []);
      const activeCook = cooks.find((c: any) => c.status === "active");
      const plannedCook = !activeCook ? cooks.find((c: any) => c.status === "planned") : null;
      const cook = activeCook ?? plannedCook;

      // 2. Fetch MEATER readings (only meaningful when cook is active)
      let probeTempF: number | undefined;
      let ambientTempF: number | undefined;
      let stall = { isStalled: false, stalledForMinutes: 0 };

      if (activeCook) {
        try {
          const meaterData = await apiFetch("/api/meater/readings");
          const probes: any[] = meaterData?.probes ?? [];
          const firstProbe = probes[0];
          if (firstProbe) {
            probeTempF = firstProbe.internalTempF;
            ambientTempF = firstProbe.ambientTempF;
          }
        } catch {
          // MEATER not linked or offline — ignore
        }

        if (probeTempF !== undefined) {
          stall = detectStall(probeTempF);
        }
      } else {
        stallWindowRef.current = null;
      }

      // 3. Fetch PitMaster insight
      let pitMasterInsight = "Ask PitMaster what to do next.";
      try {
        const homeInsights = await apiFetch("/api/ai/home-insights");
        if (homeInsights?.insight) pitMasterInsight = homeInsights.insight;
      } catch {
        // Non-critical
      }

      // 4. Build context payload
      const cookPayload = cook
        ? {
            id: cook.id,
            name: cook.name,
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

      const pitMasterPayload = {
        insight: pitMasterInsight,
        updatedAt: Date.now(),
      };

      await WatchConnectivity.updateApplicationContext({
        cook: cookPayload,
        stall: stallPayload,
        pitMaster: pitMasterPayload,
      });
    } catch (err) {
      // Push failures are silent — Watch retries on next wake
    }
  }, [apiFetch, detectStall]);

  // -------------------------------------------------------------------------
  // Polling loop
  // -------------------------------------------------------------------------

  const scheduleNextPoll = useCallback(async () => {
    await pushToWatch();

    const cooks: any[] = queryClient.getQueryData(["cooks"]) ?? [];
    const hasActiveCook = cooks.some((c: any) => c.status === "active");
    const delay = hasActiveCook ? ACTIVE_POLL_MS : IDLE_POLL_MS;

    pollRef.current = setTimeout(scheduleNextPoll, delay);
  }, [pushToWatch, queryClient]);

  // -------------------------------------------------------------------------
  // Handle incoming messages from the Watch (e.g. stopCook, pitMasterAsk)
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
            body: JSON.stringify({ status: "active", actualStartAt: new Date().toISOString() }),
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
            const result = await apiFetch("/api/ai/chat", {
              method: "POST",
              body: JSON.stringify({ message: question }),
            });
            const answer = result?.response ?? result?.message ?? "No response";
            await WatchConnectivity.sendMessage({ action: "pitMasterResponse", response: answer });
          } catch {
            await WatchConnectivity.sendMessage({
              action: "pitMasterResponse",
              response: "Couldn't reach PitMaster. Check your connection.",
            });
          }
          break;
        }

        case "fuelAdded": {
          // Log the fuel addition to the active cook's timeline on the server
          const cookId = message.cookId as string | undefined;
          const fuelType = message.fuelType as string;
          if (cookId) {
            await apiFetch(`/api/cooks/${cookId}/notes`, {
              method: "POST",
              body: JSON.stringify({ note: `Added ${fuelType}` }),
            }).catch(() => {});
          }
          break;
        }

        case "stallAction": {
          const choice = message.choice as string; // "wrap" | "ride"
          const cookId = message.cookId as string | undefined;
          if (cookId) {
            await apiFetch(`/api/cooks/${cookId}/notes`, {
              method: "POST",
              body: JSON.stringify({ note: choice === "wrap" ? "Wrapped in butcher paper" : "Riding out the stall" }),
            }).catch(() => {});
          }
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
  // Start polling on mount
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
