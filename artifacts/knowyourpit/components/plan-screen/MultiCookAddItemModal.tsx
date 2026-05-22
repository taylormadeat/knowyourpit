import React, { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { planStyles as s } from "./styles";
import { MEAT_CATEGORIES, MEAT_CUTS_BY_CATEGORY, type MeatCut } from "@/constants/meatCuts";
import {
  QP_COOK_METHODS, type QpCookMethod,
  QP_MEAT_START_TEMPS, type QpMeatStartTemp,
  QP_INJECTION_OPTIONS, type QpInjectionOption,
  QP_SPRITZ_FREQUENCIES, type QpSpritzFrequency,
  QP_WRAP_FINISH_OPTIONS, type QpWrapFinishOption,
} from "@/constants/cookQuickPicks";

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

export interface MultiItem {
  cut: MeatCut;
  weightLbs: string;
  grillId: number | null;
  cookMethod: QpCookMethod | null;
  meatStartTemp: QpMeatStartTemp | null;
  injection: QpInjectionOption | null;
  spritz: QpSpritzFrequency | null;
  wrapFinish: QpWrapFinishOption | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  multiAddCat: string;
  setMultiAddCat: (cat: string) => void;
  multiPickedCut: MeatCut | null;
  setMultiPickedCut: (c: MeatCut | null) => void;
  multiAddWeightInput: string;
  setMultiAddWeightInput: (v: string) => void;
  setMultiItems: (updater: (prev: MultiItem[]) => MultiItem[]) => void;
  editItem?: MultiItem | null;
  editIndex?: number | null;
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
    multiPickedCut, setMultiPickedCut, multiAddWeightInput, setMultiAddWeightInput, setMultiItems,
    editItem, editIndex,
  } = p;

  const isEditMode = editIndex != null && editItem != null;

  const [selectedCookMethod, setSelectedCookMethod] = useState<QpCookMethod | null>(null);
  const [lastUsedMethod, setLastUsedMethod] = useState<QpCookMethod | null>(null);
  const [selectedMeatStartTemp, setSelectedMeatStartTemp] = useState<QpMeatStartTemp | null>(null);
  const [selectedInjection, setSelectedInjection] = useState<QpInjectionOption | null>(null);
  const [selectedSpritz, setSelectedSpritz] = useState<QpSpritzFrequency | null>(null);
  const [selectedWrapFinish, setSelectedWrapFinish] = useState<QpWrapFinishOption | null>(null);

  useEffect(() => {
    if (!multiPickedCut) {
      setSelectedCookMethod(null);
      setLastUsedMethod(null);
      setSelectedMeatStartTemp(null);
      setSelectedInjection(null);
      setSelectedSpritz(null);
      setSelectedWrapFinish(null);
      return;
    }

    if (isEditMode && editItem.cut.name === multiPickedCut.name) {
      setSelectedCookMethod(editItem.cookMethod);
      setLastUsedMethod(null);
      setSelectedMeatStartTemp(editItem.meatStartTemp);
      setSelectedInjection(editItem.injection);
      setSelectedSpritz(editItem.spritz);
      setSelectedWrapFinish(editItem.wrapFinish);
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
  }, [multiPickedCut?.name, editItem]);

  const resetFields = () => {
    setSelectedCookMethod(null);
    setLastUsedMethod(null);
    setSelectedMeatStartTemp(null);
    setSelectedInjection(null);
    setSelectedSpritz(null);
    setSelectedWrapFinish(null);
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
      weightLbs: multiAddWeightInput,
      grillId: isEditMode ? editItem.grillId : null,
      cookMethod: selectedCookMethod,
      meatStartTemp: selectedMeatStartTemp,
      injection: selectedInjection,
      spritz: selectedSpritz,
      wrapFinish: selectedWrapFinish,
    };

    if (isEditMode) {
      setMultiItems(prev => prev.map((it, i) => i === editIndex ? newItem : it));
    } else {
      setMultiItems(prev => [...prev, newItem]);
    }

    resetFields();
    onClose();
    setMultiPickedCut(null);
    setMultiAddWeightInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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
            data={MEAT_CUTS_BY_CATEGORY[multiAddCat] ?? []}
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
                  <Text style={[s.cutName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[s.cutMeta, { color: colors.mutedForeground }]}>
                    Internal target {item.targetTempF}°F · Pit: {item.cookTempF}°F · ~{item.minsPerLb} min/lb
                  </Text>
                </View>
                {multiPickedCut?.name === item.name && (
                  <Feather name="check-circle" size={18} color={colors.primary} />
                )}
              </Pressable>
            )}
          />
          {multiPickedCut && (
            <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 }}>
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

              <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                <TextInput
                  style={[s.input, { color: colors.foreground }]}
                  placeholder={`Weight in lbs (optional)`}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  value={multiAddWeightInput}
                  onChangeText={setMultiAddWeightInput}
                />
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
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
