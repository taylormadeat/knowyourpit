/**
 * InlineCheckinCard — replaces the old UnifiedCheckinSheet pop-up.
 *
 * Renders two numeric temperature fields (Pit Temp, Probe/Meat Temp) plus a
 * "Check In" button directly on the active-cook screen so the pitmaster never
 * has to open a separate modal just to log temperatures.
 *
 * Behaviour is identical to the old sheet:
 *  • auto-fills from live probe/pit readings
 *  • calls the same createCheckin mutation
 *  • invokes onCheckinSaved so the parent can update the live graph, toast,
 *    and reschedule notifications
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Image,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useCreateCookCheckin } from "@workspace/api-client-react";
import type { ScheduledCheckin } from "@/constants/checkinKnowledge";
import type { PickedImage } from "./types";
import {
  classifyCheckinScanFailure,
  extractCheckinScanTemperatures,
} from "./checkinScan";

type Colors = any;
const MAX_CHECKIN_IMAGE_BASE64_CHARS = 3_500_000;

interface Props {
  cookId: number;
  colors: Colors;
  /** Live internal (meat/probe) temperature — pre-fills the field when present. */
  currentInternalTempF?: number | null;
  /** Live pit/ambient temperature — pre-fills the field when present. */
  currentPitTempF?: number | null;
  /**
   * True for produce cooks (target temp = 0). Internal temp is then optional
   * so the user can still check in with only a pit reading.
   */
  isProduceCook?: boolean;
  /**
   * The closest upcoming or recently-past scheduled phase. Used to populate
   * phaseKey / phaseLabel / scheduledAt on the mutation when no specific
   * phase was selected via a timeline tap.
   */
  nextCheckinSc?: ScheduledCheckin | null;
  /**
   * The phase the user explicitly selected by tapping a timeline milestone.
   * Takes priority over nextCheckinSc for the mutation payload so the record
   * is attributed to the correct schedule slot.
   */
  activeCheckinSc?: ScheduledCheckin | null;
  /**
   * Called after a successful check-in to clear the explicitly-selected phase
   * (activeCheckinSc) so the card reverts to following nextCheckinSc.
   */
  onClearActiveCheckin?: () => void;
  /**
   * Called after a successful check-in with the saved internal temp (or null)
   * and the phaseKey that was actually submitted, so the parent can correctly
   * mark that phase as complete when rescheduling notifications.
   */
  onCheckinSaved?: (
    savedInternalTempF: number | null,
    submittedPhaseKey: string | null,
    savedPitTempF?: number | null,
    savedAtMs?: number,
  ) => void;
  /**
   * Triggers a fresh PitMaster analysis with the submitted temperatures.
   * Mirrors the behaviour the old UnifiedCheckinSheet had: each check-in
   * fires an analysis so the pitmaster gets updated coaching advice.
   */
  onRequestAnalyze?: (opts: {
    internalTempF: number | null;
    pitTempF: number | null;
    notes: string;
    image?: PickedImage;
  }) => Promise<any>;
}

export function InlineCheckinCard({
  cookId,
  colors,
  currentInternalTempF,
  currentPitTempF,
  isProduceCook = false,
  nextCheckinSc,
  activeCheckinSc,
  onClearActiveCheckin,
  onCheckinSaved,
  onRequestAnalyze,
}: Props) {
  const createCheckin = useCreateCookCheckin();

  // ── Local field state ─────────────────────────────────────────────────────
  const [pitInput, setPitInput] = useState(
    currentPitTempF != null ? String(Math.round(currentPitTempF)) : "",
  );
  const [probeInput, setProbeInput] = useState(
    currentInternalTempF != null ? String(Math.round(currentInternalTempF)) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [scanImage, setScanImage] = useState<PickedImage | null>(null);
  const [scanStatus, setScanStatus] = useState<
    "idle" | "ready" | "analyzing" | "error" | "offline" | "limit" | "permission" | "noData"
  >("idle");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanAnalyzed, setScanAnalyzed] = useState(false);
  const [scanValuesEdited, setScanValuesEdited] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Refs to avoid stale-closure issues in the effect below.
  const pitRef = useRef(pitInput);
  pitRef.current = pitInput;
  const probeRef = useRef(probeInput);
  probeRef.current = probeInput;

  // ── Auto-fill from live readings ──────────────────────────────────────────
  // Only overwrite the field when the user hasn't typed anything yet (empty
  // string). Once they've started entering a value we leave it alone.
  useEffect(() => {
    if (currentPitTempF != null && pitRef.current === "") {
      setPitInput(String(Math.round(currentPitTempF)));
    }
  }, [currentPitTempF]);

  useEffect(() => {
    if (currentInternalTempF != null && probeRef.current === "") {
      setProbeInput(String(Math.round(currentInternalTempF)));
    }
  }, [currentInternalTempF]);

  // ── Derived / validation ──────────────────────────────────────────────────
  const parsedPit = pitInput.trim() ? parseFloat(pitInput) : null;
  const parsedInternal = probeInput.trim() ? parseFloat(probeInput) : null;

  const canSubmit =
    parsedPit != null &&
    !isNaN(parsedPit) &&
    (isProduceCook || (parsedInternal != null && !isNaN(parsedInternal)));

  const setPickedScanImage = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      const normalized = await manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { base64: true, compress: 0.65, format: SaveFormat.JPEG },
      );
      if (!normalized.base64) {
        throw new Error("The resized image did not contain data");
      }
      if (normalized.base64.length > MAX_CHECKIN_IMAGE_BASE64_CHARS) {
        setScanImage(null);
        setScanStatus("error");
        setScanMessage("That photo is still too large to attach. Try a closer screenshot, or enter the temperatures manually.");
        return;
      }
      setScanImage({
        uri: normalized.uri,
        base64: normalized.base64,
        mimeType: "image/jpeg",
      });
      setScanStatus("ready");
      setScanMessage(null);
      setScanAnalyzed(false);
      setScanValuesEdited(false);
    } catch {
      if (!asset.base64 || asset.base64.length > MAX_CHECKIN_IMAGE_BASE64_CHARS) {
        setScanImage(null);
        setScanStatus("error");
        setScanMessage("That photo is too large to attach. Try another image or enter the temperatures manually.");
        return;
      }
      setScanImage({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      setScanStatus("ready");
      setScanMessage("Using the original image. Review the temperatures before saving.");
      setScanAnalyzed(false);
      setScanValuesEdited(false);
    }
  };

  const handlePitChange = (value: string) => {
    if (scanAnalyzed) setScanValuesEdited(true);
    setPitInput(value);
  };

  const handleProbeChange = (value: string) => {
    if (scanAnalyzed) setScanValuesEdited(true);
    setProbeInput(value);
  };

  const handleChooseScanImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setScanStatus("permission");
        setScanMessage(
          permission.canAskAgain
            ? "Allow photo access to choose a thermometer screenshot."
            : "Photo access is off. Open Settings or enter the temperatures manually.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.7,
        base64: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (!result.canceled && result.assets[0]) await setPickedScanImage(result.assets[0]);
    } catch {
      setScanStatus("error");
      setScanMessage("Could not open your photo library. You can still enter the temperatures manually.");
    }
  };

  const handleTakeScanPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setScanStatus("permission");
        setScanMessage(
          permission.canAskAgain
            ? "Allow camera access to photograph the thermometer display."
            : "Camera access is off. Open Settings or enter the temperatures manually.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (!result.canceled && result.assets[0]) await setPickedScanImage(result.assets[0]);
    } catch {
      setScanStatus("error");
      setScanMessage("Could not open the camera. You can still enter the temperatures manually.");
    }
  };

  const handleOpenSettings = () => {
    if (Platform.OS !== "web") Linking.openSettings().catch(() => {});
    else Alert.alert("Permission settings", "Use your browser settings to allow photo access.");
  };

  const handleScan = async () => {
    if (!scanImage || scanStatus === "analyzing") return;
    if (!onRequestAnalyze) {
      setScanStatus("error");
      setScanMessage("Image scanning is unavailable right now. Enter the temperatures manually.");
      return;
    }
    setScanStatus("analyzing");
    setScanMessage(null);
    try {
      const response = await onRequestAnalyze({
        internalTempF: null,
        pitTempF: null,
        notes: "",
        image: scanImage,
      });
      if (response?.__scanError) {
        const kind = classifyCheckinScanFailure(response.__scanError);
        setScanStatus(kind);
        setScanMessage(
          kind === "limit"
            ? "You’ve reached today’s PitMaster scan limit. Enter the temperatures manually."
            : kind === "offline"
            ? "You appear to be offline. The photo is ready to save; enter the temperatures manually."
            : "Could not read that thermometer image. Enter the temperatures manually or try another photo.",
        );
        return;
      }

      const detected = extractCheckinScanTemperatures(response);
      if (detected.pitTempF != null) setPitInput(String(Math.round(detected.pitTempF)));
      if (detected.internalTempF != null) setProbeInput(String(Math.round(detected.internalTempF)));
      setScanAnalyzed(true);
      setScanValuesEdited(false);
      if (detected.pitTempF == null && detected.internalTempF == null) {
        setScanStatus("noData");
        setScanMessage("No readable temperatures found. Enter them below and save the photo if you’d like.");
      } else {
        setScanStatus("ready");
        setScanMessage("Review the detected temperatures before saving.");
      }
    } catch (error) {
      const kind = classifyCheckinScanFailure(error);
      setScanStatus(kind);
      setScanMessage(
        kind === "offline"
          ? "You appear to be offline. Enter the temperatures manually and try scanning again later."
          : "Could not scan that image. You can still enter the temperatures manually.",
      );
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    setSubmitError(null);
    try {
      // activeCheckinSc takes priority: it represents a phase the user explicitly
      // selected by tapping a timeline milestone. Fall back to nextCheckinSc (the
      // closest scheduled phase) or a generic manual entry.
      const sc = activeCheckinSc ?? nextCheckinSc;
      const scheduledAt = sc?.scheduledAt ?? Date.now();
      // Outer phaseKey/phaseLabel are canonical (e.g. "ai_checkin_N" for AI-plan
      // cooks). The nested phase object carries a generic fallback and must only
      // be used when the outer fields are absent.
      const phaseKey = sc?.phaseKey ?? sc?.phase?.key ?? "manual";
      const phaseLabel = sc?.phaseLabel ?? sc?.phase?.label ?? "Manual Check-in";
      const imageToAttach = scanImage;

      await createCheckin.mutateAsync({
        id: cookId,
        data: {
          scheduledAt: new Date(scheduledAt).toISOString(),
          internalTempF: parsedInternal ?? null,
          pitTempF: parsedPit ?? null,
          statusFlag: null,
          userNote: null,
          photoKey: imageToAttach
            ? `data:${imageToAttach.mimeType};base64,${imageToAttach.base64}`
            : null,
          aiGuidanceShown: null,
          phaseLabel,
          phaseKey,
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Trigger a fresh PitMaster analysis with the submitted temperatures so
      // the pitmaster gets updated coaching advice — same behaviour as the old
      // UnifiedCheckinSheet which always called onRequestAnalyze post-submit.
      if (!scanAnalyzed || scanValuesEdited) {
        onRequestAnalyze?.({
          internalTempF: parsedInternal ?? null,
          pitTempF: parsedPit ?? null,
          notes: "",
          image: imageToAttach ?? undefined,
        }).catch(() => {});
      }

      // Let the parent know a check-in was saved (updates live graph, toast,
      // and reschedules notifications using the correct phase context).
      // Pass the phaseKey we actually saved against so the parent can include it
      // in completedPhaseKeys without relying on stale activeCheckin state.
      onCheckinSaved?.(parsedInternal ?? null, phaseKey, parsedPit ?? null, Date.now());

      // Clear the explicitly-selected phase so the card reverts to following
      // the upcoming schedule rather than staying locked to the tapped milestone.
      onClearActiveCheckin?.();

      // Reset fields to the current live readings (if available) so the card
      // stays usable immediately for back-to-back check-ins when probe values
      // haven't changed — the autofill effects only trigger on prop changes,
      // not on a cleared-to-empty reset.
      setPitInput(currentPitTempF != null ? String(Math.round(currentPitTempF)) : "");
      setProbeInput(currentInternalTempF != null ? String(Math.round(currentInternalTempF)) : "");
      setScanImage(null);
      setScanStatus("idle");
      setScanMessage(null);
      setScanAnalyzed(false);
      setScanValuesEdited(false);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setSubmitError(
        scanImage
          ? "Couldn’t save this check-in with the photo. Remove the image and try again, or save the temperatures manually."
          : "Couldn’t save this check-in. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
    },
  ];

  const labelStyle = [
    styles.label,
    { color: colors.mutedForeground },
  ];

  const autoFillPit = currentPitTempF != null;
  const autoFillProbe = currentInternalTempF != null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        {/* ── Pit Temp ── */}
        <View style={styles.fieldWrap}>
          <View style={styles.labelRow}>
            <Text style={labelStyle}>Pit Temp</Text>
            {autoFillPit && (
              <View style={styles.autoBadge}>
                <Feather name="zap" size={9} color="#22c55e" />
                <Text style={styles.autoBadgeText}>Live</Text>
              </View>
            )}
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              style={inputStyle}
              value={pitInput}
              onChangeText={handlePitChange}
              placeholder="°F"
              placeholderTextColor={colors.mutedForeground + "80"}
              keyboardType="numeric"
              returnKeyType="next"
              maxLength={5}
              editable={!submitting}
            />
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>°F</Text>
          </View>
        </View>

        {/* ── Probe Temp ── */}
        <View style={styles.fieldWrap}>
          <View style={styles.labelRow}>
            <Text style={labelStyle}>Probe Temp</Text>
            {autoFillProbe && (
              <View style={styles.autoBadge}>
                <Feather name="zap" size={9} color="#22c55e" />
                <Text style={styles.autoBadgeText}>Live</Text>
              </View>
            )}
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              style={inputStyle}
              value={probeInput}
              onChangeText={handleProbeChange}
              placeholder={isProduceCook ? "optional" : "°F"}
              placeholderTextColor={colors.mutedForeground + "80"}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              maxLength={5}
              editable={!submitting}
            />
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>°F</Text>
          </View>
        </View>
      </View>

      {/* ── Optional thermometer image scan ── */}
      <View style={[styles.scanSection, { borderTopColor: colors.border }]}>
        <View style={styles.scanHeader}>
          <View style={styles.scanTitleRow}>
            <Feather name="camera" size={14} color={colors.mutedForeground} />
            <Text style={[styles.scanTitle, { color: colors.foreground }]}>Scan thermometer</Text>
            <Text style={[styles.optional, { color: colors.mutedForeground }]}>Optional</Text>
          </View>
          {scanImage && (
            <Pressable
              onPress={() => {
                setScanImage(null);
                setScanStatus("idle");
                setScanMessage(null);
                setScanAnalyzed(false);
                setScanValuesEdited(false);
              }}
              disabled={scanStatus === "analyzing"}
              hitSlop={8}
              accessibilityLabel="Remove thermometer image"
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {scanImage ? (
          <View style={styles.scanPreviewRow}>
            <Image source={{ uri: scanImage.uri }} style={styles.scanPreview} />
            <View style={styles.scanPreviewCopy}>
              <Text style={[styles.scanFileLabel, { color: colors.foreground }]} numberOfLines={1}>
                Thermometer image ready
              </Text>
              <Text style={[styles.scanHint, { color: colors.mutedForeground }]}>
                {scanStatus === "analyzing" ? "Reading temperatures…" : "Review results before saving"}
              </Text>
            </View>
            <Pressable
              onPress={handleScan}
              disabled={scanStatus === "analyzing" || submitting}
              testID="checkin-scan-button"
              accessibilityLabel="Read temperatures from image"
              style={({ pressed }) => [
                styles.scanAction,
                { borderColor: colors.primary, opacity: pressed || scanStatus === "analyzing" ? 0.7 : 1 },
              ]}
            >
              {scanStatus === "analyzing" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="zap" size={13} color={colors.primary} />
              )}
              <Text style={[styles.scanActionText, { color: colors.primary }]}>
                {scanStatus === "analyzing" ? "Reading" : "Read"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.scanButtons}>
            <Pressable
              onPress={handleTakeScanPhoto}
              disabled={submitting}
              testID="checkin-camera-button"
              accessibilityLabel="Photograph thermometer"
              style={({ pressed }) => [
                styles.scanButton,
                { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.72 : 1 },
              ]}
            >
              <Feather name="camera" size={14} color={colors.foreground} />
              <Text style={[styles.scanButtonText, { color: colors.foreground }]}>Camera</Text>
            </Pressable>
            <Pressable
              onPress={handleChooseScanImage}
              disabled={submitting}
              testID="checkin-library-button"
              accessibilityLabel="Choose thermometer screenshot"
              style={({ pressed }) => [
                styles.scanButton,
                { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.72 : 1 },
              ]}
            >
              <Feather name="image" size={14} color={colors.foreground} />
              <Text style={[styles.scanButtonText, { color: colors.foreground }]}>Photo library</Text>
            </Pressable>
          </View>
        )}

        {scanMessage && (
          <View style={styles.scanMessageRow}>
            <Feather
              name={scanStatus === "ready" ? "check-circle" : scanStatus === "permission" ? "lock" : "info"}
              size={13}
              color={scanStatus === "ready" ? "#22c55e" : colors.mutedForeground}
            />
            <Text style={[styles.scanMessage, { color: colors.mutedForeground }]}>{scanMessage}</Text>
            {scanStatus === "permission" && (
              <Pressable onPress={handleOpenSettings} hitSlop={6} accessibilityLabel="Open permission settings">
                <Text style={[styles.settingsLink, { color: colors.primary }]}>Settings</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* ── Check In button ── */}
      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
        testID="checkin-submit-button"
        style={({ pressed }) => [
          styles.btn,
          { borderRadius: 8, backgroundColor: "#FF6B2B" },
          (!canSubmit || submitting || pressed) && { opacity: 0.7 },
        ]}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Feather name="thermometer" size={14} color="#fff" />
            <Text style={styles.btnText}>Check In</Text>
          </>
        )}
      </Pressable>
      {submitError && (
        <View style={styles.submitErrorRow}>
          <Feather name="alert-circle" size={13} color="#ef4444" />
          <Text style={styles.submitError}>{submitError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  scanSection: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scanTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scanTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  optional: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  scanButtons: {
    flexDirection: "row",
    gap: 8,
  },
  scanButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  scanButtonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  scanPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  scanPreview: {
    width: 48,
    height: 48,
    borderRadius: 7,
    backgroundColor: "#00000012",
  },
  scanPreviewCopy: {
    flex: 1,
    gap: 2,
  },
  scanFileLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  scanHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  scanAction: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  scanActionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  scanMessageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },
  scanMessage: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 15,
  },
  settingsLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textDecorationLine: "underline",
  },
  submitErrorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },
  submitError: {
    flex: 1,
    color: "#ef4444",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 15,
  },
  fieldWrap: {
    flex: 1,
    gap: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#22c55e18",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  autoBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "#22c55e",
  },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingRight: 28,
    paddingVertical: 8,
    height: 40,
  },
  unit: {
    position: "absolute",
    right: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
});
