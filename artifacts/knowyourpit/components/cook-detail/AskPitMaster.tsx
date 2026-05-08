import React from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import {
  QP_COOK_METHODS,
  QP_MEAT_START_TEMPS,
  QP_INJECTION_OPTIONS,
  QP_SPRITZ_FREQUENCIES,
  QP_WRAP_FINISH_OPTIONS,
} from "@/constants/cookQuickPicks";

type Colors = any;

function ChipRow({
  label,
  options,
  selected,
  onSelect,
  colors,
}: {
  label: string;
  options: readonly string[];
  selected: string | null;
  onSelect: (val: string | null) => void;
  colors: Colors;
}) {
  return (
    <View style={qs.chipGroup}>
      <Text style={[s.notesInputLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={qs.chipScroll}>
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onSelect(active ? null : opt)}
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
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface Props {
  c: any;
  colors: Colors;
  meaterLinked: boolean | null;
  meaterProbes: any[];
  userTempInput: string;
  setUserTempInput: (v: string) => void;
  userTempEdited: boolean;
  setUserTempEdited: (v: boolean) => void;
  pitTempInput: string;
  setPitTempInput: (v: string) => void;
  cookNotes: string;
  setCookNotes: React.Dispatch<React.SetStateAction<string>>;
  qpMethod: string | null;
  setQpMethod: (v: string | null) => void;
  qpStartTemp: string | null;
  setQpStartTemp: (v: string | null) => void;
  qpInjection: string | null;
  setQpInjection: (v: string | null) => void;
  qpSpritz: string | null;
  setQpSpritz: (v: string | null) => void;
  qpWrap: string | null;
  setQpWrap: (v: string | null) => void;
  activeCookNoteTags: string[];
  setActiveCookNoteTags: React.Dispatch<React.SetStateAction<string[]>>;
  paywallUsage: any;
  autoGradePaused: boolean;
  onUpgradeAutoGradePress: () => void;
  analyzing: boolean;
  analyze: () => void;
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
    userTempInput, setUserTempInput, userTempEdited, setUserTempEdited,
    pitTempInput, setPitTempInput, cookNotes, setCookNotes,
    qpMethod, setQpMethod,
    qpStartTemp, setQpStartTemp,
    qpInjection, setQpInjection,
    qpSpritz, setQpSpritz,
    qpWrap, setQpWrap,
    activeCookNoteTags, setActiveCookNoteTags,
    paywallUsage, autoGradePaused, onUpgradeAutoGradePress,
    analyzing, analyze, lastAnalyzedAtMs, nowMs,
    result, renderDecisions, verdictCfg, assessment, onCardLayout,
  } = p;
  if (c.status !== "active") return null;

  return (
    <View
      style={[s.logSection, { backgroundColor: colors.card, borderColor: "#6C3BF540", borderRadius: colors.radius }]}
      onLayout={onCardLayout}
    >
      <View style={s.logHeader}>
        <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.logIconWrap}>
          <Feather name="zap" size={15} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.logTitle, { color: colors.foreground }]}>What Should I Do Next?</Text>
          <Text style={[s.logSub, { color: colors.mutedForeground }]}>
            {meaterLinked === true && meaterProbes.length > 0
              ? "Temperature auto-filled from your probe · add pit temp or notes and get your next step"
              : "Enter your probe and pit temperatures to get your next action"}
          </Text>
        </View>
      </View>

      {!userTempEdited && meaterProbes.length > 0 && meaterProbes[0].internalTempF != null && (
        <View style={[s.meaterAutoFillBadge, { backgroundColor: "#FF6B2B15", marginBottom: 4 }]}>
          <Feather name="radio" size={11} color="#FF6B2B" />
          <Text style={[s.meaterAutoFillText, { color: "#FF6B2B" }]}>
            Live from {meaterProbes[0].deviceName} · {meaterProbes[0].internalTempF}°F internal
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
            Probe temp <Text style={{ fontWeight: "400" }}>(°F)</Text>
          </Text>
          <TextInput
            style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, height: 38, minHeight: 38, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 10, fontSize: 13 }]}
            placeholder="e.g. 165"
            placeholderTextColor={colors.mutedForeground}
            value={userTempInput}
            onChangeText={(v) => { setUserTempInput(v); setUserTempEdited(v.trim().length > 0); }}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
            Pit temp <Text style={{ fontWeight: "400" }}>(°F)</Text>
          </Text>
          <TextInput
            style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, height: 38, minHeight: 38, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 10, fontSize: 13 }]}
            placeholder="e.g. 225"
            placeholderTextColor={colors.mutedForeground}
            value={pitTempInput}
            onChangeText={setPitTempInput}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* ── Describe the cook (chip selectors) ───────────────────────── */}
      <View style={{ gap: 8 }}>
        <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
          Describe the cook <Text style={{ fontWeight: "400" }}>(helps PitMaster analyse time and technique)</Text>
        </Text>
        <ChipRow
          label="Cooking Method"
          options={QP_COOK_METHODS}
          selected={qpMethod}
          onSelect={setQpMethod}
          colors={colors}
        />
        <ChipRow
          label="Meat Starting Temp"
          options={QP_MEAT_START_TEMPS}
          selected={qpStartTemp}
          onSelect={setQpStartTemp}
          colors={colors}
        />
        <ChipRow
          label="Injection"
          options={QP_INJECTION_OPTIONS}
          selected={qpInjection}
          onSelect={setQpInjection}
          colors={colors}
        />
        <ChipRow
          label="Spritz Frequency"
          options={QP_SPRITZ_FREQUENCIES}
          selected={qpSpritz}
          onSelect={setQpSpritz}
          colors={colors}
        />
        <ChipRow
          label="Wrap / Finish"
          options={QP_WRAP_FINISH_OPTIONS}
          selected={qpWrap}
          onSelect={setQpWrap}
          colors={colors}
        />
      </View>

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
          {renderDecisions(result.decisions ?? [])}

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

            return (
              <View style={[s.phaseCard, { backgroundColor: phaseColor + "15", borderColor: phaseColor + "40", borderRadius: colors.radius }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: pp.narrative ? 8 : 0 }}>
                  <View style={[s.phaseChip, { backgroundColor: phaseColor + "25", borderColor: phaseColor + "50" }]}>
                    <Feather name={phaseIcon as any} size={12} color={phaseColor} />
                    <Text style={[s.phaseChipText, { color: phaseColor }]}>{pp.phaseLabel}</Text>
                  </View>
                </View>

                {pp.narrative ? (
                  <Text style={[s.phaseNarrative, { color: colors.foreground }]}>{pp.narrative}</Text>
                ) : null}

                {(pp.timeToStallMinutes != null || pp.stallDurationMinutes != null || pp.timeToFinishMinutes != null) && (
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
              </View>
            );
          })()}

          {verdictCfg && assessment && (
            <View style={[s.verdictBanner, { backgroundColor: verdictCfg.color + "18", borderColor: verdictCfg.color + "40", borderRadius: colors.radius }]}>
              <Feather name={verdictCfg.icon as any} size={20} color={verdictCfg.color} />
              <View style={{ flex: 1 }}>
                <Text style={[s.verdictLabel, { color: verdictCfg.color }]}>{verdictCfg.label}</Text>
                {assessment.summary ? <Text style={[s.verdictSummary, { color: colors.foreground }]}>{assessment.summary}</Text> : null}
              </View>
            </View>
          )}
          {(assessment?.whatWentWell?.length ?? 0) > 0 && (
            <View style={[s.subSection, { borderColor: colors.border }]}>
              <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Looking Good</Text>
              {assessment!.whatWentWell!.map((item: string, i: number) => (
                <View key={i} style={s.bulletRow}>
                  <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                  <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                </View>
              ))}
            </View>
          )}
          {(assessment?.suggestions?.length ?? 0) > 0 && (
            <View style={[s.subSection, { borderColor: colors.border }]}>
              <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Watch Out For</Text>
              {assessment!.suggestions!.map((tip: string, i: number) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                  <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
          {result.noDataFound && result.probes.length === 0 && (
            <View style={s.noDataRow}>
              <Feather name="info" size={15} color={colors.mutedForeground} />
              <Text style={[s.noDataText, { color: colors.mutedForeground }]}>
                Enter a temperature reading or add cook notes for a better check-in.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const qs = StyleSheet.create({
  chipGroup: { gap: 4 },
  chipScroll: { flexDirection: "row", gap: 7, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
