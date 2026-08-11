import React, { useMemo, useState } from "react";
import { View, Text, Modal, Pressable, FlatList, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { planStyles as s } from "./styles";
import {
  MEAT_CATEGORIES,
  MEAT_CUTS_BY_CATEGORY,
  getGroupedCuts,
  type MeatCut,
} from "@/constants/meatCuts";

/** Flattened FlatList row: either a sub-group header or a cut. */
type PickerRow =
  | { type: "header"; title: string; key: string }
  | { type: "cut"; cut: MeatCut; key: string; showSep: boolean };

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

  const [search, setSearch] = useState("");

  // Reset the search whenever the modal is reopened so it starts fresh.
  React.useEffect(() => {
    if (!visible) setSearch("");
  }, [visible]);
  const query = search.trim().toLowerCase();
  const searching = query.length > 0;

  // Flatten grouped cuts into header + cut rows for the FlatList.
  // When searching, filter cuts by name across ALL categories and group the
  // matches under their category name; empty categories are hidden.
  const rows = useMemo<PickerRow[]>(() => {
    const out: PickerRow[] = [];
    if (searching) {
      for (const cat of MEAT_CATEGORIES) {
        const matches = (MEAT_CUTS_BY_CATEGORY[cat] ?? []).filter((cut) =>
          cut.name.toLowerCase().includes(query),
        );
        if (!matches.length) continue;
        out.push({ type: "header", title: cat, key: `h-${cat}` });
        matches.forEach((cut, i) =>
          out.push({ type: "cut", cut, key: cut.name, showSep: i > 0 }),
        );
      }
      return out;
    }
    const groups = getGroupedCuts(meatCategory);
    for (const g of groups) {
      if (g.title) out.push({ type: "header", title: g.title, key: `h-${g.title}` });
      g.cuts.forEach((cut, i) =>
        // Separator only between consecutive cut rows — never directly
        // under a sub-group header.
        out.push({ type: "cut", cut, key: cut.name, showSep: i > 0 }),
      );
    }
    return out;
  }, [meatCategory, searching, query]);

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

          <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.muted,
                borderRadius: 12,
                paddingHorizontal: 10,
              }}
            >
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                testID="meat-picker-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search all cuts…"
                placeholderTextColor={colors.mutedForeground}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  fontSize: 15,
                  color: colors.foreground,
                }}
              />
              {searching && (
                <Pressable onPress={() => setSearch("")} hitSlop={10} testID="meat-picker-search-clear">
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          </View>

          {!searching && (
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
          )}

          <FlatList
            data={rows}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
            ListEmptyComponent={
              searching ? (
                <Text
                  style={{
                    textAlign: "center",
                    paddingVertical: 32,
                    fontSize: 14,
                    color: colors.mutedForeground,
                  }}
                >
                  No cuts match “{search.trim()}”
                </Text>
              ) : null
            }
            renderItem={({ item: row }) => {
              if (row.type === "header") {
                return (
                  <View style={{ paddingTop: 14, paddingBottom: 6, paddingHorizontal: 2 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Inter_600SemiBold",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        color: colors.primary,
                      }}
                    >
                      {row.title}
                    </Text>
                  </View>
                );
              }
              const item = row.cut;
              return (
              <View>
              {row.showSep && <View style={[s.cutSep, { backgroundColor: colors.border }]} />}
              <Pressable
                testID={`meat-cut-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
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
              </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
