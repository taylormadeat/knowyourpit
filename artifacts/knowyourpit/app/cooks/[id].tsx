import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  useGetCook,
  useDeleteCook,
  useUpdateCook,
  getListCooksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
} from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

export default function CookDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: cook, isLoading } = useGetCook({ id: Number(id) });
  const deleteCook = useDeleteCook();
  const updateCook = useUpdateCook();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const handleDelete = () => {
    Alert.alert("Delete Cook", "Remove this cook session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCook.mutateAsync({ id: Number(id) });
          qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
          router.back();
        },
      },
    ]);
  };

  const handleStatusUpdate = async (status: string) => {
    await updateCook.mutateAsync({ id: Number(id), data: { status } });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
  };

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!cook) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Cook not found</Text>
      </View>
    );
  }

  const c = cook as any;
  const statusColor = STATUS_COLORS[c.status] || colors.primary;
  const nextStatus = c.status === "planned" ? "active" : c.status === "active" ? "completed" : null;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>
          {c.name || c.meatType || "Cook"}
        </Text>
        <Pressable style={s.delBtn} onPress={handleDelete}>
          <Feather name="trash-2" size={18} color={colors.destructive} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.statusBar, { backgroundColor: statusColor + "18", borderRadius: colors.radius }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>{c.status?.toUpperCase()}</Text>
        </View>

        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {[
            { label: "Meat", value: c.meatType },
            { label: "Grill", value: c.grill?.name },
            { label: "Cook Method", value: c.cookMethod },
            { label: "Target Temp", value: c.targetTemp ? `${c.targetTemp}°F` : null },
            { label: "Scheduled", value: c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : null },
          ]
            .filter((r) => r.value)
            .map((row, i, arr) => (
              <View
                key={row.label}
                style={[
                  s.row,
                  i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[s.rowValue, { color: colors.foreground }]}>{row.value}</Text>
              </View>
            ))}
        </View>

        {c.notes && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, padding: 14 }]}>
            <Text style={[s.notesLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <Text style={[s.notesText, { color: colors.foreground }]}>{c.notes}</Text>
          </View>
        )}

        {nextStatus && (
          <Pressable
            style={({ pressed }) => [
              s.actionBtn,
              { backgroundColor: statusColor, borderRadius: colors.radius },
              (updateCook.isPending || pressed) && { opacity: 0.7 },
            ]}
            onPress={() => handleStatusUpdate(nextStatus)}
            disabled={updateCook.isPending}
          >
            {updateCook.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather
                  name={nextStatus === "active" ? "play" : "check-circle"}
                  size={18}
                  color="#fff"
                />
                <Text style={s.actionText}>
                  {nextStatus === "active" ? "Start Cook" : "Mark Complete"}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  delBtn: { padding: 4 },
  statusBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  card: { borderWidth: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 14, fontFamily: "Inter_400Regular", maxWidth: "55%", textAlign: "right" },
  notesLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52 },
  actionText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
