import React from "react";
import { View, Text, Modal, Pressable, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import { planStyles as s } from "./styles";
import { MEAT_CATEGORIES, MEAT_CUTS_BY_CATEGORY, type MeatCut } from "@/constants/meatCuts";

type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  meatCategory: string;
  setMeatCategory: (cat: string) => void;
  selectedCut: MeatCut | null;
  handlePickCut: (cut: MeatCut) => void;
}

export function MeatPickerModal(p: Props) {
  const { visible, onClose, colors, meatCategory, setMeatCategory, selectedCut, handlePickCut } = p;
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
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Select a Food</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={s.catTabRow}>
            {MEAT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setMeatCategory(cat)}
                style={[
                  s.catTab,
                  {
                    backgroundColor: meatCategory === cat ? colors.primary : colors.muted,
                    borderRadius: 20,
                  },
                ]}
              >
                <Text
                  style={[
                    s.catTabText,
                    { color: meatCategory === cat ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>

          <FlatList
            data={MEAT_CUTS_BY_CATEGORY[meatCategory] ?? []}
            keyExtractor={(item) => item.name}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View style={[s.cutSep, { backgroundColor: colors.border }]} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handlePickCut(item)}
                style={({ pressed }) => [
                  s.cutRow,
                  pressed && { opacity: 0.7 },
                  selectedCut?.name === item.name && { backgroundColor: colors.primary + "12" },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.cutName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[s.cutMeta, { color: colors.mutedForeground }]}>
                    {item.targetTempF === 0
                      ? `Time-based · Pit: ${item.cookTempF}°F · ~${item.minsPerLb} min/lb`
                      : `Internal target ${item.targetTempF}°F · Pit: ${item.cookTempF}°F · ~${item.minsPerLb} min/lb`}
                  </Text>
                  {item.notes && (
                    <Text style={[s.cutNote, { color: colors.mutedForeground }]}>{item.notes}</Text>
                  )}
                </View>
                {selectedCut?.name === item.name && (
                  <Feather name="check-circle" size={18} color={colors.primary} />
                )}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
