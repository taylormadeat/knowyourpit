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
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useListGrills,
  useCreateGrill,
  useDeleteGrill,
  getListGrillsQueryKey,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";

const GRILL_TYPES = [
  "Kamado", "Offset Smoker", "Pellet Grill", "Kettle", "Gas Grill",
  "Cabinet Smoker", "Reverse Flow", "Drum Smoker", "Electric Smoker", "Other"
];
const FUEL_TYPES = ["Charcoal", "Wood", "Pellets", "Gas", "Electric", "Combination"];

export default function GrillsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: grills, isLoading } = useListGrills();
  const createGrill = useCreateGrill();
  const deleteGrill = useDeleteGrill();

  const [showAdd, setShowAdd] = useState(false);
  const [grillName, setGrillName] = useState("");
  const [grillType, setGrillType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [brand, setBrand] = useState("");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const handleAdd = async () => {
    if (!grillName.trim()) {
      Alert.alert("Required", "Enter a grill name");
      return;
    }
    try {
      await createGrill.mutateAsync({
        data: {
          name: grillName.trim(),
          type: grillType || undefined,
          fuelType: fuelType || undefined,
          brand: brand || undefined,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListGrillsQueryKey() });
      setShowAdd(false);
      setGrillName(""); setGrillType(""); setFuelType(""); setBrand("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to add grill");
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("Remove Grill", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          await deleteGrill.mutateAsync({ id });
          qc.invalidateQueries({ queryKey: getListGrillsQueryKey() });
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={[s.iconWrap, { backgroundColor: colors.primary + "22" }]}>
        <Feather name="wind" size={22} color={colors.primary} />
      </View>
      <View style={s.info}>
        <Text style={[s.name, { color: colors.foreground }]}>{item.name}</Text>
        {item.brand && <Text style={[s.meta, { color: colors.mutedForeground }]}>{item.brand}</Text>}
        <View style={s.tags}>
          {item.type && (
            <View style={[s.tag, { backgroundColor: colors.muted }]}>
              <Text style={[s.tagText, { color: colors.foreground }]}>{item.type}</Text>
            </View>
          )}
          {item.fuelType && (
            <View style={[s.tag, { backgroundColor: colors.muted }]}>
              <Text style={[s.tagText, { color: colors.foreground }]}>{item.fuelType}</Text>
            </View>
          )}
        </View>
      </View>
      <Pressable
        style={s.delBtn}
        onPress={() => handleDelete(item.id, item.name)}
      >
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
        <Text style={[s.title, { color: colors.foreground }]}>My Grills</Text>
        <Pressable
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowAdd(true)}
        >
          <Feather name="plus" size={18} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={(grills as any[]) || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: botPad + 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={[s.empty, { borderColor: colors.border }]}>
              <Feather name="wind" size={36} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No grills added</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Add your first grill to get started
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Add Grill</Text>
            <Pressable onPress={() => setShowAdd(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 4 }} keyboardShouldPersistTaps="handled">
            <Text style={[s.label, { color: colors.foreground }]}>Grill Name *</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                placeholder="e.g. Big Green Egg"
                placeholderTextColor={colors.mutedForeground}
                value={grillName}
                onChangeText={setGrillName}
                autoFocus
              />
            </View>
            <Text style={[s.label, { color: colors.foreground }]}>Brand</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                placeholder="e.g. Traeger, Weber, BGE"
                placeholderTextColor={colors.mutedForeground}
                value={brand}
                onChangeText={setBrand}
              />
            </View>
            <Text style={[s.label, { color: colors.foreground }]}>Grill Type</Text>
            <View style={s.chips}>
              {GRILL_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setGrillType(t === grillType ? "" : t)}
                  style={[s.chip, { backgroundColor: grillType === t ? colors.primary : colors.card, borderColor: grillType === t ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Text style={[s.chipText, { color: grillType === t ? "#fff" : colors.foreground }]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[s.label, { color: colors.foreground }]}>Fuel Type</Text>
            <View style={s.chips}>
              {FUEL_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setFuelType(t === fuelType ? "" : t)}
                  style={[s.chip, { backgroundColor: fuelType === t ? colors.secondary : colors.card, borderColor: fuelType === t ? colors.secondary : colors.border, borderRadius: colors.radius }]}
                >
                  <Text style={[s.chipText, { color: fuelType === t ? "#fff" : colors.foreground }]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [s.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }, (createGrill.isPending || pressed) && { opacity: 0.7 }]}
              onPress={handleAdd}
              disabled={createGrill.isPending}
            >
              {createGrill.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Add Grill</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold" },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  tags: { flexDirection: "row", gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  delBtn: { padding: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { borderWidth: 1, marginTop: 40, padding: 36, alignItems: "center", gap: 8, borderRadius: 12 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 8 },
  inputWrap: { borderWidth: 1, paddingHorizontal: 14, marginBottom: 4 },
  input: { height: 48, fontSize: 15, fontFamily: "Inter_400Regular" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveBtn: { height: 50, alignItems: "center", justifyContent: "center", marginTop: 16 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
