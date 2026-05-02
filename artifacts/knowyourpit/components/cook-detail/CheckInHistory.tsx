import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import { BlurredProSection } from "@/components/BlurredProSection";
import type { ShowOptions } from "@/contexts/PaywallContext";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  effectivePro: boolean;
  isIdentityLinked: boolean;
  showPaywall: (opts?: ShowOptions) => void;
}

const URGENCY_COLORS: Record<string, string> = {
  now: "#EF4444",
  soon: "#F59E0B",
  when_ready: "#6C3BF5",
  maintain: "#22c55e",
};

const VERDICT_COLORS: Record<string, string> = {
  perfect: "#22c55e", good: "#84cc16", needs_work: "#F59E0B",
  overcooked: "#EF4444", undercooked: "#3B82F6",
};

const fmtSavedAt = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
};

const fmtMins = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export function CheckInHistory({ c, colors, effectivePro, isIdentityLinked, showPaywall }: Props) {
  const history: any[] = Array.isArray((c as any).analysisHistory) ? (c as any).analysisHistory : [];
  if (history.length === 0) return null;
  // Free users see only the most recent entry; the rest are blurred behind
  // the Cook Coach paywall. While RC identity is still resolving we also
  // limit visible entries (without rendering the blur CTA) so an unlinked
  // free user can't briefly see the full history before isPro flips false.
  const reversed = [...history].reverse();
  const limitToOne = !effectivePro && reversed.length > 1;
  const isLocked = isIdentityLinked && limitToOne;
  const visibleEntries = limitToOne ? reversed.slice(0, 1) : reversed;
  const hiddenCount = limitToOne ? reversed.length - 1 : 0;

  return (
    <View style={[s.historySection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={s.logHeader}>
        <LinearGradient colors={["#374151", "#52525B"]} style={s.logIconWrap}>
          <Feather name="clock" size={15} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.logTitle, { color: colors.foreground }]}>
            {c.status === "active" ? "Check-in History" : "Analysis History"}
          </Text>
          <Text style={[s.logSub, { color: colors.mutedForeground }]}>
            {history.length} {history.length === 1 ? "entry" : "entries"} · all feedback retained
          </Text>
        </View>
      </View>
      {visibleEntries.map((entry, i) => {
        const topDecision = (entry.decisions ?? [])[0];
        const urgencyColor = topDecision
          ? (topDecision.action === "maintain" ? "#22c55e" : (URGENCY_COLORS[topDecision.urgency] ?? "#6C3BF5"))
          : null;
        const verdict = entry.assessment?.verdict;
        const verdictColor = verdict ? (VERDICT_COLORS[verdict] ?? colors.mutedForeground) : null;
        return (
          <View
            key={i}
            style={[
              s.historyEntry,
              { borderTopColor: colors.border },
              i > 0 && { borderTopWidth: 1 },
            ]}
          >
            <View style={s.historyEntryHeader}>
              <View style={[s.historyIndex, { backgroundColor: colors.muted }]}>
                <Text style={[s.historyIndexText, { color: colors.mutedForeground }]}>
                  {history.length - i}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.historyTimestamp, { color: colors.foreground }]}>
                  {entry.savedAt ? fmtSavedAt(entry.savedAt) : "Unknown time"}
                </Text>
                <View style={s.historyMeta}>
                  {entry.snapshotElapsedMinutes != null && (
                    <Text style={[s.historyMetaChip, { color: colors.mutedForeground }]}>
                      {fmtMins(entry.snapshotElapsedMinutes)} in
                    </Text>
                  )}
                  {entry.snapshotTempF != null && (
                    <Text style={[s.historyMetaChip, { color: colors.mutedForeground }]}>
                      {entry.snapshotTempF}°F
                    </Text>
                  )}
                  {entry.detectedFoodType && entry.detectedFoodType !== c.foodType && (
                    <Text style={[s.historyMetaChip, { color: colors.mutedForeground }]}>
                      {entry.detectedFoodType}
                    </Text>
                  )}
                </View>
              </View>
              {verdictColor && (
                <View style={[s.historyVerdictBadge, { backgroundColor: verdictColor + "22" }]}>
                  <Text style={[s.historyVerdictText, { color: verdictColor }]}>
                    {verdict?.replace(/_/g, " ")}
                  </Text>
                </View>
              )}
            </View>

            {topDecision && (
              <View style={[s.historyDecision, { backgroundColor: urgencyColor! + "10", borderColor: urgencyColor! + "30" }]}>
                <View style={[s.historyDecisionDot, { backgroundColor: urgencyColor! }]} />
                <Text style={[s.historyDecisionText, { color: colors.foreground }]} numberOfLines={2}>
                  {topDecision.instruction}
                </Text>
              </View>
            )}

            {entry.phasePrediction?.phaseLabel && (
              <Text style={[s.historyPhase, { color: colors.mutedForeground }]}>
                Phase: {entry.phasePrediction.phaseLabel}
              </Text>
            )}
            {entry.assessment?.summary && (
              <Text style={[s.historySummary, { color: colors.mutedForeground }]} numberOfLines={2}>
                {entry.assessment.summary}
              </Text>
            )}
            {entry.snapshotNotes && (
              <Text style={[s.historyNotes, { color: colors.mutedForeground }]} numberOfLines={1}>
                Notes: {entry.snapshotNotes}
              </Text>
            )}
          </View>
        );
      })}
      {isLocked && (
        <BlurredProSection
          featureName="Cook Coach Report"
          teaser={`Upgrade to see ${hiddenCount} more ${hiddenCount === 1 ? "check-in" : "check-ins"} from this cook.`}
          onPress={() =>
            showPaywall({
              trigger: "pro_required",
              featureName: "Cook Coach Report",
              foodType: c.foodType ?? null,
            })
          }
          minHeight={140}
          style={{ marginTop: 12 }}
        >
          <View style={{ padding: 14, gap: 8 }}>
            <Text style={[s.historyTimestamp, { color: colors.foreground }]}>
              Earlier check-in
            </Text>
            <Text style={[s.historySummary, { color: colors.mutedForeground }]} numberOfLines={2}>
              The pit was running a touch hot and the bark was just starting to set…
            </Text>
            <Text style={[s.historySummary, { color: colors.mutedForeground }]} numberOfLines={2}>
              A second check-in caught the stall and recommended a wrap…
            </Text>
          </View>
        </BlurredProSection>
      )}
    </View>
  );
}
