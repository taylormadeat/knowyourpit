import React, { useState, useRef, useEffect } from "react";
import type { ComponentProps } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useListCookEvents, getListCookEventsQueryKey } from "@workspace/api-client-react";
import type { CookCheckin, CookLogEvent } from "@workspace/api-client-react";

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

interface JournalEntry {
  id: string;
  occurredAt: number;
  type: "checkin" | "event" | "alert" | "step" | "probe";
  icon: FeatherName;
  color: string;
  summary: string;
  detail?: string;
  rawEventType?: string;
  aiDecisions?: string[];
}

const EVENT_TYPE_CONFIG: Record<string, { icon: FeatherName; color: string; label: string }> = {
  lid_open:        { icon: "wind",          color: "#6B7280", label: "Lid Opened"        },
  flare_up:        { icon: "alert-triangle",color: "#EF4444", label: "Flare-Up"          },
  spritz:          { icon: "droplet",       color: "#3B82F6", label: "Spritz"            },
  charcoal_add:    { icon: "plus-circle",   color: "#F97316", label: "Charcoal Added"    },
  wood_add:        { icon: "package",       color: "#92400E", label: "Wood Added"        },
  fuel_low:        { icon: "trending-down", color: "#8B5CF6", label: "Fuel Low"          },
  vent_adjust:     { icon: "sliders",       color: "#0EA5E9", label: "Vent Adjusted"     },
  user_note:       { icon: "edit-3",        color: "#22c55e", label: "Note"              },
  proactive_alert: { icon: "bell",          color: "#EAB308", label: "AI Alert"          },
  voice_note:      { icon: "mic",           color: "#A78BFA", label: "Voice Note"        },
  ai_analysis:     { icon: "cpu",           color: "#6C3BF5", label: "PitMaster Analysis"},
};

const DEFAULT_EVENT_CFG: { icon: FeatherName; color: string; label: string } = {
  icon: "activity",
  color: "#6B7280",
  label: "Event",
};

const STATUS_FLAG_CONFIG: Partial<Record<string, { color: string; label: string }>> = {
  all_good:       { color: "#22c55e", label: "All good"      },
  running_behind: { color: "#F59E0B", label: "Running behind" },
  flare_up:       { color: "#EF4444", label: "Flare-up"      },
  low_fuel:       { color: "#8B5CF6", label: "Low fuel"       },
};

const fmtTime = (ms: number) => {
  try {
    return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
};

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

interface Props {
  cookId: number;
  colors: Colors;
  cookStatus: string | undefined;
  checkins: CookCheckin[];
  triggeredAlerts?: TriggeredAlert[];
  stepConfirmations?: StepConfirmation[];
  liveReadingMilestones?: LiveReadingMilestone[];
}

export function PitJournalFeed({
  cookId, colors, cookStatus, checkins,
  triggeredAlerts = [], stepConfirmations = [], liveReadingMilestones = [],
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  const { data: events = [], isLoading } = useListCookEvents(cookId, {
    query: {
      queryKey: getListCookEventsQueryKey(cookId),
      enabled: cookStatus === "active" || cookStatus === "completed",
      refetchInterval: cookStatus === "active" ? 15000 : false,
    },
  });

  if (cookStatus !== "active" && cookStatus !== "completed") return null;

  const entries: JournalEntry[] = [];

  // --- Check-in entries ---
  for (const ci of checkins) {
    const statusCfg = ci.statusFlag ? STATUS_FLAG_CONFIG[ci.statusFlag] : null;
    const aiGuidance = ci.aiGuidanceShown ?? null;
    entries.push({
      id: `checkin-${ci.id}`,
      occurredAt: new Date(ci.scheduledAt).getTime(),
      type: "checkin",
      icon: statusCfg
        ? (ci.statusFlag === "all_good" ? "check-circle" : "alert-circle")
        : "check-circle",
      color: statusCfg?.color ?? "#22c55e",
      summary: `Check-In${ci.phaseLabel ? ` — ${ci.phaseLabel}` : ""}${ci.autoDismissed ? " (auto)" : ""}`,
      detail: [
        ci.internalTempF != null ? `Internal: ${Math.round(ci.internalTempF)}°F` : null,
        ci.pitTempF != null ? `Pit: ${Math.round(ci.pitTempF)}°F` : null,
        statusCfg ? statusCfg.label : null,
        ci.userNote || null,
        aiGuidance
          ? `PitMaster: "${aiGuidance.slice(0, 120)}${aiGuidance.length > 120 ? "…" : ""}"`
          : null,
      ].filter(Boolean).join(" · ") || undefined,
    });
  }

  // --- Cook events (quick-log / proactive alerts / AI analysis) ---
  for (const evt of events) {
    const cfg = EVENT_TYPE_CONFIG[evt.eventType] ?? DEFAULT_EVENT_CFG;

    if (evt.eventType === "ai_analysis") {
      const meta = evt.metadata as { verdict?: string; summary?: string; decisions?: string[] } | null;
      const verdict = meta?.verdict ?? "";
      const verdictColor =
        verdict === "on_track" ? "#22c55e" :
        verdict === "watch"    ? "#F59E0B" :
        verdict === "action_needed" ? "#EF4444" :
        cfg.color;
      const verdictLabel =
        verdict === "on_track"     ? "On Track"      :
        verdict === "watch"        ? "Watch"         :
        verdict === "action_needed"? "Action Needed" :
        verdict ? verdict : "Analysis";
      const decisions = Array.isArray(meta?.decisions) ? meta.decisions.filter(Boolean) : [];
      entries.push({
        id: `event-${evt.id}`,
        occurredAt: new Date(evt.occurredAt).getTime(),
        type: "event",
        icon: cfg.icon,
        color: verdictColor,
        summary: `PitMaster Analysis — ${verdictLabel}`,
        detail: meta?.summary ?? evt.note ?? undefined,
        rawEventType: evt.eventType,
        aiDecisions: decisions.length > 0 ? decisions : undefined,
      });
      continue;
    }

    entries.push({
      id: `event-${evt.id}`,
      occurredAt: new Date(evt.occurredAt).getTime(),
      type: "event",
      icon: cfg.icon,
      color: cfg.color,
      summary: cfg.label,
      detail: evt.note ?? undefined,
      rawEventType: evt.eventType,
    });
  }

  // --- Temperature threshold alerts that fired ---
  for (const alert of triggeredAlerts) {
    entries.push({
      id: `alert-${alert.id}`,
      occurredAt: new Date(alert.triggeredAt).getTime(),
      type: "alert",
      icon: "thermometer",
      color: "#EF4444",
      summary: "Temp Alert Triggered",
      detail: alert.message,
    });
  }

  // --- Cook step confirmations ---
  for (const step of stepConfirmations) {
    entries.push({
      id: step.id,
      occurredAt: new Date(step.confirmedAt).getTime(),
      type: "step",
      icon: "check-square",
      color: "#6C3BF5",
      summary: step.label,
    });
  }

  // --- Probe reading milestones (every 25 °F crossing) ---
  for (const m of liveReadingMilestones) {
    const cookStart = checkins[0]
      ? new Date(checkins[0].scheduledAt).getTime() - m.timeMinutes * 60000
      : Date.now() - m.timeMinutes * 60000;
    entries.push({
      id: m.id,
      occurredAt: cookStart + m.timeMinutes * 60000,
      type: "probe",
      icon: "bar-chart-2",
      color: "#0EA5E9",
      summary: `Probe hit ${Math.round(m.tempF)}°F`,
      detail: `${m.timeMinutes} min into cook`,
    });
  }

  entries.sort((a, b) => a.occurredAt - b.occurredAt);

  if (entries.length === 0 && !isLoading) {
    if (cookStatus !== "active") return null;
  }

  const displayEntries = expanded ? entries : entries.slice(-5);
  const hasMore = entries.length > 5;

  const toggleEntry = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <JournalContainer
      entries={entries}
      cookStatus={cookStatus}
      expanded={expanded}
      setExpanded={setExpanded}
      hasMore={hasMore}
      displayEntries={displayEntries}
      expandedIds={expandedIds}
      toggleEntry={toggleEntry}
      isLoading={isLoading}
      scrollRef={scrollRef}
      colors={colors}
    />
  );
}

// Separate the stateful auto-scroll logic into a component that receives
// entries.length as a prop so the useEffect dependency is stable.
interface ContainerProps {
  entries: JournalEntry[];
  cookStatus: string | undefined;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  hasMore: boolean;
  displayEntries: JournalEntry[];
  expandedIds: Set<string>;
  toggleEntry: (id: string) => void;
  isLoading: boolean;
  scrollRef: React.RefObject<ScrollView | null>;
  colors: Colors;
}

function JournalContainer({
  entries, cookStatus, expanded, setExpanded, hasMore,
  displayEntries, expandedIds, toggleEntry, isLoading, scrollRef, colors,
}: ContainerProps) {
  // Auto-expand and scroll to latest entry when a new event arrives during an
  // active cook so the pitmaster sees it without manual interaction.
  useEffect(() => {
    if (cookStatus !== "active" || entries.length === 0) return;
    setExpanded(true);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, cookStatus]);

  return (
    <View
      style={{
        backgroundColor: colors.card as string,
        borderRadius: colors.radius as number,
        borderWidth: 1,
        borderColor: colors.border as string,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          padding: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border as string,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            backgroundColor: "#E8482018",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="book-open" size={13} color="#E84820" />
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: "Inter_700Bold",
            fontSize: 12,
            color: colors.mutedForeground as string,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Pit Journal
        </Text>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 12,
            color: colors.mutedForeground as string,
          }}
        >
          {entries.length} events
        </Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground as string}
        />
      </Pressable>

      {isLoading && (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary as string} />
        </View>
      )}

      {!isLoading && entries.length === 0 && cookStatus === "active" && (
        <View style={{ padding: 16 }}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.mutedForeground as string,
              textAlign: "center",
            }}
          >
            Check-ins, quick logs, and alerts will appear here
          </Text>
        </View>
      )}

      {!isLoading && entries.length > 0 && (
        <ScrollView
          ref={scrollRef}
          style={{ maxHeight: expanded ? 480 : undefined }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          scrollEnabled={expanded}
        >
          <View style={{ padding: 14 }}>
            {!expanded && hasMore && (
              <Pressable onPress={() => setExpanded(true)} style={{ paddingBottom: 10 }}>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                    color: colors.primary as string,
                  }}
                >
                  Show all {entries.length} events ↑
                </Text>
              </Pressable>
            )}
            {displayEntries.map((entry, idx) => {
              const isLast = idx === displayEntries.length - 1;
              const isOpen = expandedIds.has(entry.id);
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => (entry.detail ? toggleEntry(entry.id) : undefined)}
                >
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ alignItems: "center", width: 28 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: entry.color + "18",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1.5,
                          borderColor: entry.color + "40",
                        }}
                      >
                        <Feather name={entry.icon} size={13} color={entry.color} />
                      </View>
                      {!isLast && (
                        <View
                          style={{
                            flex: 1,
                            width: 1.5,
                            backgroundColor: colors.border as string,
                            marginTop: 3,
                          }}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 13,
                            color: entry.color,
                          }}
                        >
                          {entry.summary}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 11,
                            color: colors.mutedForeground as string,
                          }}
                        >
                          {fmtTime(entry.occurredAt)}
                        </Text>
                      </View>
                      {(isOpen || !entry.detail) && entry.detail && (
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 12,
                            color: colors.mutedForeground as string,
                            marginTop: 3,
                            lineHeight: 17,
                          }}
                        >
                          {entry.detail}
                        </Text>
                      )}
                      {!isOpen && entry.detail && (
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 11,
                            color: colors.mutedForeground as string,
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                        >
                          {entry.detail}
                        </Text>
                      )}
                      {isOpen && entry.aiDecisions && entry.aiDecisions.length > 0 && (
                        <View style={{ marginTop: 6, gap: 4 }}>
                          {entry.aiDecisions.map((decision, dIdx) => (
                            <View key={dIdx} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                              <Text style={{ color: entry.color, fontSize: 11, lineHeight: 17 }}>›</Text>
                              <Text
                                style={{
                                  fontFamily: "Inter_400Regular",
                                  fontSize: 11,
                                  color: colors.mutedForeground as string,
                                  lineHeight: 17,
                                  flex: 1,
                                }}
                              >
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
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
