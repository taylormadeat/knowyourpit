import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { FactorBreakdownItem } from "@/components/cook-detail/types";

export interface QualFactor {
  label: string;
  colorHex: string;
  icon: string;
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  factorBreakdown: FactorBreakdownItem[];
  qualFactors?: QualFactor[];
  colors: any;
}

export function CookFactorsSheet({ visible, onClose, factorBreakdown, qualFactors, colors }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const barAnim = useRef(new Animated.Value(0)).current;
  const chipsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedIndex(0);
      barAnim.setValue(0);
      chipsAnim.setValue(0);
      Animated.stagger(60, [
        Animated.spring(barAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.spring(chipsAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
      ]).start();
    }
  }, [visible]);

  const totalMins = useMemo(
    () => factorBreakdown.reduce((s, f) => s + f.minutes, 0),
    [factorBreakdown]
  );

  const segments = useMemo(
    () => factorBreakdown.map((f, i) => ({ ...f, pct: totalMins > 0 ? (f.minutes / totalMins) * 100 : 0, index: i })),
    [factorBreakdown, totalMins]
  );

  const selectedItem = factorBreakdown[selectedIndex] ?? factorBreakdown[0];

  const handleSegmentPress = useCallback((index: number) => {
    setSelectedIndex(index);
    Haptics.selectionAsync();
  }, []);

  if (!visible || factorBreakdown.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.card, borderTopColor: colors.border + "60" }]}>
        <View style={[s.handle, { backgroundColor: colors.mutedForeground + "55" }]} />

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>What&apos;s Driving This?</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>Total: {fmtMins(totalMins)}</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={12}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          {/* ── Stacked bar ─────────────────────────────────────── */}
          <Animated.View
            style={[
              s.barWrapper,
              {
                opacity: barAnim,
                transform: [{ translateY: barAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              },
            ]}
          >
            <View style={[s.bar, { backgroundColor: colors.muted }]}>
              {segments.map((seg, i) => {
                const isSelected = selectedIndex === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => handleSegmentPress(i)}
                    style={({ pressed }) => [
                      s.barSegment,
                      {
                        width: `${seg.pct}%` as any,
                        backgroundColor: seg.colorHex,
                        opacity: pressed ? 0.75 : isSelected ? 1 : 0.5,
                        borderTopLeftRadius: i === 0 ? 8 : 0,
                        borderBottomLeftRadius: i === 0 ? 8 : 0,
                        borderTopRightRadius: i === segments.length - 1 ? 8 : 0,
                        borderBottomRightRadius: i === segments.length - 1 ? 8 : 0,
                        borderBottomWidth: isSelected ? 3 : 0,
                        borderBottomColor: "#fff",
                        justifyContent: "center",
                        alignItems: "center",
                        overflow: "hidden",
                      },
                    ]}
                  >
                    {seg.pct >= 18 && (
                      <Text numberOfLines={1} style={s.segmentLabel}>
                        {seg.label.split(" ")[0]}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Legend row — swatch + label + time for each segment */}
            <View style={s.legendRow}>
              {segments.map((seg, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleSegmentPress(i)}
                  style={[
                    s.legendItem,
                    selectedIndex === i && { opacity: 1 },
                    selectedIndex !== i && { opacity: 0.55 },
                  ]}
                >
                  <View style={[s.legendDot, { backgroundColor: seg.colorHex }]} />
                  <Text style={[s.legendLabel, { color: colors.foreground }]} numberOfLines={1}>
                    {seg.label}
                  </Text>
                  <Text style={[s.legendTime, { color: seg.colorHex }]}>{fmtMins(seg.minutes)}</Text>
                </Pressable>
              ))}
            </View>

            {/* Selected item explanation */}
            {selectedItem && (
              <View style={[s.explanationBox, { backgroundColor: selectedItem.colorHex + "18", borderColor: selectedItem.colorHex + "40" }]}>
                <View style={[s.explanationDot, { backgroundColor: selectedItem.colorHex }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.explanationLabel, { color: selectedItem.colorHex }]}>
                    {selectedItem.label} · {fmtMins(selectedItem.minutes)}
                  </Text>
                  <Text style={[s.explanationText, { color: colors.foreground }]}>
                    {selectedItem.description}
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* ── Qualitative factor chips — from cook input state ─── */}
          {qualFactors && qualFactors.length > 0 && (
            <Animated.View
              style={[
                s.chipsSection,
                {
                  opacity: chipsAnim,
                  transform: [{ translateY: chipsAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                },
              ]}
            >
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>ACTIVE FACTORS</Text>
              <View style={s.chipsRow}>
                {qualFactors.map((chip, i) => (
                  <View
                    key={i}
                    style={[
                      s.chip,
                      {
                        backgroundColor: chip.colorHex + "18",
                        borderColor: chip.colorHex + "40",
                        borderRadius: colors.radius ?? 8,
                      },
                    ]}
                  >
                    <Feather name={chip.icon as any} size={11} color={chip.colorHex} />
                    <Text style={[s.chipText, { color: chip.colorHex }]}>{chip.label}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* ── Factor detail rows ────────────────────────────────── */}
          <View style={[s.divider, { backgroundColor: colors.border }]} />

          {factorBreakdown.map((item, i) => {
            const isSelected = selectedIndex === i;
            return (
              <Pressable
                key={i}
                onPress={() => handleSegmentPress(i)}
                style={[
                  s.factorRow,
                  isSelected && { backgroundColor: item.colorHex + "0D", borderRadius: 10, paddingHorizontal: 8 },
                ]}
              >
                <View style={[s.factorIconWrap, { backgroundColor: item.colorHex + (isSelected ? "30" : "18") }]}>
                  <Feather name={item.icon as any} size={16} color={item.colorHex} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.factorTopRow}>
                    <Text style={[s.factorLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <Text style={[s.factorTime, { color: item.colorHex }]}>{fmtMins(item.minutes)}</Text>
                  </View>
                  {isSelected && (
                    <Text style={[s.factorDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}

          <Text style={[s.footerNote, { color: colors.mutedForeground }]}>
            Tap a bar segment or row to explore what drives each part of the estimate.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: "82%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 40 },
  barWrapper: { gap: 10, marginBottom: 4 },
  bar: { flexDirection: "row", height: 28, borderRadius: 8, overflow: "hidden" },
  barSegment: { height: "100%" as any },
  segmentLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#fff", paddingHorizontal: 3 },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 2,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
  legendTime: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginLeft: 2 },
  explanationBox: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "flex-start",
    marginTop: 2,
  },
  explanationDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  explanationLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 2 },
  explanationText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  chipsSection: { marginTop: 14, gap: 6 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.8 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  divider: { height: 1, marginTop: 16, marginBottom: 14 },
  factorRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  factorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  factorTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
  },
  factorLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  factorTime: { fontFamily: "Inter_700Bold", fontSize: 14, marginLeft: 8 },
  factorDesc: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 4 },
  footerNote: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16, marginTop: 8, marginBottom: 4 },
});
