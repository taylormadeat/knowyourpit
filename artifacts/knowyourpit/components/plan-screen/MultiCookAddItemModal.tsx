import React, { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { planStyles as s } from "./styles";
import { MEAT_CATEGORIES, MEAT_CUTS_BY_CATEGORY, type MeatCut } from "@/constants/meatCuts";
import { QP_COOK_METHODS, type QpCookMethod } from "@/constants/cookQuickPicks";

const COOK_METHOD_STORAGE_PREFIX = "@knowyourpit:cookMethod:";

async function loadLastCookMethod(cutName: string): Promise<QpCookMethod | null> {
  try {
    const stored = await AsyncStorage.getItem(COOK_METHOD_STORAGE_PREFIX + cutName);
    if (stored && (QP_COOK_METHODS as readonly string[]).includes(stored)) {
      return stored as QpCookMethod;
    }
  } catch {}
  return null;
}

async function saveLastCookMethod(cutName: string, method: QpCookMethod): Promise<void> {
  try {
    await AsyncStorage.setItem(COOK_METHOD_STORAGE_PREFIX + cutName, method);
  } catch {}
}

type Colors = any;

interface MultiItem { cut: MeatCut; weightLbs: string; grillId: number | null; cookMethod: QpCookMethod | null; }

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
}

export function MultiCookAddItemModal(p: Props) {
  const {
    visible, onClose, colors, multiAddCat, setMultiAddCat,
    multiPickedCut, setMultiPickedCut, multiAddWeightInput, setMultiAddWeightInput, setMultiItems,
  } = p;

  const [selectedCookMethod, setSelectedCookMethod] = useState<QpCookMethod | null>(null);

  useEffect(() => {
    if (!multiPickedCut) {
      setSelectedCookMethod(null);
      return;
    }
    loadLastCookMethod(multiPickedCut.name).then(method => {
      setSelectedCookMethod(method);
    });
  }, [multiPickedCut?.name]);

  const handleClose = () => {
    setSelectedCookMethod(null);
    onClose();
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
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Add Item</Text>
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
                      return (
                        <Pressable
                          key={method}
                          onPress={() => {
                            setSelectedCookMethod(active ? null : method);
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
                            {method}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

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
                onPress={() => {
                  if (selectedCookMethod) {
                    saveLastCookMethod(multiPickedCut.name, selectedCookMethod);
                  }
                  setMultiItems(prev => [...prev, { cut: multiPickedCut, weightLbs: multiAddWeightInput, grillId: null, cookMethod: selectedCookMethod }]);
                  setSelectedCookMethod(null);
                  onClose();
                  setMultiPickedCut(null);
                  setMultiAddWeightInput("");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[s.submitBtn, { backgroundColor: "#6C3BF5", borderRadius: colors.radius }]}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={s.submitText}>Add {multiPickedCut.name}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
