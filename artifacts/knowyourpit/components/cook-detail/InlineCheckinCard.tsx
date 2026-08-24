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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCreateCookCheckin } from "@workspace/api-client-react";
import type { ScheduledCheckin } from "@/constants/checkinKnowledge";

type Colors = any;

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
  }) => Promise<void>;
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
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

      await createCheckin.mutateAsync({
        id: cookId,
        data: {
          scheduledAt: new Date(scheduledAt).toISOString(),
          internalTempF: parsedInternal ?? null,
          pitTempF: parsedPit ?? null,
          statusFlag: null,
          userNote: null,
          photoKey: null,
          aiGuidanceShown: null,
          phaseLabel,
          phaseKey,
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Trigger a fresh PitMaster analysis with the submitted temperatures so
      // the pitmaster gets updated coaching advice — same behaviour as the old
      // UnifiedCheckinSheet which always called onRequestAnalyze post-submit.
      onRequestAnalyze?.({
        internalTempF: parsedInternal ?? null,
        pitTempF: parsedPit ?? null,
        notes: "",
      }).catch(() => {});

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
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
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
              onChangeText={setPitInput}
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
              onChangeText={setProbeInput}
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

      {/* ── Check In button ── */}
      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
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
