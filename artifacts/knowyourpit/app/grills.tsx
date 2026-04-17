import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
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
import { AppHeader } from "@/components/AppHeader";
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
import { useRouter } from "expo-router";
import { GRILL_CATALOG, type GrillModel, type GrillCategory } from "@/constants/grillCatalog";

const GRILL_TYPES = [
  "Kamado", "Offset Smoker", "Pellet Grill", "Kettle", "Gas Grill",
  "Cabinet Smoker", "Reverse Flow", "Drum Smoker", "Electric Smoker", "Other"
];
const FUEL_TYPES = ["Charcoal", "Wood", "Pellets", "Gas", "Electric", "Combination"];

type Tab = "mine" | "catalog";

export default function GrillsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: grills, isLoading } = useListGrills();
  const createGrill = useCreateGrill();
  const deleteGrill = useDeleteGrill();

  const [activeTab, setActiveTab] = useState<Tab>("mine");
  const [showAdd, setShowAdd] = useState(false);
  const [grillName, setGrillName] = useState("");
  const [grillType, setGrillType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [brand, setBrand] = useState("");

  // catalog expansion state
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set([GRILL_CATALOG[0].category]));
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const [catalogSearch, setCatalogSearch] = useState("");

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
      setActiveTab("mine");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to add grill");
    }
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
      Alert.alert("Added!", `${brandName} ${model.name} added to My Grills`, [{ text: "OK" }]);
      setActiveTab("mine");
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

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleBrand = (key: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleModel = (key: string) => {
    setExpandedModel(prev => (prev === key ? null : key));
  };

  // Filter catalog by search
  const filteredCatalog = catalogSearch.trim()
    ? GRILL_CATALOG.map(cat => ({
        ...cat,
        brands: cat.brands
          .map(b => ({
            ...b,
            models: b.models.filter(m =>
              `${b.brand} ${m.name} ${m.type}`.toLowerCase().includes(catalogSearch.toLowerCase())
            ),
          }))
          .filter(b => b.models.length > 0),
      })).filter(cat => cat.brands.length > 0)
    : GRILL_CATALOG;

  const addBtn = (
    <Pressable
      style={[s.addBtn, { backgroundColor: colors.primary, borderRadius: 8 }]}
      onPress={() => setShowAdd(true)}
    >
      <Feather name="plus" size={18} color="#fff" />
    </Pressable>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <AppHeader title="My Grills" showBack right={addBtn} />

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable
          style={[s.tab, activeTab === "mine" && [s.tabActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab("mine")}
        >
          <Feather name="wind" size={15} color={activeTab === "mine" ? colors.primary : colors.mutedForeground} style={{ marginRight: 6 }} />
          <Text style={[s.tabText, { color: activeTab === "mine" ? colors.primary : colors.mutedForeground }]}>
            My Collection {grills ? `(${(grills as any[]).length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          style={[s.tab, activeTab === "catalog" && [s.tabActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab("catalog")}
        >
          <Feather name="grid" size={15} color={activeTab === "catalog" ? colors.primary : colors.mutedForeground} style={{ marginRight: 6 }} />
          <Text style={[s.tabText, { color: activeTab === "catalog" ? colors.primary : colors.mutedForeground }]}>
            Browse Catalog
          </Text>
        </Pressable>
      </View>

      {/* ── MY COLLECTION TAB ── */}
      {activeTab === "mine" && (
        isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40, gap: 10 }}
            showsVerticalScrollIndicator={false}
          >
            {!(grills as any[])?.length ? (
              <View style={[s.empty, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
                <Feather name="wind" size={40} color={colors.mutedForeground} />
                <Text style={[s.emptyTitle, { color: colors.foreground }]}>No grills yet</Text>
                <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                  Browse the catalog to add your grill or tap + to add a custom one
                </Text>
                <Pressable
                  style={[s.browseCta, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                  onPress={() => setActiveTab("catalog")}
                >
                  <Text style={s.browseCtaText}>Browse Grill Catalog</Text>
                </Pressable>
              </View>
            ) : (
              (grills as any[]).map((item: any) => (
                <View
                  key={item.id}
                  style={[s.myGrillCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
                >
                  <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.grillIcon}>
                    <Feather name="wind" size={20} color="#fff" />
                  </LinearGradient>
                  <View style={s.grillInfo}>
                    <Text style={[s.grillName, { color: colors.foreground }]}>{item.name}</Text>
                    {item.brand && <Text style={[s.grillBrand, { color: colors.mutedForeground }]}>{item.brand}</Text>}
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
                  </View>
                  <Pressable
                    style={[s.delBtn, { backgroundColor: colors.destructive + "15", borderRadius: 8 }]}
                    onPress={() => handleDelete(item.id, item.name)}
                  >
                    <Feather name="trash-2" size={15} color={colors.destructive} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        )
      )}

      {/* ── CATALOG TAB ── */}
      {activeTab === "catalog" && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: botPad + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Search */}
          <View style={[s.searchWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[s.searchInput, { color: colors.foreground }]}
              placeholder="Search grills, brands…"
              placeholderTextColor={colors.mutedForeground}
              value={catalogSearch}
              onChangeText={setCatalogSearch}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {catalogSearch.length > 0 && (
              <Pressable onPress={() => setCatalogSearch("")}>
                <Feather name="x" size={15} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <Text style={[s.catalogHint, { color: colors.mutedForeground }]}>
            {filteredCatalog.reduce((t, c) => t + c.brands.reduce((b, br) => b + br.models.length, 0), 0)} grills across {filteredCatalog.reduce((t, c) => t + c.brands.length, 0)} brands
          </Text>

          {filteredCatalog.map((cat) => (
            <View key={cat.category}>
              {/* Category header */}
              <Pressable
                style={[s.catHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => toggleCat(cat.category)}
              >
                <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.catIcon}>
                  <Feather name={cat.icon as any} size={16} color="#fff" />
                </LinearGradient>
                <Text style={[s.catTitle, { color: colors.foreground }]}>{cat.category}</Text>
                <Text style={[s.catCount, { color: colors.mutedForeground }]}>
                  {cat.brands.reduce((t, b) => t + b.models.length, 0)} grills
                </Text>
                <Feather
                  name={expandedCats.has(cat.category) ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>

              {expandedCats.has(cat.category) && (
                <View style={[s.catBody, { borderColor: colors.border }]}>
                  {cat.brands.map((brandObj) => {
                    const brandKey = `${cat.category}::${brandObj.brand}`;
                    const brandOpen = expandedBrands.has(brandKey) || catalogSearch.length > 0;

                    return (
                      <View key={brandObj.brand}>
                        {/* Brand header */}
                        <Pressable
                          style={[s.brandHeader, { borderBottomColor: colors.border, backgroundColor: colors.background }]}
                          onPress={() => toggleBrand(brandKey)}
                        >
                          <View style={[s.brandDot, { backgroundColor: colors.primary }]} />
                          <Text style={[s.brandName, { color: colors.foreground }]}>{brandObj.brand}</Text>
                          <Text style={[s.brandCount, { color: colors.mutedForeground }]}>
                            {brandObj.models.length} models
                          </Text>
                          <Feather
                            name={brandOpen ? "chevron-up" : "chevron-right"}
                            size={16}
                            color={colors.mutedForeground}
                          />
                        </Pressable>

                        {brandOpen && brandObj.models.map((model) => {
                          const modelKey = `${brandKey}::${model.name}`;
                          const modelOpen = expandedModel === modelKey;

                          return (
                            <View
                              key={model.name}
                              style={[s.modelWrap, { borderBottomColor: colors.border }]}
                            >
                              <Pressable
                                style={s.modelRow}
                                onPress={() => toggleModel(modelKey)}
                              >
                                <View style={s.modelMain}>
                                  <Text style={[s.modelName, { color: colors.foreground }]}>
                                    {model.name}
                                  </Text>
                                  <Text style={[s.modelSub, { color: colors.mutedForeground }]}>
                                    {model.fuelType} · {model.tempRange}
                                    {model.cookingSurface ? ` · ${model.cookingSurface}` : ""}
                                  </Text>
                                </View>
                                <Feather
                                  name={modelOpen ? "chevron-up" : "chevron-down"}
                                  size={15}
                                  color={colors.mutedForeground}
                                />
                              </Pressable>

                              {modelOpen && (
                                <View style={[s.modelDetail, { backgroundColor: colors.card }]}>
                                  {model.notes && (
                                    <Text style={[s.modelNotes, { color: colors.primary }]}>
                                      ★ {model.notes}
                                    </Text>
                                  )}
                                  <View style={s.specRow}>
                                    <SpecChip label="Type" value={model.type} colors={colors} />
                                    <SpecChip label="Fuel" value={model.fuelType} colors={colors} />
                                    <SpecChip label="Temp" value={model.tempRange} colors={colors} />
                                    {model.cookingSurface && (
                                      <SpecChip label="Surface" value={model.cookingSurface} colors={colors} />
                                    )}
                                  </View>
                                  <Text style={[s.featuresLabel, { color: colors.mutedForeground }]}>Key Features</Text>
                                  {model.features.map((f) => (
                                    <View key={f} style={s.featureRow}>
                                      <View style={[s.featureDot, { backgroundColor: colors.primary }]} />
                                      <Text style={[s.featureText, { color: colors.foreground }]}>{f}</Text>
                                    </View>
                                  ))}
                                  <Pressable
                                    style={({ pressed }) => [
                                      s.addToMyGrills,
                                      { backgroundColor: colors.primary, borderRadius: colors.radius },
                                      (createGrill.isPending || pressed) && { opacity: 0.7 },
                                    ]}
                                    onPress={() => handleAddFromCatalog(model, brandObj.brand)}
                                    disabled={createGrill.isPending}
                                  >
                                    {createGrill.isPending ? (
                                      <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                      <>
                                        <Feather name="plus" size={15} color="#fff" />
                                        <Text style={s.addToMyGrillsText}>Add to My Collection</Text>
                                      </>
                                    )}
                                  </Pressable>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── ADD CUSTOM GRILL MODAL ── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAdd(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Add Custom Grill</Text>
            <Pressable onPress={() => setShowAdd(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 4 }} keyboardShouldPersistTaps="handled">
            <Text style={[s.label, { color: colors.foreground }]}>Grill Name *</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                placeholder="e.g. Big Green Egg Large"
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
                  style={[s.chip, { backgroundColor: grillType === t ? colors.primary : colors.card, borderColor: grillType === t ? colors.primary : colors.border, borderRadius: 8 }]}
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
                  style={[s.chip, { backgroundColor: fuelType === t ? colors.secondary : colors.card, borderColor: fuelType === t ? colors.secondary : colors.border, borderRadius: 8 }]}
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

function SpecChip({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[specStyles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[specStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[specStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const specStyles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minWidth: 70, marginRight: 6, marginBottom: 6 },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

const s = StyleSheet.create({
  container: { flex: 1 },

  /* Tabs */
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: {},
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  /* My collection */
  myGrillCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 14 },
  grillIcon: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  grillInfo: { flex: 1 },
  grillName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  grillBrand: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  delBtn: { padding: 8 },

  empty: { borderWidth: 1, marginTop: 24, padding: 32, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  browseCta: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12 },
  browseCtaText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  /* Catalog */
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 12, borderWidth: 1, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  catalogHint: { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 16, marginBottom: 8 },

  /* Category */
  catHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 12, marginBottom: 2, paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 10, borderWidth: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  catIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  catTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold" },
  catCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginRight: 4 },
  catBody: { marginHorizontal: 12, marginBottom: 10, borderWidth: 1, borderRadius: 10, overflow: "hidden" },

  /* Brand */
  brandHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  brandDot: { width: 8, height: 8, borderRadius: 4 },
  brandName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  brandCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginRight: 4 },

  /* Model */
  modelWrap: { borderBottomWidth: 1 },
  modelRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
  modelMain: { flex: 1, paddingRight: 8 },
  modelName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  modelSub: { fontSize: 12, fontFamily: "Inter_400Regular" },

  /* Model detail */
  modelDetail: { padding: 14, gap: 8 },
  modelNotes: { fontSize: 13, fontFamily: "Inter_500Medium", fontStyle: "italic" },
  specRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  featuresLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  featureDot: { width: 5, height: 5, borderRadius: 3 },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  addToMyGrills: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, paddingVertical: 10,
  },
  addToMyGrillsText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  /* Add custom modal */
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
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

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
