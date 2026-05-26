import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { s } from "./styles";
import { FingerprintCallout } from "./FingerprintCallout";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface Step {
  key: string;
  label: string;
  sub?: string;
  ms: number;
  primary?: boolean;
}

export function PlannedCookTimeline({ c, colors }: Props) {
  if ((c.sequenceData as any)?.schedule?.length > 0) return null;

  const meatOnMs = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
  const serveMs = c.plannedEndAt ? new Date(c.plannedEndAt).getTime() : null;

  if (meatOnMs == null && serveMs == null) return null;

  const steps: Step[] = [];

  if (meatOnMs != null && c.preheatMinutes) {
    const preheatMs = meatOnMs - (c.preheatMinutes as number) * 60_000;
    steps.push({
      key: "grill-light",
      label: "Light Grill",
      sub: `Preheat ${c.preheatMinutes} min`,
      ms: preheatMs,
    });
  }

  if (meatOnMs != null) {
    steps.push({
      key: "meat-on",
      label: "Meat On",
      ms: meatOnMs,
      primary: true,
    });
  }

  if (meatOnMs != null && c.wrapAtMinutes) {
    const wrapMs = meatOnMs + (c.wrapAtMinutes as number) * 60_000;
    steps.push({
      key: "wrap",
      label: "Wrap",
      ms: wrapMs,
    });
  }

  if (serveMs != null && c.restMinutes) {
    const pullMs = serveMs - (c.restMinutes as number) * 60_000;
    steps.push({
      key: "pull-off",
      label: "Pull Off",
      sub: `Rest ${c.restMinutes} min`,
      ms: pullMs,
    });
  }

  if (serveMs != null) {
    steps.push({
      key: "serve",
      label: "Serve By",
      ms: serveMs,
    });
  }

  if (steps.length === 0) return null;

  const accentColor = "#FF6B2B";

  return (
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
      {/* Header */}
      <View
        style={[
          s.seqScheduleHeader,
          { borderBottomWidth: 1, borderBottomColor: colors.border },
        ]}
      >
        <View
          style={[
            s.seqScheduleIcon,
            { backgroundColor: accentColor + "22" },
          ]}
        >
          <Feather name="clock" size={15} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.seqScheduleTitle, { color: colors.foreground }]}>
            Cook Timeline
          </Text>
          <Text style={[s.seqScheduleSub, { color: colors.mutedForeground }]}>
            Planned schedule
          </Text>
        </View>
      </View>

      {/* Steps */}
      <View style={{ padding: 14, paddingBottom: 10 }}>
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
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
              {/* Dot + connector column */}
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
                    ...(step.primary && {
                      backgroundColor: accentColor,
                    }),
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

              {/* Label + time column */}
              <View
                style={{
                  flex: 1,
                  paddingBottom: isLast ? 0 : 4,
                }}
              >
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
          const seqData = c.sequenceData as { fingerprintSource?: "grill" | "user" | "pit_bias_only" | null; fingerprintNote?: string | null } | null | undefined;
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
  );
}
