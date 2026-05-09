import React from "react";
import { View, Text, Modal, Pressable, FlatList, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { planStyles as s } from "./styles";
import { MEAT_CATEGORIES, MEAT_CUTS_BY_CATEGORY, type MeatCut } from "@/constants/meatCuts";

type Colors = any;

interface MultiItem { cut: MeatCut; weightLbs: string; grillId: number | null; }

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
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Add Item</Text>
            <Pressable onPress={onClose} hitSlop={10}>
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
            data={MEAT_CUTS_BY_CATEGORY[multiAddCat] ?? []}
            keyExtractor={item => item.name}
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
                  setMultiItems(prev => [...prev, { cut: multiPickedCut, weightLbs: multiAddWeightInput, grillId: null }]);
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
      </View>
    </Modal>
  );
}
