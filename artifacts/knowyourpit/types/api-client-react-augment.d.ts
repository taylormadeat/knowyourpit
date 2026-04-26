/**
 * Module augmentation for @workspace/api-client-react.
 *
 * `useGetSessionCooks` and `useUpdateSession` are consumed by the mobile app
 * but are not yet present in the generated API client package.  These
 * declarations keep `tsc --noEmit` clean while the real endpoints and
 * generated hooks are added (tracked in task #153).  Remove this file once
 * the hooks are generated and re-exported from the package.
 */
import type { UseMutationResult, UseQueryResult, QueryKey } from "@tanstack/react-query";

export interface SessionCook {
  id: number;
  status: string;
  sessionLabel: string | null;
  sessionNotes: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  foodType: string | null;
  grillName: string | null;
  targetTempF: number | null;
  restMinutes: number | null;
  ratingTenderness: number | null;
  ratingFlavor: number | null;
  ratingBark: number | null;
}

export interface UpdateSessionVariables {
  sessionId: string | number;
  sessionLabel: string | null;
  sessionNotes: string | null;
}

declare module "@workspace/api-client-react" {
  export function useGetSessionCooks(
    sessionId: string,
    options?: Record<string, unknown>
  ): UseQueryResult<SessionCook[], unknown> & { queryKey: QueryKey };

  export function useUpdateSession(
    options?: Record<string, unknown>
  ): UseMutationResult<unknown, unknown, UpdateSessionVariables, unknown>;
}
