import React, { useState, useCallback, useEffect } from "react";
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
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import {
  CHECKIN_STATUS_FLAGS,
  CHECKIN_STALL_THRESHOLD_F,
  CHECKIN_PIT_DRIFT_THRESHOLD_F,
  type CheckinStatusFlag,
  type CheckinPhase,
} from "@/constants/checkinKnowledge";
import { useCreateCookCheckin, customFetch } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Standalone AI coaching helper — takes all values explicitly so it can be
// called from both the on-open preview AND from handleSave with actual
// submitted values, avoiding any React-state staleness.
// ---------------------------------------------------------------------------
interface GuidanceParams {
  foodType: string | null | undefined;
  weightLbs: number | null | undefined;
  phase: CheckinPhase;
  internalTempF: number | null;
  pitTempF: number | null;
  targetCookTempF: number | null | undefined;
  lastCheckinInternalTempF: number | null | undefined;
  stallDetected: boolean;
  pitDriftDetected: boolean;
  pitDriftDir: "high" | "low" | null;
  isColdOutside: boolean;
  isWindy: boolean;
  weatherTempF: number | null | undefined;
  weatherWindSpeedMph: number | null | undefined;
  statusFlag: CheckinStatusFlag | null;
  userNote: string;
}

async function fetchCheckinGuidance(opts: GuidanceParams): Promise<string> {
  const {
    foodType, weightLbs, phase, internalTempF, pitTempF, targetCookTempF,
    stallDetected, pitDriftDetected, pitDriftDir,
    isColdOutside, isWindy, weatherTempF, weatherWindSpeedMph,
    statusFlag, userNote,
  } = opts;

  const contextLines = [
    weightLbs != null
      ? `Meat: ${foodType ?? "unknown"} (${weightLbs} lbs)`
      : `Meat: ${foodType ?? "unknown"}`,
    `Phase: ${phase.label} (${phase.key})`,
    internalTempF != null
      ? `Current internal temp: ${internalTempF}°F`
      : "No internal temp reported",
    pitTempF != null ? `Pit temp: ${pitTempF}°F` : "",
    targetCookTempF != null ? `Target pit temp: ${targetCookTempF}°F` : "",
    stallDetected
      ? "STALL DETECTED: internal temp moved less than 3°F since last check-in."
      : "",
    pitDriftDetected && pitTempF != null && targetCookTempF != null
      ? `PIT DRIFT: pit is ${Math.abs(pitTempF - targetCookTempF).toFixed(0)}°F ${pitDriftDir} from target.`
      : "",
    isColdOutside && weatherTempF != null
      ? `Weather: ${Math.round(weatherTempF)}°F outdoor temp — grill may struggle to hold temperature.`
      : weatherTempF != null
      ? `Outdoor temp: ${Math.round(weatherTempF)}°F`
      : "",
    isWindy && weatherWindSpeedMph != null
      ? `Wind: ${weatherWindSpeedMph} mph — wind can steal heat and cause hot/cold spots in the grill.`
      : weatherWindSpeedMph != null && weatherWindSpeedMph > 0
      ? `Wind: ${weatherWindSpeedMph} mph`
      : "",
    statusFlag ? `Status: ${statusFlag.replace(/_/g, " ")}` : "",
    userNote.trim() ? `Pitmaster note: "${userNote.trim()}"` : "",
  ].filter(Boolean);

  const prompt = [
    `You are PitMaster AI coaching a BBQ pitmaster through a live cook check-in.`,
    `Context:\n${contextLines.join("\n")}`,
    ``,
    `Visual cues for this phase: ${phase.visualCues.join("; ")}`,
    `What to prep for next: ${phase.prepForNext}`,
    ``,
    `Provide targeted, practical coaching for RIGHT NOW. Be specific and actionable.`,
    `Keep it under 120 words. Focus on the most important action or observation for this moment.`,
    stallDetected ? `The stall is detected — address this as the primary concern.` : "",
    pitDriftDetected
      ? `Pit temp is significantly off target — address this as the primary concern.`
      : "",
    isWindy && weatherWindSpeedMph != null
      ? `Wind at ${weatherWindSpeedMph} mph — advise on wind management for the grill.`
      : "",
    userNote.trim()
      ? `The pitmaster mentioned: "${userNote.trim()}" — factor this into your advice.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const conv = await customFetch<{ id: number }>("/api/ai/conversations", {
    method: "POST",
    body: JSON.stringify({ title: `Checkin: ${phase.label}` }),
  });

  const msg = await customFetch<{ reply: string }>(`/api/ai/conversations/${conv.id}/chat`, {
    method: "POST",
    body: JSON.stringify({ message: prompt }),
  });

  return msg?.reply ?? phase.coachingTemplate;
}

interface CheckinModalProps {
  visible: boolean;
  onClose: () => void;
  cookId: number;
  colors: Record<string, unknown> & {
    background: string;
    card: string;
    border: string;
    foreground: string;
    mutedForeground: string;
    primary: string;
    muted: string;
    radius: number;
  };
  phase: CheckinPhase;
  scheduledAt: number;
  foodType?: string | null;
  weightLbs?: number | null;
  currentInternalTempF?: number | null;
  currentPitTempF?: number | null;
  /** Which connected probe provided the pre-filled temperatures. */
  probeSource?: "meater" | "thermoworks" | null;
  lastCheckinInternalTempF?: number | null;
  targetCookTempF?: number | null;
  weatherTempF?: number | null;
  weatherWindSpeedMph?: number | null;
  onCheckinSaved?: (savedInternalTempF: number | null) => void;
}

const fmtTemp = (t: number | null | undefined) =>
  t != null ? `${Math.round(t)}°F` : "—";

interface AiConversation {
  id: number;
}

interface AiMessage {
  reply?: string;
  messageId?: number;
}

export function CheckinModal({
  visible,
  onClose,
  cookId,
  colors,
  phase,
  scheduledAt,
  foodType,
  currentInternalTempF,
  currentPitTempF,
  probeSource,
  weightLbs,
  lastCheckinInternalTempF,
  targetCookTempF,
  weatherTempF,
  weatherWindSpeedMph,
  onCheckinSaved,
}: CheckinModalProps) {
  const createCheckin = useCreateCookCheckin();

  const [internalTempInput, setInternalTempInput] = useState(
    currentInternalTempF != null ? String(Math.round(currentInternalTempF)) : "",
  );
  const [pitTempInput, setPitTempInput] = useState(
    currentPitTempF != null ? String(Math.round(currentPitTempF)) : "",
  );
  const [selectedFlag, setSelectedFlag] = useState<CheckinStatusFlag | null>(null);
  const [userNote, setUserNote] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [aiGuidance, setAiGuidance] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cuesExpanded, setCuesExpanded] = useState(true);

  // Reset state whenever the modal becomes visible, then kick off a background
  // AI coaching preview using the *probe values passed as props* (not React
  // state, which hasn't committed yet at this point in the render cycle).
  useEffect(() => {
    if (!visible) return;
    const initialInternalF =
      currentInternalTempF != null ? Math.round(currentInternalTempF) : null;
    const initialPitF =
      currentPitTempF != null ? Math.round(currentPitTempF) : null;
    setInternalTempInput(
      initialInternalF != null ? String(initialInternalF) : "",
    );
    setPitTempInput(initialPitF != null ? String(initialPitF) : "");
    setSelectedFlag(null);
    setUserNote("");
    setPhotoKey(null);
    setPhotoUri(null);
    setAiGuidance(null);
    setSaving(false);

    // Background preview using *explicit* prop values — no React-state staleness.
    const initStall =
      lastCheckinInternalTempF != null &&
      initialInternalF != null &&
      Math.abs(initialInternalF - lastCheckinInternalTempF) < CHECKIN_STALL_THRESHOLD_F;
    const initDriftVal =
      targetCookTempF != null && initialPitF != null
        ? initialPitF - targetCookTempF
        : null;
    const initDrift = initDriftVal != null && Math.abs(initDriftVal) > CHECKIN_PIT_DRIFT_THRESHOLD_F;
    setAiLoading(true);
    fetchCheckinGuidance({
      foodType,
      weightLbs: weightLbs ?? null,
      phase,
      internalTempF: initialInternalF,
      pitTempF: initialPitF,
      targetCookTempF: targetCookTempF ?? null,
      lastCheckinInternalTempF: lastCheckinInternalTempF ?? null,
      stallDetected: initStall,
      pitDriftDetected: initDrift,
      pitDriftDir: initDriftVal != null ? (initDriftVal > 0 ? "high" : "low") : null,
      isColdOutside: weatherTempF != null && weatherTempF < 45,
      isWindy: weatherWindSpeedMph != null && weatherWindSpeedMph >= 15,
      weatherTempF: weatherTempF ?? null,
      weatherWindSpeedMph: weatherWindSpeedMph ?? null,
      statusFlag: null,
      userNote: "",
    })
      .then((result) => setAiGuidance(result))
      .catch(() => setAiGuidance(phase.coachingTemplate))
      .finally(() => setAiLoading(false));
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
  const isWindy = weatherWindSpeedMph != null && weatherWindSpeedMph >= 15;

  // Both temperatures must be entered before Save is enabled. Fields may be
  // pre-filled by a connected probe but the user must explicitly confirm them
  // by leaving or adjusting the values — pre-fill counts as confirmation.
  const canSave =
    parsedInternal != null && !isNaN(parsedInternal) &&
    parsedPit != null && !isNaN(parsedPit);

  // "Regenerate" button — delegates to the module-level helper using current
  // form state, which is accurate since the user has already interacted.
  const generateAiGuidance = useCallback(async () => {
    setAiLoading(true);
    setAiGuidance(null);
    try {
      const result = await fetchCheckinGuidance({
        foodType,
        weightLbs: weightLbs ?? null,
        phase,
        internalTempF: parsedInternal,
        pitTempF: parsedPit,
        targetCookTempF: targetCookTempF ?? null,
        lastCheckinInternalTempF: lastCheckinInternalTempF ?? null,
        stallDetected,
        pitDriftDetected,
        pitDriftDir,
        isColdOutside,
        isWindy,
        weatherTempF: weatherTempF ?? null,
        weatherWindSpeedMph: weatherWindSpeedMph ?? null,
        statusFlag: selectedFlag,
        userNote,
      });
      setAiGuidance(result);
    } catch (err) {
      console.warn("[CheckinModal] AI guidance regenerate failed:", err);
      setAiGuidance(phase.coachingTemplate);
    } finally {
      setAiLoading(false);
    }
  }, [phase, parsedInternal, parsedPit, targetCookTempF, lastCheckinInternalTempF, stallDetected, pitDriftDetected, pitDriftDir, isColdOutside, isWindy, selectedFlag, userNote, foodType, weightLbs, weatherTempF, weatherWindSpeedMph]);

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        base64: false,
        exif: false,
      });
      if (!res.canceled && res.assets[0]) {
        const uri = res.assets[0].uri;
        setPhotoUri(uri);
        // Convert to base64 data URL so the photo is durable across sessions
        // and devices — stored directly in the cook_checkins row via photo_key.
        try {
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
          setPhotoKey(`data:image/jpeg;base64,${b64}`);
        } catch (err) {
          console.warn("[CheckinModal] base64 encode failed, falling back to local URI:", err);
          setPhotoKey(`local:${uri}`);
        }
      }
    } catch (err) {
      console.warn("[CheckinModal] camera launch failed:", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Always generate fresh AI guidance from the *actual submitted values*
      // so aiGuidanceShown reflects the note, status flag, and temperatures
      // the pitmaster just entered — not a preview generated at modal-open time.
      let finalGuidance = aiGuidance;
      try {
        setAiLoading(true);
        finalGuidance = await fetchCheckinGuidance({
          foodType,
          weightLbs: weightLbs ?? null,
          phase,
          internalTempF: parsedInternal,
          pitTempF: parsedPit,
          targetCookTempF: targetCookTempF ?? null,
          lastCheckinInternalTempF: lastCheckinInternalTempF ?? null,
          stallDetected,
          pitDriftDetected,
          pitDriftDir,
          isColdOutside,
          isWindy,
          weatherTempF: weatherTempF ?? null,
          weatherWindSpeedMph: weatherWindSpeedMph ?? null,
          statusFlag: selectedFlag,
          userNote,
        });
        setAiGuidance(finalGuidance);
      } catch (err) {
        console.warn("[CheckinModal] AI guidance at save failed:", err);
        finalGuidance = aiGuidance ?? phase.coachingTemplate;
      } finally {
        setAiLoading(false);
      }

      await createCheckin.mutateAsync({
        id: cookId,
        data: {
          scheduledAt: new Date(scheduledAt).toISOString(),
          internalTempF: parsedInternal ?? null,
          pitTempF: parsedPit ?? null,
          statusFlag: selectedFlag ?? null,
          userNote: userNote.trim() || null,
          photoKey: photoKey,
          aiGuidanceShown: finalGuidance,
          phaseLabel: phase.label,
          phaseKey: phase.key,
        },
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onCheckinSaved?.(parsedInternal ?? null);
      onClose();
    } catch {
      Alert.alert("Save failed", "Could not save check-in. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <AppKeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient
          colors={["#1C1C1F", "#2D1A0E"]}
          style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", alignItems: "center" }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#F59E0B", fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
              Check-In
            </Text>
            <Text style={{ color: "#F3EDE1", fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 2 }}>
              {phase.label}
            </Text>
            {foodType && (
              <Text style={{ color: "#9CA3AF", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                {foodType}
              </Text>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={22} color="#9CA3AF" />
          </Pressable>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Alert banners ─────────────────────────────────────── */}
          {stallDetected && (
            <View style={{ backgroundColor: "#EF444420", borderColor: "#EF4444", borderWidth: 1, borderRadius: colors.radius, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather name="alert-triangle" size={16} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#EF4444" }}>Stall Detected</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, marginTop: 2 }}>
                  Internal temp moved less than {CHECKIN_STALL_THRESHOLD_F}°F since last check-in. This is normal — the stall is evaporative cooling, not a problem.
                </Text>
              </View>
            </View>
          )}
          {pitDriftDetected && (
            <View style={{ backgroundColor: "#F59E0B20", borderColor: "#F59E0B", borderWidth: 1, borderRadius: colors.radius, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather name="thermometer" size={16} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#F59E0B" }}>
                  Pit Temp {pitDriftDir === "high" ? "Running Hot" : "Running Cold"}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, marginTop: 2 }}>
                  Pit is {Math.abs((parsedPit ?? 0) - (targetCookTempF ?? 0)).toFixed(0)}°F {pitDriftDir} of target ({fmtTemp(targetCookTempF)}). Adjust vents or fuel now.
                </Text>
              </View>
            </View>
          )}
          {isColdOutside && (
            <View style={{ backgroundColor: "#3B82F620", borderColor: "#3B82F6", borderWidth: 1, borderRadius: colors.radius, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Feather name="wind" size={16} color="#3B82F6" />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, flex: 1 }}>
                Cold outside ({Math.round(weatherTempF!)}°F) — your grill may lose heat faster than expected. Check vent settings.
              </Text>
            </View>
          )}

          {/* ── Temp inputs ───────────────────────────────────────── */}
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground, textTransform: "uppercase", letterSpacing: 0.6 }}>
                Temperature Reading
              </Text>
              {probeSource === "meater" && (currentInternalTempF != null || currentPitTempF != null) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#22c55e18", borderColor: "#22c55e", borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Feather name="wifi" size={11} color="#22c55e" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#22c55e" }}>
                    Auto-filled from MEATER
                  </Text>
                </View>
              )}
              {probeSource === "thermoworks" && (currentInternalTempF != null || currentPitTempF != null) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#22c55e18", borderColor: "#22c55e", borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Feather name="wifi" size={11} color="#22c55e" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#22c55e" }}>
                    Auto-filled from probe
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground, marginBottom: 6 }}>Internal Temp</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TextInput
                    value={internalTempInput}
                    onChangeText={setInternalTempInput}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.mutedForeground}
                    style={{
                      flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                      padding: 10, fontFamily: "Inter_600SemiBold", fontSize: 18,
                      color: colors.foreground, backgroundColor: colors.background, textAlign: "center",
                    }}
                  />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>°F</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground, marginBottom: 6 }}>Pit Temp</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TextInput
                    value={pitTempInput}
                    onChangeText={setPitTempInput}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.mutedForeground}
                    style={{
                      flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                      padding: 10, fontFamily: "Inter_600SemiBold", fontSize: 18,
                      color: colors.foreground, backgroundColor: colors.background, textAlign: "center",
                    }}
                  />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>°F</Text>
                </View>
              </View>
            </View>
            {phase.expectedInternalTempRange != null && (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                Expected for this phase: {phase.expectedInternalTempRange[0]}–{phase.expectedInternalTempRange[1]}°F
              </Text>
            )}
            {!canSave && (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#F59E0B", marginTop: 2 }}>
                Enter both internal and pit temps to save
              </Text>
            )}
          </View>

          {/* ── Quick status ──────────────────────────────────────── */}
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
              Quick Status
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CHECKIN_STATUS_FLAGS.map((flag) => {
                const active = selectedFlag === flag.key;
                return (
                  <Pressable
                    key={flag.key}
                    onPress={() => setSelectedFlag(active ? null : flag.key)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 6,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? flag.color : colors.border,
                      backgroundColor: active ? `${flag.color}18` : colors.background,
                    }}
                  >
                    <Feather name={flag.icon} size={13} color={active ? flag.color : colors.mutedForeground} />
                    <Text style={{
                      fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                      fontSize: 13,
                      color: active ? flag.color : colors.foreground,
                    }}>
                      {flag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Visual milestone photo ────────────────────────────── */}
          {phase.isVisualMilestone && (
            <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground }}>
                📸 Visual Milestone
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                This is a great moment to capture a photo of your bark, smoke ring, or cook progress.
              </Text>
              {photoUri ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: "#22c55e20", borderWidth: 1, borderColor: "#22c55e", alignItems: "center", justifyContent: "center" }}>
                    <Feather name="check" size={20} color="#22c55e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#22c55e" }}>Photo captured</Text>
                    <Pressable onPress={() => { setPhotoUri(null); setPhotoKey(null); }}>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Tap to remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handleTakePhoto}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 12,
                    borderStyle: "dashed",
                  }}
                >
                  <Feather name="camera" size={16} color={colors.mutedForeground} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.mutedForeground }}>
                    Take a Photo
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ── Visual cues ───────────────────────────────────────── */}
          <Pressable
            onPress={() => setCuesExpanded((v) => !v)}
            style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <LinearGradient colors={["#374151", "#52525B"]} style={{ width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="eye" size={14} color="#fff" />
                </LinearGradient>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground }}>
                  What to Look For
                </Text>
              </View>
              <Feather name={cuesExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </View>
            {cuesExpanded && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                {phase.visualCues.map((cue, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#F59E0B", marginTop: 6 }} />
                    <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground, lineHeight: 19 }}>
                      {cue}
                    </Text>
                  </View>
                ))}
                <View style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                    Prep for Next
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground, lineHeight: 19 }}>
                    {phase.prepForNext}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>

          {/* ── Note to PitMaster ─────────────────────────────────── */}
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground, marginBottom: 8 }}>
              Note to PitMaster
              <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 12 }}> (optional)</Text>
            </Text>
            <TextInput
              value={userNote}
              onChangeText={setUserNote}
              multiline
              placeholder="Tell PitMaster anything — what you're seeing, smelling, or wondering about…"
              placeholderTextColor={colors.mutedForeground}
              style={{
                borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12,
                fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground,
                backgroundColor: colors.background, minHeight: 80, textAlignVertical: "top",
              }}
            />
          </View>

          {/* ── PitMaster coaching card ───────────────────────────── */}
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: `${colors.primary}40`, overflow: "hidden" }}>
            <LinearGradient colors={[`${colors.primary}15`, `${colors.primary}05`]} style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <LinearGradient colors={["#E84520", "#F59E0B"]} style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="zap" size={15} color="#fff" />
                </LinearGradient>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground }}>
                  PitMaster Coaching
                </Text>
              </View>
              {aiGuidance ? (
                <>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.foreground, lineHeight: 21 }}>
                    {aiGuidance}
                  </Text>
                  <Pressable onPress={generateAiGuidance} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                    <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                      Regenerate with updated context
                    </Text>
                  </Pressable>
                </>
              ) : aiLoading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground }}>
                    Generating coaching…
                  </Text>
                </View>
              ) : (
                <Pressable onPress={generateAiGuidance} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="play-circle" size={16} color={colors.primary} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.primary }}>
                    Get PitMaster's coaching for this moment
                  </Text>
                </Pressable>
              )}
            </LinearGradient>
          </View>

          {/* ── Save button ───────────────────────────────────────── */}
          <Pressable
            onPress={handleSave}
            disabled={saving || !canSave}
            style={({ pressed }) => ({ overflow: "hidden", borderRadius: colors.radius, opacity: pressed || saving || !canSave ? 0.45 : 1 })}
          >
            <LinearGradient
              colors={["#E84520", "#F59E0B"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50 }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="#fff" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" }}>
                    Save Check-In
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </AppKeyboardAvoidingView>
    </Modal>
  );
}
