import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

function formatAgo(diffMs: number): string {
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function computeLabel(queryClient: ReturnType<typeof useQueryClient>): string | null {
  const queries = queryClient.getQueryCache().getAll();
  const times = queries
    .map((q) => q.state.dataUpdatedAt)
    .filter((t) => t > 0);
  if (times.length === 0) return null;
  const latest = Math.max(...times);
  return formatAgo(Date.now() - latest);
}

export function useLastUpdated(): string | null {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState<string | null>(() => computeLabel(queryClient));

  useEffect(() => {
    setLabel(computeLabel(queryClient));

    const unsub = queryClient.getQueryCache().subscribe(() => {
      setLabel(computeLabel(queryClient));
    });

    const interval = setInterval(() => {
      setLabel(computeLabel(queryClient));
    }, 30_000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [queryClient]);

  return label;
}
