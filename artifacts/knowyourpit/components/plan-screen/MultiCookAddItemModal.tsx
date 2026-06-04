import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Modal, Pressable, FlatList, TextInput, ScrollView, Alert } from "react-native";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { planStyles as s } from "./styles";
import { MEAT_CATEGORIES, MEAT_CUTS_BY_CATEGORY, MEAT_CUTS, type MeatCut } from "@/constants/meatCuts";
import {
  useListCustomMeatCuts,
  useDeleteCustomMeatCut,
  useListGrills,
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
  thawMethod: ThawMethod;
  notes?: string;
  targetTempF: string;
  cookTempF: string;
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

  const { data: customCutsData } = useListCustomMeatCuts();
  const deleteCustomCut = useDeleteCustomMeatCut();
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

  const [selectedCookMethod, setSelectedCookMethod] = useState<QpCookMethod | null>(null);
  const [lastUsedMethod, setLastUsedMethod] = useState<QpCookMethod | null>(null);
  const [selectedMeatStartTemp, setSelectedMeatStartTemp] = useState<QpMeatStartTemp | null>(null);
  const [selectedInjection, setSelectedInjection] = useState<QpInjectionOption | null>(null);
  const [selectedSpritz, setSelectedSpritz] = useState<QpSpritzFrequency | null>(null);
  const [selectedWrapFinish, setSelectedWrapFinish] = useState<QpWrapFinishOption | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [thawMethod, setThawMethod] = useState<ThawMethod>("fridge");
  const [itemNotes, setItemNotes] = useState("");
  const [selectedGrillId, setSelectedGrillId] = useState<number | null>(null);
  const [targetTempFInput, setTargetTempFInput] = useState("");
  const [cookTempFInput, setCookTempFInput] = useState("");
  const [localSizeOutput, setLocalSizeOutput] = useState<SizeInputRowOutput>(EMPTY_SIZE_OUTPUT);

  const editWeightForPrefill = useMemo(() => {
    if (isEditMode && editItem.cut.name === multiPickedCut?.name) {
      return editItem.sizeOutput.effectiveWeightLbs;
    }
    return null;
  }, [isEditMode, editItem?.cut.name, multiPickedCut?.name, editItem?.sizeOutput.effectiveWeightLbs]);

  useEffect(() => {
    if (!multiPickedCut) {
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

  const resetFields = () => {
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
                  multiPickedCut?.name === item.name && { backgroundColor: colors.primary + "12" },
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
                    Internal target {item.targetTempF}°F · Pit: {item.cookTempF}°F · ~{item.minsPerLb} min/lb
                  </Text>
                </View>
                {item.isCustom && (
                  <Pressable
                    onPress={() => handleDeleteCustomCut(item)}
                    hitSlop={10}
                    style={{ padding: 6 }}
                  >
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                )}
                {multiPickedCut?.name === item.name && (
                  <Feather name="check-circle" size={18} color={colors.primary} />
                )}
              </Pressable>
            )}
          />
          {multiPickedCut && (
            <ScrollView
              style={{ maxHeight: 480 }}
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
                      onChangeText={setTargetTempFInput}
                    />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginRight: 10 }}>°F</Text>
                  </View>
                </View>
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
                      onChangeText={setCookTempFInput}
                    />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginRight: 10 }}>°F</Text>
                  </View>
                </View>
              </View>

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
                  if (multiPickedCut && v) saveLastWrapFinish(multiPickedCut.name, v);
                }}
              />

              {/* From Freezer toggle */}
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
                        {([
                          { value: "fridge" as ThawMethod, label: "Refrigerator  (~24h / 4–5 lbs)" },
                          { value: "cold_water" as ThawMethod, label: "Cold Water  (~1h per lb)" },
                        ] as const).map(opt => {
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
          )}
        </View>
      </AppKeyboardAvoidingView>
    </Modal>
  );
}
