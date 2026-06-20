import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { LogoBackground } from "@/components/LogoBackground";
import { GrillTypeIcon, classifyGrillType, grillGradientColors } from "@/components/GrillTypeIcon";
import { GrillFingerprint } from "@/components/GrillFingerprint";
import {
  useGetGrill,
  useDeleteGrill,
  useGetGrillStats,
  getListGrillsQueryKey,
  getGetGrillQueryKey,
  getGetGrillStatsQueryKey,
  type Grill,
} from "@workspace/api-client-react";

function formatRelativeShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function GrillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const colors = useColors();
  const topPad = useTopInset();
  const botPad = useBottomInset();

  const grillId = Number(id);

  const grillFromListCache = useMemo(() => {
    const cached = qc.getQueriesData<Grill[]>({ queryKey: getListGrillsQueryKey() });
    for (const [, grills] of cached) {
      const found = grills?.find((g) => g.id === grillId);
      if (found) return found;
    }
    return undefined;
  }, [qc, grillId]);

  const { data: grill, isLoading } = useGetGrill(grillId, {
    query: {
      queryKey: getGetGrillQueryKey(grillId),
      staleTime: 30_000,
      initialData: grillFromListCache,
      initialDataUpdatedAt: grillFromListCache ? 0 : undefined,
    } as any,
  });

  const { data: stats } = useGetGrillStats(grillId, {
    query: {
      queryKey: getGetGrillStatsQueryKey(grillId),
      staleTime: 60_000,
      enabled: !!grill,
    },
  });

  const deleteGrill = useDeleteGrill();

  const handleDelete = () => {
    if (!grill) return;
    Alert.alert("Remove Grill", `Remove "${grill.name}" from your collection?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteGrill.mutateAsync({ id: grillId });
          qc.invalidateQueries({ queryKey: getListGrillsQueryKey() });
          router.back();
        },
      },
    ]);
  };

  if (isLoading && !grill) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad }]}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!grill) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad }]}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={s.center}>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Grill not found</Text>
        </View>
      </View>
    );
  }

  const grillType = classifyGrillType(grill.type);
  const gradientColors = grillGradientColors(grillType);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <View style={[s.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {grill.name}
        </Text>
        <Pressable
          style={[s.deleteBtn, { backgroundColor: colors.destructive + "15" }]}
          onPress={handleDelete}
          hitSlop={8}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View style={[s.heroCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <LinearGradient colors={gradientColors} style={s.heroIcon}>
            <GrillTypeIcon type={grill.type} size={32} color="#fff" />
          </LinearGradient>
          <View style={s.heroInfo}>
            <Text style={[s.heroName, { color: colors.foreground }]}>{grill.name}</Text>
            {grill.brand && (
              <Text style={[s.heroBrand, { color: colors.mutedForeground }]}>{grill.brand}</Text>
            )}
            {grill.model && grill.model !== grill.name && (
              <Text style={[s.heroModel, { color: colors.mutedForeground }]}>{grill.model}</Text>
            )}
            <View style={s.tagRow}>
              {grill.type ? (
                <View style={[s.tag, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[s.tagText, { color: colors.primary }]}>{grill.type}</Text>
                </View>
              ) : null}
              {grill.fuelType ? (
                <View style={[s.tag, { backgroundColor: colors.muted }]}>
                  <Text style={[s.tagText, { color: colors.mutedForeground }]}>{grill.fuelType}</Text>
                </View>
              ) : null}
              {grill.wifiEnabled ? (
                <View style={[s.tag, { backgroundColor: colors.primary + "18", flexDirection: "row", alignItems: "center", gap: 3 }]}>
                  <Feather name="wifi" size={10} color={colors.primary} />
                  <Text style={[s.tagText, { color: colors.primary }]}>WiFi</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Cook stats */}
        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Cook History</Text>
          <View style={s.statsGrid}>
            <StatItem
              icon="zap"
              label="Total Cooks"
              value={String(grill.cookCount ?? grill.totalCooks ?? 0)}
              colors={colors}
            />
            {typeof (grill.totalHours ?? stats?.totalHours) === "number" && (grill.totalHours ?? stats?.totalHours)! > 0 && (
              <StatItem
                icon="clock"
                label="Total Hours"
                value={`${Math.round((grill.totalHours ?? stats?.totalHours)!)}h`}
                colors={colors}
              />
            )}
            {stats?.avgCookDurationMinutes != null && stats.avgCookDurationMinutes > 0 && (
              <StatItem
                icon="activity"
                label="Avg Cook"
                value={`${Math.round(stats.avgCookDurationMinutes / 60 * 10) / 10}h`}
                colors={colors}
              />
            )}
            {(grill.lastCookAt ?? null) && (
              <StatItem
                icon="calendar"
                label="Last Cook"
                value={formatRelativeShort(grill.lastCookAt) ?? "—"}
                colors={colors}
              />
            )}
            {(grill.mostCookedFood ?? stats?.mostCookedFood) && (
              <StatItem
                icon="award"
                label="Most Cooked"
                value={grill.mostCookedFood ?? stats?.mostCookedFood ?? "—"}
                colors={colors}
              />
            )}
            {stats?.avgPitTempF != null && (
              <StatItem
                icon="thermometer"
                label="Avg Pit Temp"
                value={`${Math.round(stats.avgPitTempF)}°F`}
                colors={colors}
              />
            )}
          </View>
        </View>

        {/* Specs */}
        {(grill.tempRange || grill.cookingSurfaceSqIn != null || grill.hopperSizeLbs != null || grill.minTempF != null || grill.maxTempF != null || grill.numProbes != null || grill.heatZones != null) && (
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Specs</Text>
            {grill.tempRange && <SpecRow label="Temperature Range" value={grill.tempRange} colors={colors} />}
            {grill.cookingSurfaceSqIn != null && <SpecRow label="Cooking Surface" value={`${Math.round(grill.cookingSurfaceSqIn)} sq in`} colors={colors} />}
            {grill.hopperSizeLbs != null && <SpecRow label="Hopper Size" value={`${grill.hopperSizeLbs} lbs`} colors={colors} />}
            {grill.numProbes != null && <SpecRow label="Probe Ports" value={String(grill.numProbes)} colors={colors} />}
            {grill.heatZones != null && <SpecRow label="Heat Zones" value={String(grill.heatZones)} colors={colors} />}
          </View>
        )}

        {/* Features */}
        {Array.isArray(grill.features) && grill.features.length > 0 && (
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Features</Text>
            <View style={s.tagRow}>
              {grill.features.map((f, i) => (
                <View key={i} style={[s.tag, { backgroundColor: colors.muted }]}>
                  <Text style={[s.tagText, { color: colors.mutedForeground }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        {grill.notes ? (
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Notes</Text>
            <Text style={[s.notesText, { color: colors.mutedForeground }]}>{grill.notes}</Text>
          </View>
        ) : null}

        {/* Grill Fingerprint (Pro) */}
        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <GrillFingerprint grillId={grillId} grillName={grill.name} />
        </View>
      </ScrollView>
    </View>
  );
}

function StatItem({ icon, label, value, colors }: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={s.statItem}>
      <Feather name={icon} size={14} color={colors.primary} />
      <Text style={[s.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function SpecRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[s.specRow, { borderBottomColor: colors.border }]}>
      <Text style={[s.specLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.specValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { padding: 14, gap: 12 },

  heroCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: { flex: 1, gap: 4 },
  heroName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  heroBrand: { fontSize: 13, fontFamily: "Inter_400Regular" },
  heroModel: { fontSize: 12, fontFamily: "Inter_400Regular" },

  section: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statItem: {
    alignItems: "center",
    gap: 3,
    minWidth: 80,
  },
  statValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  specLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  specValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },

  notesText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
});
