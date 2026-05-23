/**
 * Thin re-export wrapper for the shared @workspace/checkin-schedule package.
 *
 * Phase definitions, schedule generation, and all core types now live in the
 * shared lib so the API server and this mobile app stay in perfect sync.
 * Only the UI-specific CHECKIN_STATUS_FLAGS constant (which references Expo
 * icon types) remains here.
 */
import type { ComponentProps } from "react";
import type { Feather } from "@expo/vector-icons";

export type { CheckinStatusFlag } from "@workspace/checkin-schedule";
export {
  CHECKIN_SCHEDULES,
  getCheckinSchedule,
  generateCheckinSchedule,
  rescheduleCheckins,
  CHECKIN_STALL_THRESHOLD_F,
  CHECKIN_PIT_DRIFT_THRESHOLD_F,
  CHECKIN_NOTIF_IDS_KEY_PREFIX,
} from "@workspace/checkin-schedule";
export type {
  CheckinPhase,
  MeatCheckinSchedule,
  ScheduledCheckin,
  CheckinSequenceAnchor,
} from "@workspace/checkin-schedule";

import type { CheckinStatusFlag } from "@workspace/checkin-schedule";

export const CHECKIN_STATUS_FLAGS: {
  key: CheckinStatusFlag;
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
  color: string;
}[] = [
  { key: "all_good", label: "All good", icon: "check-circle", color: "#22c55e" },
  { key: "running_behind", label: "Running behind", icon: "clock", color: "#F59E0B" },
  { key: "flare_up", label: "Flare-up", icon: "alert-triangle", color: "#EF4444" },
  { key: "low_fuel", label: "Low on fuel", icon: "trending-down", color: "#8B5CF6" },
];
