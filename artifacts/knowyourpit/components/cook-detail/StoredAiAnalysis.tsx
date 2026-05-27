import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import { TempGraph, ProbeTimeSeries } from "@/components/TempGraph";
import { BlurredProSection } from "@/components/BlurredProSection";
import { EVENT_ICONS } from "./constants";
import { fmtISOInText } from "./utils";
import type { ShowOptions } from "@/contexts/PaywallContext";

/** First N words of a string, with an ellipsis if truncated. Used to keep the
 *  free-user summary teaser short enough to feel like a preview. */
function firstWords(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const words = s.trim().split(/\s+/);
  if (words.length <= n) return s.trim();
  return words.slice(0, n).join(" ") + "…";
}

type Colors = any;
type ShowPaywall = (opts?: ShowOptions) => void;

interface Props {
  c: any;
  colors: Colors;
  storedAnalysis: any;
  storedAssessment: any;
  storedVerdictCfg: any;
  storedGraphProbes: any[];
  cardWidth: number;
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
    storedGraphProbes, cardWidth, isIdentityLinked, effectivePro,
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
            PitMaster Cook Analysis
          </Text>
          <Text style={[s.logSub, { color: colors.mutedForeground }]}>
            Saved from image scan
          </Text>
          {(() => {
            const sourceLabel = (storedAnalysis as any)?.snapshotTempSourceLabel as string | null | undefined;
            const snapTempF = (storedAnalysis as any)?.snapshotTempF as number | null | undefined;
            if (!sourceLabel) return null;
            const tempPart = snapTempF != null ? ` · ${Math.round(snapTempF)}°F` : "";
            return (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                marginTop: 5, alignSelf: "flex-start",
                backgroundColor: "#6C3BF518", borderRadius: 6,
                paddingHorizontal: 7, paddingVertical: 3,
              }}>
                <Feather name="radio" size={10} color="#A855F7" />
                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#A855F7" }}>
                  {sourceLabel}{tempPart}
                </Text>
              </View>
            );
          })()}
        </View>
        {storedVerdictCfg && (
          <View style={[s.verdictPill, { backgroundColor: storedVerdictCfg.color + "22" }]}>
            <Feather name={storedVerdictCfg.icon as any} size={12} color={storedVerdictCfg.color} />
            <Text style={[s.verdictPillText, { color: storedVerdictCfg.color }]}>{storedVerdictCfg.label}</Text>
          </View>
        )}
      </View>

      {/* RC identity not yet linked: skeleton placeholder so Pro users don't
          see a paywall flash on cold start. */}
      {!isIdentityLinked && (
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

      {/* Key Takeaway — VISIBLE to free users as the teaser. Pro users see the
          full suggestions list further down. */}
      {isIdentityLinked && (storedAssessment?.suggestions?.length ?? 0) > 0 && (
        <View style={[s.keyTakeawayCard, { backgroundColor: "#A855F715", borderColor: "#A855F740" }]}>
          <View style={s.keyTakeawayHeader}>
            <Feather name="star" size={13} color="#A855F7" />
            <Text style={[s.keyTakeawayLabel, { color: "#A855F7" }]}>
              {`For your next ${c.foodType || "cook"}`}
            </Text>
          </View>
          <Text style={[s.keyTakeawayText, { color: colors.foreground }]}>
            {storedAssessment!.suggestions![0]}
          </Text>
        </View>
      )}

      {/* Summary — Pro: full text. Free: first ~40 words with a bottom fade
          gradient (Cook Coach teaser). */}
      {isIdentityLinked && storedAssessment?.summary ? (
        effectivePro ? (
          <Text style={[s.storedSummary, { color: colors.foreground }]}>{storedAssessment.summary}</Text>
        ) : (
          <View style={{ position: "relative" }}>
            <Text
              style={[s.storedSummary, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {firstWords(storedAssessment.summary, 40)}
            </Text>
            <LinearGradient
              colors={["transparent", colors.card]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 24 }}
              pointerEvents="none"
            />
          </View>
        )
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
                What Went Well
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
                Next Time, Try This
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

      {/* Free user: blurred view of the actual coach lists. The real items
          are rendered beneath the BlurView so the conversion moment shows
          authentic content shape, not placeholder copy. */}
      {isIdentityLinked && !effectivePro && (
        ((storedAssessment?.whatWentWell?.length ?? 0) > 0 ||
          (storedAssessment?.suggestions?.length ?? 1) > 1)
      ) && (() => {
        const wins: string[] = Array.isArray(storedAssessment?.whatWentWell)
          ? storedAssessment.whatWentWell
          : [];
        const tipsAll: string[] = Array.isArray(storedAssessment?.suggestions)
          ? storedAssessment.suggestions
          : [];
        // suggestions[0] is already shown un-blurred as the key takeaway,
        // so the blurred list shows the rest.
        const tips = tipsAll.slice(1);
        return (
          <BlurredProSection
            featureName="Cook Coach Report"
            ctaTitle="Unlock your full coach report"
            teaser="See every win, every fix, and every next-time tip the AI found in this cook."
            onPress={() =>
              showPaywall({
                trigger: "pro_required",
                featureName: "Cook Coach Report",
                foodType: c.foodType ?? null,
              })
            }
            minHeight={180}
            style={{ marginTop: 12 }}
          >
            <View style={{ padding: 14, gap: 10 }}>
              {wins.length > 0 && (
                <>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>
                    What Went Well
                  </Text>
                  {wins.slice(0, 3).map((item, i) => (
                    <View key={`w-${i}`} style={s.bulletRow}>
                      <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                      <Text style={[s.bulletText, { color: colors.foreground }]} numberOfLines={2}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </>
              )}
              {tips.length > 0 && (
                <>
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginTop: 6 }]}>
                    Next Time, Try This
                  </Text>
                  {tips.slice(0, 3).map((tip, i) => (
                    <View key={`t-${i}`} style={s.bulletRow}>
                      <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                      <Text style={[s.bulletText, { color: colors.foreground }]} numberOfLines={2}>
                        {tip}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </BlurredProSection>
        );
      })()}
    </View>
  );
}
