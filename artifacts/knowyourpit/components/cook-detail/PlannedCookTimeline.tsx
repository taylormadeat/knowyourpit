import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { s } from "./styles";
import { FingerprintCallout } from "./FingerprintCallout";
import { generateCheckinSchedule, type ScheduledCheckin } from "@/constants/checkinKnowledge";
import { fmtMinutes } from "@/utils/duration";
import { CheckinPreviewSheet } from "./CheckinPreviewSheet";
import { MEAT_CUTS } from "@/constants/meatCuts";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  cookStatus?: string;
  estimatedFinishMs?: number | null;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type MilestoneStep = {
  kind: "milestone";
  key: string;
  label: string;
  sub?: string;
  ms: number;
  primary?: boolean;
};

type CheckinStep = {
  kind: "checkin";
  key: string;
  label: string;
  ms: number;
  sc: ScheduledCheckin;
};

type Step = MilestoneStep | CheckinStep;

export function PlannedCookTimeline({ c, colors, cookStatus, estimatedFinishMs }: Props) {
  if ((c.sequenceData as any)?.schedule?.length > 0) return null;

  const isActive = cookStatus === "active";
  // For Cook Now (immediate start) cooks, plannedStartAt may be null.
  // Fall back to actualStartAt so the anchor for check-in offsets is correct.
  const meatOnMs = c.plannedStartAt
    ? new Date(c.plannedStartAt).getTime()
    : c.actualStartAt
      ? new Date(c.actualStartAt).getTime()
      : null;
  // plannedEndAt is often null for Cook Now active cooks. Fall back to the
  // caller-supplied estimatedFinishMs (which uses wrap-adjusted AI range →
  // sequence data → plannedEndAt as its own fallback chain).
  const serveMsRaw = c.plannedEndAt
    ? new Date(c.plannedEndAt).getTime()
    : (estimatedFinishMs ?? null);

  // Last-resort fallback: derive an estimated finish time from MEAT_CUTS
  // baselines when plannedEndAt is null and no estimatedFinishMs is available.
  // This covers cooks created before the plan-screen fix saved plannedEndAt, or
  // cooks manually scheduled without an AI prediction.
  let serveMs = serveMsRaw;
  let isEstimatedFinish = false;
  if (serveMs == null && meatOnMs != null && c.foodType) {
    const cut = MEAT_CUTS.find(
      (m) => m.name.toLowerCase() === (c.foodType as string).toLowerCase(),
    );
    if (cut) {
      const weightLbs = cut.isIndividualCook
        ? (cut.avgPieceWeightLbs ?? 1)
        : ((c.weightLbs as number | null) ?? cut.avgPieceWeightLbs ?? 5);
      const cookMins = Math.round(weightLbs * cut.minsPerLb);
      const restMins = (c.restMinutes as number | null) ?? cut.restMins ?? 0;
      serveMs = meatOnMs + cookMins * 60_000 + restMins * 60_000;
      isEstimatedFinish = true;
    }
  }

  if (meatOnMs == null && serveMs == null) return null;

  const milestones: MilestoneStep[] = [];

  if (meatOnMs != null && c.preheatMinutes) {
    const preheatMs = meatOnMs - (c.preheatMinutes as number) * 60_000;
    milestones.push({
      kind: "milestone",
      key: "grill-light",
      label: "Light Grill",
      sub: `Preheat ${c.preheatMinutes} min`,
      ms: preheatMs,
    });
  }

  if (meatOnMs != null) {
    milestones.push({
      kind: "milestone",
      key: "meat-on",
      label: "Meat On",
      ms: meatOnMs,
      primary: true,
    });
  }

  if (meatOnMs != null && c.wrapAtMinutes) {
    const wrapMs = meatOnMs + (c.wrapAtMinutes as number) * 60_000;
    milestones.push({
      kind: "milestone",
      key: "wrap",
      label: "Wrap",
      ms: wrapMs,
    });
  }

  const pullOffMs =
    serveMs != null && c.restMinutes
      ? serveMs - (c.restMinutes as number) * 60_000
      : serveMs;

  if (serveMs != null && c.restMinutes) {
    milestones.push({
      kind: "milestone",
      key: "pull-off",
      label: "Pull Off",
      sub: `Rest ${c.restMinutes} min`,
      ms: pullOffMs!,
    });
  }

  if (serveMs != null) {
    milestones.push({
      kind: "milestone",
      key: "serve",
      label: "Serve By",
      ms: serveMs,
    });
  }

  if (milestones.length === 0) return null;

  const checkinSteps: CheckinStep[] = [];
  if (meatOnMs != null && pullOffMs != null && pullOffMs > meatOnMs) {
    const anchor =
      c.wrapAtMinutes ? { wrapAtMinutes: c.wrapAtMinutes as number } : null;
    const scheduled = generateCheckinSchedule(
      (c.foodType as string | null) ?? null,
      meatOnMs,
      pullOffMs,
      anchor,
      (c.weightLbs as number | null) ?? null,
    );
    const upperBoundMs = serveMs ?? pullOffMs;
    for (const sc of scheduled) {
      if (sc.scheduledAt >= meatOnMs && sc.scheduledAt <= upperBoundMs) {
        checkinSteps.push({
          kind: "checkin",
          key: `ci-${sc.phaseKey}`,
          label: sc.phaseLabel,
          ms: sc.scheduledAt,
          sc,
        });
      }
    }
  }

  const allSteps: Step[] = [...milestones, ...checkinSteps].sort(
    (a, b) => a.ms - b.ms,
  );

  if (allSteps.length === 0) return null;

  const accentColor = "#FF6B2B";
  const ciColor = "#7C3AED";

  return (
    <CheckinPreviewWrapper meatOnMs={meatOnMs} colors={colors} isActive={isActive}>
      {(openPreview) => (
        <View
          style={[
            s.card,
            {
              borderRadius: colors.radius,
              borderColor: colors.border,
              backgroundColor: colors.card,
              overflow: "hidden",
            },
          ]}
        >
          <View
            style={[
              s.seqScheduleHeader,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View
              style={[s.seqScheduleIcon, { backgroundColor: accentColor + "22" }]}
            >
              <Feather name="clock" size={15} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.seqScheduleTitle, { color: colors.foreground }]}>
                Cook Timeline
              </Text>
              <Text style={[s.seqScheduleSub, { color: colors.mutedForeground }]}>
                {isActive ? "Active schedule" : "Planned schedule"}
                {isEstimatedFinish ? " · estimated" : ""}
              </Text>
            </View>
          </View>

          <View style={{ padding: 14, paddingBottom: 10 }}>
            {allSteps.map((step, idx) => {
              const isLast = idx === allSteps.length - 1;

              if (step.kind === "checkin") {
                const offsetMin =
                  meatOnMs != null
                    ? Math.round((step.ms - meatOnMs) / 60_000)
                    : null;
                const rowContent = (
                  <>
                    <View style={{ alignItems: "center", width: 18 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: ciColor + "33",
                          borderWidth: 1.5,
                          borderColor: ciColor,
                          marginTop: 5,
                        }}
                      />
                      {!isLast && (
                        <View
                          style={{
                            width: 1,
                            flex: 1,
                            backgroundColor: colors.border,
                            marginTop: 3,
                          }}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          marginBottom: 1,
                        }}
                      >
                        <Feather name="bell" size={9} color={ciColor} />
                        <Text
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 10,
                            color: ciColor,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                          }}
                        >
                          Check In · {step.label}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 13,
                          color: colors.foreground,
                        }}
                      >
                        {fmtTime(step.ms)}
                        {offsetMin != null && (
                          <Text
                            style={{
                              color: colors.mutedForeground,
                              fontSize: 12,
                            }}
                          >
                            {" "}· +{fmtMinutes(offsetMin)}
                          </Text>
                        )}
                      </Text>
                      {!isActive && (
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 11,
                            color: ciColor + "99",
                            marginTop: 2,
                          }}
                        >
                          Tap to preview →
                        </Text>
                      )}
                    </View>
                  </>
                );

                if (!isActive) {
                  return (
                    <Pressable
                      key={step.key}
                      onPress={() => openPreview(step.sc)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 12,
                        minHeight: isLast ? 0 : 44,
                        marginLeft: 3,
                        opacity: pressed ? 0.65 : 1,
                      })}
                    >
                      {rowContent}
                    </Pressable>
                  );
                }

                return (
                  <View
                    key={step.key}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                      minHeight: isLast ? 0 : 44,
                      marginLeft: 3,
                    }}
                  >
                    {rowContent}
                  </View>
                );
              }

              const dotColor = step.primary ? accentColor : colors.mutedForeground;
              const dotBg = step.primary ? accentColor + "22" : "transparent";

              return (
                <View
                  key={step.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                    minHeight: isLast ? 0 : 52,
                  }}
                >
                  <View style={{ alignItems: "center", width: 18 }}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: dotBg,
                        borderWidth: step.primary ? 0 : 1.5,
                        borderColor: dotColor,
                        marginTop: 4,
                        ...(step.primary && { backgroundColor: accentColor }),
                      }}
                    />
                    {!isLast && (
                      <View
                        style={{
                          width: 1,
                          flex: 1,
                          backgroundColor: colors.border,
                          marginTop: 4,
                        }}
                      />
                    )}
                  </View>

                  <View style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 12,
                        color: colors.mutedForeground,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 1,
                      }}
                    >
                      {step.label}
                    </Text>
                    {step.sub != null && (
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 11,
                          color: colors.mutedForeground,
                          marginBottom: 1,
                        }}
                      >
                        {step.sub}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontFamily: "Inter_700Bold",
                        fontSize: 16,
                        color: step.primary ? accentColor : colors.foreground,
                      }}
                    >
                      {fmtTime(step.ms)}
                    </Text>
                  </View>
                </View>
              );
            })}
            {(() => {
              const seqData = c.sequenceData as {
                fingerprintSource?:
                  | "grill"
                  | "user"
                  | "pit_bias_only"
                  | null;
                fingerprintNote?: string | null;
              } | null | undefined;
              return (
                <FingerprintCallout
                  fingerprintSource={seqData?.fingerprintSource}
                  fingerprintNote={seqData?.fingerprintNote}
                  colors={colors}
                />
              );
            })()}
          </View>
        </View>
      )}
    </CheckinPreviewWrapper>
  );
}

// Render-prop wrapper that owns the preview sheet state so the outer
// component stays a pure function (no hooks at the top level after early
// returns, which would violate the rules of hooks).
function CheckinPreviewWrapper({
  meatOnMs,
  colors,
  isActive,
  children,
}: {
  meatOnMs: number | null;
  colors: any;
  isActive: boolean;
  children: (openPreview: (sc: ScheduledCheckin) => void) => React.ReactNode;
}) {
  const [previewSc, setPreviewSc] = useState<ScheduledCheckin | null>(null);
  return (
    <>
      {children(isActive ? () => {} : setPreviewSc)}
      {!isActive && (
        <CheckinPreviewSheet
          visible={previewSc != null}
          onClose={() => setPreviewSc(null)}
          colors={colors}
          sc={previewSc}
          meatOnMs={meatOnMs}
        />
      )}
    </>
  );
}
