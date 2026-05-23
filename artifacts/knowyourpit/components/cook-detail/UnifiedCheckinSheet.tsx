import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import type { ComponentProps } from "react";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  useCreateCookCheckin,
  useCreateCookEvent,
  useUpdateCook,
} from "@workspace/api-client-react";
import type { CreateCookEventBodyEventType } from "@workspace/api-client-react";
import {
  CHECKIN_STATUS_FLAGS,
  CHECKIN_STALL_THRESHOLD_F,
  CHECKIN_PIT_DRIFT_THRESHOLD_F,
  type CheckinStatusFlag,
  type CheckinPhase,
} from "@/constants/checkinKnowledge";
import {
  QP_SPRITZ_FREQUENCIES,
  QP_SPRITZ_LIQUIDS,
  QP_WRAP_FINISH_OPTIONS,
} from "@/constants/cookQuickPicks";

type FeatherName = ComponentProps<typeof Feather>["name"];
type EventType = CreateCookEventBodyEventType;

interface EventChip {
  type: EventType;
  label: string;
  icon: FeatherName;
  color: string;
}

const EVENT_CHIPS: EventChip[] = [
  { type: "spritz", label: "Spritz", icon: "droplet", color: "#3B82F6" },
  { type: "lid_open", label: "Lid Opened", icon: "wind", color: "#6B7280" },
  { type: "flare_up", label: "Flare-Up", icon: "alert-triangle", color: "#EF4444" },
  { type: "charcoal_add", label: "Charcoal", icon: "plus-circle", color: "#F97316" },
  { type: "wood_add", label: "Wood", icon: "package", color: "#92400E" },
  { type: "vent_adjust", label: "Vent Adjust", icon: "sliders", color: "#0EA5E9" },
];

interface AnalysisDecision {
  action?: string;
  rationale?: string;
  priority?: string;
}

interface AnalysisResult {
  decisions?: AnalysisDecision[];
  phasePrediction?: {
    phase?: string;
    phaseLabel?: string;
    narrative?: string;
    timeToStallMinutes?: number | null;
    stallDurationMinutes?: number | null;
    timeToFinishMinutes?: number | null;
  } | null;
  assessment?: {
    verdict?: string;
    summary?: string;
  } | null;
}

interface Colors {
  background: string;
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  muted: string;
  radius: number;
}

interface UnifiedCheckinSheetProps {
  visible: boolean;
  onClose: () => void;
  cookId: number;
  colors: Colors;
  phase: CheckinPhase;
  scheduledAt: number;
  foodType?: string | null;
  weightLbs?: number | null;
  currentInternalTempF?: number | null;
  currentPitTempF?: number | null;
  probeSource?: "meater" | "thermoworks" | null;
  lastCheckinInternalTempF?: number | null;
  targetCookTempF?: number | null;
  weatherTempF?: number | null;
  weatherWindSpeedMph?: number | null;
  onCheckinSaved?: (savedInternalTempF: number | null) => void;
  cookSpritzFrequency?: string | null;
  cookSpritzLiquid?: string | null;
  cookWrapFinish?: string | null;
  onRequestAnalyze: (opts: { internalTempF: number | null; pitTempF: number | null; notes: string }) => Promise<void>;
  result: AnalysisResult | null;
}

type Stage = "form" | "submitting" | "analyzing" | "done";

const fmtMin = (mins: number) => {
  if (mins < 60) return `~${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
};

const PHASE_COLORS: Record<string, string> = {
  heat_up: "#3B82F6",
  stall: "#F59E0B",
  finishing: "#22c55e",
  done: "#6B7280",
};
const PHASE_ICONS: Record<string, FeatherName> = {
  heat_up: "thermometer",
  stall: "clock",
  finishing: "trending-up",
  done: "check-circle",
};

export function UnifiedCheckinSheet({
  visible,
  onClose,
  cookId,
  colors,
  phase,
  scheduledAt,
  foodType,
  weightLbs,
  currentInternalTempF,
  currentPitTempF,
  probeSource,
  lastCheckinInternalTempF,
  targetCookTempF,
  weatherTempF,
  weatherWindSpeedMph,
  onCheckinSaved,
  cookSpritzFrequency,
  cookSpritzLiquid,
  cookWrapFinish,
  onRequestAnalyze,
  result,
}: UnifiedCheckinSheetProps) {
  const createCheckin = useCreateCookCheckin();
  const createEvent = useCreateCookEvent();
  const updateCook = useUpdateCook();

  const [stage, setStage] = useState<Stage>("form");

  const [selectedEvents, setSelectedEvents] = useState<Set<EventType>>(new Set());
  const [internalTempInput, setInternalTempInput] = useState(
    currentInternalTempF != null ? String(Math.round(currentInternalTempF)) : "",
  );
  const [pitTempInput, setPitTempInput] = useState(
    currentPitTempF != null ? String(Math.round(currentPitTempF)) : "",
  );
  const [selectedFlag, setSelectedFlag] = useState<CheckinStatusFlag | null>(null);
  const [userNote, setUserNote] = useState("");

  const [spritzFreq, setSpritzFreq] = useState<string | null>(cookSpritzFrequency ?? null);
  const [spritzLiquid, setSpritzLiquid] = useState<string | null>(cookSpritzLiquid ?? null);
  const [wrapFinish, setWrapFinish] = useState<string | null>(cookWrapFinish ?? null);

  useEffect(() => {
    if (!visible) return;
    setStage("form");
    setSelectedEvents(new Set());
    setInternalTempInput(
      currentInternalTempF != null ? String(Math.round(currentInternalTempF)) : "",
    );
    setPitTempInput(
      currentPitTempF != null ? String(Math.round(currentPitTempF)) : "",
    );
    setSelectedFlag(null);
    setUserNote("");
    setSpritzFreq(cookSpritzFrequency ?? null);
    setSpritzLiquid(cookSpritzLiquid ?? null);
    setWrapFinish(cookWrapFinish ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cookId, phase.key]);

  const parsedInternal = internalTempInput.trim() ? parseFloat(internalTempInput) : null;
  const parsedPit = pitTempInput.trim() ? parseFloat(pitTempInput) : null;

  const stallDetected =
    lastCheckinInternalTempF != null &&
    parsedInternal != null &&
    Math.abs(parsedInternal - lastCheckinInternalTempF) < CHECKIN_STALL_THRESHOLD_F;

  const pitDriftDetected =
    targetCookTempF != null &&
    parsedPit != null &&
    Math.abs(parsedPit - targetCookTempF) > CHECKIN_PIT_DRIFT_THRESHOLD_F;

  const pitDriftDir =
    pitDriftDetected && parsedPit != null && targetCookTempF != null
      ? parsedPit > targetCookTempF
        ? "high"
        : "low"
      : null;

  const isColdOutside = weatherTempF != null && weatherTempF < 45;

  const canSubmit =
    parsedInternal != null &&
    !isNaN(parsedInternal) &&
    parsedPit != null &&
    !isNaN(parsedPit);

  const toggleEvent = useCallback((type: EventType) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStage("submitting");
    try {
      await createCheckin.mutateAsync({
        id: cookId,
        data: {
          scheduledAt: new Date(scheduledAt).toISOString(),
          internalTempF: parsedInternal ?? null,
          pitTempF: parsedPit ?? null,
          statusFlag: selectedFlag ?? null,
          userNote: userNote.trim() || null,
          photoKey: null,
          aiGuidanceShown: null,
          phaseLabel: phase.label,
          phaseKey: phase.key,
        },
      });

      for (const eventType of selectedEvents) {
        await createEvent.mutateAsync({
          id: cookId,
          data: { eventType, note: null },
        }).catch(() => {});
      }

      const techniqueChanged =
        spritzFreq !== (cookSpritzFrequency ?? null) ||
        spritzLiquid !== (cookSpritzLiquid ?? null) ||
        wrapFinish !== (cookWrapFinish ?? null);

      if (techniqueChanged) {
        await updateCook.mutateAsync({
          id: cookId,
          data: {
            spritzFrequency: spritzFreq,
            spritzLiquid: spritzLiquid,
            wrapFinish: wrapFinish,
          } as any,
        }).catch(() => {});
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onCheckinSaved?.(parsedInternal ?? null);

      setStage("analyzing");
      await onRequestAnalyze({
        internalTempF: parsedInternal ?? null,
        pitTempF: parsedPit ?? null,
        notes: userNote.trim(),
      });
      setStage("done");
    } catch (err: any) {
      setStage("form");
      Alert.alert("Check-in failed", "Could not save. Please try again.");
    }
  };

  const handleClose = () => {
    if (stage === "submitting" || stage === "analyzing") return;
    onClose();
  };

  if (!visible) return null;

  const isSubmitting = stage === "submitting";
  const isAnalyzing = stage === "analyzing";
  const isDone = stage === "done";
  const isBusy = isSubmitting || isAnalyzing;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <AppKeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient
          colors={["#1C1C1F", "#2D1A0E"]}
          style={{
            paddingTop: 20,
            paddingHorizontal: 20,
            paddingBottom: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "#F59E0B",
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Check In with PitMaster
            </Text>
            <Text
              style={{
                color: "#F3EDE1",
                fontFamily: "Inter_700Bold",
                fontSize: 20,
                marginTop: 2,
              }}
            >
              {phase.label}
            </Text>
            {foodType && (
              <Text
                style={{
                  color: "#9CA3AF",
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {foodType}
                {weightLbs != null ? ` · ${weightLbs} lbs` : ""}
              </Text>
            )}
          </View>
          <Pressable onPress={handleClose} hitSlop={12} disabled={isBusy}>
            <Feather name="x" size={22} color={isBusy ? "#555" : "#9CA3AF"} />
          </Pressable>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── 1. What just happened? ──────────────────────────── */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 13,
                color: colors.foreground,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 12,
              }}
            >
              What just happened?
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {EVENT_CHIPS.map((chip) => {
                const active = selectedEvents.has(chip.type);
                return (
                  <Pressable
                    key={chip.type}
                    onPress={() => toggleEvent(chip.type)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? chip.color : colors.border,
                      backgroundColor: active ? chip.color + "20" : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Feather
                      name={chip.icon}
                      size={13}
                      color={active ? chip.color : (colors.mutedForeground as string)}
                    />
                    <Text
                      style={{
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                        fontSize: 13,
                        color: active ? chip.color : colors.foreground,
                      }}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── 2. Temperatures ──────────────────────────────────── */}
          {stallDetected && (
            <View
              style={{
                backgroundColor: "#EF444420",
                borderColor: "#EF4444",
                borderWidth: 1,
                borderRadius: colors.radius,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Feather name="alert-triangle" size={16} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 13,
                    color: "#EF4444",
                  }}
                >
                  Stall Detected
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: colors.foreground,
                    marginTop: 2,
                  }}
                >
                  Internal temp moved less than {CHECKIN_STALL_THRESHOLD_F}°F since last check-in. This is
                  normal — the stall is evaporative cooling, not a problem.
                </Text>
              </View>
            </View>
          )}
          {pitDriftDetected && (
            <View
              style={{
                backgroundColor: "#F59E0B20",
                borderColor: "#F59E0B",
                borderWidth: 1,
                borderRadius: colors.radius,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Feather name="thermometer" size={16} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 13,
                    color: "#F59E0B",
                  }}
                >
                  Pit Temp {pitDriftDir === "high" ? "Running Hot" : "Running Cold"}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: colors.foreground,
                    marginTop: 2,
                  }}
                >
                  Pit is {Math.abs((parsedPit ?? 0) - (targetCookTempF ?? 0)).toFixed(0)}°F{" "}
                  {pitDriftDir} of target ({targetCookTempF != null ? `${Math.round(targetCookTempF)}°F` : "—"}). Adjust vents or fuel now.
                </Text>
              </View>
            </View>
          )}
          {isColdOutside && (
            <View
              style={{
                backgroundColor: "#3B82F620",
                borderColor: "#3B82F6",
                borderWidth: 1,
                borderRadius: colors.radius,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Feather name="wind" size={16} color="#3B82F6" />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.foreground,
                  flex: 1,
                }}
              >
                Cold outside ({Math.round(weatherTempF!)}°F) — your grill may lose heat faster
                than expected. Check vent settings.
              </Text>
            </View>
          )}

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 14,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                  color: colors.foreground,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                Temperatures
              </Text>
              {probeSource != null &&
                (currentInternalTempF != null || currentPitTempF != null) && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: "#22c55e18",
                      borderColor: "#22c55e",
                      borderWidth: 1,
                      borderRadius: 20,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Feather name="wifi" size={11} color="#22c55e" />
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 10,
                        color: "#22c55e",
                      }}
                    >
                      {probeSource === "meater"
                        ? "Auto-filled from MEATER"
                        : "Auto-filled from probe"}
                    </Text>
                  </View>
                )}
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                    color: colors.mutedForeground,
                    marginBottom: 6,
                  }}
                >
                  Internal Temp
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TextInput
                    value={internalTempInput}
                    onChangeText={setInternalTempInput}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.mutedForeground}
                    editable={!isBusy}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      padding: 10,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 18,
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      textAlign: "center",
                    }}
                  />
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                    }}
                  >
                    °F
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                    color: colors.mutedForeground,
                    marginBottom: 6,
                  }}
                >
                  Pit Temp
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TextInput
                    value={pitTempInput}
                    onChangeText={setPitTempInput}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.mutedForeground}
                    editable={!isBusy}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      padding: 10,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 18,
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      textAlign: "center",
                    }}
                  />
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 14,
                    }}
                  >
                    °F
                  </Text>
                </View>
              </View>
            </View>
            {phase.expectedInternalTempRange != null && (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.mutedForeground,
                }}
              >
                Expected for this phase: {phase.expectedInternalTempRange[0]}–
                {phase.expectedInternalTempRange[1]}°F
              </Text>
            )}
            {!canSubmit && (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: "#F59E0B",
                  marginTop: 2,
                }}
              >
                Enter both internal and pit temps to check in
              </Text>
            )}

            {/* Quick status flags */}
            <View>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                  color: colors.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                Quick Status
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CHECKIN_STATUS_FLAGS.map((flag) => {
                  const active = selectedFlag === flag.key;
                  return (
                    <Pressable
                      key={flag.key}
                      onPress={() =>
                        !isBusy && setSelectedFlag(active ? null : flag.key)
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: active ? 1.5 : 1,
                        borderColor: active ? flag.color : colors.border,
                        backgroundColor: active ? `${flag.color}18` : colors.background,
                      }}
                    >
                      <Feather
                        name={flag.icon}
                        size={13}
                        color={active ? flag.color : (colors.mutedForeground as string)}
                      />
                      <Text
                        style={{
                          fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                          fontSize: 13,
                          color: active ? flag.color : colors.foreground,
                        }}
                      >
                        {flag.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── 3. Technique context ─────────────────────────────── */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              gap: 14,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 13,
                color: colors.foreground,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Technique
            </Text>

            <TechniqueChipRow
              label="Wrap / Finish"
              options={QP_WRAP_FINISH_OPTIONS as unknown as string[]}
              value={wrapFinish}
              onChange={isBusy ? undefined : setWrapFinish}
              colors={colors}
            />
            <TechniqueChipRow
              label="Spritz Frequency"
              options={QP_SPRITZ_FREQUENCIES as unknown as string[]}
              value={spritzFreq}
              onChange={isBusy ? undefined : setSpritzFreq}
              colors={colors}
            />
            <TechniqueChipRow
              label="Spritz Liquid"
              options={QP_SPRITZ_LIQUIDS as unknown as string[]}
              value={spritzLiquid}
              onChange={isBusy ? undefined : setSpritzLiquid}
              colors={colors}
            />
          </View>

          {/* ── 4. Notes ─────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 13,
                color: colors.foreground,
                marginBottom: 8,
              }}
            >
              Notes{" "}
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                  fontSize: 12,
                }}
              >
                (optional)
              </Text>
            </Text>
            <TextInput
              value={userNote}
              onChangeText={setUserNote}
              multiline
              editable={!isBusy}
              placeholder="Tell PitMaster anything — what you're seeing, smelling, or wondering about…"
              placeholderTextColor={colors.mutedForeground}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                fontFamily: "Inter_400Regular",
                color: colors.foreground,
                backgroundColor: colors.background,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </View>

          {/* ── Submit button ─────────────────────────────────────── */}
          <Pressable
            onPress={handleSubmit}
            disabled={isBusy || !canSubmit || isDone}
            style={({ pressed }) => ({
              overflow: "hidden",
              borderRadius: colors.radius,
              opacity: pressed || isBusy || !canSubmit || isDone ? 0.5 : 1,
            })}
          >
            <LinearGradient
              colors={["#E84520", "#F59E0B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 52,
              }}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    Saving…
                  </Text>
                </>
              ) : isAnalyzing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    PitMaster is thinking…
                  </Text>
                </>
              ) : isDone ? (
                <>
                  <Feather name="check-circle" size={18} color="#fff" />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    Checked In
                  </Text>
                </>
              ) : (
                <>
                  <Feather name="zap" size={18} color="#fff" />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    Check In with PitMaster
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* ── Inline AI result ─────────────────────────────────── */}
          {isDone && result && (
            <InlineAnalysisResult result={result} colors={colors} />
          )}

          {/* ── Dismiss after done ────────────────────────────────── */}
          {isDone && (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                alignItems: "center",
                paddingVertical: 14,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 15,
                  color: colors.mutedForeground,
                }}
              >
                Done
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </AppKeyboardAvoidingView>
    </Modal>
  );
}

function TechniqueChipRow({
  label,
  options,
  value,
  onChange,
  colors,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange?: (v: string | null) => void;
  colors: Colors;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
          color: colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}
      >
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange && onChange(active ? null : opt)}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: active ? 1.5 : 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary + "20" : "transparent",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                  fontSize: 12,
                  color: active ? colors.primary : colors.foreground,
                }}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function InlineAnalysisResult({
  result,
  colors,
}: {
  result: AnalysisResult;
  colors: Colors;
}) {
  const decisions = result.decisions ?? [];
  const pp = result.phasePrediction ?? null;
  const assessment = result.assessment ?? null;

  const primaryDecisions = decisions.filter(
    (d) => d.priority === "primary" || d.priority === "high",
  );
  const displayDecisions = primaryDecisions.length > 0 ? primaryDecisions : decisions.slice(0, 3);

  const phaseColor = pp?.phase ? (PHASE_COLORS[pp.phase] ?? "#6B7280") : "#6B7280";
  const phaseIcon: FeatherName = pp?.phase
    ? (PHASE_ICONS[pp.phase] ?? "activity")
    : "activity";

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: "#6C3BF540",
        overflow: "hidden",
        gap: 0,
      }}
    >
      <LinearGradient
        colors={["#6C3BF515", "#6C3BF505"]}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <LinearGradient
          colors={["#6C3BF5", "#A855F7"]}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="zap" size={14} color="#fff" />
        </LinearGradient>
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 14,
            color: colors.foreground,
          }}
        >
          PitMaster's Next Steps
        </Text>
      </LinearGradient>

      <View style={{ padding: 16, gap: 12 }}>
        {displayDecisions.length > 0 && (
          <View style={{ gap: 8 }}>
            {displayDecisions.map((d, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "#E8452015",
                    borderWidth: 1,
                    borderColor: "#E8452040",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 10,
                      color: "#E84520",
                    }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 13,
                      color: colors.foreground,
                      lineHeight: 19,
                    }}
                  >
                    {d.action}
                  </Text>
                  {d.rationale ? (
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: colors.mutedForeground,
                        lineHeight: 17,
                        marginTop: 2,
                      }}
                    >
                      {d.rationale}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {pp && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: phaseColor + "15",
              borderWidth: 1,
              borderColor: phaseColor + "40",
            }}
          >
            <Feather name={phaseIcon} size={13} color={phaseColor} />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: phaseColor,
                flex: 1,
              }}
            >
              {pp.phaseLabel}
              {pp.timeToFinishMinutes != null
                ? `  ·  Done in ${fmtMin(pp.timeToFinishMinutes)}`
                : ""}
              {pp.stallDurationMinutes != null && pp.phase === "stall"
                ? `  ·  Stall ends in ${fmtMin(pp.stallDurationMinutes)}`
                : ""}
            </Text>
          </View>
        )}

        {assessment?.summary && (
          <View
            style={{
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: colors.border,
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
              {assessment.summary}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
