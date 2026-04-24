import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { useGetTemperatureHistory } from "@workspace/api-client-react";

export default function TempHistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data: history, isLoading } = useGetTemperatureHistory();

  const topPad = useTopInset();
  const botPad = useBottomInset();

  const renderItem = ({ item }: { item: any }) => (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={[s.iconWrap, { backgroundColor: colors.primary + "22" }]}>
        <Feather name="thermometer" size={18} color={colors.primary} />
      </View>
      <View style={s.info}>
        <Text style={[s.temp, { color: colors.primary }]}>{item.temperature}°F</Text>
        <Text style={[s.meta, { color: colors.mutedForeground }]}>
          {item.probe || "Probe"} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
        </Text>
        {item.cook?.name && (
          <Text style={[s.cookName, { color: colors.foreground }]}>{item.cook.name}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <AppHeader title="Temperature History" showBack dark />

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={(history as any[]) || []}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: botPad + 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="thermometer" size={36} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No readings yet</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Scan thermometer photos to log temps
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
  temp: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 2 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cookName: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { marginTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
