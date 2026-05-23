import React from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import { QP_WRAP_FINISH_OPTIONS } from "@/constants/cookQuickPicks";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  meaterLinked: boolean | null;
  meaterProbes: any[];
  lastCheckinInternalTempF: number | null;
  lastCheckinPitTempF: number | null;
  lastCheckinAt: string | null;
  cookNotes: string;
  setCookNotes: React.Dispatch<React.SetStateAction<string>>;
  qpMethod: string | null;
  qpStartTemp: string | null;
  qpInjection: string | null;
  qpSpritz: string | null;
  qpWrap: string | null;
  activeCookNoteTags: string[];
  setActiveCookNoteTags: React.Dispatch<React.SetStateAction<string[]>>;
  paywallUsage: any;
  autoGradePaused: boolean;
  onUpgradeAutoGradePress: () => void;
  analyzing: boolean;
  analyze: () => void;
  cookPhotoCount?: number;
  lastAnalyzedAtMs: number | null;
  nowMs: number;
  result: any;
  renderDecisions: (decisions: any[]) => React.ReactNode;
  verdictCfg: any;
  assessment: any;
  onCardLayout: (e: any) => void;
}

export function AskPitMaster(p: Props) {
  const {
    c, colors, meaterLinked, meaterProbes,
    lastCheckinInternalTempF, lastCheckinPitTempF, lastCheckinAt,
    cookNotes, setCookNotes,
    qpMethod, qpInjection, qpSpritz, qpWrap,
    activeCookNoteTags, setActiveCookNoteTags,
    paywallUsage, autoGradePaused, onUpgradeAutoGradePress,
    analyzing, analyze, lastAnalyzedAtMs, nowMs,
    result, renderDecisions, verdictCfg, assessment, onCardLayout,
    cookPhotoCount = 0,
  } = p;

  const [cardExpanded, setCardExpanded] = React.useState(false);
  const [phaseNarrativeExpanded, setPhaseNarrativeExpanded] = React.useState(false);
  const [assessmentExpanded, setAssessmentExpanded] = React.useState(false);

  const heroAnim = React.useRef(new Animated.ValueXY({ x: 0, y: 16 })).current;
  const heroOpacity = React.useRef(new Animated.Value(0)).current;
  const phaseAnim = React.useRef(new Animated.ValueXY({ x: 0, y: 16 })).current;
  const phaseOpacity = React.useRef(new Animated.Value(0)).current;
  const assessAnim = React.useRef(new Animated.ValueXY({ x: 0, y: 16 })).current;
  const assessOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (result) {
      setPhaseNarrativeExpanded(false);
      setAssessmentExpanded(false);

      heroAnim.setValue({ x: 0, y: 16 });
      heroOpacity.setValue(0);
      phaseAnim.setValue({ x: 0, y: 16 });
      phaseOpacity.setValue(0);
      assessAnim.setValue({ x: 0, y: 16 });
      assessOpacity.setValue(0);

      const makeSlide = (opacity: Animated.Value, anim: Animated.ValueXY, delay: number) =>
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 280, delay, useNativeDriver: true }),
          Animated.timing(anim.y, { toValue: 0, duration: 280, delay, useNativeDriver: true }),
        ]);

      Animated.sequence([
        makeSlide(heroOpacity, heroAnim, 150),
        makeSlide(phaseOpacity, phaseAnim, 0),
        makeSlide(assessOpacity, assessAnim, 0),
      ]).start();
    }
  }, [result]);

  if (c.status !== "active") return null;

  const collapseLabel = (() => {
    if (lastAnalyzedAtMs != null) {
      const ageSec = Math.max(0, Math.round((nowMs - lastAnalyzedAtMs) / 1000));
      const ageLabel =
        ageSec < 60
          ? "just now"
          : ageSec < 3600
            ? `${Math.round(ageSec / 60)} min ago`
            : `${Math.floor(ageSec / 3600)}h ${Math.round((ageSec % 3600) / 60)}m ago`;
      return `Last checked in ${ageLabel} · Tap to ask again`;
    }
    const techSummary = [qpMethod, qpInjection, qpSpritz, qpWrap].filter(Boolean).join(" · ");
    return techSummary ? `${techSummary} · Tap to ask PitMaster` : "Tap to ask PitMaster";
  })();

  const checkinAgeLabel = React.useMemo(() => {
    if (!lastCheckinAt) return null;
    const ageSec = Math.max(0, Math.round((nowMs - new Date(lastCheckinAt).getTime()) / 1000));
    if (ageSec < 60) return "just now";
    if (ageSec < 3600) return `${Math.round(ageSec / 60)} min ago`;
    return `${Math.floor(ageSec / 3600)}h ${Math.round((ageSec % 3600) / 60)}m ago`;
  }, [lastCheckinAt, nowMs]);

  const hasLastCheckinTemps = lastCheckinInternalTempF != null || lastCheckinPitTempF != null;
  const liveMeaterTemp = meaterProbes.length > 0 && meaterProbes[0].internalTempF != null
    ? meaterProbes[0].internalTempF as number
    : null;

  return (
    <View
      style={[s.logSection, { backgroundColor: colors.card, borderColor: "#6C3BF540", borderRadius: colors.radius }]}
      onLayout={onCardLayout}
    >
      <Pressable
        onPress={() => setCardExpanded((e) => !e)}
        style={[s.logHeader, { paddingBottom: cardExpanded ? undefined : 0 }]}
      >
        <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.logIconWrap}>
          <Feather name="zap" size={15} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.logTitle, { color: colors.foreground }]}>What Should I Do Next?</Text>
          {cardExpanded ? (
            <Text style={[s.logSub, { color: colors.mutedForeground }]}>
              {hasLastCheckinTemps
                ? "Temperatures from your last check-in · add notes and get your next step"
                : "Log a check-in to provide temperatures for better coaching"}
            </Text>
          ) : (
            <Text style={[s.logSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {collapseLabel}
            </Text>
          )}
        </View>
        <Feather
          name={cardExpanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground as string}
        />
      </Pressable>

      {cardExpanded && (
        <>
          {/* ── Last check-in temps (read-only) ──────────────────── */}
          {hasLastCheckinTemps ? (
            <View style={{ gap: 8 }}>
              {liveMeaterTemp != null && (
                <View style={[s.meaterAutoFillBadge, { backgroundColor: "#FF6B2B15", marginBottom: 0 }]}>
                  <Feather name="radio" size={11} color="#FF6B2B" />
                  <Text style={[s.meaterAutoFillText, { color: "#FF6B2B" }]}>
                    Live from {meaterProbes[0].deviceName} · {liveMeaterTemp}°F · will be used for analysis
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={[qs.tempReadBox, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[qs.tempReadLabel, { color: colors.mutedForeground }]}>Probe temp</Text>
                  <Text style={[qs.tempReadValue, { color: liveMeaterTemp != null ? "#FF6B2B" : colors.foreground }]}>
                    {liveMeaterTemp != null
                      ? `${liveMeaterTemp}°F`
                      : lastCheckinInternalTempF != null
                        ? `${lastCheckinInternalTempF}°F`
                        : "—"}
                  </Text>
                </View>
                <View style={[qs.tempReadBox, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[qs.tempReadLabel, { color: colors.mutedForeground }]}>Pit temp</Text>
                  <Text style={[qs.tempReadValue, { color: colors.foreground }]}>
                    {lastCheckinPitTempF != null ? `${lastCheckinPitTempF}°F` : "—"}
                  </Text>
                </View>
              </View>
              {checkinAgeLabel && (
                <Text style={[qs.checkinAge, { color: colors.mutedForeground }]}>
                  From your last check-in · {checkinAgeLabel}
                </Text>
              )}
            </View>
          ) : (
            <View style={[qs.noCheckinNudge, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Feather name="thermometer" size={15} color={colors.mutedForeground as string} />
              <Text style={[qs.noCheckinText, { color: colors.mutedForeground }]}>
                {meaterLinked === true && meaterProbes.length > 0 && liveMeaterTemp != null
                  ? `Live probe at ${liveMeaterTemp}°F · tap "Check In" to log your pit temp too`
                  : "Tap the check-in button above to log your probe and pit temperatures."}
              </Text>
            </View>
          )}

          {/* ── What's happening? (cook notes + quick-add chips) ─────────── */}
          <View>
            <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
              What's happening? <Text style={{ fontWeight: "400" }}>(optional)</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[qs.chipScroll, { marginBottom: 8 }]}
            >
              {QP_WRAP_FINISH_OPTIONS.map((tag) => {
                const active = activeCookNoteTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => {
                      if (active) {
                        setActiveCookNoteTags((prev: string[]) => prev.filter((t) => t !== tag));
                        setCookNotes((prev: string) => {
                          const parts = prev.split(" · ").map((p) => p.trim()).filter((p) => p !== tag && p !== "");
                          return parts.join(" · ");
                        });
                      } else {
                        setActiveCookNoteTags((prev: string[]) => [...prev, tag]);
                        setCookNotes((prev: string) => (prev.trim() ? `${prev.trim()} · ${tag}` : tag));
                      }
                    }}
                    style={[
                      qs.chip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + "20" : "transparent",
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Text style={[qs.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, minHeight: 56, padding: 10, fontSize: 13 }]}
              placeholder="e.g. Going into the stall around 160°F, just wrapped it in butcher paper..."
              placeholderTextColor={colors.mutedForeground}
              value={cookNotes}
              onChangeText={setCookNotes}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {paywallUsage && !paywallUsage.unlimited && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                color:
                  paywallUsage.remaining.aiAnalyzesToday <= 1
                    ? colors.primary
                    : colors.mutedForeground,
                textAlign: "center",
                marginTop: 6,
                marginBottom: -2,
              }}
            >
              {paywallUsage.remaining.aiAnalyzesToday} of {paywallUsage.limits.aiAnalyzePerDay} free
              analyses left today
            </Text>
          )}
          {autoGradePaused && paywallUsage && !paywallUsage.unlimited && (
            <Pressable
              onPress={onUpgradeAutoGradePress}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: colors.radius,
                  backgroundColor: "#E84820" + "12",
                  borderWidth: 1,
                  borderColor: "#E84820" + "35",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="pause-circle" size={16} color="#E84820" />
              <Text
                style={{
                  flex: 1,
                  color: colors.foreground,
                  fontSize: 13,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                Auto-grading is a Pro feature — upgrade to unlock
              </Text>
              <Feather name="chevron-right" size={16} color="#E84820" />
            </Pressable>
          )}

          {cookPhotoCount > 0 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#6C3BF512",
                borderWidth: 1,
                borderColor: "#6C3BF530",
                marginBottom: 4,
              }}
            >
              <Feather name="camera" size={12} color="#A855F7" />
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                  color: "#A855F7",
                  flex: 1,
                }}
              >
                Using your {cookPhotoCount} cook photo{cookPhotoCount > 1 ? "s" : ""} for visual analysis
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [s.analyzeBtn, { borderRadius: colors.radius }, (analyzing || pressed) && { opacity: 0.75 }]}
            onPress={() => analyze()}
            disabled={analyzing}
          >
            <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.analyzeBtnGradient}>
              {analyzing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.analyzeBtnText}>PitMaster is checking in…</Text>
                </>
              ) : (
                <>
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={s.analyzeBtnText}>Ask PitMaster</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {lastAnalyzedAtMs != null && (() => {
            const ageSec = Math.max(0, Math.round((nowMs - lastAnalyzedAtMs) / 1000));
            const ageLabel =
              ageSec < 60
                ? "just now"
                : ageSec < 3600
                  ? `${Math.round(ageSec / 60)} min ago`
                  : `${Math.floor(ageSec / 3600)}h ${Math.round((ageSec % 3600) / 60)}m ago`;
            const hh = new Date(lastAnalyzedAtMs).getHours();
            const mm = new Date(lastAnalyzedAtMs).getMinutes();
            const ampm = hh >= 12 ? "PM" : "AM";
            const hour12 = hh % 12 === 0 ? 12 : hh % 12;
            const clock = `${hour12}:${String(mm).padStart(2, "0")} ${ampm}`;
            return (
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_500Medium",
                  color: colors.mutedForeground,
                  textAlign: "center",
                  marginTop: -2,
                }}
              >
                Auto-graded {clock} · Updated {ageLabel}
              </Text>
            );
          })()}

          {result && (
            <View style={[s.results, { borderTopColor: colors.border }]}>
              <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroAnim.y }] }}>
                {renderDecisions(result.decisions ?? [])}
              </Animated.View>

              {result.phasePrediction && (() => {
                const pp = result.phasePrediction!;
                const PHASE_COLORS: Record<string, string> = {
                  heat_up: "#3B82F6",
                  stall: "#F59E0B",
                  finishing: "#22c55e",
                  done: "#6B7280",
                };
                const PHASE_ICONS: Record<string, string> = {
                  heat_up: "thermometer",
                  stall: "clock",
                  finishing: "trending-up",
                  done: "check-circle",
                };
                const phaseColor = PHASE_COLORS[pp.phase] ?? "#6B7280";
                const phaseIcon = PHASE_ICONS[pp.phase] ?? "activity";

                const fmtTime = (mins: number) => {
                  if (mins < 60) return `~${mins}m`;
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
                };

                const hasTimingChips =
                  (pp.timeToStallMinutes != null && pp.phase === "heat_up") ||
                  (pp.stallDurationMinutes != null && pp.phase === "stall") ||
                  pp.timeToFinishMinutes != null;

                return (
                  <Animated.View style={[s.phaseCard, { backgroundColor: phaseColor + "15", borderColor: phaseColor + "40", borderRadius: colors.radius }, { opacity: phaseOpacity, transform: [{ translateY: phaseAnim.y }] }]}>
                    {/* Phase chip + optional narrative toggle on same row */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[s.phaseChip, { backgroundColor: phaseColor + "25", borderColor: phaseColor + "50" }]}>
                        <Feather name={phaseIcon as any} size={12} color={phaseColor} />
                        <Text style={[s.phaseChipText, { color: phaseColor }]}>{pp.phaseLabel}</Text>
                      </View>
                      {pp.narrative ? (
                        <Pressable
                          onPress={() => setPhaseNarrativeExpanded((v) => !v)}
                          style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                          hitSlop={8}
                        >
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: phaseColor }}>
                            {phaseNarrativeExpanded ? "Less" : "More"}
                          </Text>
                          <Feather name={phaseNarrativeExpanded ? "chevron-up" : "chevron-down"} size={11} color={phaseColor} />
                        </Pressable>
                      ) : null}
                    </View>

                    {phaseNarrativeExpanded && pp.narrative ? (
                      <Text style={[s.phaseNarrative, { color: colors.foreground }]}>{pp.narrative}</Text>
                    ) : null}

                    {hasTimingChips && (
                      <View style={s.phaseChips}>
                        {pp.timeToStallMinutes != null && pp.phase === "heat_up" && (
                          <View style={[s.timeChip, { backgroundColor: phaseColor + "20", borderColor: phaseColor + "40" }]}>
                            <Feather name="clock" size={11} color={phaseColor} />
                            <Text style={[s.timeChipText, { color: phaseColor }]}>Stall in {fmtTime(pp.timeToStallMinutes)}</Text>
                          </View>
                        )}
                        {pp.stallDurationMinutes != null && pp.phase === "stall" && (
                          <View style={[s.timeChip, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B40" }]}>
                            <Feather name="pause-circle" size={11} color="#F59E0B" />
                            <Text style={[s.timeChipText, { color: "#F59E0B" }]}>Stall ends in {fmtTime(pp.stallDurationMinutes)}</Text>
                          </View>
                        )}
                        {pp.timeToFinishMinutes != null && (
                          <View style={[s.timeChip, { backgroundColor: "#22c55e20", borderColor: "#22c55e40" }]}>
                            <Feather name="flag" size={11} color="#22c55e" />
                            <Text style={[s.timeChipText, { color: "#22c55e" }]}>Done in {fmtTime(pp.timeToFinishMinutes)}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </Animated.View>
                );
              })()}

              <Animated.View style={{ opacity: assessOpacity, transform: [{ translateY: assessAnim.y }] }}>
              {verdictCfg && assessment && (
                <View style={[s.verdictBanner, { backgroundColor: verdictCfg.color + "18", borderColor: verdictCfg.color + "40", borderRadius: colors.radius }]}>
                  <Feather name={verdictCfg.icon as any} size={20} color={verdictCfg.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.verdictLabel, { color: verdictCfg.color }]}>{verdictCfg.label}</Text>
                    {assessment.summary ? <Text style={[s.verdictSummary, { color: colors.foreground }]}>{assessment.summary}</Text> : null}
                  </View>
                </View>
              )}

              {/* Assessment bullets — collapsed behind a summary chip row */}
              {(() => {
                const wellCount = assessment?.whatWentWell?.length ?? 0;
                const tipCount = assessment?.suggestions?.length ?? 0;
                if (wellCount === 0 && tipCount === 0) return null;
                const summaryParts: string[] = [];
                if (wellCount > 0) summaryParts.push(`✓ ${wellCount} on track`);
                if (tipCount > 0) summaryParts.push(`⚠ ${tipCount} tip${tipCount > 1 ? "s" : ""}`);
                return (
                  <View style={[s.subSection, { borderColor: colors.border }]}>
                    <Pressable
                      onPress={() => setAssessmentExpanded((v) => !v)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0, flex: 1 }]}>
                        {summaryParts.join("  ·  ")}
                      </Text>
                      <Feather name={assessmentExpanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
                    </Pressable>
                    {assessmentExpanded && (
                      <>
                        {wellCount > 0 && (
                          <View style={{ marginTop: 10, gap: 4 }}>
                            <Text style={[s.subLabel, { color: "#22c55e", marginBottom: 4 }]}>Looking Good</Text>
                            {assessment!.whatWentWell!.map((item: string, i: number) => (
                              <View key={i} style={s.bulletRow}>
                                <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                                <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {tipCount > 0 && (
                          <View style={{ marginTop: 10, gap: 4 }}>
                            <Text style={[s.subLabel, { color: "#A855F7", marginBottom: 4 }]}>Watch Out For</Text>
                            {assessment!.suggestions!.map((tip: string, i: number) => (
                              <View key={i} style={s.bulletRow}>
                                <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                                <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })()}
              </Animated.View>
              {result.noDataFound && result.probes.length === 0 && (
                <View style={s.noDataRow}>
                  <Feather name="info" size={15} color={colors.mutedForeground} />
                  <Text style={[s.noDataText, { color: colors.mutedForeground }]}>
                    Log a check-in with temperatures to get a more accurate analysis.
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const qs = StyleSheet.create({
  chipScroll: { flexDirection: "row", gap: 7, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tempReadBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  tempReadLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  tempReadValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  checkinAge: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  noCheckinNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  noCheckinText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
