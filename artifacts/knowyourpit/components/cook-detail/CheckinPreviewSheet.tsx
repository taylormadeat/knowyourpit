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
import { fmtMinutes } from "@/utils/duration";

type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  sc: ScheduledCheckin | null;
  meatOnMs: number | null;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

const CI_COLOR = "#7C3AED";

export function CheckinPreviewSheet({ visible, onClose, colors, sc, meatOnMs }: Props) {
  if (!sc) return null;

  const phase = sc.phase;
  const offsetMin =
    meatOnMs != null
      ? Math.round((sc.scheduledAt - meatOnMs) / 60_000)
      : null;

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

          {/* Coaching blurb */}
          <View style={{ gap: 6 }}>
            <SectionLabel colors={colors} icon="message-circle" label="PitMaster will ask" />
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
                  fontSize: 14,
                  color: colors.foreground,
                  lineHeight: 20,
                }}
              >
                {phase.coachingTemplate}
              </Text>
            </View>
          </View>

          {/* Expected temp range */}
          {phase.expectedInternalTempRange != null && (
            <View style={{ gap: 6 }}>
              <SectionLabel
                colors={colors}
                icon="thermometer"
                label="Expected internal temp"
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: colors.background,
                  borderRadius: colors.radius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                }}
              >
                <Feather name="thermometer" size={16} color="#F59E0B" />
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 16,
                    color: colors.foreground,
                  }}
                >
                  {phase.expectedInternalTempRange[0]}–
                  {phase.expectedInternalTempRange[1]}°F
                </Text>
              </View>
            </View>
          )}

          {/* Visual cues */}
          {phase.visualCues.length > 0 && (
            <View style={{ gap: 6 }}>
              <SectionLabel colors={colors} icon="eye" label="Visual cues to look for" />
              <View
                style={{
                  backgroundColor: colors.background,
                  borderRadius: colors.radius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  gap: 8,
                }}
              >
                {phase.visualCues.map((cue, i) => (
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
                        marginTop: 6,
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
