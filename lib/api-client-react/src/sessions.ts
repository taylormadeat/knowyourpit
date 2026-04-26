import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import { getListCooksQueryKey } from "./generated/api";
import type { Cook } from "./generated/api.schemas";

export interface UpdateSessionBody {
  sessionLabel?: string | null;
  sessionNotes?: string | null;
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
