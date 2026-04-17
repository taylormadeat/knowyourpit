import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useListRecipes, useToggleRecipeFavorite } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function RecipesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { data: recipes, isLoading, refetch } = useListRecipes();
  const toggleFav = useToggleRecipeFavorite();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const filtered = ((recipes as any[]) || []).filter((r: any) =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.meatType?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [
        s.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
        pressed && { opacity: 0.75 },
      ]}
      onPress={() => router.push(`/recipe/${item.id}` as any)}
    >
      <View style={[s.cardIcon, { backgroundColor: colors.primary + "22" }]}>
        <Feather name="book-open" size={20} color={colors.primary} />
      </View>
      <View style={s.cardInfo}>
        <Text style={[s.cardName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>
          {item.meatType || "BBQ"}{item.cookTime ? ` · ${item.cookTime}` : ""}
        </Text>
      </View>
      <Pressable
        style={s.favBtn}
        onPress={() => {
          toggleFav.mutate({ id: item.id });
          qc.invalidateQueries({ queryKey: ["listRecipes"] });
        }}
        hitSlop={10}
      >
        <Feather
          name={item.isFavorite ? "heart" : "heart"}
          size={18}
          color={item.isFavorite ? colors.destructive : colors.mutedForeground}
        />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Recipes</Text>
      </View>

      <View style={[s.searchWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          placeholder="Search recipes..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: botPad + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="book-open" size={36} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {search ? "No results" : "No recipes yet"}
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
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 14 },
  cardIcon: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  favBtn: { padding: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { marginTop: 60, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
