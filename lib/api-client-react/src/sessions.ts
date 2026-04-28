import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import { getListCooksQueryKey } from "./generated/api";
import type { Cook } from "./generated/api.schemas";

export interface SequenceItem {
  foodType: string;
  estimatedDurationMinutes: number;
  preheatMinutes: number;
  restMinutes: number;
  grillLightAt: string;
  meatOnAt: string;
  estimatedFinishAt: string;
  notes?: string | null;
}

export interface SequenceData {
  serveAt: string;
  summary?: string | null;
  schedule: SequenceItem[];
}

export interface UpdateSessionBody {
  sessionLabel?: string | null;
  sessionNotes?: string | null;
  sequenceData?: SequenceData;
}

export interface UpdateSessionResult {
  sessionId: string;
  sessionLabel?: string | null;
  sessionNotes?: string | null;
}

export type SessionCook = Cook & {
  sessionLabel: string | null;
  sessionNotes: string | null;
};

export function updateSession(sessionId: string, body: UpdateSessionBody): Promise<UpdateSessionResult> {
  return customFetch<UpdateSessionResult>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation<UpdateSessionResult, Error, { sessionId: string } & UpdateSessionBody>({
    mutationFn: ({ sessionId, ...body }) => updateSession(sessionId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
    },
  });
}

export function deleteSession(sessionId: string): Promise<void> {
  return customFetch<void>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (sessionId) => deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
    },
  });
}

export function getGetSessionCooksQueryKey(sessionId: string) {
  return ["sessions", sessionId, "cooks"] as const;
}

export function getSessionCooks(sessionId: string): Promise<SessionCook[]> {
  return customFetch<SessionCook[]>(`/api/sessions/${encodeURIComponent(sessionId)}`);
}

export function useGetSessionCooks(sessionId: string) {
  return useQuery<SessionCook[]>({
    queryKey: getGetSessionCooksQueryKey(sessionId),
    queryFn: () => getSessionCooks(sessionId),
    enabled: Boolean(sessionId),
  });
}

export function removeCookFromSession(cookId: number): Promise<Cook> {
  return customFetch<Cook>(`/api/cooks/${cookId}`, {
    method: "PATCH",
    body: JSON.stringify({ sessionId: null }),
  });
}

export function useRemoveCookFromSession(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation<Cook, Error, number>({
    mutationFn: (cookId) => removeCookFromSession(cookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetSessionCooksQueryKey(sessionId) });
      queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
    },
  });
}
