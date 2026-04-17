import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useGetRecipe } from "@workspace/api-client-react";

export default function RecipeDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: recipe, isLoading } = useGetRecipe({ id: Number(id) });

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const r = recipe as any;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>
          {r?.name || "Recipe"}
        </Text>
      </View>

      {r && (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.metaRow}>
            {r.meatType && (
              <View style={[s.badge, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[s.badgeText, { color: colors.primary }]}>{r.meatType}</Text>
              </View>
            )}
            {r.cookTime && (
              <View style={[s.badge, { backgroundColor: colors.muted }]}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[s.badgeText, { color: colors.mutedForeground }]}>{r.cookTime}</Text>
              </View>
            )}
            {r.difficulty && (
              <View style={[s.badge, { backgroundColor: colors.muted }]}>
                <Text style={[s.badgeText, { color: colors.mutedForeground }]}>{r.difficulty}</Text>
              </View>
            )}
          </View>

          {r.description && (
            <Text style={[s.description, { color: colors.foreground }]}>{r.description}</Text>
          )}

          {r.ingredients && (
            <View>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Ingredients</Text>
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Text style={[s.contentText, { color: colors.foreground }]}>{r.ingredients}</Text>
              </View>
            </View>
          )}

          {r.instructions && (
            <View>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Instructions</Text>
              <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Text style={[s.contentText, { color: colors.foreground }]}>{r.instructions}</Text>
              </View>
            </View>
          )}

          {r.targetTemp && (
            <View style={[s.tempCard, { backgroundColor: colors.primary + "15", borderRadius: colors.radius }]}>
              <Feather name="thermometer" size={20} color={colors.primary} />
              <View>
                <Text style={[s.tempLabel, { color: colors.mutedForeground }]}>Target Temperature</Text>
                <Text style={[s.tempValue, { color: colors.primary }]}>{r.targetTemp}°F</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  description: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 10 },
  card: { borderWidth: 1, padding: 14 },
  contentText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 24 },
  tempCard: { flexDirection: "row", gap: 12, padding: 14, alignItems: "center" },
  tempLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tempValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
});
