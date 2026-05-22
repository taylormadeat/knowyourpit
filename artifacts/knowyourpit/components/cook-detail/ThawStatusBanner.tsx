import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { relCountdown } from "./utils";
import type { SequenceData } from "./types";

type ThawStage = "thawing" | "tempering" | "ready" | null;

interface Props {
  cookStatus: string | undefined;
  isMeatOn: boolean;
  /** ISO string set when the pitmaster taps Start Cook / meat is confirmed on */
  actualStartAt?: string | null;
  cookSeqData: SequenceData | null;
  meatOnMs: number | null;
  nowMs: number;
  thawMethod?: string | null;
  actualThawStartAt?: string | null;
  onPress?: () => void;
  onMarkThawStarted?: () => void;
  markingThaw?: boolean;
  colors: any;
}

const METHOD_LABEL: Record<string, string> = {
  fridge: "Fridge thaw",
  cold_water: "Cold-water thaw",
  microwave: "Microwave thaw",
  counter: "Counter thaw",
  cook_from_frozen: "Cook from frozen",
};

function getMethodLabel(method: string | null | undefined): string {
  if (!method) return "Thawing";
  return METHOD_LABEL[method] ?? "Thawing";
}

const STAGE_CONFIG: Record<
  NonNullable<ThawStage>,
  { label: string; icon: string; color: string; gradientColors: [string, string]; sub: string }
> = {
  thawing: {
    label: "THAWING",
    icon: "cloud-snow",
    color: "#38bdf8",
    gradientColors: ["#0ea5e910", "#06b6d410"],
    sub: "Meat is in the thaw window",
  },
  tempering: {
    label: "TEMPERING",
    icon: "wind",
    color: "#a78bfa",
    gradientColors: ["#7c3aed10", "#a78bfa10"],
    sub: "Thawed — letting it come up to room temp",
  },
  ready: {
    label: "READY TO COOK",
    icon: "check-circle",
    color: "#22c55e",
    gradientColors: ["#22c55e10", "#16a34a10"],
    sub: "Ready to go on the grill",
  },
};

function computeThawStage(
  cookSeqData: SequenceData | null,
  nowMs: number,
  thawMethod: string | null | undefined,
): ThawStage {
  const frozen = cookSeqData?.frozen;
  if (!frozen?.thawStartAt) return null;

  const frozenMethod = frozen.method as string | null | undefined;
  const method = thawMethod ?? frozenMethod ?? null;

  if (method === "cook_from_frozen") return "thawing";

  const thawEndMs = frozen.thawEndAt ? new Date(frozen.thawEndAt as string).getTime() : null;

  if (thawEndMs != null && nowMs < thawEndMs) return "thawing";

  const grillLightAt = cookSeqData?.schedule?.[0]?.grillLightAt ?? null;
  const grillLightMs = grillLightAt ? new Date(grillLightAt as string).getTime() : null;

  if (grillLightMs != null && nowMs < grillLightMs) return "tempering";

  return "ready";
}

function fmtElapsed(elapsedMs: number): string {
  const totalMin = Math.floor(elapsedMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ThawStatusBanner({
  cookStatus,
  isMeatOn,
  actualStartAt,
  cookSeqData,
  meatOnMs,
  nowMs,
  thawMethod,
  actualThawStartAt,
  onPress,
  onMarkThawStarted,
  markingThaw,
  colors,
}: Props) {
  // Once the pitmaster has confirmed meat is on (actualStartAt set), hide the
  // banner regardless of whether sequenceData is present.
  if (cookStatus !== "active" || isMeatOn || !!actualStartAt) return null;

  const frozen = cookSeqData?.frozen;
  if (!frozen?.thawStartAt) return null;

  const stage = computeThawStage(cookSeqData, nowMs, thawMethod);
  if (!stage) return null;

  const cfg = STAGE_CONFIG[stage];
  const frozenMethod = (frozen as any).method as string | null | undefined;
  const method = thawMethod ?? frozenMethod ?? null;
  const methodLabel = getMethodLabel(method);

  const meatOnTimeStr =
    meatOnMs != null
      ? new Date(meatOnMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : null;

  const countdown = meatOnMs != null && meatOnMs > nowMs ? relCountdown(meatOnMs, nowMs) : null;

  const actualThawMs = actualThawStartAt ? new Date(actualThawStartAt).getTime() : null;
  const elapsedMs = actualThawMs != null ? nowMs - actualThawMs : null;
  const isThawingStage = stage === "thawing";
  const showMarkButton = isThawingStage && actualThawMs == null && !!onMarkThawStarted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed && onPress ? 0.88 : 1 }]}
      disabled={!onPress}
    >
      <View
        style={{
          borderRadius: colors.radius,
          borderWidth: 1.5,
          borderColor: cfg.color + "55",
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={cfg.gradientColors}
          style={{
            padding: 14,
            gap: 10,
          }}
        >
          {/* Main row: icon + text + chevron */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {/* Icon bubble */}
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: cfg.color + "22",
                borderWidth: 1.5,
                borderColor: cfg.color + "55",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Feather name={cfg.icon as any} size={18} color={cfg.color} />
            </View>

            {/* Text block */}
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    backgroundColor: cfg.color + "22",
                    borderRadius: 5,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 10,
                      color: cfg.color,
                      letterSpacing: 0.8,
                    }}
                  >
                    {cfg.label}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                    color: colors.mutedForeground,
                  }}
                >
                  {methodLabel}
                </Text>
              </View>

              {/* Sub-line: actual elapsed when thaw started, else planned sub */}
              {elapsedMs != null && isThawingStage ? (
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: colors.foreground,
                    lineHeight: 18,
                  }}
                >
                  Thawing for{" "}
                  <Text style={{ fontFamily: "Inter_700Bold", color: cfg.color }}>
                    {fmtElapsed(elapsedMs)}
                  </Text>
                </Text>
              ) : (
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: colors.foreground,
                    lineHeight: 18,
                  }}
                >
                  {cfg.sub}
                </Text>
              )}

              {/* Countdown / target time row */}
              {(countdown != null || meatOnTimeStr != null) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Feather name="clock" size={11} color={cfg.color} />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 12,
                      color: cfg.color,
                    }}
                  >
                    {countdown != null ? `Meat on in ${countdown}` : `Meat on at ${meatOnTimeStr}`}
                  </Text>
                  {countdown != null && meatOnTimeStr != null && (
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 11,
                        color: colors.mutedForeground,
                      }}
                    >
                      · {meatOnTimeStr}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Chevron hint if tappable */}
            {onPress && (
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            )}
          </View>

          {/* Mark Thaw Started button — only in thawing stage before thaw is confirmed */}
          {showMarkButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onMarkThawStarted();
              }}
              disabled={markingThaw}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 10,
                backgroundColor: cfg.color + "22",
                borderWidth: 1.5,
                borderColor: cfg.color + "55",
                opacity: pressed || markingThaw ? 0.7 : 1,
              })}
            >
              {markingThaw ? (
                <ActivityIndicator size="small" color={cfg.color} />
              ) : (
                <Feather name="check-square" size={15} color={cfg.color} />
              )}
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color: cfg.color,
                }}
              >
                {markingThaw ? "Saving…" : "Mark Thaw Started"}
              </Text>
            </Pressable>
          )}

          {/* Actual thaw started confirmation chip */}
          {isThawingStage && actualThawMs != null && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: cfg.color + "15",
                alignSelf: "flex-start",
              }}
            >
              <Feather name="check-circle" size={12} color={cfg.color} />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: cfg.color,
                }}
              >
                Thaw started at{" "}
                {new Date(actualThawMs).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </Pressable>
  );
}
