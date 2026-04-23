import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Cook } from "@workspace/api-client-react";
import { WatchConnectivity } from "../modules/watch-connectivity";

const STALL_DELTA_F = 2;
const STALL_DURATION_MS = 30 * 60 * 1000;
const ACTIVE_POLL_MS = 15_000;
const IDLE_POLL_MS = 60_000;
const FUEL_TIMER_KEY = "knowyourpit:fuelTimer";

interface StallWindow {
  firstSeenAt: number;
  tempF: number;
}

interface MeaterReadings {
  probes?: Array<{ internalTempF: number; ambientTempF: number }>;
}

interface AiChatResponse {
  reply?: string;
}

interface HomeInsightsResponse {
  tips?: string[];
}

interface FuelTimerConfig {
  intervalMinutes: number;
  fuelType: string;
}

const FUEL_TIMER_DEFAULTS: FuelTimerConfig = {
  intervalMinutes: 60,
  fuelType: "Apple Wood",
};

async function readFuelTimer(): Promise<FuelTimerConfig> {
  const raw = await AsyncStorage.getItem(FUEL_TIMER_KEY);
  if (!raw) return FUEL_TIMER_DEFAULTS;
  return { ...FUEL_TIMER_DEFAULTS, ...JSON.parse(raw) };
}

/** Called by the fuel timer settings UI (task #65) to persist user preferences. */
export async function saveFuelTimer(config: Partial<FuelTimerConfig>): Promise<void> {
  const current = await readFuelTimer();
  await AsyncStorage.setItem(FUEL_TIMER_KEY, JSON.stringify({ ...current, ...config }));
}

export function useWatchBridge() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const stallWindow = useRef<StallWindow | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiBase =
    process.env.EXPO_PUBLIC_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "");

  const apiFetch = useCallback(
    async <T>(path: string, options?: RequestInit): Promise<T> => {
      const token = await getToken();
      const res = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers ?? {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
      return res.json() as Promise<T>;
    },
    [apiBase, getToken]
  );

  const detectStall = useCallback(
    (probeTempF: number): { isStalled: boolean; stalledForMinutes: number } => {
      const now = Date.now();
      const win = stallWindow.current;
      if (!win || Math.abs(probeTempF - win.tempF) > STALL_DELTA_F) {
        stallWindow.current = { firstSeenAt: now, tempF: probeTempF };
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

  const pushToWatch = useCallback(async (): Promise<boolean> => {
    if (!WatchConnectivity.isSupported()) return false;

    const cooks = await apiFetch<Cook[]>("/api/cooks").catch((): Cook[] => []);
    const activeCook = cooks.find((c) => c.status === "active") ?? null;
    const plannedCook = !activeCook
      ? (cooks.find((c) => c.status === "planned") ?? null)
      : null;
    const cook = activeCook ?? plannedCook;

    if (activeCook) {
      queryClient.invalidateQueries({ queryKey: ["cooks"] });
    } else {
      stallWindow.current = null;
    }

    let probeTempF: number | undefined;
    let ambientTempF: number | undefined;
    let stall = { isStalled: false, stalledForMinutes: 0 };

    if (activeCook) {
      const meater = await apiFetch<MeaterReadings>("/api/meater/readings").catch(
        () => null
      );
      const probe = meater?.probes?.[0];
      if (probe) {
        probeTempF = probe.internalTempF;
        ambientTempF = probe.ambientTempF;
        stall = detectStall(probeTempF);
      }
    }

    const insights = await apiFetch<HomeInsightsResponse>(
      "/api/ai/home-insights"
    ).catch(() => null);
    const pitMasterInsight =
      insights?.tips?.[0] ?? "Ask PitMaster what to do next.";

    const fuelConfig = await readFuelTimer();

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

    await WatchConnectivity.updateApplicationContext({
      cook: cookPayload,
      stall: {
        isStalled: stall.isStalled,
        stalledForMinutes: stall.stalledForMinutes,
        probeTempF: probeTempF ?? 0,
        targetTempF: activeCook?.targetTempF ?? 0,
      },
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

    return activeCook !== null;
  }, [apiFetch, detectStall, queryClient]);

  const scheduleNextPoll = useCallback(async () => {
    const hasActive = await pushToWatch().catch(() => false);
    pollTimer.current = setTimeout(
      scheduleNextPoll,
      hasActive ? ACTIVE_POLL_MS : IDLE_POLL_MS
    );
  }, [pushToWatch]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !WatchConnectivity.isSupported()) return;

    const sub = WatchConnectivity.addMessageListener(async ({ message }) => {
      const action = message.action as string | undefined;

      if (action === "stopCook") {
        await apiFetch(`/api/cooks/${message.cookId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled" }),
        });
        queryClient.invalidateQueries({ queryKey: ["cooks"] });
        await pushToWatch();
        return;
      }

      if (action === "markDone") {
        await apiFetch(`/api/cooks/${message.cookId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "completed" }),
        });
        queryClient.invalidateQueries({ queryKey: ["cooks"] });
        await pushToWatch();
        return;
      }

      if (action === "startCook") {
        await apiFetch(`/api/cooks/${message.cookId}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "active",
            actualStartAt: new Date().toISOString(),
          }),
        });
        queryClient.invalidateQueries({ queryKey: ["cooks"] });
        await pushToWatch();
        return;
      }

      if (action === "pitMasterAsk") {
        const result = await apiFetch<AiChatResponse>("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({ message: message.question }),
        }).catch(() => null);
        await WatchConnectivity.sendMessage({
          action: "pitMasterResponse",
          response: result?.reply ?? "PitMaster is offline.",
        });
        return;
      }

      if (action === "stallAction" && message.choice === "wrap") {
        const cookId = message.cookId as string | undefined;
        if (cookId) {
          const ts = new Date().toLocaleTimeString();
          const entry = `[${ts}] Stall — meat wrapped in butcher paper.`;
          const existing = await apiFetch<{ notes?: string | null }>(
            `/api/cooks/${cookId}`
          ).catch(() => null);
          const combined = existing?.notes
            ? `${existing.notes}\n${entry}`
            : entry;
          await apiFetch(`/api/cooks/${cookId}`, {
            method: "PATCH",
            body: JSON.stringify({ notes: combined }),
          }).catch(() => null);
        }
        return;
      }

      if (action === "refreshTemps") {
        await pushToWatch();
      }
    });

    return () => sub.remove();
  }, [apiFetch, pushToWatch, queryClient]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !WatchConnectivity.isSupported()) return;
    scheduleNextPoll();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [scheduleNextPoll]);
}
