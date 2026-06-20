import React, { useState, useRef, useEffect, useCallback } from "react";
import type { ComponentProps } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";

import {
  useListCookEvents,
  getListCookEventsQueryKey,
} from "@workspace/api-client-react";
import type { CookCheckin } from "@workspace/api-client-react";
import { PROBE_POLL_INTERVAL_MS } from "@/constants/polling";
import {
  generateCheckinSchedule,
  type ScheduledCheckin,
  type CheckinSequenceAnchor,
  type CheckinPhase,
} from "@/constants/checkinKnowledge";
import type { AiCheckinItem } from "./types";
import { BlurredProSection } from "@/components/BlurredProSection";
import type { ShowOptions } from "@/contexts/PaywallContext";
import type { SequenceData } from "./types";

type FeatherName = ComponentProps<typeof Feather>["name"];

type Colors = Record<string, unknown> & {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  radius: number;
  muted: string;
  background: string;
};

// ─── Supporting types ─────────────────────────────────────────────────────────

interface TriggeredAlert {
  id: number;
  message: string;
  triggeredAt: string;
}

interface StepConfirmation {
  id: string;
  label: string;
  confirmedAt: string;
}

interface LiveReadingMilestone {
  id: string;
  tempF: number;
  timeMinutes: number;
}

interface AnalysisHistoryEntry {
  savedAt?: string;
  snapshotElapsedMinutes?: number;
  snapshotTempF?: number;
  snapshotNotes?: string;
  detectedFoodType?: string;
  assessment?: { verdict?: string; summary?: string };
  phasePrediction?: { phaseLabel?: string };
  decisions?: Array<{ action?: string; urgency?: string; instruction?: string }>;
}

// ─── Unified activity event model ────────────────────────────────────────────

/** AI analysis payload merged from a nearby cook_events ai_analysis row. */
interface MergedCookEventAnalysis {
  verdict: string;
  verdictColor: string;
  verdictLabel: string;
  summary?: string;
  decisions?: string[];
}

/**
 * A single check-in event that may carry data from either or both of:
 * - CookCheckin  (new system: phaseKey, temps, note, photo, aiGuidanceShown)
 * - AnalysisHistoryEntry  (legacy: verdict, summary, decisions)
 * - MergedCookEventAnalysis  (cook_events ai_analysis rows absorbed within 15 min)
 * Merging by time proximity prevents the same moment appearing as multiple rows.
 */
interface UnifiedCheckinEvent {
  kind: "checkin";
  id: string;
  occurredAt: number;
  icon: FeatherName;
  color: string;
  summary: string;
  checkin: CookCheckin | null;
  historyEntry: AnalysisHistoryEntry | null;
  /** 0 = most recent; used for Pro paywall gating */
  ageRank: number;
  /** Most severe ai_analysis cook event absorbed into this check-in row */
  mergedCookEventAnalysis?: MergedCookEventAnalysis;
}

interface JournalEvent {
  kind: "journal-event";
  id: string;
  occurredAt: number;
  icon: FeatherName;
  color: string;
  summary: string;
  detail?: string;
  rawEventType?: string;
  aiDecisions?: string[];
}

interface AiAnalysisEvent {
  kind: "ai-analysis";
  id: string;
  occurredAt: number;
  icon: FeatherName;
  color: string;
  summary: string;
  detail?: string;
  aiDecisions?: string[];
  /** Raw verdict key: "on_track" | "watch" | "action_needed" */
  verdict?: string;
}

interface TriggeredAlertEvent {
  kind: "triggered-alert";
  id: string;
  occurredAt: number;
  icon: FeatherName;
  color: string;
  summary: string;
  detail?: string;
}

interface StepConfirmationEvent {
  kind: "step-confirmation";
  id: string;
  occurredAt: number;
  icon: FeatherName;
  color: string;
  summary: string;
}

interface ProbeMilestoneEvent {
  kind: "probe-milestone";
  id: string;
  occurredAt: number;
  icon: FeatherName;
  color: string;
  summary: string;
  detail?: string;
}

interface ScheduledMilestoneEvent {
  kind: "scheduled-milestone";
  id: string;
  occurredAt: number;
  sc: ScheduledCheckin;
  isNext: boolean;
  isEstimated?: boolean;
}

type PastEvent =
  | UnifiedCheckinEvent
  | JournalEvent
  | AiAnalysisEvent
  | TriggeredAlertEvent
  | StepConfirmationEvent
  | ProbeMilestoneEvent;

type ActivityEvent = PastEvent | ScheduledMilestoneEvent;

// ─── Config maps ──────────────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<string, { icon: FeatherName; color: string; label: string }> = {
  lid_open:        { icon: "wind",           color: "#6B7280", label: "Lid Opened"         },
  flare_up:        { icon: "alert-triangle", color: "#EF4444", label: "Flare-Up"           },
  spritz:          { icon: "droplet",        color: "#3B82F6", label: "Spritz"             },
  mop:             { icon: "droplet",        color: "#92400E", label: "Mop"                },
  charcoal_add:    { icon: "plus-circle",    color: "#F97316", label: "Charcoal Added"     },
  wood_add:        { icon: "package",        color: "#92400E", label: "Wood Added"         },
  fuel_low:        { icon: "trending-down",  color: "#8B5CF6", label: "Fuel Low"           },
  vent_adjust:     { icon: "sliders",        color: "#0EA5E9", label: "Vent Adjusted"      },
  user_note:       { icon: "edit-3",         color: "#22c55e", label: "Note"               },
  proactive_alert: { icon: "bell",           color: "#EAB308", label: "AI Alert"           },
  voice_note:      { icon: "mic",            color: "#A78BFA", label: "Voice Note"         },
  ai_analysis:     { icon: "cpu",            color: "#6C3BF5", label: "PitMaster Analysis" },
};

const DEFAULT_EVENT_CFG: { icon: FeatherName; color: string; label: string } = {
  icon: "activity",
  color: "#6B7280",
  label: "Event",
};

const STATUS_FLAG_CONFIG: Partial<Record<string, { color: string; label: string }>> = {
  all_good:       { color: "#22c55e", label: "All good"       },
  running_behind: { color: "#F59E0B", label: "Running behind" },
  flare_up:       { color: "#EF4444", label: "Flare-up"       },
  low_fuel:       { color: "#8B5CF6", label: "Low fuel"       },
};

const VERDICT_COLORS: Record<string, string> = {
  perfect:     "#22c55e",
  good:        "#84cc16",
  needs_work:  "#F59E0B",
  overcooked:  "#EF4444",
  undercooked: "#3B82F6",
};

/** Severity rank for ai_analysis verdict keys — higher wins when merging duplicates. */
const VERDICT_SEVERITY: Record<string, number> = {
  action_needed: 3,
  watch:         2,
  on_track:      1,
};

/** Max time gap between an ai_analysis cook event and a check-in to be merged into it. */
const ANALYSIS_MATCH_WINDOW_MS = 15 * 60 * 1000;

const URGENCY_COLORS: Record<string, string> = {
  now:        "#EF4444",
  soon:       "#F59E0B",
  when_ready: "#6C3BF5",
  maintain:   "#22c55e",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROBE_SOURCE_LABELS: Record<string, string> = {
  meater:       "MEATER Probe",
  thermoworks:  "ThermoWorks Probe",
  inkbird:      "Inkbird Probe",
  govee:        "Govee Probe",
  ble:          "Bluetooth Probe",
  lan:          "Network Probe",
};

function probeSourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return PROBE_SOURCE_LABELS[source] ?? "Probe";
}

const fmtTime = (ms: number) => {
  try {
    return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return ""; }
};

const fmtDateTime = (ms: number) => {
  try {
    return new Date(ms).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return ""; }
};

const fmtCountdown = (targetMs: number, nowMs: number) => {
  const diff = targetMs - nowMs;
  if (diff <= 0) return "Now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `in ${hrs}h ${rem}m`;
};

const fmtMins = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Match analysisHistory entries to CookCheckin records by time proximity (≤ 15 min). */
function mergeCheckinsWithHistory(
  checkins: CookCheckin[],
  history: AnalysisHistoryEntry[],
): UnifiedCheckinEvent[] {
  const MATCH_WINDOW_MS = 15 * 60 * 1000;

  // Work with mutable copies so we can remove matched items
  const unmatchedHistory = [...history];

  // Build unified events from CookCheckin records first
  const events: { occurredAt: number; checkin: CookCheckin | null; historyEntry: AnalysisHistoryEntry | null }[] = [];

  for (const ci of checkins) {
    const ciMs = new Date(ci.firedAt ?? ci.createdAt).getTime();
    // Try to find a matching analysisHistory entry
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < unmatchedHistory.length; i++) {
      const entry = unmatchedHistory[i];
      if (!entry.savedAt) continue;
      const diff = Math.abs(new Date(entry.savedAt).getTime() - ciMs);
      if (diff < MATCH_WINDOW_MS && diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    const historyEntry = bestIdx >= 0 ? unmatchedHistory.splice(bestIdx, 1)[0] : null;
    events.push({ occurredAt: ciMs, checkin: ci, historyEntry });
  }

  // Any remaining unmatched history entries become checkin events (legacy-only)
  for (const entry of unmatchedHistory) {
    if (!entry.savedAt) continue;
    events.push({
      occurredAt: new Date(entry.savedAt).getTime(),
      checkin: null,
      historyEntry: entry,
    });
  }

  // Sort chronologically, then assign ageRank (0 = most recent)
  events.sort((a, b) => a.occurredAt - b.occurredAt);
  const total = events.length;

  return events.map((ev, idx) => {
    const ci = ev.checkin;
    const he = ev.historyEntry;
    const statusCfg = ci?.statusFlag ? STATUS_FLAG_CONFIG[ci.statusFlag] : null;
    const verdict = he?.assessment?.verdict;
    const color = statusCfg?.color ?? (verdict ? (VERDICT_COLORS[verdict] ?? "#22c55e") : "#22c55e");
    const icon: FeatherName = statusCfg
      ? ci?.statusFlag === "all_good" ? "check-circle" : "alert-circle"
      : "check-circle";
    const label = ci?.phaseLabel ?? he?.phasePrediction?.phaseLabel ?? null;
    const isAuto = ci?.autoDismissed ? " (auto)" : "";
    const summary = `Check-In${label ? ` — ${label}` : ""}${isAuto}`;
    return {
      kind: "checkin" as const,
      id: ci ? `checkin-${ci.id}` : `history-${idx}`,
      occurredAt: ev.occurredAt,
      icon,
      color,
      summary,
      checkin: ci,
      historyEntry: he,
      ageRank: total - 1 - idx, // 0 = most recent
    };
  });
}

// ─── Scheduled milestone row ──────────────────────────────────────────────────

interface ScheduledRowProps {
  sc: ScheduledCheckin;
  isNext: boolean;
  isEstimated?: boolean;
  colors: Colors;
  nowMs: number;
  onRemovePlanned?: (phaseKey: string) => void;
  isLast: boolean;
  onOpenCheckin: (sc: ScheduledCheckin) => void;
  aiCheckinItem?: AiCheckinItem | null;
}

function ScheduledMilestoneRow({
  sc, isNext, isEstimated, colors, nowMs, onRemovePlanned, isLast, onOpenCheckin, aiCheckinItem,
}: ScheduledRowProps) {
  const swipeRef = useRef<Swipeable>(null);
  const [expandedCoaching, setExpandedCoaching] = useState(false);

  const hasAiContent = !isEstimated && !!aiCheckinItem && (
    !!aiCheckinItem.coachingNote || (aiCheckinItem.visualCues?.length ?? 0) > 0
  );

  const renderRightActions = useCallback(
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const translateX = dragX.interpolate({ inputRange: [-80, 0], outputRange: [0, 80], extrapolate: "clamp" });
      return (
        <Animated.View style={{
          width: 80, justifyContent: "center", alignItems: "center",
          backgroundColor: "#EF444420", transform: [{ translateX }],
        }}>
          <Pressable onPress={() => { swipeRef.current?.close(); onRemovePlanned?.(sc.phaseKey); }}
            style={{ alignItems: "center", gap: 3 }}>
            <Feather name="bell-off" size={18} color="#EF4444" />
            <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#EF4444" }}>Remove</Text>
          </Pressable>
        </Animated.View>
      );
    },
    [sc.phaseKey, onRemovePlanned],
  );

  const accentColor = isEstimated ? (colors.mutedForeground as string) : (isNext ? "#F59E0B" : "#6C3BF5");

  const tempRange = aiCheckinItem?.expectedInternalTempRange;

  return (
    <Swipeable ref={swipeRef}
      renderRightActions={!isEstimated && onRemovePlanned ? renderRightActions : undefined}
      overshootRight={false} friction={2}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", width: 28 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: accentColor + "18", alignItems: "center", justifyContent: "center",
            borderWidth: 1.5, borderColor: accentColor + "60",
          }}>
            <Feather name={isEstimated ? "map-pin" : (isNext ? "bell" : "clock")} size={12} color={accentColor} />
          </View>
          {!isLast && <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border as string, marginTop: 3 }} />}
        </View>

        <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14, paddingTop: 2 }}>
          <Pressable
            onPress={hasAiContent ? () => setExpandedCoaching((v) => !v) : undefined}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}
          >
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground as string, flex: 1 }}>
              {sc.phaseLabel}
            </Text>
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: accentColor + "18" }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: accentColor }}>
                {isEstimated ? "estimated" : (isNext ? "up next" : "upcoming")}
              </Text>
            </View>
            {hasAiContent && (
              <Feather
                name={expandedCoaching ? "chevron-up" : "chevron-down"}
                size={13}
                color={colors.mutedForeground as string}
              />
            )}
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string }}>
              {fmtDateTime(sc.scheduledAt)} · {fmtCountdown(sc.scheduledAt, nowMs)}
            </Text>
            {tempRange && (
              <View style={{
                paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
                backgroundColor: "#0EA5E918", borderWidth: 1, borderColor: "#0EA5E940",
                flexDirection: "row", alignItems: "center", gap: 3,
              }}>
                <Feather name="thermometer" size={10} color="#0EA5E9" />
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#0EA5E9" }}>
                  {tempRange[0]}–{tempRange[1]}°F
                </Text>
              </View>
            )}
          </View>

          {/* Collapsed coaching note preview — visible before the user expands */}
          {!expandedCoaching && !isEstimated && !!aiCheckinItem?.coachingNote && (
            <View style={{
              marginTop: 6,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 5,
            }}>
              <Feather name="zap" size={10} color={accentColor} style={{ marginTop: 2 }} />
              <Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{
                  flex: 1,
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.mutedForeground as string,
                  lineHeight: 17,
                  fontStyle: "italic",
                }}
              >
                {aiCheckinItem.coachingNote}
              </Text>
            </View>
          )}

          {expandedCoaching && hasAiContent && (
            <View style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 8,
              backgroundColor: accentColor + "0C",
              borderWidth: 1,
              borderColor: accentColor + "28",
              gap: 6,
            }}>
              {!!aiCheckinItem!.coachingNote && (
                <Text style={{
                  fontFamily: "Inter_400Regular", fontSize: 12,
                  color: colors.foreground as string, lineHeight: 17,
                }}>
                  {aiCheckinItem!.coachingNote}
                </Text>
              )}
              {(aiCheckinItem!.visualCues?.length ?? 0) > 0 && (
                <View style={{ gap: 4, marginTop: aiCheckinItem!.coachingNote ? 4 : 0 }}>
                  <Text style={{
                    fontFamily: "Inter_600SemiBold", fontSize: 10,
                    color: colors.mutedForeground as string, textTransform: "uppercase", letterSpacing: 0.6,
                  }}>
                    Visual cues
                  </Text>
                  {aiCheckinItem!.visualCues.map((cue, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                      <Text style={{ color: accentColor, fontSize: 10, marginTop: 2 }}>•</Text>
                      <Text style={{
                        fontFamily: "Inter_400Regular", fontSize: 12,
                        color: colors.foreground as string, flex: 1, lineHeight: 17,
                      }}>
                        {cue}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {!isEstimated && isNext && (
            <Pressable onPress={() => onOpenCheckin(sc)}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5, alignSelf: "flex-start" }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.primary as string }}>
                Check in now
              </Text>
              <Feather name="arrow-right" size={12} color={colors.primary as string} />
            </Pressable>
          )}
          {!isEstimated && isNext && onRemovePlanned && (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string, marginTop: 3 }}>
              Swipe left to remove reminder
            </Text>
          )}
        </View>
      </View>
    </Swipeable>
  );
}

// ─── Check-in row ─────────────────────────────────────────────────────────────

interface CheckinRowProps {
  event: UnifiedCheckinEvent;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  colors: Colors;
  effectivePro: boolean;
  isIdentityLinked: boolean;
  cookStatus: string | undefined;
  totalCheckinCount: number;
  showPaywall: (opts?: ShowOptions) => void;
  cookFoodType?: string | null;
}

function CheckinRow({
  event, isLast, isExpanded, onToggle, colors,
  effectivePro, isIdentityLinked, cookStatus, totalCheckinCount, showPaywall, cookFoodType,
}: CheckinRowProps) {
  const ci = event.checkin;
  const he = event.historyEntry;

  const hasExpandableContent = !!(
    ci?.internalTempF != null || ci?.pitTempF != null || ci?.userNote ||
    ci?.aiGuidanceShown || ci?.photoKey ||
    he?.assessment?.verdict || he?.assessment?.summary ||
    (he?.decisions?.length ?? 0) > 0 ||
    event.mergedCookEventAnalysis
  );

  const hasAnalysis = !!(
    he?.assessment?.verdict || he?.assessment?.summary ||
    event.mergedCookEventAnalysis
  );

  // Pro lock: on completed cooks, non-Pro users with confirmed identity can only
  // freely expand the most recent check-in (ageRank 0). Older entries show a paywall
  // when expanded.
  const isLocked =
    cookStatus === "completed" &&
    isIdentityLinked &&
    !effectivePro &&
    event.ageRank > 0 &&
    totalCheckinCount > 1;

  // One-line collapsed preview (temperature, probe source, status — verdict shown separately as a badge)
  const collapsedPreview = (() => {
    const bits: string[] = [];
    const srcLabel = probeSourceLabel(ci?.probeSource);
    if (srcLabel) bits.push(srcLabel);
    if (ci?.internalTempF != null) bits.push(`${Math.round(ci.internalTempF)}°F`);
    if (ci?.statusFlag) {
      const cfg = STATUS_FLAG_CONFIG[ci.statusFlag];
      if (cfg) bits.push(cfg.label);
    }
    if (bits.length === 0 && ci?.userNote) bits.push(ci.userNote.slice(0, 60));
    return bits.join(" · ");
  })();

  // Colored verdict badge shown below the one-liner when the row is collapsed
  const collapsedVerdictBadge = (() => {
    if (!hasAnalysis) return null;
    const verdict = he?.assessment?.verdict ?? event.mergedCookEventAnalysis?.verdict ?? null;
    if (!verdict) return null;
    // Prefer the pre-computed color from the merged event (handles on_track / watch / action_needed)
    const color = (event.mergedCookEventAnalysis?.verdict === verdict)
      ? (event.mergedCookEventAnalysis.verdictColor ?? (VERDICT_COLORS[verdict] ?? "#22c55e"))
      : (VERDICT_COLORS[verdict] ?? "#22c55e");
    const label = (event.mergedCookEventAnalysis?.verdict === verdict)
      ? (event.mergedCookEventAnalysis.verdictLabel ?? verdict.replace(/_/g, " "))
      : verdict.replace(/_/g, " ");
    return { color, label };
  })();

  return (
    <Pressable onPress={hasExpandableContent ? onToggle : undefined}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", width: 28 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: event.color + "18", alignItems: "center", justifyContent: "center",
            borderWidth: 1.5, borderColor: event.color + "40",
          }}>
            <Feather name={event.icon} size={13} color={event.color} />
          </View>
          {!isLast && <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border as string, marginTop: 3 }} />}
        </View>

        <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14, paddingTop: 2 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: event.color, flex: 1 }}>
              {event.summary}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string }}>
                {fmtTime(event.occurredAt)}
              </Text>
              {hasExpandableContent && (
                isExpanded ? (
                  <Feather name="chevron-up" size={13} color={colors.mutedForeground as string} />
                ) : hasAnalysis ? (
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: colors.primary as string }}>
                    View analysis ›
                  </Text>
                ) : (
                  <Feather name="chevron-down" size={13} color={colors.mutedForeground as string} />
                )
              )}
            </View>
          </View>

          {/* Collapsed one-liner */}
          {!isExpanded && collapsedPreview ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string, marginTop: 2 }}
              numberOfLines={1}>
              {collapsedPreview}
            </Text>
          ) : null}

          {/* Collapsed verdict badge — colored chip shown below the one-liner when analysis is available */}
          {!isExpanded && collapsedVerdictBadge && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <View style={{
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
                backgroundColor: collapsedVerdictBadge.color + "22",
              }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: collapsedVerdictBadge.color }}>
                  {collapsedVerdictBadge.label}
                </Text>
              </View>
            </View>
          )}

          {/* Expanded detail */}
          {isExpanded && hasExpandableContent && (
            <View style={{ marginTop: 8, gap: 6 }}>
              {/* ── CookCheckin fields ── */}

              {/* Status flag chip */}
              {ci?.statusFlag && (() => {
                const cfg = STATUS_FLAG_CONFIG[ci.statusFlag];
                return cfg ? (
                  <View style={{ alignSelf: "flex-start" }}>
                    <View style={{
                      paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10,
                      backgroundColor: cfg.color + "20", borderWidth: 1, borderColor: cfg.color + "40",
                    }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: cfg.color }}>
                        {cfg.label}
                      </Text>
                    </View>
                  </View>
                ) : null;
              })()}

              {/* Probe source chip */}
              {ci?.probeSource && (ci.internalTempF != null || ci.pitTempF != null) && (() => {
                const label = probeSourceLabel(ci.probeSource);
                return label ? (
                  <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4,
                    backgroundColor: "#22c55e18", borderColor: "#22c55e40", borderWidth: 1,
                    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Feather name="wifi" size={11} color="#22c55e" />
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#22c55e" }}>
                      {label}
                    </Text>
                  </View>
                ) : null;
              })()}

              {/* Temperature tiles */}
              {ci && (ci.internalTempF != null || ci.pitTempF != null) && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {ci.internalTempF != null && (
                    <View style={{
                      backgroundColor: colors.background as string, borderRadius: 8,
                      paddingHorizontal: 10, paddingVertical: 6,
                    }}>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground as string }}>
                        Internal
                      </Text>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground as string }}>
                        {Math.round(ci.internalTempF)}°F
                      </Text>
                    </View>
                  )}
                  {ci.pitTempF != null && (
                    <View style={{
                      backgroundColor: colors.background as string, borderRadius: 8,
                      paddingHorizontal: 10, paddingVertical: 6,
                    }}>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground as string }}>
                        Pit
                      </Text>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground as string }}>
                        {Math.round(ci.pitTempF)}°F
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Legacy snapshot temp (from analysisHistory, when no CookCheckin temp available) */}
              {!ci && he?.snapshotTempF != null && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{
                    backgroundColor: colors.background as string, borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 6,
                  }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground as string }}>
                      Temp
                    </Text>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground as string }}>
                      {he.snapshotTempF}°F
                    </Text>
                  </View>
                </View>
              )}

              {/* User note */}
              {ci?.userNote && (
                <View style={{
                  backgroundColor: colors.background as string, borderRadius: 8,
                  padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary as string,
                }}>
                  <Text style={{
                    fontFamily: "Inter_400Regular", fontSize: 12,
                    color: colors.foreground as string, fontStyle: "italic", lineHeight: 18,
                  }}>
                    "{ci.userNote}"
                  </Text>
                </View>
              )}

              {/* Snapshot notes (legacy) */}
              {!ci?.userNote && he?.snapshotNotes && (
                <View style={{
                  backgroundColor: colors.background as string, borderRadius: 8,
                  padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary as string,
                }}>
                  <Text style={{
                    fontFamily: "Inter_400Regular", fontSize: 12,
                    color: colors.foreground as string, fontStyle: "italic", lineHeight: 18,
                  }}>
                    "{he.snapshotNotes}"
                  </Text>
                </View>
              )}

              {/* Photo */}
              {ci?.photoKey && (
                ci.photoKey.startsWith("local:") ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="camera" size={12} color={colors.mutedForeground as string} />
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string }}>
                      Photo captured
                    </Text>
                  </View>
                ) : (
                  <Image source={{ uri: ci.photoKey }}
                    style={{ width: "100%", height: 140, borderRadius: 8 }} resizeMode="cover" />
                )
              )}

              {/* AI guidance (new system) */}
              {ci?.aiGuidanceShown && (
                <View style={{ backgroundColor: (colors.primary as string) + "10", borderRadius: 8, padding: 10 }}>
                  <Text style={{
                    fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.primary as string,
                    marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5,
                  }}>
                    PitMaster Coaching
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground as string, lineHeight: 18 }}>
                    {ci.aiGuidanceShown}
                  </Text>
                </View>
              )}

              {/* ── AnalysisHistory coach detail ── */}
              {he && (
                isLocked ? (
                  <BlurredProSection
                    featureName="Cook Coach Report"
                    ctaTitle="Unlock your full coach report"
                    teaser={`Upgrade to see ${totalCheckinCount - 1} more check-in${totalCheckinCount - 1 === 1 ? "" : "s"} from this cook.`}
                    onPress={() => showPaywall({
                      trigger: "pro_required",
                      featureName: "Cook Coach Report",
                      foodType: cookFoodType ?? null,
                    })}
                    minHeight={80}
                    style={{ marginTop: 4 }}
                  >
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground as string }}>
                        AI verdict, decisions, and phase analysis from this check-in…
                      </Text>
                    </View>
                  </BlurredProSection>
                ) : (
                  <CoachDetailSection
                    he={he}
                    cookFoodType={cookFoodType}
                    cookFoodTypeOnRecord={null}
                    colors={colors}
                  />
                )
              )}

              {/* ── Merged cook event analysis (shown when historyEntry is absent or has no verdict) ── */}
              {(!he || !he.assessment?.verdict) && event.mergedCookEventAnalysis && (() => {
                const mca = event.mergedCookEventAnalysis;
                return (
                  <View style={{ gap: 6 }}>
                    <Text style={{
                      fontFamily: "Inter_600SemiBold", fontSize: 10,
                      color: colors.primary as string,
                      textTransform: "uppercase", letterSpacing: 0.5,
                    }}>
                      PitMaster says:
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                        backgroundColor: mca.verdictColor + "22",
                      }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: mca.verdictColor }}>
                          {mca.verdictLabel}
                        </Text>
                      </View>
                    </View>
                    {mca.summary ? (
                      <Text style={{
                        fontFamily: "Inter_400Regular", fontSize: 12,
                        color: colors.mutedForeground as string, lineHeight: 18,
                      }} numberOfLines={5}>
                        {mca.summary}
                      </Text>
                    ) : null}
                    {(mca.decisions?.length ?? 0) > 0 ? (
                      <View style={{ gap: 4 }}>
                        {mca.decisions!.map((d, dIdx) => (
                          <View key={dIdx} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                            <Text style={{ color: mca.verdictColor, fontSize: 11, lineHeight: 17 }}>›</Text>
                            <Text style={{
                              fontFamily: "Inter_400Regular", fontSize: 11,
                              color: colors.mutedForeground as string, lineHeight: 17, flex: 1,
                            }}>
                              {d}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Coach detail section (analysisHistory fields) ────────────────────────────

interface CoachDetailProps {
  he: AnalysisHistoryEntry;
  cookFoodType?: string | null;
  cookFoodTypeOnRecord: string | null;
  colors: Colors;
}

function CoachDetailSection({ he, cookFoodType, colors }: CoachDetailProps) {
  const verdict = he.assessment?.verdict;
  const verdictColor = verdict ? (VERDICT_COLORS[verdict] ?? colors.mutedForeground) : null;
  const topDecision = (he.decisions ?? [])[0];
  const urgencyColor = topDecision
    ? topDecision.action === "maintain"
      ? "#22c55e"
      : (URGENCY_COLORS[topDecision.urgency ?? ""] ?? "#6C3BF5")
    : null;

  return (
    <View style={{ gap: 6 }}>
      {/* Meta chips row */}
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {he.snapshotElapsedMinutes != null && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.muted as string }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground as string }}>
              {fmtMins(he.snapshotElapsedMinutes)} in
            </Text>
          </View>
        )}
        {he.snapshotTempF != null && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.muted as string }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground as string }}>
              {he.snapshotTempF}°F
            </Text>
          </View>
        )}
        {he.detectedFoodType && he.detectedFoodType !== cookFoodType && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.muted as string }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground as string }}>
              {he.detectedFoodType}
            </Text>
          </View>
        )}
        {verdictColor && verdict && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: verdictColor + "22" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: verdictColor }}>
              {verdict.replace(/_/g, " ")}
            </Text>
          </View>
        )}
      </View>

      {/* Top decision instruction */}
      {topDecision && urgencyColor && (
        <View style={{
          backgroundColor: urgencyColor + "10", borderColor: urgencyColor + "30",
          borderWidth: 1, borderRadius: 8, padding: 10,
          flexDirection: "row", gap: 8, alignItems: "flex-start",
        }}>
          <View style={{
            width: 7, height: 7, borderRadius: 4,
            backgroundColor: urgencyColor, marginTop: 4, flexShrink: 0,
          }} />
          <Text style={{
            fontFamily: "Inter_500Medium", fontSize: 12,
            color: colors.foreground as string, flex: 1, lineHeight: 18,
          }} numberOfLines={2}>
            {topDecision.instruction}
          </Text>
        </View>
      )}

      {/* Phase prediction */}
      {he.phasePrediction?.phaseLabel && (
        <Text style={{
          fontFamily: "Inter_400Regular", fontSize: 11,
          color: colors.mutedForeground as string, fontStyle: "italic",
        }}>
          Phase: {he.phasePrediction.phaseLabel}
        </Text>
      )}

      {/* Summary */}
      {he.assessment?.summary && (
        <Text style={{
          fontFamily: "Inter_400Regular", fontSize: 12,
          color: colors.mutedForeground as string, lineHeight: 18,
        }} numberOfLines={3}>
          {he.assessment.summary}
        </Text>
      )}
    </View>
  );
}

// ─── Generic past event row ───────────────────────────────────────────────────

interface GenericRowProps {
  event: Exclude<PastEvent, UnifiedCheckinEvent>;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  colors: Colors;
}

function GenericEventRow({ event, isLast, isExpanded, onToggle, colors }: GenericRowProps) {
  const hasDetail =
    event.kind === "ai-analysis"
      ? !!(event.detail || (event.aiDecisions?.length ?? 0) > 0)
      : !!(event as any).detail;

  return (
    <Pressable onPress={hasDetail ? onToggle : undefined}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", width: 28 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: event.color + "18", alignItems: "center", justifyContent: "center",
            borderWidth: 1.5, borderColor: event.color + "40",
          }}>
            <Feather name={event.icon} size={13} color={event.color} />
          </View>
          {!isLast && <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border as string, marginTop: 3 }} />}
        </View>

        <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14, paddingTop: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: event.color, flex: 1 }}>
              {event.summary}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string }}>
                {fmtTime(event.occurredAt)}
              </Text>
              {hasDetail && (
                <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={13}
                  color={colors.mutedForeground as string} />
              )}
            </View>
          </View>

          {/* Collapsed one-liner */}
          {!isExpanded && hasDetail && (event as any).detail && (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string, marginTop: 2 }}
              numberOfLines={1}>
              {(event as any).detail}
            </Text>
          )}

          {/* Expanded detail */}
          {isExpanded && (event as any).detail && (
            <Text style={{
              fontFamily: "Inter_400Regular", fontSize: 12,
              color: colors.mutedForeground as string, marginTop: 4, lineHeight: 17,
            }}>
              {(event as any).detail}
            </Text>
          )}

          {/* AI decisions list */}
          {isExpanded && event.kind === "ai-analysis" && (event.aiDecisions?.length ?? 0) > 0 && (
            <View style={{ marginTop: 6, gap: 4 }}>
              {event.aiDecisions!.map((decision, dIdx) => (
                <View key={dIdx} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                  <Text style={{ color: event.color, fontSize: 11, lineHeight: 17 }}>›</Text>
                  <Text style={{
                    fontFamily: "Inter_400Regular", fontSize: 11,
                    color: colors.mutedForeground as string, lineHeight: 17, flex: 1,
                  }}>
                    {decision}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  c: any;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
  cookId: number;
  cookSeqData: SequenceData | null | undefined;
  checkins: CookCheckin[];
  checkinsLoading: boolean;
  onOpenCheckin: (checkin: ScheduledCheckin) => void;
  triggeredAlerts?: TriggeredAlert[];
  stepConfirmations?: StepConfirmation[];
  liveReadingMilestones?: LiveReadingMilestone[];
  effectivePro: boolean;
  isIdentityLinked: boolean;
  showPaywall: (opts?: ShowOptions) => void;
  plannedCheckins?: ScheduledCheckin[];
  onRemovePlanned?: (phaseKey: string) => void;
  /** Refetch interval in ms for active-cook event polling. Defaults to the
   *  20-min baseline; pass the cook-screen's computed probe interval so the
   *  timeline stays in sync with probe polling cadence. */
  refetchIntervalMs?: number;
}

export function CookActivityTimeline({
  c, colors, cookStatus, nowMs, cookId, cookSeqData, checkins, checkinsLoading,
  onOpenCheckin, triggeredAlerts = [], stepConfirmations = [], liveReadingMilestones = [],
  effectivePro, isIdentityLinked, showPaywall, plannedCheckins = [], onRemovePlanned,
  refetchIntervalMs = PROBE_POLL_INTERVAL_MS,
}: Props) {
  const [expanded, setExpanded] = useState(cookStatus === "active");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);
  const prevCountRef = useRef(0);
  const isAtBottomRef = useRef(true);

  const isActive = cookStatus === "active";
  const isCompleted = cookStatus === "completed";
  const isPlanned = cookStatus === "planned";

  const { data: cookEvents = [], isLoading: eventsLoading, error: eventsError } = useListCookEvents(cookId, {
    query: {
      queryKey: getListCookEventsQueryKey(cookId),
      enabled: isActive || isCompleted,
      refetchInterval: isActive ? refetchIntervalMs : false,
      // Short staleTime prevents isLoading from flipping back to true on a
      // fast re-navigation — the data is already fresh from the initial fetch.
      staleTime: 5_000,
    },
  });

  // ── Loading timeout guard ─────────────────────────────────────────────────
  // If either the checkins or events query hasn't resolved within 15 s, give
  // up on the spinner and show the empty state so the section never hangs
  // indefinitely. The timer resets whenever the loading state changes.
  const [loadingTimedOut, setLoadingTimedOut] = React.useState(false);
  const isCurrentlyLoading = !isPlanned && (checkinsLoading || eventsLoading);
  React.useEffect(() => {
    if (!isCurrentlyLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const id = setTimeout(() => setLoadingTimedOut(true), 15_000);
    return () => clearTimeout(id);
  }, [isCurrentlyLoading]);

  // ── Scheduled check-in phases ────────────────────────────────────────────────
  const firstItem = cookSeqData?.schedule?.[0];
  const meatOnAt =
    firstItem?.meatOnAt ??
    (c?.actualStartAt as string | null | undefined) ??
    (c?.plannedStartAt as string | null | undefined) ??
    null;
  const estimatedFinishAt =
    firstItem?.estimatedFinishAt ??
    (c?.plannedEndAt as string | null | undefined) ??
    null;
  const foodType = (firstItem?.foodType ?? (c?.foodType as string | null | undefined)) || null;

  const aiRefining = !!(cookSeqData as any)?.aiRefining;
  const rawAiCheckins: AiCheckinItem[] | null | undefined = cookSeqData?.aiCheckins;

  const scheduledCheckins: ScheduledCheckin[] = React.useMemo(() => {
    if (!meatOnAt || !estimatedFinishAt) return [];
    const meatOnAtMs = new Date(meatOnAt).getTime();
    const finishAtMs = new Date(estimatedFinishAt).getTime();
    if (finishAtMs <= meatOnAtMs) return [];
    const anchor: CheckinSequenceAnchor = {
      meatOnAt,
      estimatedFinishAt,
      wrapAtMinutes: firstItem?.wrapAtMinutes ?? (c?.wrapAtMinutes as number | null | undefined) ?? null,
    };
    return generateCheckinSchedule(foodType, meatOnAtMs, finishAtMs, anchor);
  }, [foodType, meatOnAt, estimatedFinishAt, firstItem?.wrapAtMinutes, c?.wrapAtMinutes]);

  const _dummyPhase: CheckinPhase = React.useMemo(() => ({
    key: "", label: "", anchorPercent: 0, expectedInternalTempRange: null,
    visualCues: [], prepForNext: "", coachingTemplate: "",
  }), []);

  const aiDerivedCheckins: ScheduledCheckin[] = React.useMemo(() => {
    if (!rawAiCheckins?.length || !meatOnAt) return [];
    const meatMs = new Date(meatOnAt).getTime();
    return rawAiCheckins.map((item, i) => ({
      id: `ai_ci_${i}`,
      phaseKey: `ai_ci_${i}`,
      phaseLabel: item.label,
      scheduledAt: meatMs + item.offsetMinutes * 60_000,
      phase: _dummyPhase,
    }));
  }, [rawAiCheckins, meatOnAt, _dummyPhase]);

  const estimatedMilestones: ScheduledCheckin[] = React.useMemo(() => {
    if (!aiRefining || (rawAiCheckins?.length ?? 0) > 0) return [];
    if (!meatOnAt || !estimatedFinishAt) return [];
    const meatMs = new Date(meatOnAt).getTime();
    const finishMs = new Date(estimatedFinishAt).getTime();
    if (finishMs <= meatMs) return [];
    const wrapMinutes = firstItem?.wrapAtMinutes ?? null;
    const rows: ScheduledCheckin[] = [
      { id: "est_meat_on", phaseKey: "est_meat_on", phaseLabel: "Meat On", scheduledAt: meatMs, phase: _dummyPhase },
    ];
    if (wrapMinutes && wrapMinutes > 0) {
      rows.push({ id: "est_wrap", phaseKey: "est_wrap", phaseLabel: "Wrap", scheduledAt: meatMs + wrapMinutes * 60_000, phase: _dummyPhase });
    }
    rows.push({ id: "est_pull_off", phaseKey: "est_pull_off", phaseLabel: "Pull Off", scheduledAt: finishMs, phase: _dummyPhase });
    return rows;
  }, [aiRefining, rawAiCheckins, meatOnAt, estimatedFinishAt, firstItem?.wrapAtMinutes, _dummyPhase]);

  const completedCheckinMap = React.useMemo(() => {
    const map = new Map<string, CookCheckin>();
    for (const ci of checkins) {
      if (ci.phaseKey) map.set(ci.phaseKey, ci);
    }
    return map;
  }, [checkins]);

  // ── Build unified check-in events (merge CookCheckin + analysisHistory) ──────
  const unifiedCheckinEvents: UnifiedCheckinEvent[] = React.useMemo(() => {
    const analysisHistory: AnalysisHistoryEntry[] = Array.isArray(c?.analysisHistory)
      ? c.analysisHistory
      : [];
    return mergeCheckinsWithHistory(checkins, analysisHistory);
  }, [checkins, c?.analysisHistory]);

  // ── Build all past events ────────────────────────────────────────────────────
  const pastEvents: PastEvent[] = React.useMemo(() => {
    // Shallow-copy check-in events so we can attach mergedCookEventAnalysis without
    // mutating the objects from the unifiedCheckinEvents memo.
    const mutableCheckins: UnifiedCheckinEvent[] = unifiedCheckinEvents.map(e => ({ ...e }));
    // Track the occurredAt ms of the most recently merged event per check-in id,
    // used as a tiebreaker when two ai_analysis events have equal severity.
    const mergedAtMs = new Map<string, number>();
    const list: PastEvent[] = [...mutableCheckins];

    // Cook events from journal
    for (const evt of cookEvents as any[]) {
      const cfg = EVENT_TYPE_CONFIG[evt.eventType] ?? DEFAULT_EVENT_CFG;

      if (evt.eventType === "ai_analysis") {
        const meta = evt.metadata as { verdict?: string; summary?: string; decisions?: string[] } | null;
        const verdict = meta?.verdict ?? "";
        const evtMs = new Date(evt.occurredAt).getTime();
        const verdictColor =
          verdict === "on_track"     ? "#22c55e" :
          verdict === "watch"        ? "#F59E0B" :
          verdict === "action_needed"? "#EF4444" : cfg.color;
        const verdictLabel =
          verdict === "on_track"      ? "On Track"      :
          verdict === "watch"         ? "Watch"         :
          verdict === "action_needed" ? "Action Needed" :
          verdict || "Analysis";
        const decisions = Array.isArray(meta?.decisions) ? meta.decisions.filter(Boolean) : [];

        // Find the nearest check-in within the match window and absorb this event into it.
        let bestCheckin: UnifiedCheckinEvent | null = null;
        let bestDiff = Infinity;
        for (const ce of mutableCheckins) {
          const diff = Math.abs(ce.occurredAt - evtMs);
          if (diff < ANALYSIS_MATCH_WINDOW_MS && diff < bestDiff) {
            bestDiff = diff;
            bestCheckin = ce;
          }
        }

        if (bestCheckin) {
          // Keep the most severe verdict; break ties by choosing the more recent event.
          const existingSeverity = VERDICT_SEVERITY[bestCheckin.mergedCookEventAnalysis?.verdict ?? ""] ?? 0;
          const newSeverity = VERDICT_SEVERITY[verdict] ?? 0;
          const existingMs = mergedAtMs.get(bestCheckin.id) ?? -Infinity;
          if (!bestCheckin.mergedCookEventAnalysis || newSeverity > existingSeverity ||
              (newSeverity === existingSeverity && evtMs > existingMs)) {
            bestCheckin.mergedCookEventAnalysis = {
              verdict,
              verdictColor,
              verdictLabel,
              summary: meta?.summary ?? evt.note ?? undefined,
              decisions: decisions.length > 0 ? decisions : undefined,
            };
            mergedAtMs.set(bestCheckin.id, evtMs);
          }
          continue;
        }

        // No nearby check-in — show as a standalone row.
        list.push({
          kind: "ai-analysis",
          id: `event-${evt.id}`,
          occurredAt: evtMs,
          icon: cfg.icon,
          color: verdictColor,
          summary: `PitMaster Analysis — ${verdictLabel}`,
          detail: meta?.summary ?? evt.note ?? undefined,
          aiDecisions: decisions.length > 0 ? decisions : undefined,
          verdict,
        });
        continue;
      }

      list.push({
        kind: "journal-event",
        id: `event-${evt.id}`,
        occurredAt: new Date(evt.occurredAt).getTime(),
        icon: cfg.icon,
        color: cfg.color,
        summary: cfg.label,
        detail: evt.note ?? undefined,
        rawEventType: evt.eventType,
      });
    }

    // Triggered temperature alerts
    for (const alert of triggeredAlerts) {
      list.push({
        kind: "triggered-alert",
        id: `alert-${alert.id}`,
        occurredAt: new Date(alert.triggeredAt).getTime(),
        icon: "thermometer",
        color: "#EF4444",
        summary: "Temp Alert Triggered",
        detail: alert.message,
      });
    }

    // Step confirmations
    for (const step of stepConfirmations) {
      list.push({
        kind: "step-confirmation",
        id: step.id,
        occurredAt: new Date(step.confirmedAt).getTime(),
        icon: "check-square",
        color: "#6C3BF5",
        summary: step.label,
      });
    }

    // Probe milestones
    for (const m of liveReadingMilestones) {
      const cookStart = checkins[0]
        ? new Date(checkins[0].scheduledAt).getTime() - m.timeMinutes * 60000
        : Date.now() - m.timeMinutes * 60000;
      list.push({
        kind: "probe-milestone",
        id: m.id,
        occurredAt: cookStart + m.timeMinutes * 60000,
        icon: "bar-chart-2",
        color: "#0EA5E9",
        summary: `Probe hit ${Math.round(m.tempF)}°F`,
        detail: `${m.timeMinutes} min into cook`,
      });
    }

    list.sort((a, b) => a.occurredAt - b.occurredAt);
    return list;
  }, [unifiedCheckinEvents, cookEvents, triggeredAlerts, stepConfirmations, liveReadingMilestones, checkins]);

  // ── Upcoming scheduled milestones ────────────────────────────────────────────
  const upcomingScheduled: ScheduledCheckin[] = React.useMemo(() => {
    if (!isActive && !isPlanned) return [];
    const upcoming = scheduledCheckins.filter(
      (sc) => !completedCheckinMap.has(sc.phaseKey) && sc.scheduledAt > nowMs,
    );
    if (upcoming.length === 0 && scheduledCheckins.length === 0) {
      return plannedCheckins.filter((sc) => sc.scheduledAt > nowMs);
    }
    return upcoming;
  }, [scheduledCheckins, completedCheckinMap, nowMs, isActive, isPlanned, plannedCheckins]);

  const planOnlyScheduled: ScheduledCheckin[] = React.useMemo(() => {
    if (!isPlanned) return [];
    if (aiDerivedCheckins.length > 0) return aiDerivedCheckins;
    if (estimatedMilestones.length > 0) return estimatedMilestones;
    return scheduledCheckins;
  }, [isPlanned, aiDerivedCheckins, estimatedMilestones, scheduledCheckins]);

  // Auto-expand and scroll on new events during active cook.
  // Only fires when a genuinely new event arrives (prevCount > 0 ensures initial
  // load is skipped). Scroll is suppressed when the user has scrolled upward.
  useEffect(() => {
    if (!isActive) return;
    const prevCount = prevCountRef.current;
    prevCountRef.current = pastEvents.length;
    if (pastEvents.length === 0 || prevCount === 0 || pastEvents.length <= prevCount) return;
    setExpanded(true);
    if (!isAtBottomRef.current) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastEvents.length, isActive]);

  const toggleEntry = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Last AI verdict chip (for collapsed header) ───────────────────────────
  const lastVerdictChip = React.useMemo(() => {
    const eligible = pastEvents
      .filter((e): e is AiAnalysisEvent | UnifiedCheckinEvent => {
        if (e.kind === "ai-analysis") return true;
        if (e.kind === "checkin" && (
          !!e.historyEntry?.assessment?.verdict || !!e.mergedCookEventAnalysis?.verdict
        )) return true;
        return false;
      })
      .slice()
      .sort((a, b) => b.occurredAt - a.occurredAt);

    if (eligible.length === 0) return null;
    const latest = eligible[0];

    if (latest.kind === "ai-analysis") {
      const v = latest.verdict ?? "";
      const label =
        v === "on_track"      ? "On Track"      :
        v === "watch"         ? "Watch"         :
        v === "action_needed" ? "Action Needed" :
        "Analysis";
      const color =
        v === "on_track"      ? "#22c55e" :
        v === "watch"         ? "#F59E0B" :
        v === "action_needed" ? "#EF4444" :
        latest.color;
      return { color, label };
    }

    if (latest.kind === "checkin") {
      // Prefer the historyEntry verdict; fall back to the merged cook event analysis.
      const verdict = latest.historyEntry?.assessment?.verdict ?? latest.mergedCookEventAnalysis?.verdict ?? null;
      if (verdict) {
        // Use the pre-computed verdictColor when available (avoids re-deriving for non-VERDICT_COLORS keys).
        const color = latest.mergedCookEventAnalysis?.verdict === verdict
          ? (latest.mergedCookEventAnalysis.verdictColor ?? (VERDICT_COLORS[verdict] ?? "#22c55e"))
          : (VERDICT_COLORS[verdict] ?? "#22c55e");
        const label = verdict.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
        return { color, label };
      }
    }

    return null;
  }, [pastEvents]);

  // ── Visibility ───────────────────────────────────────────────────────────────
  if (!isActive && !isCompleted && !isPlanned) return null;

  const shownScheduled = isPlanned ? planOnlyScheduled : upcomingScheduled;
  const nextCheckinKey = isActive && shownScheduled.length > 0 ? shownScheduled[0].phaseKey : null;

  const isShowingEstimated = isPlanned && estimatedMilestones.length > 0 && aiDerivedCheckins.length === 0;

  const allRows: ActivityEvent[] = [
    ...pastEvents,
    ...shownScheduled.map((sc) => ({
      kind: "scheduled-milestone" as const,
      id: `scheduled-${sc.phaseKey}`,
      occurredAt: sc.scheduledAt,
      sc,
      isNext: sc.phaseKey === nextCheckinKey,
      isEstimated: sc.phaseKey.startsWith("est_"),
    })),
  ];

  const hasAnyContent =
    allRows.length > 0 || checkinsLoading || eventsLoading;

  if (!hasAnyContent && !isCompleted) return null;

  const meatOnAtMs = meatOnAt ? new Date(meatOnAt).getTime() : null;
  const isMeatOnYet = meatOnAtMs == null || meatOnAtMs <= nowMs;

  // Header label
  const upcomingCount = shownScheduled.length;
  const totalPastCount = pastEvents.length;
  const headerSubLabel = (() => {
    if (isPlanned) {
      const base = `${upcomingCount} check-in${upcomingCount !== 1 ? "s" : ""} planned`;
      return isShowingEstimated ? `${base} (estimated)` : base;
    }
    if (totalPastCount > 0 && upcomingCount > 0)
      return `${totalPastCount} event${totalPastCount !== 1 ? "s" : ""} · ${upcomingCount} upcoming`;
    if (totalPastCount > 0)
      return `${totalPastCount} event${totalPastCount !== 1 ? "s" : ""}`;
    if (upcomingCount > 0) return `${upcomingCount} upcoming`;
    return isActive ? "Activity will appear here" : "No activity recorded";
  })();

  return (
    <View style={{
      backgroundColor: colors.card as string,
      borderRadius: colors.radius as number,
      borderWidth: 1,
      borderColor: colors.border as string,
      overflow: "hidden",
    }}>
      {/* Header */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{
          flexDirection: "row", alignItems: "center", gap: 8, padding: 14,
          borderBottomWidth: 1, borderBottomColor: colors.border as string,
        }}
      >
        <View style={{
          width: 24, height: 24, borderRadius: 6,
          backgroundColor: "#E8482018", alignItems: "center", justifyContent: "center",
        }}>
          <Feather name="activity" size={13} color="#E84820" />
        </View>
        <Text style={{
          flex: 1, fontFamily: "Inter_700Bold", fontSize: 12,
          color: colors.mutedForeground as string, textTransform: "uppercase", letterSpacing: 0.8,
        }}>
          Activity
        </Text>
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground as string }}>
          {headerSubLabel}
        </Text>
        {!expanded && lastVerdictChip && (
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
            backgroundColor: lastVerdictChip.color + "20",
            borderWidth: 1, borderColor: lastVerdictChip.color + "40",
          }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: lastVerdictChip.color }}>
              {lastVerdictChip.label}
            </Text>
          </View>
        )}
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16}
          color={colors.mutedForeground as string} />
      </Pressable>

      {/* Loading — planned cooks have no past check-ins, so suppress the
           transient isLoading spinner that fires while the query resolves.
           After 15 s or on error, fall through to the empty state below. */}
      {!isPlanned && (checkinsLoading || eventsLoading) && !loadingTimedOut && !eventsError && (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary as string} />
        </View>
      )}

      {/* Error / timeout fallback — replaces the spinner so it never hangs */}
      {!isPlanned && (loadingTimedOut || !!eventsError) && pastEvents.length === 0 && (
        <View style={{ padding: 16 }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground as string, textAlign: "center" }}>
            No activity yet — events will appear as your cook progresses
          </Text>
        </View>
      )}

      {/* Meat not on yet */}
      {!checkinsLoading && !eventsLoading && isActive && !isMeatOnYet && pastEvents.length === 0 && (
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Feather name="clock" size={14} color={colors.mutedForeground as string} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground as string, flex: 1 }}>
            Activity begins when meat goes on
            {meatOnAtMs
              ? ` at ${new Date(meatOnAtMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`
              : ""}
          </Text>
        </View>
      )}

      {/* Empty active state */}
      {!checkinsLoading && !eventsLoading && isActive && isMeatOnYet && allRows.length === 0 && (
        <View style={{ padding: 16 }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground as string, textAlign: "center" }}>
            Check-ins, quick logs, and alerts will appear here
          </Text>
        </View>
      )}

      {/* Empty completed state */}
      {!checkinsLoading && !eventsLoading && isCompleted && !hasAnyContent && (
        <View style={{ padding: 16 }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground as string, textAlign: "center" }}>
            No check-ins recorded during this cook
          </Text>
        </View>
      )}

      {/* Timeline rows */}
      {!checkinsLoading && !eventsLoading && expanded && allRows.length > 0 && (
        <ScrollView ref={scrollRef} style={{ maxHeight: 520 }}
          showsVerticalScrollIndicator={false} nestedScrollEnabled
          scrollEventThrottle={100}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            isAtBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 32;
          }}>
          {isShowingEstimated && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2,
            }}>
              <ActivityIndicator size="small" color={colors.mutedForeground as string} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string, fontStyle: "italic" }}>
                PitMaster is personalizing your check-in schedule…
              </Text>
            </View>
          )}
          <View style={{ padding: 14 }}>
            {allRows.map((row, idx) => {
              const isLast = idx === allRows.length - 1;

              if (row.kind === "scheduled-milestone") {
                const aiIdx = row.sc.phaseKey.startsWith("ai_ci_")
                  ? parseInt(row.sc.phaseKey.slice(6), 10)
                  : NaN;
                const aiCheckinItem = !isNaN(aiIdx) && rawAiCheckins ? rawAiCheckins[aiIdx] : null;
                return (
                  <ScheduledMilestoneRow key={row.id}
                    sc={row.sc} isNext={row.isNext} isEstimated={row.isEstimated}
                    colors={colors} nowMs={nowMs}
                    onRemovePlanned={onRemovePlanned}
                    isLast={isLast} onOpenCheckin={onOpenCheckin}
                    aiCheckinItem={aiCheckinItem}
                  />
                );
              }

              if (row.kind === "checkin") {
                return (
                  <CheckinRow key={row.id}
                    event={row} isLast={isLast}
                    isExpanded={expandedIds.has(row.id)}
                    onToggle={() => toggleEntry(row.id)}
                    colors={colors}
                    effectivePro={effectivePro}
                    isIdentityLinked={isIdentityLinked}
                    cookStatus={cookStatus}
                    totalCheckinCount={unifiedCheckinEvents.length}
                    showPaywall={showPaywall}
                    cookFoodType={c?.foodType ?? null}
                  />
                );
              }

              return (
                <GenericEventRow key={row.id}
                  event={row as Exclude<PastEvent, UnifiedCheckinEvent>}
                  isLast={isLast}
                  isExpanded={expandedIds.has(row.id)}
                  onToggle={() => toggleEntry(row.id)}
                  colors={colors}
                />
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Collapsed prompt */}
      {!checkinsLoading && !eventsLoading && !expanded && totalPastCount > 0 && (
        <Pressable onPress={() => setExpanded(true)} style={{ padding: 14 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.primary as string }}>
            Show all {totalPastCount} event{totalPastCount !== 1 ? "s" : ""} ↓
          </Text>
        </Pressable>
      )}
    </View>
  );
}
