import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Modal, Pressable, FlatList, TextInput, ScrollView, Alert } from "react-native";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { planStyles as s } from "./styles";
import { MEAT_CATEGORIES, MEAT_CUTS_BY_CATEGORY, isProduce, type MeatCut } from "@/constants/meatCuts";
import {
  useListCustomMeatCuts,
  useDeleteCustomMeatCut,
  useUpdateCustomMeatCut,
  useListGrills,
  useGetTechniquePresets,
  useListUserTechniquePresets,
  useCreateUserTechniquePreset,
  useDeleteUserTechniquePreset,
  getListCustomMeatCutsQueryKey,
  type TechniquePreset,
  type UserTechniquePreset,
} from "@workspace/api-client-react";
import { SizeInputRow, type SizeInputRowOutput } from "@/components/plan-screen/SizeInputRow";
import {
  QP_COOK_METHODS, type QpCookMethod,
  QP_MEAT_START_TEMPS, type QpMeatStartTemp,
  QP_INJECTION_OPTIONS, type QpInjectionOption,
  QP_SPRITZ_FREQUENCIES, type QpSpritzFrequency,
  QP_WRAP_FINISH_OPTIONS, type QpWrapFinishOption,
} from "@/constants/cookQuickPicks";
import { type ThawMethod } from "@/components/plan-screen/frozenSchedule";

type AnyThawMethod = ThawMethod | "microwave" | "counter" | "cook_from_frozen";

const COOK_METHOD_STORAGE_PREFIX = "@knowyourpit:cookMethod:";
const MEAT_START_TEMP_STORAGE_PREFIX = "@knowyourpit:meatStartTemp:";
const INJECTION_STORAGE_PREFIX = "@knowyourpit:injection:";
const SPRITZ_STORAGE_PREFIX = "@knowyourpit:spritz:";
const WRAP_FINISH_STORAGE_PREFIX = "@knowyourpit:wrapFinish:";

async function loadLastCookMethod(cutName: string): Promise<QpCookMethod | null> {
  try {
    const stored = await AsyncStorage.getItem(COOK_METHOD_STORAGE_PREFIX + cutName);
    if (stored && (QP_COOK_METHODS as readonly string[]).includes(stored)) return stored as QpCookMethod;
  } catch {}
  return null;
}
async function saveLastCookMethod(cutName: string, method: QpCookMethod): Promise<void> {
  try { await AsyncStorage.setItem(COOK_METHOD_STORAGE_PREFIX + cutName, method); } catch {}
}

async function loadLastMeatStartTemp(cutName: string): Promise<QpMeatStartTemp | null> {
  try {
    const stored = await AsyncStorage.getItem(MEAT_START_TEMP_STORAGE_PREFIX + cutName);
    if (stored && (QP_MEAT_START_TEMPS as readonly string[]).includes(stored)) return stored as QpMeatStartTemp;
  } catch {}
  return null;
}
async function saveLastMeatStartTemp(cutName: string, v: QpMeatStartTemp): Promise<void> {
  try { await AsyncStorage.setItem(MEAT_START_TEMP_STORAGE_PREFIX + cutName, v); } catch {}
}

async function loadLastInjection(cutName: string): Promise<QpInjectionOption | null> {
  try {
    const stored = await AsyncStorage.getItem(INJECTION_STORAGE_PREFIX + cutName);
    if (stored && (QP_INJECTION_OPTIONS as readonly string[]).includes(stored)) return stored as QpInjectionOption;
  } catch {}
  return null;
}
async function saveLastInjection(cutName: string, v: QpInjectionOption): Promise<void> {
  try { await AsyncStorage.setItem(INJECTION_STORAGE_PREFIX + cutName, v); } catch {}
}

async function loadLastSpritz(cutName: string): Promise<QpSpritzFrequency | null> {
  try {
    const stored = await AsyncStorage.getItem(SPRITZ_STORAGE_PREFIX + cutName);
    if (stored && (QP_SPRITZ_FREQUENCIES as readonly string[]).includes(stored)) return stored as QpSpritzFrequency;
  } catch {}
  return null;
}
async function saveLastSpritz(cutName: string, v: QpSpritzFrequency): Promise<void> {
  try { await AsyncStorage.setItem(SPRITZ_STORAGE_PREFIX + cutName, v); } catch {}
}

async function loadLastWrapFinish(cutName: string): Promise<QpWrapFinishOption | null> {
  try {
    const stored = await AsyncStorage.getItem(WRAP_FINISH_STORAGE_PREFIX + cutName);
    if (stored && (QP_WRAP_FINISH_OPTIONS as readonly string[]).includes(stored)) return stored as QpWrapFinishOption;
  } catch {}
  return null;
}
async function saveLastWrapFinish(cutName: string, v: QpWrapFinishOption): Promise<void> {
  try { await AsyncStorage.setItem(WRAP_FINISH_STORAGE_PREFIX + cutName, v); } catch {}
}

type Colors = any;

type PickerCut = MeatCut & { isCustom?: boolean; customId?: number };

const EMPTY_SIZE_OUTPUT: SizeInputRowOutput = {
  effectiveWeightLbs: null,
  sizingLabel: null,
  isEstimated: false,
  pieceCount: null,
  mode: "weight",
};

const THAW_CHIPS: { value: AnyThawMethod; label: string }[] = [
  { value: "fridge", label: "Refrigerator  (~24h / 4–5 lbs)" },
  { value: "cold_water", label: "Cold Water  (~1h per lb)" },
  { value: "microwave", label: "Microwave  (cook immediately)" },
  { value: "counter", label: "Counter Thaw" },
  { value: "cook_from_frozen", label: "Cook from Frozen  (+~50% time)" },
];

export interface MultiItem {
  cut: MeatCut;
  sizeOutput: SizeInputRowOutput;
  grillId: number | null;
  cookMethod: QpCookMethod | null;
  meatStartTemp: QpMeatStartTemp | null;
  injection: QpInjectionOption | null;
  spritz: QpSpritzFrequency | null;
  wrapFinish: QpWrapFinishOption | null;
  isFrozen: boolean;
  thawMethod: AnyThawMethod;
  notes?: string;
  targetTempF: string;
  cookTempF: string;
  cookingStylePreset?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  multiAddCat: string;
  setMultiAddCat: (cat: string) => void;
  multiPickedCut: MeatCut | null;
  setMultiPickedCut: (c: MeatCut | null) => void;
  setMultiItems: (updater: (prev: MultiItem[]) => MultiItem[]) => void;
  editItem?: MultiItem | null;
  editIndex?: number | null;
  effectivePro?: boolean;
  frozenTrialAvailable?: boolean;
  showPaywall?: (opts: any) => void;
}

function ChipRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
  colors,
}: {
  label: string;
  options: readonly T[];
  selected: T | null;
  onSelect: (v: T | null) => void;
  colors: Colors;
}) {
  return (
    <View>
      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {options.map(option => {
            const active = selected === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  onSelect(active ? null : option);
                  Haptics.selectionAsync();
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary + "18" : colors.muted,
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: active ? colors.primary : colors.mutedForeground }}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export function MultiCookAddItemModal(p: Props) {
  const {
    visible, onClose, colors, multiAddCat, setMultiAddCat,
    multiPickedCut, setMultiPickedCut, setMultiItems,
    editItem, editIndex,
    effectivePro = false,
    frozenTrialAvailable = false,
    showPaywall = () => {},
  } = p;

  const isEditMode = editIndex != null && editItem != null;

  const qc = useQueryClient();
  const { data: customCutsData } = useListCustomMeatCuts();
  const deleteCustomCut = useDeleteCustomMeatCut();
  const updateCustomCut = useUpdateCustomMeatCut();
  const customCuts: any[] = Array.isArray(customCutsData) ? customCutsData : [];

  const { data: grillsList } = useListGrills();
  const grills: any[] = Array.isArray(grillsList) ? grillsList : [];

  const cutsForCategory = useMemo((): PickerCut[] => {
    const builtin: PickerCut[] = (MEAT_CUTS_BY_CATEGORY[multiAddCat] ?? []).map(c => ({ ...c }));
    const customs: PickerCut[] = customCuts
      .filter((c: any) => c.category === multiAddCat)
      .map((c: any) => ({
        name: c.name,
        category: c.category,
        targetTempF: c.targetTempF,
        cookTempF: c.cookTempF,
        minsPerLb: c.minsPerLb,
        restMins: c.restMins,
        cookMethod: c.cookMethod ?? undefined,
        notes: c.notes ?? undefined,
        isCustom: true as const,
        customId: c.id as number,
      }));
    return [...customs, ...builtin];
  }, [customCuts, multiAddCat]);

  // ── Technique presets — fetched once, filtered client-side ───────────
  const { data: allPresets } = useGetTechniquePresets(
    {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { staleTime: 10 * 60 * 1000 } as any },
  );
  const cutPresets = useMemo(
    () => allPresets?.filter(p => p.cutName === multiPickedCut?.name) ?? [],
    [allPresets, multiPickedCut?.name],
  );

  // ── User-created custom technique presets ─────────────────────────────
  const { data: allUserPresets, refetch: refetchUserPresets } = useListUserTechniquePresets(
    {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { staleTime: 5 * 60 * 1000 } as any },
  );
  const cutUserPresets = useMemo(
    () => allUserPresets?.filter(p => p.cutName === multiPickedCut?.name) ?? [],
    [allUserPresets, multiPickedCut?.name],
  );
  const createUserPreset = useCreateUserTechniquePreset();
  const deleteUserPreset = useDeleteUserTechniquePreset();
  const [savePresetModalVisible, setSavePresetModalVisible] = useState(false);
  const [savePresetLabel, setSavePresetLabel] = useState("");
  const [savePresetSaving, setSavePresetSaving] = useState(false);

  // ── Item fields ──────────────────────────────────────────────────────
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [selectedCookMethod, setSelectedCookMethod] = useState<QpCookMethod | null>(null);
  const [lastUsedMethod, setLastUsedMethod] = useState<QpCookMethod | null>(null);
  const [selectedMeatStartTemp, setSelectedMeatStartTemp] = useState<QpMeatStartTemp | null>(null);
  const [selectedInjection, setSelectedInjection] = useState<QpInjectionOption | null>(null);
  const [selectedSpritz, setSelectedSpritz] = useState<QpSpritzFrequency | null>(null);
  const [selectedWrapFinish, setSelectedWrapFinish] = useState<QpWrapFinishOption | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [thawMethod, setThawMethod] = useState<AnyThawMethod>("fridge");
  const [itemNotes, setItemNotes] = useState("");
  const [selectedGrillId, setSelectedGrillId] = useState<number | null>(null);
  const [targetTempFInput, setTargetTempFInput] = useState("");
  const [cookTempFInput, setCookTempFInput] = useState("");
  const [localSizeOutput, setLocalSizeOutput] = useState<SizeInputRowOutput>(EMPTY_SIZE_OUTPUT);

  // ── Custom cut editor ─────────────────────────────────────────────────
  const [cutEditorVisible, setCutEditorVisible] = useState(false);
  const [editingCutId, setEditingCutId] = useState<number | null>(null);
  const [ccName, setCcName] = useState("");
  const [ccCategory, setCcCategory] = useState("Beef");
  const [ccTargetTempF, setCcTargetTempF] = useState("");
  const [ccCookTempF, setCcCookTempF] = useState("");
  const [ccMinsPerLb, setCcMinsPerLb] = useState("");
  const [ccRestMins, setCcRestMins] = useState("");
  const [ccCookMethod, setCcCookMethod] = useState("");

  const openCutEditor = (cut: PickerCut) => {
    setEditingCutId(cut.customId ?? null);
    setCcName(cut.name);
    setCcCategory(cut.category);
    setCcTargetTempF(String(cut.targetTempF));
    setCcCookTempF(String(cut.cookTempF));
    setCcMinsPerLb(String(cut.minsPerLb));
    setCcRestMins(String(cut.restMins));
    setCcCookMethod(cut.cookMethod ?? "");
    setCutEditorVisible(true);
  };

  const saveCutEdit = async () => {
    const name = ccName.trim();
    const targetT = parseFloat(ccTargetTempF);
    const cookT = parseFloat(ccCookTempF);
    const mpl = parseFloat(ccMinsPerLb);
    const rm = parseInt(ccRestMins, 10);
    if (!name) { Alert.alert("Name required", "Give your cut a name."); return; }
    if (isNaN(targetT) || isNaN(cookT) || isNaN(mpl) || isNaN(rm)) {
      Alert.alert("Numbers required", "Target temp, pit temp, mins/lb, and rest mins must be numbers.");
      return;
    }
    try {
      await updateCustomCut.mutateAsync({
        id: editingCutId!,
        data: { name, category: ccCategory, targetTempF: targetT, cookTempF: cookT, minsPerLb: mpl, restMins: rm, cookMethod: ccCookMethod.trim() || null },
      });
      qc.invalidateQueries({ queryKey: getListCustomMeatCutsQueryKey() });
      setCutEditorVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Save failed", "Could not save the custom cut.");
    }
  };

  const editWeightForPrefill = useMemo(() => {
    if (isEditMode && editItem.cut.name === multiPickedCut?.name) {
      return editItem.sizeOutput.effectiveWeightLbs;
    }
    return null;
  }, [isEditMode, editItem?.cut.name, multiPickedCut?.name, editItem?.sizeOutput.effectiveWeightLbs]);

  useEffect(() => {
    if (!multiPickedCut) {
      setActivePreset(null);
      setSelectedCookMethod(null);
      setLastUsedMethod(null);
      setSelectedMeatStartTemp(null);
      setSelectedInjection(null);
      setSelectedSpritz(null);
      setSelectedWrapFinish(null);
      setIsFrozen(false);
      setThawMethod("fridge");
      setItemNotes("");
      setSelectedGrillId(null);
      setTargetTempFInput("");
      setCookTempFInput("");
      setLocalSizeOutput(EMPTY_SIZE_OUTPUT);
      return;
    }

    if (isEditMode && editItem.cut.name === multiPickedCut.name) {
      setActivePreset(editItem.cookingStylePreset ?? null);
      setSelectedCookMethod(editItem.cookMethod);
      setLastUsedMethod(null);
      setSelectedMeatStartTemp(editItem.meatStartTemp);
      setSelectedInjection(editItem.injection);
      setSelectedSpritz(editItem.spritz);
      setSelectedWrapFinish(editItem.wrapFinish);
      setIsFrozen(editItem.isFrozen);
      setThawMethod(editItem.thawMethod);
      setItemNotes(editItem.notes ?? "");
      setSelectedGrillId(editItem.grillId);
      setTargetTempFInput(editItem.targetTempF);
      setCookTempFInput(editItem.cookTempF);
      return;
    }

    setActivePreset(null);
    loadLastCookMethod(multiPickedCut.name).then(method => {
      setSelectedCookMethod(method);
      setLastUsedMethod(method);
    });
    loadLastMeatStartTemp(multiPickedCut.name).then(v => setSelectedMeatStartTemp(v));
    loadLastInjection(multiPickedCut.name).then(v => setSelectedInjection(v));
    loadLastSpritz(multiPickedCut.name).then(v => setSelectedSpritz(v));
    loadLastWrapFinish(multiPickedCut.name).then(v => setSelectedWrapFinish(v));
    setIsFrozen(false);
    setThawMethod("fridge");
    setSelectedGrillId(null);
    setTargetTempFInput("");
    setCookTempFInput("");
    setLocalSizeOutput(EMPTY_SIZE_OUTPUT);
  }, [multiPickedCut?.name, editItem]);

  const hasAnyQuickPick = !!(selectedCookMethod || selectedInjection || selectedSpritz || selectedWrapFinish || selectedMeatStartTemp);

  const handleSavePreset = async () => {
    if (!multiPickedCut || !savePresetLabel.trim()) return;
    setSavePresetSaving(true);
    try {
      await createUserPreset.mutateAsync({
        data: {
          cutName: multiPickedCut.name,
          label: savePresetLabel.trim(),
          cookMethod: selectedCookMethod ?? null,
          wrapFinish: selectedWrapFinish ?? null,
          spritzFrequency: selectedSpritz ?? null,
          injection: selectedInjection ?? null,
          cookTempF: cookTempFInput ? Number(cookTempFInput) : null,
          targetTempF: targetTempFInput ? Number(targetTempFInput) : null,
        },
      });
      await refetchUserPresets();
      setSavePresetModalVisible(false);
      setSavePresetLabel("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not save preset. Please try again.");
    } finally {
      setSavePresetSaving(false);
    }
  };

  const handleDeleteUserPreset = (preset: UserTechniquePreset) => {
    Alert.alert(
      "Delete Preset",
      `Delete "${preset.label}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUserPreset.mutateAsync({ id: preset.id });
              await refetchUserPresets();
              if (activePreset === preset.label) setActivePreset(null);
              Haptics.selectionAsync();
            } catch {
              Alert.alert("Error", "Could not delete preset.");
            }
          },
        },
      ],
    );
  };

  const resetFields = () => {
    setActivePreset(null);
    setSelectedCookMethod(null);
    setLastUsedMethod(null);
    setSelectedMeatStartTemp(null);
    setSelectedInjection(null);
    setSelectedSpritz(null);
    setSelectedWrapFinish(null);
    setIsFrozen(false);
    setThawMethod("fridge");
    setItemNotes("");
    setSelectedGrillId(null);
    setTargetTempFInput("");
    setCookTempFInput("");
    setLocalSizeOutput(EMPTY_SIZE_OUTPUT);
  };

  const handleClose = () => {
    resetFields();
    onClose();
  };

  const handleSave = () => {
    if (!multiPickedCut) return;

    if (selectedCookMethod) {
      saveLastCookMethod(multiPickedCut.name, selectedCookMethod);
    }

    const newItem: MultiItem = {
      cut: multiPickedCut,
      sizeOutput: localSizeOutput,
      grillId: selectedGrillId,
      cookMethod: selectedCookMethod,
      meatStartTemp: selectedMeatStartTemp,
      injection: selectedInjection,
      spritz: selectedSpritz,
      wrapFinish: selectedWrapFinish,
      isFrozen,
      thawMethod,
      notes: itemNotes.trim() || undefined,
      targetTempF: targetTempFInput,
      cookTempF: cookTempFInput,
      cookingStylePreset: activePreset ?? undefined,
    };

    if (isEditMode) {
      setMultiItems(prev => prev.map((it, i) => i === editIndex ? newItem : it));
    } else {
      setMultiItems(prev => [...prev, newItem]);
    }

    resetFields();
    onClose();
    setMultiPickedCut(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteCustomCut = (cut: PickerCut) => {
    if (!cut.customId) return;
    Alert.alert(
      "Delete custom cut?",
      `Remove "${cut.name}" from your custom cuts.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCustomCut.mutateAsync({ id: cut.customId! });
              if (multiPickedCut?.name === cut.name) setMultiPickedCut(null);
            } catch {
              Alert.alert("Delete failed", "Could not delete the custom cut.");
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <AppKeyboardAvoidingView style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>
                {isEditMode ? "Edit Item" : "Add Item"}
              </Text>
              <Pressable onPress={handleClose} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {!multiPickedCut ? (
              <>
                <View style={s.catTabRow}>
                  {MEAT_CATEGORIES.map(cat => (
                    <Pressable
                      key={cat}
                      onPress={() => setMultiAddCat(cat)}
                      style={[s.catTab, { backgroundColor: multiAddCat === cat ? colors.primary : colors.muted, borderRadius: 20 }]}
                    >
                      <Text style={[s.catTabText, { color: multiAddCat === cat ? "#fff" : colors.mutedForeground }]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
                <FlatList
                  style={{ flex: 1 }}
                  data={cutsForCategory}
                  keyExtractor={item => item.name}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
                  ItemSeparatorComponent={() => <View style={[s.cutSep, { backgroundColor: colors.border }]} />}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => setMultiPickedCut(item)}
                      style={({ pressed }) => [
                        s.cutRow,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[s.cutName, { color: colors.foreground }]}>{item.name}</Text>
                          {item.isCustom && (
                            <View style={{ backgroundColor: colors.primary + "20", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.primary }}>Custom</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[s.cutMeta, { color: colors.mutedForeground }]}>
                          {item.targetTempF === 0
                            ? `Time-based · Pit: ${item.cookTempF}°F · ~${item.minsPerLb} min/lb`
                            : `Internal target ${item.targetTempF}°F · Pit: ${item.cookTempF}°F · ~${item.minsPerLb} min/lb`}
                        </Text>
                      </View>
                      {item.isCustom && (
                        <View style={{ flexDirection: "row", gap: 2 }}>
                          <Pressable
                            onPress={() => openCutEditor(item)}
                            hitSlop={10}
                            style={{ padding: 6 }}
                          >
                            <Feather name="edit-2" size={14} color={colors.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteCustomCut(item)}
                            hitSlop={10}
                            style={{ padding: 6 }}
                          >
                            <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                          </Pressable>
                        </View>
                      )}
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  )}
                />
              </>
            ) : (
              <>
                {/* Selected cut header — tap to change selection */}
                <Pressable
                  onPress={() => setMultiPickedCut(null)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: pressed ? colors.muted : colors.primary + "10",
                  })}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
                    <Feather name="check" size={14} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>{multiPickedCut.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                      {multiPickedCut.targetTempF === 0
                        ? `Time-based · Pit: ${multiPickedCut.cookTempF}°F`
                        : `Target ${multiPickedCut.targetTempF}°F · Pit: ${multiPickedCut.cookTempF}°F`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.muted, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>Change</Text>
                    <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
                  </View>
                </Pressable>
                <ScrollView
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ padding: 14, gap: 12 }}
                >
                {/* Size input */}
                <View>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Size
                  </Text>
                  <SizeInputRow
                    cut={multiPickedCut}
                    colors={colors}
                    onChange={setLocalSizeOutput}
                    detectedWeightLbs={editWeightForPrefill}
                  />
                </View>

                {/* Grill picker */}
                {grills.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Grill (optional)
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {grills.map((g: any) => {
                          const active = selectedGrillId === g.id;
                          return (
                            <Pressable
                              key={g.id}
                              onPress={() => {
                                setSelectedGrillId(active ? null : g.id);
                                Haptics.selectionAsync();
                              }}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: active ? colors.primary : colors.border,
                                backgroundColor: active ? colors.primary + "18" : colors.muted,
                              }}
                            >
                              <Feather name="wind" size={12} color={active ? colors.primary : colors.mutedForeground} />
                              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: active ? colors.primary : colors.mutedForeground }}>
                                {g.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {/* Target temp + Cook temp overrides */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {isProduce(multiPickedCut.category) ? (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Internal Target
                      </Text>
                      <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                        <Text style={[s.input, { color: colors.mutedForeground, paddingVertical: 12 }]}>Time-based</Text>
                      </View>
                    </View>
                  ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Target Temp
                    </Text>
                    <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                      <TextInput
                        style={[s.input, { color: colors.foreground }]}
                        placeholder={String(multiPickedCut.targetTempF)}
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                        value={targetTempFInput}
                        onChangeText={(v) => { setTargetTempFInput(v); setActivePreset(null); }}
                      />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginRight: 10 }}>°F</Text>
                    </View>
                  </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Pit Temp
                    </Text>
                    <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                      <TextInput
                        style={[s.input, { color: colors.foreground }]}
                        placeholder={String(multiPickedCut.cookTempF)}
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                        value={cookTempFInput}
                        onChangeText={(v) => { setCookTempFInput(v); setActivePreset(null); }}
                      />
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginRight: 10 }}>°F</Text>
                    </View>
                  </View>
                </View>

                {/* Cooking style presets */}
                {((cutUserPresets && cutUserPresets.length > 0) || (cutPresets && cutPresets.length > 0)) && (
                  <View>
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Cooking Style
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {cutUserPresets.map((preset: UserTechniquePreset) => {
                          const active = activePreset === preset.label;
                          return (
                            <View key={`user-${preset.id}`} style={{ flexDirection: "row", alignItems: "center" }}>
                              <Pressable
                                onPress={() => {
                                  if (active) {
                                    setActivePreset(null);
                                    return;
                                  }
                                  setActivePreset(preset.label);
                                  if (preset.cookMethod && (QP_COOK_METHODS as readonly string[]).includes(preset.cookMethod)) {
                                    setSelectedCookMethod(preset.cookMethod as QpCookMethod);
                                  }
                                  if (preset.injection && (QP_INJECTION_OPTIONS as readonly string[]).includes(preset.injection)) {
                                    setSelectedInjection(preset.injection as QpInjectionOption);
                                  }
                                  if (preset.spritzFrequency && (QP_SPRITZ_FREQUENCIES as readonly string[]).includes(preset.spritzFrequency)) {
                                    setSelectedSpritz(preset.spritzFrequency as QpSpritzFrequency);
                                  }
                                  if (preset.wrapFinish && (QP_WRAP_FINISH_OPTIONS as readonly string[]).includes(preset.wrapFinish)) {
                                    setSelectedWrapFinish(preset.wrapFinish as QpWrapFinishOption);
                                  }
                                  if (preset.cookTempF != null) setCookTempFInput(String(preset.cookTempF));
                                  if (preset.targetTempF != null) setTargetTempFInput(String(preset.targetTempF));
                                  Haptics.selectionAsync();
                                }}
                                style={{
                                  paddingLeft: 14,
                                  paddingRight: 6,
                                  paddingVertical: 8,
                                  borderRadius: 20,
                                  borderTopRightRadius: 0,
                                  borderBottomRightRadius: 0,
                                  borderWidth: 1,
                                  borderRightWidth: 0,
                                  borderColor: active ? colors.primary : colors.border,
                                  backgroundColor: active ? colors.primary + "18" : colors.muted,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Feather name="bookmark" size={11} color={active ? colors.primary : colors.mutedForeground} />
                                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: active ? colors.primary : colors.mutedForeground }}>
                                  {preset.label}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleDeleteUserPreset(preset)}
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 8,
                                  borderRadius: 20,
                                  borderTopLeftRadius: 0,
                                  borderBottomLeftRadius: 0,
                                  borderWidth: 1,
                                  borderLeftWidth: 0,
                                  borderColor: active ? colors.primary : colors.border,
                                  backgroundColor: active ? colors.primary + "18" : colors.muted,
                                }}
                              >
                                <Feather name="x" size={12} color={colors.mutedForeground} />
                              </Pressable>
                            </View>
                          );
                        })}
                        {cutPresets.map((preset: TechniquePreset) => {
                          const active = activePreset === preset.label;
                          return (
                            <Pressable
                              key={preset.id}
                              onPress={() => {
                                if (active) {
                                  setActivePreset(null);
                                  return;
                                }
                                setActivePreset(preset.label);
                                if (preset.cookMethod && (QP_COOK_METHODS as readonly string[]).includes(preset.cookMethod)) {
                                  setSelectedCookMethod(preset.cookMethod as QpCookMethod);
                                }
                                if (preset.injection && (QP_INJECTION_OPTIONS as readonly string[]).includes(preset.injection)) {
                                  setSelectedInjection(preset.injection as QpInjectionOption);
                                }
                                if (preset.spritzFrequency && (QP_SPRITZ_FREQUENCIES as readonly string[]).includes(preset.spritzFrequency)) {
                                  setSelectedSpritz(preset.spritzFrequency as QpSpritzFrequency);
                                }
                                if (preset.wrapFinish && (QP_WRAP_FINISH_OPTIONS as readonly string[]).includes(preset.wrapFinish)) {
                                  setSelectedWrapFinish(preset.wrapFinish as QpWrapFinishOption);
                                }
                                if (preset.cookTempF != null) setCookTempFInput(String(preset.cookTempF));
                                if (preset.targetTempF != null) setTargetTempFInput(String(preset.targetTempF));
                                Haptics.selectionAsync();
                              }}
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: active ? colors.primary : colors.border,
                                backgroundColor: active ? colors.primary + "18" : colors.muted,
                              }}
                            >
                              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: active ? colors.primary : colors.mutedForeground }}>
                                {preset.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {/* Cooking method chips */}
                <View>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Cooking Method
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {QP_COOK_METHODS.map(method => {
                        const active = selectedCookMethod === method;
                        const showLastUsed = lastUsedMethod === method && active;
                        return (
                          <Pressable
                            key={method}
                            onPress={() => {
                              const next = active ? null : method;
                              setSelectedCookMethod(next);
                              setActivePreset(null);
                              setLastUsedMethod(null);
                              if (multiPickedCut && next) {
                                saveLastCookMethod(multiPickedCut.name, next);
                              }
                              Haptics.selectionAsync();
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: showLastUsed ? 5 : 7,
                              borderRadius: 20,
                              borderWidth: 1,
                              borderColor: active ? colors.primary : colors.border,
                              backgroundColor: active ? colors.primary + "18" : colors.muted,
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: active ? colors.primary : colors.mutedForeground }}>
                              {method}
                            </Text>
                            {showLastUsed && (
                              <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: colors.primary, opacity: 0.75, marginTop: 1 }}>
                                Last used
                              </Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* Meat start temp chips */}
                <ChipRow
                  label="Meat Starting Temp"
                  options={QP_MEAT_START_TEMPS}
                  selected={selectedMeatStartTemp}
                  colors={colors}
                  onSelect={(v) => {
                    setSelectedMeatStartTemp(v);
                    setActivePreset(null);
                    if (multiPickedCut && v) saveLastMeatStartTemp(multiPickedCut.name, v);
                  }}
                />

                {/* Injection chips */}
                <ChipRow
                  label="Injection"
                  options={QP_INJECTION_OPTIONS}
                  selected={selectedInjection}
                  colors={colors}
                  onSelect={(v) => {
                    setSelectedInjection(v);
                    setActivePreset(null);
                    if (multiPickedCut && v) saveLastInjection(multiPickedCut.name, v);
                  }}
                />

                {/* Spritz chips */}
                <ChipRow
                  label="Spritz"
                  options={QP_SPRITZ_FREQUENCIES}
                  selected={selectedSpritz}
                  colors={colors}
                  onSelect={(v) => {
                    setSelectedSpritz(v);
                    setActivePreset(null);
                    if (multiPickedCut && v) saveLastSpritz(multiPickedCut.name, v);
                  }}
                />

                {/* Wrap / finish chips */}
                <ChipRow
                  label="Wrap / Finish"
                  options={QP_WRAP_FINISH_OPTIONS}
                  selected={selectedWrapFinish}
                  colors={colors}
                  onSelect={(v) => {
                    setSelectedWrapFinish(v);
                    setActivePreset(null);
                    if (multiPickedCut && v) saveLastWrapFinish(multiPickedCut.name, v);
                  }}
                />

                {/* Save as preset */}
                {multiPickedCut && hasAnyQuickPick && (
                  <Pressable
                    onPress={() => { setSavePresetLabel(""); setSavePresetModalVisible(true); }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      alignSelf: "flex-start",
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.muted,
                    }}
                  >
                    <Feather name="bookmark" size={13} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                      Save as preset
                    </Text>
                  </Pressable>
                )}

                {/* From Freezer toggle — not shown for produce (no thaw needed) */}
                {!isProduce(multiPickedCut.category) && (
                <View style={{ borderRadius: 10, borderWidth: 1, borderColor: isFrozen ? "#3B82F660" : colors.border, backgroundColor: colors.background, paddingHorizontal: 12, overflow: "hidden" }}>
                  <Pressable
                    onPress={() => {
                      if (isFrozen) {
                        setIsFrozen(false);
                        Haptics.selectionAsync();
                        return;
                      }
                      if (!effectivePro && !frozenTrialAvailable) {
                        showPaywall({ trigger: "frozen_timeline_limit_reached", featureName: "Frozen-to-Table Timeline" });
                        return;
                      }
                      setIsFrozen(true);
                      Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 11,
                        gap: 10,
                        minHeight: 44,
                        borderBottomWidth: isFrozen ? 0.5 : 0,
                        borderBottomColor: colors.border,
                      },
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: "#3B82F620", alignItems: "center", justifyContent: "center" }}>
                      <Feather name="cloud-snow" size={14} color="#3B82F6" />
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                      Starting from frozen?
                    </Text>
                    {!effectivePro && !frozenTrialAvailable && (
                      <View style={s.proPill}>
                        <Feather name="star" size={9} color="#fff" />
                        <Text style={s.proPillText}>PRO</Text>
                      </View>
                    )}
                    <View style={[s.toggleTrack, { backgroundColor: isFrozen ? "#3B82F6" : colors.muted, borderColor: isFrozen ? "#3B82F6" : colors.border }]}>
                      <View style={[s.toggleThumb, { backgroundColor: "#fff", transform: [{ translateX: isFrozen ? 18 : 0 }] }]} />
                    </View>
                  </Pressable>
                  {isFrozen && (
                    <View style={{ paddingBottom: 12, paddingTop: 8 }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Thaw Method
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {THAW_CHIPS.map(opt => {
                            const active = thawMethod === opt.value;
                            return (
                              <Pressable
                                key={opt.value}
                                onPress={() => { setThawMethod(opt.value); Haptics.selectionAsync(); }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 20,
                                  borderWidth: 1,
                                  borderColor: active ? "#3B82F6" : colors.border,
                                  backgroundColor: active ? "#3B82F620" : colors.muted,
                                }}
                              >
                                <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: active ? "#3B82F6" : colors.mutedForeground }}>
                                  {opt.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>
                )}

                {/* Notes */}
                <View>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Notes (optional)
                  </Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground, minHeight: 72, textAlignVertical: "top", paddingTop: 10 }]}
                      placeholder="Rub recipe, wood choice, injection brine, special instructions…"
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      value={itemNotes}
                      onChangeText={setItemNotes}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={handleSave}
                  style={[s.submitBtn, { backgroundColor: "#6C3BF5", borderRadius: colors.radius }]}
                >
                  <Feather name={isEditMode ? "check" : "plus"} size={16} color="#fff" />
                  <Text style={s.submitText}>
                    {isEditMode ? `Save ${multiPickedCut.name}` : `Add ${multiPickedCut.name}`}
                  </Text>
                </Pressable>
                </ScrollView>
              </>
            )}
          </View>
        </AppKeyboardAvoidingView>
      </Modal>

      {/* ── Custom cut editor (inner modal) ──────────────────────────── */}
      <Modal
        visible={cutEditorVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCutEditorVisible(false)}
      >
        <AppKeyboardAvoidingView style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card, maxHeight: "85%" }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Edit Custom Cut</Text>
              <Pressable onPress={() => setCutEditorVisible(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 14 }}
            >
              {[
                { label: "Name", value: ccName, set: setCcName, placeholder: "e.g. Wagyu Brisket", keyboard: "default" as const },
                { label: "Internal Target Temp (°F)", value: ccTargetTempF, set: setCcTargetTempF, placeholder: "e.g. 205", keyboard: "decimal-pad" as const },
                { label: "Pit Temp (°F)", value: ccCookTempF, set: setCcCookTempF, placeholder: "e.g. 225", keyboard: "decimal-pad" as const },
                { label: "Mins Per Lb", value: ccMinsPerLb, set: setCcMinsPerLb, placeholder: "e.g. 60", keyboard: "decimal-pad" as const },
                { label: "Rest Mins", value: ccRestMins, set: setCcRestMins, placeholder: "e.g. 60", keyboard: "decimal-pad" as const },
                { label: "Cook Method (optional)", value: ccCookMethod, set: setCcCookMethod, placeholder: "e.g. Low & Slow", keyboard: "default" as const },
              ].map(field => (
                <View key={field.label}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {field.label}
                  </Text>
                  <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <TextInput
                      style={[s.input, { color: colors.foreground }]}
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType={field.keyboard}
                      value={field.value}
                      onChangeText={field.set}
                    />
                  </View>
                </View>
              ))}
              <Pressable
                onPress={saveCutEdit}
                disabled={updateCustomCut.isPending}
                style={[s.submitBtn, { backgroundColor: "#6C3BF5", borderRadius: colors.radius, opacity: updateCustomCut.isPending ? 0.6 : 1 }]}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={s.submitText}>
                  {updateCustomCut.isPending ? "Saving…" : "Save Changes"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </AppKeyboardAvoidingView>
      </Modal>

      {/* ── Save Preset Modal ──────────────────────────────────────────── */}
      <Modal
        visible={savePresetModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSavePresetModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setSavePresetModalVisible(false)}
        />
        <AppKeyboardAvoidingView>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopWidth: 1,
              borderTopColor: colors.border + "60",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 8,
              paddingHorizontal: 18,
              paddingBottom: 40,
              gap: 14,
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.mutedForeground + "55", alignSelf: "center", marginBottom: 4 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>Save Preset</Text>
              <Pressable
                onPress={handleSavePreset}
                disabled={!savePresetLabel.trim() || savePresetSaving}
                style={{
                  backgroundColor: (!savePresetLabel.trim() || savePresetSaving) ? colors.muted : colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: (!savePresetLabel.trim() || savePresetSaving) ? colors.mutedForeground : "#fff" }}>
                  {savePresetSaving ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={{
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: colors.radius,
                color: colors.foreground,
                fontSize: 15,
                fontFamily: "Inter_400Regular",
                padding: 14,
              }}
              placeholder="e.g. My Overnight Style"
              placeholderTextColor={colors.mutedForeground}
              value={savePresetLabel}
              onChangeText={setSavePresetLabel}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSavePreset}
            />
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              Saves your current method, injection, spritz, wrap, and temperature settings as a one-tap preset for {multiPickedCut?.name ?? "this cut"}.
            </Text>
          </View>
        </AppKeyboardAvoidingView>
      </Modal>
    </>
  );
}
