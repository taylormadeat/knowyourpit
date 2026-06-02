import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { FactorBreakdownItem } from "@/components/cook-detail/types";

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
  colors: any;
}

export function CookFactorsSheet({ visible, onClose, factorBreakdown, colors }: Props) {
  const totalMins = useMemo(
    () => factorBreakdown.reduce((s, f) => s + f.minutes, 0),
    [factorBreakdown]
  );

  const segments = useMemo(
    () =>
      factorBreakdown.map((f) => ({
        ...f,
        pct: totalMins > 0 ? (f.minutes / totalMins) * 100 : 0,
      })),
    [factorBreakdown, totalMins]
  );

  const handleOverlayPress = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible || factorBreakdown.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={handleOverlayPress}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <LinearGradient
            colors={["#E84820", "#FF6B2B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>What&apos;s Driving This?</Text>
              <Text style={styles.headerSub}>Total: {fmtMins(totalMins)}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Feather name="x" size={18} color="#fff" />
            </Pressable>
          </LinearGradient>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.barRow}>
              {segments.map((seg, i) => (
                <View
                  key={i}
                  style={[
                    styles.barSegment,
                    {
                      width: `${seg.pct}%` as any,
                      backgroundColor: seg.colorHex,
                      borderTopLeftRadius: i === 0 ? 6 : 0,
                      borderBottomLeftRadius: i === 0 ? 6 : 0,
                      borderTopRightRadius: i === segments.length - 1 ? 6 : 0,
                      borderBottomRightRadius: i === segments.length - 1 ? 6 : 0,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={[styles.legendRow]}>
              {segments.map((seg, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: seg.colorHex }]} />
                  <Text
                    style={[styles.legendLabel, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {seg.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {factorBreakdown.map((item, i) => (
              <View key={i} style={styles.factorRow}>
                <View
                  style={[styles.factorIconWrap, { backgroundColor: item.colorHex + "22" }]}
                >
                  <Feather
                    name={item.icon as any}
                    size={16}
                    color={item.colorHex}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.factorTopRow}>
                    <Text
                      style={[styles.factorLabel, { color: colors.foreground }]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.factorTime, { color: item.colorHex }]}
                    >
                      {fmtMins(item.minutes)}
                    </Text>
                  </View>
                  <Text
                    style={[styles.factorDesc, { color: colors.mutedForeground }]}
                  >
                    {item.description}
                  </Text>
                </View>
              </View>
            ))}

            <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
              Segment sizes are proportional to time contribution. Thaw + temper time (when present) falls outside the active cook window.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: "78%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 0,
  },
  barRow: {
    flexDirection: "row",
    height: 20,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 10,
  },
  barSegment: {
    height: "100%",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  divider: {
    height: 1,
    marginBottom: 14,
  },
  factorRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    alignItems: "flex-start",
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
    marginBottom: 3,
  },
  factorLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    flex: 1,
  },
  factorTime: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginLeft: 8,
  },
  factorDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  footerNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 8,
  },
});
