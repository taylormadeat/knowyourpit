import React from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useListAlerts, useDeleteAlert, getListAlertsQueryKey, useListCooks } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { fmtMinutes } from "@/utils/duration";

function fmtTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function alertTypeLabel(alertType: string, thresholdTempF: number): string {
  if (alertType === "target_reached") return `Probe hits ${thresholdTempF}°F`;
  if (alertType === "time_before_serve") return `${fmtMinutes(thresholdTempF)} before serve`;
  if (alertType === "min_temp") return `Min temp: ${thresholdTempF}°F`;
  if (alertType === "max_temp") return `Max temp: ${thresholdTempF}°F`;
  return alertType.replace(/_/g, " ");
}

export default function AlertsScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { data: alerts, isLoading } = useListAlerts();
  const { data: cooks } = useListCooks();
  const deleteAlert = useDeleteAlert();

  const cookNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    if (Array.isArray(cooks)) {
      for (const c of cooks as any[]) {
        map.set(c.id, c.foodType ? `${c.foodType}` : `Cook #${c.id}`);
      }
    }
    return map;
  }, [cooks]);

  const botPad = useBottomInset();

  const handleDelete = (id: number, scheduledNotificationId?: string | null) => {
    Alert.alert("Delete Alert", "Remove this alert?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (scheduledNotificationId && Platform.OS !== "web") {
            try {
              const Notifications = require("expo-notifications");
              await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
            } catch {}
          }
          await deleteAlert.mutateAsync({ id });
          qc.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        },
      },
    ]);
  };

  const allAlerts: any[] = Array.isArray(alerts) ? alerts : [];
  const watching = allAlerts.filter((a) => a.isActive).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const triggered = allAlerts.filter((a) => !a.isActive).sort(
    (a, b) => new Date(b.triggeredAt ?? b.createdAt).getTime() - new Date(a.triggeredAt ?? a.createdAt).getTime(),
  );

  const sections = [
    ...(watching.length > 0 ? [{ title: "Watching", data: watching, active: true }] : []),
    ...(triggered.length > 0 ? [{ title: "Triggered", data: triggered, active: false }] : []),
  ];

  const renderItem = ({ item, section }: { item: any; section: any }) => {
    const isActive = section.active;
    const accentColor = isActive
      ? item.alertType === "time_before_serve" ? "#3B82F6" : "#EF4444"
      : "#22c55e";
    const typeStr = alertTypeLabel(item.alertType, item.thresholdTempF);

    return (
      <View
        style={[
          s.card,
          {
            backgroundColor: colors.card,
            borderColor: isActive ? accentColor + "30" : colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={[s.iconWrap, { backgroundColor: accentColor + "18" }]}>
          <Feather
            name={isActive ? (item.alertType === "time_before_serve" ? "clock" : "thermometer") : "check-circle"}
            size={18}
            color={accentColor}
          />
        </View>
        <View style={s.info}>
          <Text style={[s.alertMsg, { color: colors.foreground }]} numberOfLines={2}>
            {item.message || typeStr}
          </Text>
          <View style={s.metaRow}>
            <Text style={[s.metaChip, { color: colors.mutedForeground }]}>{typeStr}</Text>
            {item.cookId != null && (
              <Text style={[s.metaChip, { color: colors.mutedForeground }]}>
                {cookNameById.get(item.cookId) ?? `Cook #${item.cookId}`}
              </Text>
            )}
            {!isActive && item.triggeredAt && (
              <Text style={[s.metaChip, { color: "#22c55e" }]}>
                Fired {fmtTimeAgo(item.triggeredAt)}
              </Text>
            )}
            {isActive && item.alertType === "time_before_serve" && (
              <Text style={[s.metaChip, { color: "#3B82F6" }]}>Scheduled</Text>
            )}
          </View>
        </View>
        <View style={s.actions}>
          {isActive && (
            <View style={[s.watchingBadge, { backgroundColor: accentColor + "18" }]}>
              <View style={[s.watchingDot, { backgroundColor: accentColor }]} />
              <Text style={[s.watchingText, { color: accentColor }]}>Active</Text>
            </View>
          )}
          <Pressable
            onPress={() => handleDelete(item.id, item.scheduledNotificationId)}
            style={s.delBtn}
            hitSlop={8}
          >
            <Feather name="trash-2" size={15} color={colors.destructive} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="Alerts" showBack dark />

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : allAlerts.length === 0 ? (
        <View style={s.empty}>
          <Feather name="bell-off" size={40} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No alerts yet</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Open an active cook to set temperature or timer alerts.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={[s.sectionHeader, { backgroundColor: colors.background }]}>
              <View style={[s.sectionDot, { backgroundColor: section.active ? "#EF4444" : "#22c55e" }]} />
              <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
                {section.title.toUpperCase()}
              </Text>
              <Text style={[s.sectionCount, { color: colors.mutedForeground }]}>
                {section.data.length}
              </Text>
            </View>
          )}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: botPad + 40 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  sectionCount: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" },

  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, padding: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  info: { flex: 1 },
  alertMsg: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20, marginBottom: 4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: { fontSize: 11, fontFamily: "Inter_400Regular" },

  actions: { alignItems: "flex-end", gap: 8 },
  watchingBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  watchingDot: { width: 6, height: 6, borderRadius: 3 },
  watchingText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  delBtn: { padding: 4 },
});
