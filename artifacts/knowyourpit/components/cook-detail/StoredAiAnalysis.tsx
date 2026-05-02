import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import { TempGraph, ProbeTimeSeries } from "@/components/TempGraph";
import { BlurredProSection } from "@/components/BlurredProSection";
import { EVENT_ICONS } from "./constants";
import { fmtISOInText } from "./utils";

type Colors = any;
type ShowPaywall = (args?: any) => void;

interface Props {
  c: any;
  colors: Colors;
  storedAnalysis: any;
  storedAssessment: any;
  storedVerdictCfg: any;
  storedGraphProbes: any[];
  cardWidth: number;
  nowMs: number;
  isIdentityLinked: boolean;
  effectivePro: boolean;
  expandedStoredSections: Set<string>;
  toggleStoredSection: (key: string) => void;
  showPaywall: ShowPaywall;
  onCardLayout: (e: any) => void;
}

export function StoredAiAnalysis(p: Props) {
  const {
    c, colors, storedAnalysis, storedAssessment, storedVerdictCfg,
    storedGraphProbes, cardWidth, nowMs, isIdentityLinked, effectivePro,
    expandedStoredSections, toggleStoredSection, showPaywall, onCardLayout,
  } = p;
  if (!storedAnalysis) return null;

  return (
    <View
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
      onLayout={onCardLayout}
    >
      <View style={s.logHeader}>
        <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.logIconWrap}>
          <Feather name="activity" size={15} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.logTitle, { color: colors.foreground }]}>
            {c.status === "active" ? "PitMaster Live Check-in" : "PitMaster Cook Analysis"}
          </Text>
          <Text style={[s.logSub, { color: colors.mutedForeground }]}>
            {c.status === "active"
              ? (() => {
                  const m = (storedAnalysis as any)?.snapshotElapsedMinutes;
                  let intoCook = "";
                  if (typeof m === "number" && m >= 0) {
                    const h = Math.floor(m / 60);
                    const mm = m % 60;
                    intoCook = `Last check-in at ${h > 0 ? `${h}h ${mm}m` : `${mm}m`} into cook`;
                  } else {
                    intoCook = "Latest check-in";
                  }
                  const analyzedAtRaw =
                    (storedAnalysis as any)?.analyzedAt ??
                    (() => {
                      const hist: any[] = Array.isArray((c as any).analysisHistory) ? (c as any).analysisHistory : [];
                      return hist.length > 0 ? hist[hist.length - 1]?.savedAt : null;
                    })();
                  const analyzedAtMs = analyzedAtRaw ? new Date(analyzedAtRaw).getTime() : NaN;
                  if (!Number.isFinite(analyzedAtMs)) return intoCook;
                  const ageSec = Math.max(0, Math.round((nowMs - analyzedAtMs) / 1000));
                  let ago: string;
                  if (ageSec < 60) ago = "just now";
                  else if (ageSec < 3600) ago = `${Math.floor(ageSec / 60)} min ago`;
                  else {
                    const ah = Math.floor(ageSec / 3600);
                    const am = Math.floor((ageSec % 3600) / 60);
                    ago = am > 0 ? `${ah}h ${am}m ago` : `${ah}h ago`;
                  }
                  return `${intoCook} · ${ago}`;
                })()
              : "Saved from image scan"}
          </Text>
        </View>
        {storedVerdictCfg && (
          <View style={[s.verdictPill, { backgroundColor: storedVerdictCfg.color + "22" }]}>
            <Feather name={storedVerdictCfg.icon as any} size={12} color={storedVerdictCfg.color} />
            <Text style={[s.verdictPillText, { color: storedVerdictCfg.color }]}>{storedVerdictCfg.label}</Text>
          </View>
        )}
      </View>

      {!isIdentityLinked && !effectivePro && (
        (storedAssessment?.suggestions?.length ?? 0) > 0 ||
        (storedAssessment?.whatWentWell?.length ?? 0) > 0 ||
        !!storedAssessment?.summary
      ) && (
        <View
          style={{
            marginVertical: 8,
            height: 150,
            borderRadius: colors.radius,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: 0.4,
          }}
        />
      )}
      {isIdentityLinked && !effectivePro && (
        (storedAssessment?.suggestions?.length ?? 0) > 0 ||
        (storedAssessment?.whatWentWell?.length ?? 0) > 0 ||
        !!storedAssessment?.summary
      ) && (
        <BlurredProSection
          featureName="Cook Coach"
          teaser={`AI insights on your ${(c.foodType || "cook").toLowerCase()} — what worked, what to fix, and what to do next time.`}
          onPress={() =>
            showPaywall({
              trigger: "pro_required",
              featureName: "Cook Coach",
              foodType: c.foodType ?? null,
            })
          }
          minHeight={150}
          style={{ marginVertical: 8 }}
        >
          {(storedAssessment?.suggestions?.length ?? 0) > 0 ? (
            <View style={[s.keyTakeawayCard, { backgroundColor: "#A855F715", borderColor: "#A855F740" }]}>
              <View style={s.keyTakeawayHeader}>
                <Feather name="star" size={13} color="#A855F7" />
                <Text style={[s.keyTakeawayLabel, { color: "#A855F7" }]}>
                  {c.status === "active" ? "Do this now" : `For your next ${c.foodType || "cook"}`}
                </Text>
              </View>
              <Text style={[s.keyTakeawayText, { color: colors.foreground }]}>
                {storedAssessment!.suggestions![0]}
              </Text>
            </View>
          ) : null}
          {storedAssessment?.summary ? (
            <Text style={[s.storedSummary, { color: colors.foreground }]}>{storedAssessment.summary}</Text>
          ) : null}
        </BlurredProSection>
      )}

      {effectivePro && (storedAssessment?.suggestions?.length ?? 0) > 0 && (
        <View style={[s.keyTakeawayCard, { backgroundColor: "#A855F715", borderColor: "#A855F740" }]}>
          <View style={s.keyTakeawayHeader}>
            <Feather name="star" size={13} color="#A855F7" />
            <Text style={[s.keyTakeawayLabel, { color: "#A855F7" }]}>
              {c.status === "active" ? "Do this now" : `For your next ${c.foodType || "cook"}`}
            </Text>
          </View>
          <Text style={[s.keyTakeawayText, { color: colors.foreground }]}>
            {storedAssessment!.suggestions![0]}
          </Text>
        </View>
      )}

      {effectivePro && storedAssessment?.summary ? (
        <Text style={[s.storedSummary, { color: colors.foreground }]}>{storedAssessment.summary}</Text>
      ) : null}

      {storedGraphProbes.length > 0 && (
        <View style={[s.graphWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Temperature Graph</Text>
          <TempGraph
            probes={storedGraphProbes as unknown as ProbeTimeSeries[]}
            events={storedAnalysis?.events ?? []}
            targetTempF={c.targetTempF ?? null}
            width={cardWidth}
            height={190}
          />
        </View>
      )}

      {(storedAnalysis?.probes?.length ?? 0) > 0 && (
        <View style={[s.subSection, { borderTopColor: colors.border }]}>
          <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Probe Readings</Text>
          {storedAnalysis!.probes.map((pr: any, i: number) => (
            <View key={i} style={[s.probeRow, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[s.probeName, { color: colors.foreground }]}>{pr.probeName}</Text>
                {(pr.minTempF != null || pr.maxTempF != null) && (
                  <Text style={[s.probeRange, { color: colors.mutedForeground }]}>
                    {pr.minTempF ?? "?"}°F → {pr.maxTempF ?? "?"}°F
                  </Text>
                )}
              </View>
              <Text style={[s.probeFinish, { color: "#A855F7" }]}>{pr.finishingTempF}°F</Text>
            </View>
          ))}
        </View>
      )}

      {(storedAnalysis?.events?.length ?? 0) > 0 && (() => {
        const isOpen = expandedStoredSections.has("timeline");
        const events = storedAnalysis!.events;
        return (
          <View style={[s.subSection, { borderTopColor: colors.border }]}>
            <Pressable style={s.collapsibleRow} onPress={() => toggleStoredSection("timeline")}>
              <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>Cook Timeline</Text>
              <View style={[s.countPill, { backgroundColor: colors.muted }]}>
                <Text style={[s.countPillText, { color: colors.mutedForeground }]}>{events.length}</Text>
              </View>
              <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
            </Pressable>
            {!isOpen && (
              <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                {fmtISOInText(events[0].description)}
              </Text>
            )}
            {isOpen && events.map((ev: any, i: number) => {
              const hrs = Math.floor(ev.timeMinutes / 60);
              const mins = ev.timeMinutes % 60;
              return (
                <View key={i} style={[s.eventRow, { borderTopColor: colors.border }]}>
                  <View style={[s.eventIconWrap, { backgroundColor: "#A855F7" + "18" }]}>
                    <Feather name={(EVENT_ICONS[ev.type] ?? "circle") as any} size={13} color="#A855F7" />
                  </View>
                  <Text style={[s.eventDesc, { color: colors.foreground, flex: 1 }]}>{fmtISOInText(ev.description)}</Text>
                  <Text style={[s.eventTime, { color: colors.mutedForeground }]}>
                    {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })()}

      {effectivePro && (storedAssessment?.whatWentWell?.length ?? 0) > 0 && (() => {
        const isOpen = expandedStoredSections.has("wentWell");
        const items: string[] = storedAssessment!.whatWentWell;
        return (
          <View style={[s.subSection, { borderTopColor: colors.border }]}>
            <Pressable style={s.collapsibleRow} onPress={() => toggleStoredSection("wentWell")}>
              <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>
                {c.status === "active" ? "What's Working" : "What Went Well"}
              </Text>
              <View style={[s.countPill, { backgroundColor: "#22c55e18" }]}>
                <Text style={[s.countPillText, { color: "#22c55e" }]}>{items.length}</Text>
              </View>
              <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
            </Pressable>
            {!isOpen && (
              <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                {items[0]}
              </Text>
            )}
            {isOpen && items.map((item, i) => (
              <View key={i} style={s.bulletRow}>
                <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      {effectivePro && (storedAssessment?.suggestions?.length ?? 0) > 0 && (() => {
        const isOpen = expandedStoredSections.has("nextTime");
        const tips: string[] = storedAssessment!.suggestions;
        return (
          <View style={[s.subSection, { borderTopColor: colors.border }]}>
            <Pressable style={s.collapsibleRow} onPress={() => toggleStoredSection("nextTime")}>
              <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>
                {c.status === "active" ? "What to Adjust" : "Next Time, Try This"}
              </Text>
              <View style={[s.countPill, { backgroundColor: "#A855F718" }]}>
                <Text style={[s.countPillText, { color: "#A855F7" }]}>{tips.length}</Text>
              </View>
              <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
            </Pressable>
            {!isOpen && (
              <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                {tips[0]}
              </Text>
            )}
            {isOpen && tips.map((tip, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
              </View>
            ))}
          </View>
        );
      })()}
    </View>
  );
}
