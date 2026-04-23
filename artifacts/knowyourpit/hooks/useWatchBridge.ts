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
 *   5. Forward PitMaster questions to /api/ai/chat and push the answer back
 *
 * Call this hook once at the app root (inside ClerkProvider + QueryClientProvider).
 * It is a no-op on Android and web.
 */

import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { WatchConnectivity } from "../modules/watch-connectivity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StallWindow {
  firstSeenAt: number;
  tempF: number;
}

const STALL_DELTA_F = 2;
const STALL_DURATION_MS = 30 * 60 * 1000;
const ACTIVE_POLL_MS = 15_000;
const IDLE_POLL_MS = 60_000;

// Default fuel timer sent to Watch until user configures it (task #65)
const DEFAULT_FUEL_TIMER = {
  intervalMinutes: 60,
  elapsedMinutes: 0,
  fuelType: "Apple Wood",
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWatchBridge() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const stallWindowRef = useRef<StallWindow | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "";

  // -------------------------------------------------------------------------
  // Authenticated API fetch — includes Clerk bearer token
  // -------------------------------------------------------------------------

  const apiFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const token = await getToken();
      const resp = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers ?? {}),
        },
      });
      if (!resp.ok) throw new Error(`${resp.status} ${path}`);
      return resp.json();
    },
    [apiBase, getToken]
  );

  // -------------------------------------------------------------------------
  // Stall detection
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
  // Push to Watch — builds and sends the full application context
  // -------------------------------------------------------------------------

  const pushToWatch = useCallback(async () => {
    if (!WatchConnectivity.isSupported()) return;

    try {
      // 1. Fetch cooks list
      const cooks: any[] = await apiFetch("/api/cooks").catch(() => []);
      const activeCook = cooks.find((c: any) => c.status === "active");
      const plannedCook = !activeCook
        ? cooks.find((c: any) => c.status === "planned")
        : null;
      const cook = activeCook ?? plannedCook ?? null;

      // 2. MEATER readings (only when a cook is active)
      let probeTempF: number | undefined;
      let ambientTempF: number | undefined;
      let stall = { isStalled: false, stalledForMinutes: 0 };

      if (activeCook) {
        try {
          const meaterData = await apiFetch("/api/meater/readings");
          const firstProbe = (meaterData?.probes as any[])?.[0];
          if (firstProbe) {
            probeTempF = firstProbe.internalTempF as number;
            ambientTempF = firstProbe.ambientTempF as number;
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

      // 3. PitMaster insight (non-critical, swallow errors)
      let pitMasterInsight = "Ask PitMaster what to do next.";
      try {
        const homeInsights = await apiFetch("/api/ai/home-insights");
        if (homeInsights?.insight) pitMasterInsight = homeInsights.insight as string;
      } catch {
        /* ignore */
      }

      // 4. Build payload
      const cookPayload = cook
        ? {
            id: cook.id as string,
            name: cook.name as string,
            status: cook.status as string,
            probeTempF: probeTempF ?? null,
            ambientTempF: ambientTempF ?? null,
            targetTempF: (cook.targetTempF as number | null | undefined) ?? null,
            elapsedMs: activeCook?.actualStartAt
              ? Date.now() - new Date(activeCook.actualStartAt as string).getTime()
              : null,
            estimatedRemainingMs: cook.plannedEndAt
              ? new Date(cook.plannedEndAt as string).getTime() - Date.now()
              : null,
          }
        : null;

      const stallPayload = {
        isStalled: stall.isStalled,
        stalledForMinutes: stall.stalledForMinutes,
        probeTempF: probeTempF ?? 0,
        targetTempF: (activeCook?.targetTempF as number | undefined) ?? 0,
      };

      // Fuel timer: use defaults until task #65 adds per-cook configuration
      const fuelTimerPayload = DEFAULT_FUEL_TIMER;

      const pitMasterPayload = {
        insight: pitMasterInsight,
        updatedAt: Date.now(),
      };

      await WatchConnectivity.updateApplicationContext({
        cook: cookPayload,
        stall: stallPayload,
        fuelTimer: fuelTimerPayload,
        pitMaster: pitMasterPayload,
      });
    } catch {
      // Swallow — Watch retries on next wake
    }
  }, [apiFetch, detectStall]);

  // -------------------------------------------------------------------------
  // Polling loop
  // -------------------------------------------------------------------------

  const scheduleNextPoll = useCallback(async () => {
    await pushToWatch();

    const cooks = (queryClient.getQueryData(["cooks"]) as any[] | undefined) ?? [];
    const hasActiveCook = cooks.some((c: any) => c.status === "active");
    const delay = hasActiveCook ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    pollRef.current = setTimeout(scheduleNextPoll, delay);
  }, [pushToWatch, queryClient]);

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
            // POST /api/ai/chat returns { reply, suggestions }
            const result = await apiFetch("/api/ai/chat", {
              method: "POST",
              body: JSON.stringify({ message: question }),
            });
            const answer =
              (result?.reply as string | undefined) ??
              "No response from PitMaster.";
            await WatchConnectivity.sendMessage({
              action: "pitMasterResponse",
              response: answer,
            });
          } catch {
            await WatchConnectivity.sendMessage({
              action: "pitMasterResponse",
              response: "Couldn't reach PitMaster. Check your connection.",
            });
          }
          break;
        }

        case "fuelAdded": {
          // Logged locally on the Watch; nothing to persist server-side until
          // cook notes endpoint is available (task #65 adds the phone UI side).
          break;
        }

        case "stallAction": {
          // No server notes endpoint exists yet; action is handled on Watch.
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
