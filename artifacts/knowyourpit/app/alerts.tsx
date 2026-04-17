import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useListAlerts, useDeleteAlert } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: alerts, isLoading } = useListAlerts();
  const deleteAlert = useDeleteAlert();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Alert", "Remove this alert?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteAlert.mutateAsync({ id });
          qc.invalidateQueries({ queryKey: ["listAlerts"] });
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={[s.iconWrap, { backgroundColor: colors.primary + "22" }]}>
        <Feather name="bell" size={18} color={colors.primary} />
      </View>
      <View style={s.info}>
        <Text style={[s.alertName, { color: colors.foreground }]}>{item.name || "Temperature Alert"}</Text>
        <Text style={[s.alertMeta, { color: colors.mutedForeground }]}>
          {item.targetTemp ? `${item.targetTemp}°F` : ""}
          {item.cookId ? ` · Cook #${item.cookId}` : ""}
        </Text>
      </View>
      <Pressable onPress={() => handleDelete(item.id)} style={s.delBtn}>
        <Feather name="trash-2" size={16} color={colors.destructive} />
      </Pressable>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Alerts</Text>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={(alerts as any[]) || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: botPad + 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="bell-off" size={36} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No alerts set</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Create alerts from a cook session
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  alertName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  alertMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  delBtn: { padding: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { marginTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
