import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useGetGrillFingerprint, type GrillFingerprintDurationPattern } from "@workspace/api-client-react";

interface Props {
  grillId: number;
  grillName?: string;
}

const CONFIDENCE_LABELS: Record<string, { label: string; segments: number }> = {
  none: { label: "Not enough data", segments: 0 },
  building: { label: "Building", segments: 1 },
  developing: { label: "Developing", segments: 2 },
  established: { label: "Established", segments: 3 },
};

export function GrillFingerprint({ grillId, grillName }: Props) {
  const colors = useColors();
  const { data, isLoading, error } = useGetGrillFingerprint(grillId);

  if (isLoading) {
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return null;
  }

  const fp = data;
  const confidence = CONFIDENCE_LABELS[fp.confidenceLevel] ?? CONFIDENCE_LABELS.none;
  const meatEntries = Object.entries(fp.durationByMeat ?? {});

  if (fp.cookCount < 2) {
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <View style={s.headerRow}>
          <Feather name="cpu" size={16} color={colors.primary} />
          <Text style={[s.title, { color: colors.foreground }]}>Grill Fingerprint</Text>
        </View>
        <View style={[s.emptyBox, { backgroundColor: colors.muted }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Complete {2 - fp.cookCount} more cook{2 - fp.cookCount === 1 ? "" : "s"} on this grill to see its fingerprint.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={s.headerRow}>
        <Feather name="cpu" size={16} color={colors.primary} />
        <Text style={[s.title, { color: colors.foreground }]}>Grill Fingerprint</Text>
        <Text style={[s.headerSub, { color: colors.mutedForeground }]}>
          {fp.cookCount} cook{fp.cookCount === 1 ? "" : "s"}
        </Text>
      </View>

      {/* Confidence bar */}
      <View style={s.confidenceWrap}>
        <View style={s.confidenceBars}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                s.confSeg,
                {
                  backgroundColor: i < confidence.segments ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[s.confLabel, { color: colors.mutedForeground }]}>
          {confidence.label}
        </Text>
      </View>

      {/* Calibration chips */}
      <View style={s.chipRow}>
        {fp.pitBiasF != null && (
          <PitBiasChip biasF={fp.pitBiasF} />
        )}
        {fp.overshootF != null && (
          <OvershootChip overshootF={fp.overshootF} />
        )}
      </View>

      {/* Pace by meat */}
      {meatEntries.length > 0 && (
        <View style={s.paceSection}>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
            Pace by meat
          </Text>
          {meatEntries.map(([key, pattern]: [string, GrillFingerprintDurationPattern]) => {
            const label = key.replace(/_/g, " ");
            const baseline = pattern.baselineMinsPerLb;
            const pct = pattern.pctDiff;
            const dirText = pct == null
              ? null
              : pct > 5
                ? `${pct}% slower than baseline`
                : pct < -5
                  ? `${Math.abs(pct)}% faster than baseline`
                  : "right at baseline";
            const dirColor = pct == null
              ? colors.mutedForeground
              : pct > 5
                ? "#F59E0B"
                : pct < -5
                  ? "#22c55e"
                  : colors.mutedForeground;
            return (
              <View key={key} style={[s.paceRow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.paceMeat, { color: colors.foreground }]}>{label}</Text>
                  <Text style={[s.paceSub, { color: colors.mutedForeground }]}>
                    {pattern.actualMinsPerLb} min/lb
                    {baseline != null ? ` · baseline ${baseline} min/lb` : ""}
                    {" · "}{pattern.sampleSize} cook{pattern.sampleSize === 1 ? "" : "s"}
                  </Text>
                </View>
                {dirText && (
                  <Text style={[s.paceDelta, { color: dirColor }]} numberOfLines={2}>
                    {dirText}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {fp.pitBiasF == null && fp.overshootF == null && meatEntries.length === 0 && (
        <Text style={[s.bodyMuted, { color: colors.mutedForeground }]}>
          Log probe temps and pull temps on{grillName ? ` ${grillName}` : ""} to unlock pit and pull-temp calibration.
        </Text>
      )}
    </View>
  );
}

function PitBiasChip({ biasF }: { biasF: number }) {
  const colors = useColors();
  const abs = Math.abs(biasF);
  if (abs < 3) {
    return (
      <View style={[s.chip, { backgroundColor: colors.muted }]}>
        <Feather name="check" size={11} color={colors.mutedForeground} />
        <Text style={[s.chipText, { color: colors.mutedForeground }]}>
          Reads accurately
        </Text>
      </View>
    );
  }
  const isHot = biasF > 0;
  const color = isHot ? "#F97316" : "#3B82F6";
  return (
    <View style={[s.chip, { backgroundColor: color + "18", borderColor: color + "40", borderWidth: 1 }]}>
      <Feather name={isHot ? "thermometer" : "wind"} size={11} color={color} />
      <Text style={[s.chipText, { color }]}>
        Runs {abs}°F {isHot ? "hot" : "cold"}
      </Text>
    </View>
  );
}

function OvershootChip({ overshootF }: { overshootF: number }) {
  const colors = useColors();
  const abs = Math.abs(overshootF);
  if (abs < 2) {
    return (
      <View style={[s.chip, { backgroundColor: colors.muted }]}>
        <Feather name="target" size={11} color={colors.mutedForeground} />
        <Text style={[s.chipText, { color: colors.mutedForeground }]}>
          Accurate pull temps
        </Text>
      </View>
    );
  }
  const isOver = overshootF > 0;
  const color = isOver ? "#A855F7" : "#22c55e";
  return (
    <View style={[s.chip, { backgroundColor: color + "18", borderColor: color + "40", borderWidth: 1 }]}>
      <Feather name="trending-up" size={11} color={color} />
      <Text style={[s.chipText, { color }]}>
        {isOver ? "Overshoots" : "Undershoots"} by {abs}°F
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 10, marginTop: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  headerSub: { fontSize: 11, fontFamily: "Inter_500Medium" },
  confidenceWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  confidenceBars: { flexDirection: "row", gap: 4, flex: 1 },
  confSeg: { flex: 1, height: 6, borderRadius: 3 },
  confLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  paceSection: { gap: 4, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  paceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1 },
  paceMeat: { fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  paceSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  paceDelta: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "right", maxWidth: 130 },
  emptyBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8 },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  bodyMuted: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
