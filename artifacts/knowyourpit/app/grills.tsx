import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useListGrills,
  useCreateGrill,
  useDeleteGrill,
  getListGrillsQueryKey,
} from "@workspace/api-client-react";
import { GRILL_CATALOG, type GrillModel } from "@/constants/grillCatalog";

const GRILL_TYPES = [
  "Kamado", "Offset Smoker", "Pellet Grill", "Kettle", "Gas Grill",
  "Cabinet Smoker", "Reverse Flow", "Drum Smoker", "Electric Smoker", "Other",
];
const FUEL_TYPES = ["Charcoal", "Wood", "Pellets", "Gas", "Electric", "Combination"];

interface BrandEntry {
  brand: string;
  categories: string[];
  models: GrillModel[];
}

function buildBrandList(): BrandEntry[] {
  const map = new Map<string, BrandEntry>();
  for (const cat of GRILL_CATALOG) {
    for (const b of cat.brands) {
      const existing = map.get(b.brand);
      if (existing) {
        if (!existing.categories.includes(cat.category)) existing.categories.push(cat.category);
        existing.models.push(...b.models);
      } else {
        map.set(b.brand, { brand: b.brand, categories: [cat.category], models: [...b.models] });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.brand.localeCompare(b.brand));
}

const ALL_BRANDS = buildBrandList();

export default function GrillsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: grills, isLoading } = useListGrills();
  const createGrill = useCreateGrill();
  const deleteGrill = useDeleteGrill();

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [expandedCatalogBrands, setExpandedCatalogBrands] = useState<Set<string>>(new Set());

  // Custom form fields
  const [grillName, setGrillName] = useState("");
  const [grillType, setGrillType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [customBrand, setCustomBrand] = useState("");

  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  // ── Filter catalog brands ──
  const filteredBrands = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return ALL_BRANDS;
    return ALL_BRANDS.map((entry) => ({
      ...entry,
      models: entry.models.filter((m) =>
        `${entry.brand} ${m.name} ${m.type} ${m.fuelType}`.toLowerCase().includes(q)
      ),
    })).filter((entry) => entry.models.length > 0 || entry.brand.toLowerCase().includes(q));
  }, [catalogSearch]);

  // ── Handlers ──
  const toggleCatalogBrand = (brand: string) => {
    setExpandedCatalogBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand); else next.add(brand);
      return next;
    });
  };

  const handleAddFromCatalog = async (model: GrillModel, brandName: string) => {
    try {
      await createGrill.mutateAsync({
        data: {
          name: `${brandName} ${model.name}`,
          type: model.type,
          fuelType: model.fuelType,
          brand: brandName,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListGrillsQueryKey() });
      setShowAddModal(false);
      setCatalogSearch("");
      setExpandedCatalogBrands(new Set());
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to add grill");
    }
  };

  const handleAddCustom = async () => {
    if (!grillName.trim()) {
      Alert.alert("Required", "Enter a grill name");
      return;
    }
    if (!grillType) {
      Alert.alert("Required", "Select a grill type");
      return;
    }
    try {
      await createGrill.mutateAsync({
        data: {
          name: grillName.trim(),
          type: grillType || undefined,
          fuelType: fuelType || undefined,
          brand: customBrand || undefined,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListGrillsQueryKey() });
      setShowAddModal(false);
      setShowCustomForm(false);
      setGrillName(""); setGrillType(""); setFuelType(""); setCustomBrand("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to add grill");
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("Remove Grill", `Remove "${name}" from your collection?`, [
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

  const openAddModal = () => {
    setShowCustomForm(false);
    setCatalogSearch("");
    setExpandedCatalogBrands(new Set());
    setGrillName(""); setGrillType(""); setFuelType(""); setCustomBrand("");
    setShowAddModal(true);
  };

  const addBtn = (
    <Pressable style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAddModal}>
      <Feather name="plus" size={18} color="#fff" />
    </Pressable>
  );

  const allGrills = (grills as any[]) ?? [];

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="My Grills" showBack dark right={addBtn} />

      {/* ── MY GRILLS ── */}
      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : !allGrills.length ? (
        <View style={s.emptyWrap}>
          <View style={[s.empty, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <GrillIcon color={colors.mutedForeground} />
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No grills yet</Text>
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
              Tap + to browse brands and add your grill, or add a custom one
            </Text>
            <Pressable
              style={[s.browseCta, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={openAddModal}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={s.browseCtaText}>Add a Grill</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: botPad + 40, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {allGrills.map((item: any) => (
            <View
              key={item.id}
              style={[s.grillCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.grillCardIcon}>
                <Feather name="wind" size={20} color="#fff" />
              </LinearGradient>
              <View style={s.grillCardInfo}>
                <Text style={[s.grillCardName, { color: colors.foreground }]}>{item.name}</Text>
                {item.brand && (
                  <Text style={[s.grillCardBrand, { color: colors.mutedForeground }]}>{item.brand}</Text>
                )}
                <View style={s.tagRow}>
                  {item.type && (
                    <View style={[s.tag, { backgroundColor: colors.primary + "18" }]}>
                      <Text style={[s.tagText, { color: colors.primary }]}>{item.type}</Text>
                    </View>
                  )}
                  {item.fuelType && (
                    <View style={[s.tag, { backgroundColor: colors.muted }]}>
                      <Text style={[s.tagText, { color: colors.mutedForeground }]}>{item.fuelType}</Text>
                    </View>
                  )}
                </View>
                {/* ── Grill stats ── */}
                <View style={s.grillStatRow}>
                  <View style={s.grillStatItem}>
                    <Feather name="zap" size={11} color={colors.mutedForeground} />
                    <Text style={[s.grillStatText, { color: colors.mutedForeground }]}>
                      {item.cookCount ?? 0} cook{(item.cookCount ?? 0) !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  {item.avgRating != null && item.cookCount > 0 && (() => {
                    const avg = parseFloat(item.avgRating);
                    if (isNaN(avg)) return null;
                    const grade = grillLetterGrade(avg);
                    const color = grillGradeColor(avg);
                    return (
                      <View style={[s.grillGradePill, { backgroundColor: color + "18", borderColor: color + "40" }]}>
                        <Feather name="star" size={11} color={color} />
                        <Text style={[s.grillGradeText, { color }]}>{grade}</Text>
                        <Text style={[s.grillGradeAvg, { color: color + "cc" }]}>({avg.toFixed(1)})</Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
              <Pressable
                style={[s.delBtn, { backgroundColor: colors.destructive + "15", borderRadius: 8 }]}
                onPress={() => handleDelete(item.id, item.name)}
              >
                <Feather name="trash-2" size={15} color={colors.destructive} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── ADD GRILL MODAL ── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[s.modal, { backgroundColor: colors.background }]}>
            {/* Modal header */}
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Add a Grill</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: botPad + 40 }}
            >
              {/* Search */}
              <View style={[s.searchWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Feather name="search" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[s.searchInput, { color: colors.foreground }]}
                  placeholder="Search brands or models…"
                  placeholderTextColor={colors.mutedForeground}
                  value={catalogSearch}
                  onChangeText={(t) => {
                    setCatalogSearch(t);
                    if (t.trim()) {
                      setExpandedCatalogBrands(new Set(filteredBrands.map((b) => b.brand)));
                    }
                  }}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {catalogSearch.length > 0 && (
                  <Pressable onPress={() => { setCatalogSearch(""); setExpandedCatalogBrands(new Set()); }}>
                    <Feather name="x" size={15} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </View>

              {/* Brand accordion */}
              <View style={{ paddingHorizontal: 12, gap: 8 }}>
                {filteredBrands.map((entry) => {
                  const isOpen = expandedCatalogBrands.has(entry.brand);
                  return (
                    <View
                      key={entry.brand}
                      style={[s.catBrandCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
                    >
                      <Pressable style={s.catBrandHeader} onPress={() => toggleCatalogBrand(entry.brand)}>
                        <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.catBrandInitial}>
                          <Text style={s.catBrandInitialText}>{entry.brand[0]}</Text>
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.catBrandName, { color: colors.foreground }]}>{entry.brand}</Text>
                          <Text style={[s.catBrandSub, { color: colors.mutedForeground }]}>
                            {entry.models.length} {entry.models.length === 1 ? "model" : "models"}
                          </Text>
                        </View>
                        <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                      </Pressable>

                      {isOpen && (
                        <View style={[s.catModelList, { borderTopColor: colors.border }]}>
                          {entry.models.map((model, idx) => (
                            <Pressable
                              key={model.name}
                              style={[
                                s.catModelRow,
                                { borderBottomColor: colors.border },
                                idx === entry.models.length - 1 && { borderBottomWidth: 0 },
                                (createGrill.isPending) && { opacity: 0.6 },
                              ]}
                              onPress={() => handleAddFromCatalog(model, entry.brand)}
                              disabled={createGrill.isPending}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[s.catModelName, { color: colors.foreground }]}>{model.name}</Text>
                                <Text style={[s.catModelSub, { color: colors.mutedForeground }]}>
                                  {model.type} · {model.fuelType}
                                  {model.tempRange ? ` · ${model.tempRange}` : ""}
                                </Text>
                              </View>
                              {createGrill.isPending ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                              ) : (
                                <View style={[s.addPill, { backgroundColor: colors.primary }]}>
                                  <Feather name="plus" size={12} color="#fff" />
                                  <Text style={s.addPillText}>Add</Text>
                                </View>
                              )}
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Custom grill divider */}
              <View style={[s.customDivider, { borderTopColor: colors.border }]}>
                <Text style={[s.customDividerText, { color: colors.mutedForeground }]}>
                  Don't see your grill?
                </Text>
                <Pressable
                  style={[s.customToggleBtn, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}
                  onPress={() => setShowCustomForm((v) => !v)}
                >
                  <Feather name={showCustomForm ? "chevron-up" : "edit-2"} size={14} color={colors.foreground} />
                  <Text style={[s.customToggleText, { color: colors.foreground }]}>
                    {showCustomForm ? "Hide custom form" : "Add custom grill"}
                  </Text>
                </Pressable>
              </View>

              {/* Custom form (collapsible) */}
              {showCustomForm && (
                <View style={[s.customForm, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[s.label, { color: colors.foreground }]}>Grill Name *</Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground }]}
                      placeholder="e.g. My Custom Offset"
                      placeholderTextColor={colors.mutedForeground}
                      value={grillName}
                      onChangeText={setGrillName}
                    />
                  </View>
                  <Text style={[s.label, { color: colors.foreground }]}>Brand (optional)</Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground }]}
                      placeholder="e.g. Traeger, Weber, BGE"
                      placeholderTextColor={colors.mutedForeground}
                      value={customBrand}
                      onChangeText={setCustomBrand}
                    />
                  </View>
                  <Text style={[s.label, { color: colors.foreground }]}>Grill Type</Text>
                  <View style={s.chips}>
                    {GRILL_TYPES.map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setGrillType(t === grillType ? "" : t)}
                        style={[s.chip, { backgroundColor: grillType === t ? colors.primary : colors.background, borderColor: grillType === t ? colors.primary : colors.border, borderRadius: 8 }]}
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
                        style={[s.chip, { backgroundColor: fuelType === t ? colors.secondary : colors.background, borderColor: fuelType === t ? colors.secondary : colors.border, borderRadius: 8 }]}
                      >
                        <Text style={[s.chipText, { color: fuelType === t ? "#fff" : colors.foreground }]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    style={({ pressed }) => [s.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }, (createGrill.isPending || pressed) && { opacity: 0.7 }]}
                    onPress={handleAddCustom}
                    disabled={createGrill.isPending}
                  >
                    {createGrill.isPending
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.saveBtnText}>Add Custom Grill</Text>}
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function grillLetterGrade(avg: number): string {
  if (avg >= 4.7) return "A+";
  if (avg >= 4.3) return "A";
  if (avg >= 4.0) return "A-";
  if (avg >= 3.7) return "B+";
  if (avg >= 3.3) return "B";
  if (avg >= 3.0) return "B-";
  if (avg >= 2.7) return "C+";
  if (avg >= 2.3) return "C";
  if (avg >= 2.0) return "C-";
  if (avg >= 1.7) return "D+";
  if (avg >= 1.3) return "D";
  return "D-";
}

function grillGradeColor(avg: number): string {
  if (avg >= 4.0) return "#22c55e";
  if (avg >= 3.0) return "#F59E0B";
  return "#E84820";
}

function GrillIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
      <Feather name="wind" size={40} color={color} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  /* Empty state */
  emptyWrap: { flex: 1, padding: 20, justifyContent: "center" },
  empty: { borderWidth: 1, padding: 32, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  browseCta: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  browseCtaText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  /* My grills flat cards */
  grillCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, padding: 14 },
  grillCardIcon: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  grillCardInfo: { flex: 1 },
  grillCardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  grillCardBrand: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 5 },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  grillStatRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" },
  grillStatItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  grillStatText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  grillGradePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  grillGradeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  grillGradeAvg: { fontSize: 11, fontFamily: "Inter_400Regular" },
  delBtn: { padding: 8 },

  /* Add grill modal */
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },

  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, margin: 12, borderWidth: 1, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },

  /* Catalog brand accordion */
  catBrandCard: { borderWidth: 1, overflow: "hidden" },
  catBrandHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  catBrandInitial: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  catBrandInitialText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  catBrandName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catBrandSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  catModelList: { borderTopWidth: 1 },
  catModelRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  catModelName: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 2 },
  catModelSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  addPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  addPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },

  /* Custom grill section */
  customDivider: { marginTop: 20, marginHorizontal: 12, paddingTop: 16, borderTopWidth: 1, alignItems: "center", gap: 10 },
  customDividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  customToggleBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  customToggleText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  customForm: { margin: 12, borderWidth: 1, padding: 16, gap: 4 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 12, marginBottom: 6 },
  inputWrap: { borderWidth: 1, height: 44, justifyContent: "center", paddingHorizontal: 14 },
  input: { fontSize: 14, fontFamily: "Inter_400Regular" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveBtn: { marginTop: 16, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
