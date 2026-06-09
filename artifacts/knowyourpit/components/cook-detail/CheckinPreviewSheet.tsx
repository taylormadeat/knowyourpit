import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { s } from "./styles";
import type { ScheduledCheckin } from "@/constants/checkinKnowledge";
import type { AiCheckinItem } from "@workspace/checkin-schedule";
import { fmtMinutes } from "@/utils/duration";

type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  sc: ScheduledCheckin | null;
  meatOnMs: number | null;
  aiCheckins?: AiCheckinItem[] | null;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

const CI_COLOR = "#7C3AED";

export function CheckinPreviewSheet({ visible, onClose, colors, sc, meatOnMs, aiCheckins }: Props) {
  if (!sc) return null;

  const phase = sc.phase;
  const offsetMin =
    meatOnMs != null
      ? Math.round((sc.scheduledAt - meatOnMs) / 60_000)
      : null;

  // Match AI-generated checkin by label (same logic as UnifiedCheckinSheet)
  const matchedAiCheckin: AiCheckinItem | undefined =
    aiCheckins?.find(
      (a) => a.label.toLowerCase() === phase.label.toLowerCase(),
    ) ?? undefined;

  const effectiveCoachingNote: string =
    matchedAiCheckin?.coachingNote || phase.coachingTemplate;
  const effectiveVisualCues: string[] =
    matchedAiCheckin?.visualCues && matchedAiCheckin.visualCues.length > 0
      ? matchedAiCheckin.visualCues
      : phase.visualCues;
  const effectiveTempRange: [number, number] | null =
    matchedAiCheckin?.expectedInternalTempRange ??
    phase.expectedInternalTempRange ?? null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={s.grillOverlay} onPress={onClose} />
      <View
        style={[
          s.alertSheet,
          {
            backgroundColor: colors.card,
            maxHeight: "80%",
          },
        ]}
      >
        <View style={[s.grillSheetHandle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View
          style={[
            s.alertSheetHeader,
            { borderBottomColor: colors.border },
          ]}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: CI_COLOR + "22",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="bell" size={16} color={CI_COLOR} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                s.grillSheetTitle,
                { color: colors.foreground, marginBottom: 0, fontSize: 15 },
              ]}
            >
              {phase.label}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: CI_COLOR,
                marginTop: 1,
              }}
            >
              {fmtTime(sc.scheduledAt)}
              {offsetMin != null && offsetMin > 0
                ? `  ·  +${fmtMinutes(offsetMin)}`
                : ""}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
        >
          {/* Preview notice */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: CI_COLOR + "14",
              borderRadius: colors.radius,
              padding: 10,
            }}
          >
            <Feather name="info" size={13} color={CI_COLOR} />
            <Text
              style={{
                flex: 1,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: CI_COLOR,
                lineHeight: 17,
              }}
            >
              This is a preview — check in once your cook is active.
            </Text>
          </View>

          {/* PitMaster coaching card */}
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: matchedAiCheckin ? "#7C3AED40" : colors.border,
              overflow: "hidden",
            }}
          >
            {/* Card header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderBottomWidth: 1,
                borderBottomColor: matchedAiCheckin ? "#7C3AED22" : colors.border,
                backgroundColor: matchedAiCheckin ? "#7C3AED0A" : "transparent",
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  backgroundColor: matchedAiCheckin ? "#7C3AED22" : colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name={matchedAiCheckin ? "zap" : "message-circle"}
                  size={11}
                  color={matchedAiCheckin ? CI_COLOR : colors.mutedForeground}
                />
              </View>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 10,
                  color: matchedAiCheckin ? CI_COLOR : colors.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  flex: 1,
                }}
              >
                {matchedAiCheckin ? "PitMaster's Plan for This Phase" : "PitMaster will ask"}
              </Text>
              {matchedAiCheckin && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#7C3AED18",
                    borderColor: "#7C3AED40",
                    borderWidth: 1,
                    borderRadius: 20,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Feather name="cpu" size={9} color={CI_COLOR} />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 9,
                      color: CI_COLOR,
                    }}
                  >
                    AI
                  </Text>
                </View>
              )}
            </View>

            {/* Card body */}
            <View style={{ padding: 12, gap: 12 }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: colors.foreground,
                  lineHeight: 20,
                }}
              >
                {effectiveCoachingNote}
              </Text>

              {/* Expected temp range chip */}
              {effectiveTempRange != null && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: "#F59E0B14",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#F59E0B40",
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    alignSelf: "flex-start",
                  }}
                >
                  <Feather name="thermometer" size={13} color="#F59E0B" />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                      color: "#F59E0B",
                    }}
                  >
                    {effectiveTempRange[0]}–{effectiveTempRange[1]}°F expected
                  </Text>
                </View>
              )}

              {/* Visual cues */}
              {effectiveVisualCues.length > 0 && (
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Feather name="eye" size={11} color={colors.mutedForeground} />
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 10,
                        color: colors.mutedForeground,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Visual cues to look for
                    </Text>
                  </View>
                  <View style={{ gap: 7 }}>
                    {effectiveVisualCues.map((cue, i) => (
                      <View
                        key={i}
                        style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: "#22c55e",
                            marginTop: 7,
                            flexShrink: 0,
                          }}
                        />
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: "Inter_400Regular",
                            fontSize: 13,
                            color: colors.foreground,
                            lineHeight: 19,
                          }}
                        >
                          {cue}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Prep for next */}
          {phase.prepForNext ? (
            <View style={{ gap: 6 }}>
              <SectionLabel colors={colors} icon="arrow-right-circle" label="Prep for next phase" />
              <View
                style={{
                  backgroundColor: colors.background,
                  borderRadius: colors.radius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    color: colors.foreground,
                    lineHeight: 19,
                  }}
                >
                  {phase.prepForNext}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SectionLabel({
  colors,
  icon,
  label,
}: {
  colors: Colors;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Feather name={icon} size={11} color={colors.mutedForeground} />
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          color: colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
