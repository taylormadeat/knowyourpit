import React, { useState, useEffect, useRef } from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { planStyles as s } from "./styles";
import { fmtMinutes } from "@/utils/duration";
import { fmtDuration, formatDateTime } from "./utils";

type Colors = any;

interface SelectedChips {
  cookingMethod?: string | null;
  meatStartTemp?: string | null;
  injection?: string | null;
  spritzFrequency?: string | null;
  wrapFinish?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  aiResult: any | null;
  applyAiPlan: () => void;
  grillName?: string;
  selectedChips?: SelectedChips;
  retrying?: boolean;
  isStreaming?: boolean;
}

const CHIP_LABELS: { key: keyof SelectedChips; label: string }[] = [
  { key: "cookingMethod", label: "Method" },
  { key: "meatStartTemp", label: "Start Temp" },
  { key: "injection", label: "Injection" },
  { key: "spritzFrequency", label: "Spritz/Mop" },
  { key: "wrapFinish", label: "Wrap" },
];

function ShimmerBar({ width, colors }: { width: number | `${number}%`; colors: Colors }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });
  return (
    <Animated.View style={{
      height: 12,
      width,
      borderRadius: 6,
      backgroundColor: colors.border,
      opacity,
    }} />
  );
}

// ── Timeline entry types ─────────────────────────────────────────────────────

type EventEntry = {
  kind: "event";
  icon: string;
  label: string;
  absoluteMs: number;
};

type CheckinEntry = {
  kind: "checkin";
  index: number;
  ci: any;
  absoluteMs: number;
};

type WrapEntry = {
  kind: "wrap";
  method: string;
  wrapTempF?: number;
  reason?: string;
  absoluteMs: number;
};

type RestEntry = {
  kind: "rest";
  restMinutes: number;
  absoluteMs: number;
};

type TimelineEntry = EventEntry | CheckinEntry | WrapEntry | RestEntry;

function buildTimeline(aiResult: any): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  const parseMs = (val: string | null | undefined): number | null => {
    if (!val) return null;
    const ms = new Date(val).getTime();
    return isNaN(ms) ? null : ms;
  };

  const grillLightMs = parseMs(aiResult.grillLightAt);
  const startMs = parseMs(aiResult.suggestedStartAt);
  const finishMs = parseMs(aiResult.estimatedFinishAt);
  const serveMs = parseMs(aiResult.serveAt);

  if (grillLightMs != null) {
    entries.push({ kind: "event", icon: "power", label: "Light grill", absoluteMs: grillLightMs });
  }
  if (startMs != null) {
    entries.push({ kind: "event", icon: "zap", label: "Put food on", absoluteMs: startMs });
  }

  if (startMs != null && Array.isArray(aiResult.checkins)) {
    for (let i = 0; i < aiResult.checkins.length; i++) {
      const ci = aiResult.checkins[i];
      const absMs = startMs + (ci.offsetMinutes ?? 0) * 60_000;
      entries.push({ kind: "checkin", index: i, ci, absoluteMs: absMs });
    }
  }

  if (startMs != null && aiResult.wrap && aiResult.wrap.method !== "none" && aiResult.wrap.wrapAtMinutes > 0) {
    const wrapMs = startMs + aiResult.wrap.wrapAtMinutes * 60_000;
    entries.push({
      kind: "wrap",
      method: aiResult.wrap.method,
      wrapTempF: aiResult.wrap.wrapTempF,
      reason: aiResult.wrap.reason,
      absoluteMs: wrapMs,
    });
  }

  if (finishMs != null) {
    entries.push({ kind: "event", icon: "pause", label: "Pull off grill", absoluteMs: finishMs });
  }

  if (finishMs != null && aiResult.wrap?.restMinutes > 0) {
    entries.push({
      kind: "rest",
      restMinutes: aiResult.wrap.restMinutes,
      absoluteMs: finishMs + 1,
    });
  }

  if (serveMs != null) {
    entries.push({ kind: "event", icon: "check-circle", label: "Ready to serve", absoluteMs: serveMs });
  }

  entries.sort((a, b) => a.absoluteMs - b.absoluteMs);
  return entries;
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function TimelineConnector({ colors }: { colors: Colors }) {
  return (
    <View style={{
      width: 1,
      flex: 1,
      minHeight: 10,
      backgroundColor: colors.border,
      marginTop: 3,
      alignSelf: "center",
    }} />
  );
}

function EventRow({
  icon,
  label,
  absoluteMs,
  colors,
  isLast,
}: {
  icon: string;
  label: string;
  absoluteMs: number;
  colors: Colors;
  isLast: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", width: 36 }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#6C3BF5" + "20",
          borderWidth: 1,
          borderColor: "#6C3BF5" + "50",
        }}>
          <Feather name={icon as any} size={16} color="#6C3BF5" />
        </View>
        {!isLast && <TimelineConnector colors={colors} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14, justifyContent: "center" }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 1 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>
          {formatDateTime(new Date(absoluteMs))}
        </Text>
      </View>
    </View>
  );
}

function CheckinRow({
  ci,
  absoluteMs,
  expanded,
  onToggle,
  colors,
  isLast,
}: {
  ci: any;
  absoluteMs: number;
  expanded: boolean;
  onToggle: () => void;
  colors: Colors;
  isLast: boolean;
}) {
  const isWrap = /wrap/i.test(ci.label ?? "");
  const iconName = isWrap ? "package" : "clock";
  const accentColor = isWrap ? "#F59E0B" : "#6C3BF5";
  const hasDetail = !!(ci.coachingNote || ci.expectedInternalTempRange);

  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", width: 36 }}>
        <View style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: accentColor + "18",
          borderWidth: 1,
          borderColor: accentColor + "40",
        }}>
          <Feather name={iconName as any} size={12} color={accentColor} />
        </View>
        {!isLast && <TimelineConnector colors={colors} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
        <Pressable
          onPress={hasDetail ? onToggle : undefined}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          hitSlop={6}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 1 }}>
              {formatDateTime(new Date(absoluteMs))} · +{fmtDuration(ci.offsetMinutes)}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: isWrap ? "#F59E0B" : colors.foreground }}>
              {ci.label}
            </Text>
          </View>
          {ci.expectedInternalTempRange && (
            <View style={{
              backgroundColor: colors.muted,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                {ci.expectedInternalTempRange[0]}–{ci.expectedInternalTempRange[1]}°F
              </Text>
            </View>
          )}
          {hasDetail && (
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.mutedForeground}
            />
          )}
        </Pressable>
        {expanded && ci.coachingNote && (
          <Text style={{
            fontSize: 12,
            fontFamily: "Inter_400Regular",
            color: colors.mutedForeground,
            lineHeight: 17,
            marginTop: 6,
            paddingRight: 4,
          }}>
            {ci.coachingNote}
          </Text>
        )}
      </View>
    </View>
  );
}

function WrapRow({
  entry,
  colors,
  isLast,
}: {
  entry: WrapEntry;
  colors: Colors;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const methodLabel =
    entry.method === "butcher_paper" ? "Butcher Paper Wrap" : "Foil Wrap (Texas Crutch)";

  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", width: 36 }}>
        <View style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F59E0B18",
          borderWidth: 1,
          borderColor: "#F59E0B40",
        }}>
          <Feather name="package" size={12} color="#F59E0B" />
        </View>
        {!isLast && <TimelineConnector colors={colors} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
        <Pressable
          onPress={entry.reason ? () => setExpanded(v => !v) : undefined}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          hitSlop={6}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 1 }}>
              {formatDateTime(new Date(entry.absoluteMs))}
              {entry.wrapTempF ? ` · ${entry.wrapTempF}°F internal` : ""}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#F59E0B" }}>
              {methodLabel}
            </Text>
          </View>
          {entry.reason && (
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.mutedForeground}
            />
          )}
        </Pressable>
        {expanded && entry.reason && (
          <Text style={{
            fontSize: 12,
            fontFamily: "Inter_400Regular",
            color: colors.mutedForeground,
            lineHeight: 17,
            marginTop: 6,
          }}>
            {entry.reason}
          </Text>
        )}
      </View>
    </View>
  );
}

function RestRow({
  entry,
  colors,
  isLast,
}: {
  entry: RestEntry;
  colors: Colors;
  isLast: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", width: 36 }}>
        <View style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.muted,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Feather name="coffee" size={12} color={colors.primary ?? "#6C3BF5"} />
        </View>
        {!isLast && <TimelineConnector colors={colors} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 12, justifyContent: "center" }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 1 }}>
          Rest off heat
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
          {fmtDuration(entry.restMinutes)} before serving
        </Text>
      </View>
    </View>
  );
}

// ── Partial-streaming checkin/wrap rows (relative offsets only) ───────────────

function PartialCheckinRow({ ci, isLast, colors }: { ci: any; isLast: boolean; colors: Colors }) {
  const isWrap = /wrap/i.test(ci.label ?? "");
  const iconName = isWrap ? "package" : "clock";
  const accentColor = isWrap ? "#F59E0B" : "#6C3BF5";
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", width: 36 }}>
        <View style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: accentColor + "18",
          borderWidth: 1,
          borderColor: accentColor + "40",
        }}>
          <Feather name={iconName as any} size={12} color={accentColor} />
        </View>
        {!isLast && <TimelineConnector colors={colors} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 1 }}>
          +{fmtDuration(ci.offsetMinutes)} into cook
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: isWrap ? "#F59E0B" : colors.foreground }}>
          {ci.label}
        </Text>
        {ci.expectedInternalTempRange && (
          <View style={{
            backgroundColor: colors.muted,
            borderRadius: 8,
            paddingHorizontal: 7,
            paddingVertical: 3,
            alignSelf: "flex-start",
            marginTop: 4,
          }}>
            <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              {ci.expectedInternalTempRange[0]}–{ci.expectedInternalTempRange[1]}°F
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PartialWrapRow({ wrap, isLast, colors }: { wrap: any; isLast: boolean; colors: Colors }) {
  const methodLabel = wrap.method === "butcher_paper" ? "Butcher Paper Wrap" : "Foil Wrap (Texas Crutch)";
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", width: 36 }}>
        <View style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F59E0B18",
          borderWidth: 1,
          borderColor: "#F59E0B40",
        }}>
          <Feather name="package" size={12} color="#F59E0B" />
        </View>
        {!isLast && <TimelineConnector colors={colors} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 12, justifyContent: "center" }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 1 }}>
          +{fmtDuration(wrap.wrapAtMinutes)} into cook{wrap.wrapTempF ? ` · ${wrap.wrapTempF}°F internal` : ""}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#F59E0B" }}>
          {methodLabel}
        </Text>
      </View>
    </View>
  );
}

// ── Streaming cursor blink ────────────────────────────────────────────────────

function StreamingCursor({ colors }: { colors: Colors }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.Text style={{ opacity: anim, color: "#6C3BF5", fontFamily: "Inter_700Bold", fontSize: 14 }}>
      {"|"}
    </Animated.Text>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────

export function AiResultsModal(p: Props) {
  const { visible, onClose, colors, aiResult, applyAiPlan, grillName, selectedChips, retrying, isStreaming } = p;

  const activeChips = selectedChips
    ? CHIP_LABELS.filter((c) => selectedChips[c.key])
    : [];

  const [expandedCheckins, setExpandedCheckins] = useState<Set<number>>(new Set());

  const toggleCheckin = (index: number) => {
    setExpandedCheckins(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // The timeline and apply button require the full computed response (grillLightAt etc.)
  const hasFullResponse = !!(aiResult?.grillLightAt);
  const hasCoreFields = !!(aiResult?.estimatedDurationMinutes && aiResult?.wrap && aiResult?.confidence);
  const timeline: TimelineEntry[] = hasFullResponse ? buildTimeline(aiResult) : [];

  const noWrap = aiResult?.wrap?.method === "none";

  // Whether the rationale is still partially streaming (no full response yet)
  const rationaleIsStreaming = isStreaming && !!aiResult?.rationale && !hasFullResponse;

  const fingerprintLabel = (() => {
    if (!aiResult) return null;
    const src = aiResult.fingerprintSource;
    if (src !== "grill" && src !== "user") return null;
    const note: string | null = aiResult.fingerprintNote ?? null;
    const countMatch = note ? note.match(/across (\d+) cook/) : null;
    const n = countMatch ? parseInt(countMatch[1], 10) : null;
    const cookWord = n === 1 ? "cook" : "cooks";
    if (src === "grill") {
      return n != null
        ? `Tuned to your ${n} ${cookWord} on this grill`
        : "Tuned to your cook history on this grill";
    }
    const meatMatch = note ? note.match(/learned pace on ([^(]+?) \(across all grills\)/) : null;
    const meat = meatMatch ? meatMatch[1].trim() : null;
    return n != null && meat
      ? `Tuned to your ${n} ${meat} ${cookWord}`
      : n != null
        ? `Tuned to your ${n} personal ${cookWord}`
        : "Tuned to your personal cook history";
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[s.modalHandle, { backgroundColor: colors.border }]} />

          <LinearGradient
            colors={["#6C3BF5", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.aiModalHeader}
          >
            <Feather name="cpu" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.aiModalTitle}>PitMaster Plan</Text>
              {hasCoreFields ? (
                <Text style={s.aiModalSub}>
                  {aiResult.confidence?.toUpperCase()} confidence · {fmtMinutes(aiResult.estimatedDurationMinutes)} active cook
                </Text>
              ) : (
                <Text style={[s.aiModalSub, { opacity: 0.7 }]}>Cooking up your plan…</Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
            {/* ── Full loading state (no partial data yet) ── */}
            {!aiResult && (
              <View style={{ gap: 20, paddingTop: 24 }}>
                <ActivityIndicator size="large" color="#6C3BF5" style={{ marginBottom: 8 }} />
                <View style={{ gap: 10 }}>
                  <ShimmerBar width="75%" colors={colors} />
                  <ShimmerBar width="90%" colors={colors} />
                  <ShimmerBar width="60%" colors={colors} />
                </View>
                <View style={{ gap: 10, marginTop: 8 }}>
                  <ShimmerBar width="50%" colors={colors} />
                  <ShimmerBar width="80%" colors={colors} />
                  <ShimmerBar width="70%" colors={colors} />
                  <ShimmerBar width="85%" colors={colors} />
                </View>
                <View style={{ gap: 10, marginTop: 8 }}>
                  <ShimmerBar width="45%" colors={colors} />
                  <ShimmerBar width="95%" colors={colors} />
                  <ShimmerBar width="65%" colors={colors} />
                </View>
              </View>
            )}

            {aiResult && (
              <>
                {/* ── Timeout notice ── */}
                {aiResult.timedOut && (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 14,
                    marginBottom: 2,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: "#F59E0B18",
                    borderWidth: 1,
                    borderColor: "#F59E0B40",
                    borderRadius: 10,
                  }}>
                    {retrying ? (
                      <ActivityIndicator size="small" color="#F59E0B" />
                    ) : (
                      <Feather name="clock" size={14} color="#F59E0B" />
                    )}
                    <Text style={{
                      flex: 1,
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#D97706",
                      lineHeight: 17,
                    }}>
                      {retrying
                        ? "Getting your personalized plan — updating in a moment…"
                        : "Taking longer than usual — here's a rough estimate. Tap \"Apply\" or try again for a personalized plan."}
                    </Text>
                  </View>
                )}

                {/* ── Technique selections echo ── */}
                {activeChips.length > 0 && (
                  <View style={{
                    marginTop: 14,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                  }}>
                    <Text style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 11,
                      color: colors.mutedForeground,
                      marginRight: 2,
                    }}>
                      Your picks:
                    </Text>
                    {activeChips.map(({ key, label }) => (
                      <View
                        key={key}
                        style={{
                          backgroundColor: "#6C3BF5" + "15",
                          borderColor: "#6C3BF5" + "40",
                          borderWidth: 1,
                          borderRadius: 20,
                          paddingHorizontal: 10,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 11,
                          color: "#6C3BF5",
                        }}>
                          {label}: {selectedChips![key]}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* ── PitMaster Analysis ── */}
                <View style={[s.aiSection, { borderColor: colors.border }]}>
                  <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>PitMaster Analysis</Text>
                  {aiResult.rationale ? (
                    <Text style={[s.aiBody, { color: colors.mutedForeground }]}>
                      {aiResult.rationale}
                      {rationaleIsStreaming && <StreamingCursor colors={colors} />}
                    </Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 4 }}>
                      <ShimmerBar width="90%" colors={colors} />
                      <ShimmerBar width="75%" colors={colors} />
                      <ShimmerBar width="60%" colors={colors} />
                    </View>
                  )}
                </View>

                {/* ── Cook Timeline ── */}
                {hasFullResponse ? (
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Text style={[s.aiSectionTitle, { color: colors.foreground, marginBottom: 0, flex: 1 }]}>
                        Cook Timeline
                      </Text>
                      {noWrap && (
                        <View style={{
                          backgroundColor: colors.muted,
                          borderRadius: 12,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                            No wrap needed
                          </Text>
                        </View>
                      )}
                    </View>


                    {timeline.map((entry, idx) => {
                      const isLast = idx === timeline.length - 1;
                      if (entry.kind === "event") {
                        return (
                          <EventRow
                            key={`event-${entry.label}`}
                            icon={entry.icon}
                            label={entry.label}
                            absoluteMs={entry.absoluteMs}
                            colors={colors}
                            isLast={isLast}
                          />
                        );
                      }
                      if (entry.kind === "checkin") {
                        return (
                          <CheckinRow
                            key={`checkin-${entry.index}`}
                            ci={entry.ci}
                            absoluteMs={entry.absoluteMs}
                            expanded={expandedCheckins.has(entry.index)}
                            onToggle={() => toggleCheckin(entry.index)}
                            colors={colors}
                            isLast={isLast}
                          />
                        );
                      }
                      if (entry.kind === "wrap") {
                        return (
                          <WrapRow
                            key="wrap"
                            entry={entry}
                            colors={colors}
                            isLast={isLast}
                          />
                        );
                      }
                      if (entry.kind === "rest") {
                        return (
                          <RestRow
                            key="rest"
                            entry={entry}
                            colors={colors}
                            isLast={isLast}
                          />
                        );
                      }
                      return null;
                    })}

                    {fingerprintLabel && (
                      <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 12,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}>
                        <Feather name="bar-chart-2" size={12} color={colors.mutedForeground} />
                        <Text style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          color: colors.mutedForeground,
                          flex: 1,
                        }}>
                          {fingerprintLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : isStreaming && hasCoreFields ? (
                  // Partial timeline: checkins + wrap with relative offsets; absolute times arrive with "complete"
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Text style={[s.aiSectionTitle, { color: colors.foreground, marginBottom: 0, flex: 1 }]}>
                        Cook Timeline
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <ActivityIndicator size="small" color="#6C3BF5" />
                        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                          finalizing times…
                        </Text>
                      </View>
                    </View>

                    {/* Duration summary row */}
                    <View style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      backgroundColor: "#6C3BF5" + "12",
                      borderRadius: 8,
                      marginBottom: 14,
                    }}>
                      <Feather name="clock" size={13} color="#6C3BF5" />
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                        ~{fmtMinutes(aiResult.estimatedDurationMinutes)} active cook
                      </Text>
                    </View>

                    {/* Checkins as they arrive */}
                    {Array.isArray(aiResult.checkins) && aiResult.checkins.map((ci: any, idx: number) => {
                      const hasWrapAfter = aiResult.wrap && aiResult.wrap.method !== "none";
                      const isLast = idx === aiResult.checkins.length - 1 && !hasWrapAfter && !isStreaming;
                      return (
                        <PartialCheckinRow
                          key={`pci-${idx}`}
                          ci={ci}
                          isLast={isLast}
                          colors={colors}
                        />
                      );
                    })}

                    {/* Wrap row once it arrives */}
                    {aiResult.wrap && aiResult.wrap.method !== "none" && (
                      <PartialWrapRow wrap={aiResult.wrap} isLast={!isStreaming} colors={colors} />
                    )}

                    {/* Shimmer for checkins not yet arrived */}
                    {(!aiResult.checkins || aiResult.checkins.length === 0) && (
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.muted }} />
                          <View style={{ flex: 1, gap: 6 }}>
                            <ShimmerBar width="35%" colors={colors} />
                            <ShimmerBar width="55%" colors={colors} />
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.muted }} />
                          <View style={{ flex: 1, gap: 6 }}>
                            <ShimmerBar width="45%" colors={colors} />
                            <ShimmerBar width="70%" colors={colors} />
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                ) : isStreaming ? (
                  // Full shimmer while no core fields yet
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Cook Timeline</Text>
                    <View style={{ gap: 12 }}>
                      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted }} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <ShimmerBar width="40%" colors={colors} />
                          <ShimmerBar width="60%" colors={colors} />
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.muted }} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <ShimmerBar width="35%" colors={colors} />
                          <ShimmerBar width="55%" colors={colors} />
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.muted }} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <ShimmerBar width="45%" colors={colors} />
                          <ShimmerBar width="70%" colors={colors} />
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* ── Pit Master Tips ── */}
                {aiResult.tips && aiResult.tips.length > 0 ? (
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Pit Master Tips</Text>
                    {aiResult.tips.map((tip: string, i: number) => (
                      <View key={i} style={s.tipRow}>
                        <View style={[s.tipBullet, { backgroundColor: "#6C3BF5" }]} />
                        <Text style={[s.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                ) : isStreaming ? (
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Pit Master Tips</Text>
                    <View style={{ gap: 10 }}>
                      <ShimmerBar width="85%" colors={colors} />
                      <ShimmerBar width="70%" colors={colors} />
                      <ShimmerBar width="90%" colors={colors} />
                    </View>
                  </View>
                ) : null}

                {/* ── Apply / Dismiss buttons ── */}
                {/* Apply is enabled as soon as core fields (duration, wrap, confidence) arrive,
                    even if the timeline dates aren't computed yet (they arrive with "complete"). */}
                {hasCoreFields && (
                  <>
                    <Pressable
                      onPress={applyAiPlan}
                      style={({ pressed }) => [
                        s.applyBtn,
                        { borderRadius: colors.radius },
                        pressed && { opacity: 0.75 },
                      ]}
                    >
                      <LinearGradient
                        colors={["#6C3BF5", "#A855F7"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.applyBtnGradient}
                      >
                        <Feather name="check" size={18} color="#fff" />
                        <Text style={s.applyBtnText}>Apply PitMaster Plan</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable
                      onPress={onClose}
                      style={[s.dismissBtn, { borderRadius: colors.radius, borderColor: colors.border }]}
                    >
                      <Text style={[s.dismissBtnText, { color: colors.mutedForeground }]}>Keep manual plan</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
