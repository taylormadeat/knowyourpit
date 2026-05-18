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
  Image,
} from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useLayout } from "@/hooks/useLayout";
import {
  useListGrills,
  useCreateGrill,
  useUpdateGrill,
  useDeleteGrill,
  getListGrillsQueryKey,
  useGetGrillInsights,
  getGetGrillInsightsQueryKey,
} from "@workspace/api-client-react";
import { GRILL_CATALOG, type GrillModel } from "@/constants/grillCatalog";
import { GrillTypeIcon, classifyGrillType, grillGradientColors } from "@/components/GrillTypeIcon";

const GRILL_TYPES = [
  "Pellet Grill", "Kamado", "Offset Smoker", "Reverse Flow Smoker",
  "Drum Smoker", "Bullet Smoker", "Kettle", "Gas Grill", "Charcoal Grill",
  "Cabinet Smoker", "Electric Smoker", "Combo", "Griddle", "Other",
];
const FUEL_TYPES = ["Charcoal", "Wood", "Pellets", "Gas", "Electric", "Combination"];

// Parses catalog cookingSurface strings like "572 sq in", "1,050 sq in" → 572.
// Returns null for non-numeric values like "Drum" or "3.4 cu ft".
function parseCookingSurfaceSqIn(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = raw.replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*sq\s*in/i);
  return m ? parseFloat(m[1]) : null;
}

// Scans catalog feature strings for an explicit hopper size in pounds, e.g.
// "Large 21 lb hopper" → 21, "20 lb hopper" → 20. Returns the first numeric
// match, or null if no quantified hopper info is present.
function parseHopperSizeLbs(features: string[] | undefined | null): number | null {
  if (!Array.isArray(features)) return null;
  for (const f of features) {
    if (!/hopper/i.test(f)) continue;
    const m = f.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound)/i);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

// Format a Date/ISO string as a short relative phrase, e.g. "2d ago", "3h ago",
// "just now". Falls back to a localized date string for >30 days.
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
  return new Date(iso).toLocaleDateString();
}

interface BrandEntry {
  brand: string;
  categories: string[];
  models: GrillModel[];
  logoUrl?: string;
}

// `logoUrl` is sourced from the catalog (`GrillBrand.logoUrl`). The merge
// keeps the first non-empty `logoUrl` we encounter for a given brand so
// it doesn't matter which category lists the brand first.
function buildBrandList(): BrandEntry[] {
  const map = new Map<string, BrandEntry>();
  for (const cat of GRILL_CATALOG) {
    for (const b of cat.brands) {
      const existing = map.get(b.brand);
      if (existing) {
        if (!existing.categories.includes(cat.category)) existing.categories.push(cat.category);
        existing.models.push(...b.models);
        if (!existing.logoUrl && b.logoUrl) existing.logoUrl = b.logoUrl;
      } else {
        map.set(b.brand, {
          brand: b.brand,
          categories: [cat.category],
          models: [...b.models],
          logoUrl: b.logoUrl,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.brand.localeCompare(b.brand));
}

const ALL_BRANDS = buildBrandList();

// Maps the server's internal confidence enum to user-facing labels.
// none (0-1 cooks) → Low, building (2-4) → Low, developing (5-9) → Medium, established (10+) → High
const CONFIDENCE_LABEL: Record<string, string> = {
  none: "Low",
  building: "Low",
  developing: "Medium",
  established: "High",
};

function GrillFingerprintSection({
  grillId,
  completedCookCount,
  colors,
}: {
  grillId: number;
  completedCookCount: number;
  colors: any;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const { data, isLoading } = useGetGrillInsights(grillId, {
    query: {
      queryKey: getGetGrillInsightsQueryKey(grillId),
      enabled: completedCookCount > 0,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  // No completed cooks yet — show flat empty-state note, no expand control
  if (completedCookCount === 0) {
    return (
      <View style={[fps.section, { borderTopColor: colors.border }]}>
        <View style={fps.headerRow}>
          <Feather name="trending-up" size={10} color={colors.mutedForeground} />
          <Text style={[fps.sectionLabel, { color: colors.mutedForeground }]}>Learned Pace</Text>
        </View>
        <Text style={[fps.emptyNote, { color: colors.mutedForeground }]}>
          Complete a cook on this grill to start learning its pace.
        </Text>
      </View>
    );
  }

  // Collapsed header — always shown once there are cooks
  const cookCount = data?.cookCount ?? completedCookCount;
  const confidenceLevel = data?.confidenceLevel ?? "none";
  const confidenceLabel = CONFIDENCE_LABEL[confidenceLevel] ?? "Low";

  return (
    <View style={[fps.section, { borderTopColor: colors.border }]}>
      <Pressable
        style={fps.headerRow}
        onPress={() => setExpanded((v) => !v)}
        hitSlop={8}
      >
        <Feather name="trending-up" size={10} color={colors.mutedForeground} />
        <Text style={[fps.sectionLabel, { color: colors.mutedForeground }]}>Learned Pace</Text>
        {!isLoading && (
          <View style={[fps.confidenceBadge, { backgroundColor: colors.muted }]}>
            <Text style={[fps.confidenceText, { color: colors.mutedForeground }]}>
              {confidenceLabel} confidence · {cookCount} cook{cookCount !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
        {isLoading
          ? <ActivityIndicator size="small" color={colors.mutedForeground} style={{ transform: [{ scale: 0.6 }] }} />
          : <Feather name={expanded ? "chevron-up" : "chevron-down"} size={12} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
        }
      </Pressable>

      {expanded && data && (() => {
        const { pitBiasF, overshootF, durationByMeat } = data;
        const meatEntries = Object.entries(durationByMeat ?? {}).filter(([, p]) => p.sampleSize >= 1);
        const hasBiasChip = pitBiasF != null;
        const hasOvershootChip = overshootF != null && Math.abs(overshootF) >= 3;

        return (
          <>
            {(hasBiasChip || hasOvershootChip) && (
              <View style={fps.chipRow}>
                {hasBiasChip && (
                  Math.abs(pitBiasF!) >= 3 ? (
                    <View style={[fps.chip, { backgroundColor: (pitBiasF! > 0 ? "#E84820" : "#3B82F6") + "15", borderColor: (pitBiasF! > 0 ? "#E84820" : "#3B82F6") + "40" }]}>
                      <Text style={[fps.chipText, { color: pitBiasF! > 0 ? "#E84820" : "#3B82F6" }]}>
                        Runs {pitBiasF! > 0 ? "HOT" : "COLD"} {Math.abs(Math.round(pitBiasF!))}°F
                      </Text>
                    </View>
                  ) : (
                    <View style={[fps.chip, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}>
                      <Text style={[fps.chipText, { color: "#22c55e" }]}>Accurate temp</Text>
                    </View>
                  )
                )}
                {hasOvershootChip && (
                  <View style={[fps.chip, { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}>
                    <Text style={[fps.chipText, { color: colors.mutedForeground }]}>
                      {overshootF! > 0 ? "Overshoots" : "Undershoots"} {Math.abs(Math.round(overshootF!))}°F
                    </Text>
                  </View>
                )}
              </View>
            )}

            {meatEntries.length > 0 && (
              <View style={fps.meatRows}>
                {meatEntries.map(([meat, p]) => {
                  const label = meat.replace(/_/g, " ");
                  const pct = p.pctDiff;
                  const pctColor =
                    pct == null ? colors.mutedForeground
                    : pct > 10 ? "#E84820"
                    : pct < -10 ? "#3B82F6"
                    : "#22c55e";
                  const pctLabel =
                    pct == null ? null
                    : pct > 5 ? `+${pct}% slower`
                    : pct < -5 ? `${pct}% faster`
                    : "~avg";
                  return (
                    <View key={meat} style={fps.meatRow}>
                      <Text style={[fps.meatLabel, { color: colors.foreground }]} numberOfLines={1}>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </Text>
                      <Text style={[fps.meatPace, { color: colors.mutedForeground }]}>
                        {p.actualMinsPerLb} min/lb
                      </Text>
                      <Text style={[fps.meatN, { color: colors.mutedForeground }]}>
                        · {p.sampleSize} cook{p.sampleSize !== 1 ? "s" : ""}
                      </Text>
                      {pctLabel != null && (
                        <Text style={[fps.meatPct, { color: pctColor }]}>{pctLabel}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        );
      })()}
    </View>
  );
}

const fps = StyleSheet.create({
  section: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  confidenceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  confidenceText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  emptyNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  meatRows: {
    gap: 3,
  },
  meatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  meatLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    minWidth: 60,
  },
  meatPace: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  meatPct: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  meatN: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    opacity: 0.7,
  },
});

export default function GrillsScreen() {
  const colors = useColors();
  const qc = useQueryClient();

  const { data: grills, isLoading } = useListGrills();
  const createGrill = useCreateGrill();
  const updateGrill = useUpdateGrill();
  const deleteGrill = useDeleteGrill();

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [expandedCatalogBrands, setExpandedCatalogBrands] = useState<Set<string>>(new Set());
  const [logoErrorBrands, setLogoErrorBrands] = useState<Set<string>>(new Set());

  // Custom form fields
  const [grillName, setGrillName] = useState("");
  const [grillType, setGrillType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [tempRange, setTempRange] = useState("");
  const [featuresInput, setFeaturesInput] = useState("");
  const [cookingSurfaceInput, setCookingSurfaceInput] = useState("");
  const [hopperSizeInput, setHopperSizeInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [wifiEnabledInput, setWifiEnabledInput] = useState(false);

  // Edit modal state
  const [editingGrillId, setEditingGrillId] = useState<number | null>(null);

  const botPad = useBottomInset();
  const { isTablet, contentMaxWidth } = useLayout();

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
      const surfaceSqIn = parseCookingSurfaceSqIn(model.cookingSurface);
      const hopperLbs = parseHopperSizeLbs(model.features);
      const wifiFromFeatures = Array.isArray(model.features)
        && model.features.some((f) => /\bwi\s*-?\s*fi\b|wifire/i.test(f));
      await createGrill.mutateAsync({
        data: {
          name: `${brandName} ${model.name}`,
          type: model.type,
          fuelType: model.fuelType,
          brand: brandName,
          model: model.name,
          tempRange: model.tempRange || undefined,
          features: Array.isArray(model.features) && model.features.length > 0 ? model.features : undefined,
          notes: model.notes || undefined,
          cookingSurfaceSqIn: surfaceSqIn ?? undefined,
          hopperSizeLbs: hopperLbs ?? undefined,
          wifiEnabled: wifiFromFeatures ? true : undefined,
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

  const parseFeaturesInput = (raw: string): string[] => {
    return raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
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
    const featuresArr = parseFeaturesInput(featuresInput);
    const cookingSurfaceVal = cookingSurfaceInput.trim()
      ? Number(cookingSurfaceInput.trim().replace(/,/g, ""))
      : NaN;
    const hopperVal = hopperSizeInput.trim()
      ? Number(hopperSizeInput.trim().replace(/,/g, ""))
      : NaN;
    try {
      if (editingGrillId != null) {
        await updateGrill.mutateAsync({
          id: editingGrillId,
          data: {
            name: grillName.trim(),
            type: grillType || "",
            fuelType: fuelType || null,
            brand: customBrand.trim() || null,
            tempRange: tempRange.trim() || null,
            features: featuresArr.length > 0 ? featuresArr : null,
            notes: notesInput.trim() || null,
            cookingSurfaceSqIn: isFinite(cookingSurfaceVal) ? cookingSurfaceVal : null,
            hopperSizeLbs: isFinite(hopperVal) ? hopperVal : null,
            wifiEnabled: wifiEnabledInput,
          },
        });
      } else {
        await createGrill.mutateAsync({
          data: {
            name: grillName.trim(),
            type: grillType || "",
            fuelType: fuelType || undefined,
            brand: customBrand.trim() || undefined,
            tempRange: tempRange.trim() || undefined,
            features: featuresArr.length > 0 ? featuresArr : undefined,
            notes: notesInput.trim() || undefined,
            cookingSurfaceSqIn: isFinite(cookingSurfaceVal) ? cookingSurfaceVal : undefined,
            hopperSizeLbs: isFinite(hopperVal) ? hopperVal : undefined,
            wifiEnabled: wifiEnabledInput || undefined,
          },
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListGrillsQueryKey() });
      setShowAddModal(false);
      setShowCustomForm(false);
      resetCustomForm();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save grill");
    }
  };

  const resetCustomForm = () => {
    setGrillName(""); setGrillType(""); setFuelType(""); setCustomBrand("");
    setTempRange(""); setFeaturesInput(""); setEditingGrillId(null);
    setCookingSurfaceInput(""); setHopperSizeInput(""); setNotesInput("");
    setWifiEnabledInput(false);
  };

  const openEditModal = (g: any) => {
    setEditingGrillId(g.id);
    setGrillName(g.name ?? "");
    setGrillType(g.type ?? "");
    setFuelType(g.fuelType ?? "");
    setCustomBrand(g.brand ?? "");
    setTempRange(g.tempRange ?? "");
    setFeaturesInput(Array.isArray(g.features) ? g.features.join(", ") : "");
    setCookingSurfaceInput(g.cookingSurfaceSqIn != null ? String(g.cookingSurfaceSqIn) : "");
    setHopperSizeInput(g.hopperSizeLbs != null ? String(g.hopperSizeLbs) : "");
    setNotesInput(g.notes ?? "");
    setWifiEnabledInput(Boolean(g.wifiEnabled));
    setShowCustomForm(true);
    setCatalogSearch("");
    setExpandedCatalogBrands(new Set());
    setShowAddModal(true);
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
    resetCustomForm();
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
          contentContainerStyle={{
            padding: 14,
            paddingBottom: botPad + 40,
            ...(isTablet ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" } : null),
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={
              isTablet
                ? { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }
                : { gap: 10 }
            }
          >
          {allGrills.map((item: any) => (
            <View
              key={item.id}
              style={isTablet ? { width: "50%", paddingHorizontal: 5, marginBottom: 10 } : null}
            >
            <View
              style={[s.grillCardWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
            <View style={s.grillCard}>
              <LinearGradient colors={grillGradientColors(classifyGrillType(item.type))} style={s.grillCardIcon}>
                <GrillTypeIcon type={item.type} size={22} color="#fff" />
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
                  {item.tempRange && (
                    <View style={[s.tag, { backgroundColor: colors.muted }]}>
                      <Text style={[s.tagText, { color: colors.mutedForeground }]}>{item.tempRange}</Text>
                    </View>
                  )}
                </View>
                {Array.isArray(item.features) && item.features.length > 0 && (
                  <View style={[s.tagRow, { marginTop: 5 }]}>
                    {item.features.slice(0, 3).map((f: string, i: number) => (
                      <View key={i} style={[s.tag, { backgroundColor: colors.muted }]}>
                        <Text style={[s.tagText, { color: colors.mutedForeground }]} numberOfLines={1}>{f}</Text>
                      </View>
                    ))}
                    {item.features.length > 3 && (
                      <Text style={[s.tagText, { color: colors.mutedForeground }]}>+{item.features.length - 3}</Text>
                    )}
                  </View>
                )}
                {/* ── Spec chips (only render fields with data) ── */}
                {(item.cookingSurfaceSqIn != null || item.wifiEnabled || item.hopperSizeLbs != null) && (
                  <View style={[s.tagRow, { marginTop: 5 }]}>
                    {item.cookingSurfaceSqIn != null && (
                      <View style={[s.tag, { backgroundColor: colors.muted }]}>
                        <Text style={[s.tagText, { color: colors.mutedForeground }]}>
                          {Math.round(item.cookingSurfaceSqIn)} sq in
                        </Text>
                      </View>
                    )}
                    {item.wifiEnabled && (
                      <View style={[s.tag, { backgroundColor: colors.primary + "18", flexDirection: "row", alignItems: "center", gap: 3 }]}>
                        <Feather name="wifi" size={10} color={colors.primary} />
                        <Text style={[s.tagText, { color: colors.primary }]}>WiFi</Text>
                      </View>
                    )}
                    {item.hopperSizeLbs != null && (
                      <View style={[s.tag, { backgroundColor: colors.muted }]}>
                        <Text style={[s.tagText, { color: colors.mutedForeground }]}>
                          {item.hopperSizeLbs} lb hopper
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* ── Usage stats ── */}
                <View style={s.grillStatRow}>
                  <View style={s.grillStatItem}>
                    <Feather name="zap" size={11} color={colors.mutedForeground} />
                    <Text style={[s.grillStatText, { color: colors.mutedForeground }]}>
                      {item.cookCount ?? 0} cook{(item.cookCount ?? 0) !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  {typeof item.totalHours === "number" && item.totalHours > 0 && (
                    <View style={s.grillStatItem}>
                      <Feather name="clock" size={11} color={colors.mutedForeground} />
                      <Text style={[s.grillStatText, { color: colors.mutedForeground }]}>
                        {item.totalHours >= 10 ? Math.round(item.totalHours) : item.totalHours.toFixed(1)}h cooked
                      </Text>
                    </View>
                  )}
                  {item.lastCookAt && (
                    <View style={s.grillStatItem}>
                      <Feather name="calendar" size={11} color={colors.mutedForeground} />
                      <Text style={[s.grillStatText, { color: colors.mutedForeground }]}>
                        Last cooked {formatRelativeShort(item.lastCookAt)}
                      </Text>
                    </View>
                  )}
                  {item.mostCookedFood && (item.completedCookCount ?? 0) >= 3 && (
                    <View style={s.grillStatItem}>
                      <Feather name="award" size={11} color={colors.mutedForeground} />
                      <Text style={[s.grillStatText, { color: colors.mutedForeground }]}>
                        Mostly {item.mostCookedFood}
                      </Text>
                    </View>
                  )}
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
                <GrillFingerprintSection
                  grillId={item.id}
                  completedCookCount={item.completedCookCount ?? 0}
                  colors={colors}
                />
              </View>
              <View style={{ flexDirection: "column", gap: 6 }}>
                <Pressable
                  style={[s.delBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}
                  onPress={() => openEditModal(item)}
                >
                  <Feather name="edit-2" size={15} color={colors.foreground} />
                </Pressable>
                <Pressable
                  style={[s.delBtn, { backgroundColor: colors.destructive + "15", borderRadius: 8 }]}
                  onPress={() => handleDelete(item.id, item.name)}
                >
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
            </View>
            </View>
          ))}
          </View>
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
              <Text style={[s.modalTitle, { color: colors.foreground }]}>
                {editingGrillId != null ? "Edit Grill" : "Add a Grill"}
              </Text>
              <Pressable onPress={() => { setShowAddModal(false); resetCustomForm(); }}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: botPad + 40 }}
            >
              {editingGrillId == null && (
              <>
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
                  const showLogo = entry.logoUrl && !logoErrorBrands.has(entry.brand);
                  return (
                    <View
                      key={entry.brand}
                      style={[s.catBrandCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
                    >
                      <Pressable style={s.catBrandHeader} onPress={() => toggleCatalogBrand(entry.brand)}>
                        {showLogo ? (
                          <View style={[s.catBrandLogo, { backgroundColor: "#fff", borderColor: colors.border }]}>
                            <Image
                              source={{ uri: entry.logoUrl }}
                              style={s.catBrandLogoImg}
                              resizeMode="contain"
                              onError={() => {
                                setLogoErrorBrands((prev) => {
                                  if (prev.has(entry.brand)) return prev;
                                  const next = new Set(prev);
                                  next.add(entry.brand);
                                  return next;
                                });
                              }}
                            />
                          </View>
                        ) : (
                          <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.catBrandInitial}>
                            <Text style={s.catBrandInitialText}>{entry.brand[0]}</Text>
                          </LinearGradient>
                        )}
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
              </>
              )}

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
                  <Text style={[s.label, { color: colors.foreground }]}>Temp Range (optional)</Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground }]}
                      placeholder="e.g. 180°F – 500°F"
                      placeholderTextColor={colors.mutedForeground}
                      value={tempRange}
                      onChangeText={setTempRange}
                    />
                  </View>
                  <Text style={[s.label, { color: colors.foreground }]}>Cooking Surface (optional)</Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground }]}
                      placeholder="sq in (e.g. 572)"
                      placeholderTextColor={colors.mutedForeground}
                      value={cookingSurfaceInput}
                      onChangeText={setCookingSurfaceInput}
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={[s.label, { color: colors.foreground }]}>Hopper Size (optional)</Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground }]}
                      placeholder="lbs (e.g. 18)"
                      placeholderTextColor={colors.mutedForeground}
                      value={hopperSizeInput}
                      onChangeText={setHopperSizeInput}
                      keyboardType="numeric"
                    />
                  </View>
                  <Pressable
                    onPress={() => setWifiEnabledInput((v) => !v)}
                    style={[s.wifiToggle, { borderColor: colors.border, backgroundColor: wifiEnabledInput ? colors.primary + "18" : colors.background, borderRadius: colors.radius }]}
                  >
                    <Feather name="wifi" size={15} color={wifiEnabledInput ? colors.primary : colors.mutedForeground} />
                    <Text style={[s.wifiToggleText, { color: wifiEnabledInput ? colors.primary : colors.foreground }]}>
                      WiFi-enabled
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Feather
                      name={wifiEnabledInput ? "check-square" : "square"}
                      size={18}
                      color={wifiEnabledInput ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                  <Text style={[s.label, { color: colors.foreground }]}>Features (optional)</Text>
                  <Text style={[s.helperText, { color: colors.mutedForeground }]}>
                    Comma-separated, e.g. Pellet sensor, Side burner, Sear box
                  </Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius, height: undefined, minHeight: 44, paddingVertical: 8 }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground, minHeight: 30 }]}
                      placeholder="Pellet sensor, Side burner, Sear box"
                      placeholderTextColor={colors.mutedForeground}
                      value={featuresInput}
                      onChangeText={setFeaturesInput}
                      multiline
                    />
                  </View>
                  <Text style={[s.label, { color: colors.foreground }]}>Notes (optional)</Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius, height: undefined, minHeight: 44, paddingVertical: 8 }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground, minHeight: 30 }]}
                      placeholder="Anything memorable about this grill"
                      placeholderTextColor={colors.mutedForeground}
                      value={notesInput}
                      onChangeText={setNotesInput}
                      multiline
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [s.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }, (createGrill.isPending || updateGrill.isPending || pressed) && { opacity: 0.7 }]}
                    onPress={handleAddCustom}
                    disabled={createGrill.isPending || updateGrill.isPending}
                  >
                    {(createGrill.isPending || updateGrill.isPending)
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.saveBtnText}>{editingGrillId != null ? "Save Changes" : "Add Custom Grill"}</Text>}
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
  grillCardWrap: { borderWidth: 1, padding: 14 },
  grillCard: { flexDirection: "row", alignItems: "center", gap: 14 },
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
  catBrandLogo: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, padding: 3 },
  catBrandLogoImg: { width: "100%", height: "100%" },
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
  helperText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: -4, marginBottom: 4 },
  wifiToggle: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  wifiToggleText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
