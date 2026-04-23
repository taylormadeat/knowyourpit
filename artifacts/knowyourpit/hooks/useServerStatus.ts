import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

export type ServerStatus = "unknown" | "reachable" | "unreachable";

const POLL_INTERVAL_MS = 30_000;
const TIMEOUT_MS = 6_000;

export function useServerStatus(baseUrl: string): {
  status: ServerStatus;
  retry: () => void;
} {
  const [status, setStatus] = useState<ServerStatus>("unknown");
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (!baseUrl || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${baseUrl}/health`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      setStatus(res.ok ? "reachable" : "unreachable");
    } catch {
      setStatus("unreachable");
    } finally {
      checkingRef.current = false;
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!baseUrl) return;
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [baseUrl, check]);

  useEffect(() => {
    if (!baseUrl) return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, [baseUrl, check]);

  return { status, retry: check };
}
