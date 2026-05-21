import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface OptionItem {
  label: string;
  value: string;
}

interface OptionBottomSheetProps {
  visible: boolean;
  title: string;
  options: readonly string[] | OptionItem[];
  selected: string | null;
  onChange: (value: string | null) => void;
  onClose: () => void;
  colors: any;
  allowDeselect?: boolean;
  lastUsed?: string | null;
}

function isOptionItem(o: string | OptionItem): o is OptionItem {
  return typeof o === "object";
}

export function OptionBottomSheet({
  visible,
  title,
  options,
  selected,
  onChange,
  onClose,
  colors,
  allowDeselect = true,
  lastUsed,
}: OptionBottomSheetProps) {
  const handleSelect = (value: string) => {
    if (allowDeselect && selected === value) {
      onChange(null);
    } else {
      onChange(value);
    }
    Haptics.selectionAsync();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={obs.overlay} onPress={onClose} />
      <View
        style={[
          obs.sheet,
          { backgroundColor: colors.card, borderTopColor: colors.border + "60" },
        ]}
      >
        <View style={[obs.handle, { backgroundColor: colors.mutedForeground + "55" }]} />

        <View style={obs.header}>
          <Text style={[obs.title, { color: colors.foreground }]}>{title}</Text>
          <Pressable onPress={onClose} style={obs.closeBtn}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView
          style={{ maxHeight: 380 }}
          contentContainerStyle={obs.chipGrid}
          showsVerticalScrollIndicator={false}
        >
          {options.map((opt) => {
            const label = isOptionItem(opt) ? opt.label : opt;
            const value = isOptionItem(opt) ? opt.value : opt;
            const active = selected === value;
            const showLastUsed = lastUsed === value && active;
            return (
              <Pressable
                key={value}
                onPress={() => handleSelect(value)}
                style={[
                  obs.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.background,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                    paddingVertical: showLastUsed ? 5 : 9,
                  },
                ]}
              >
                {active && (
                  <Feather name="check" size={12} color="#fff" />
                )}
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={[
                      obs.chipText,
                      { color: active ? "#fff" : colors.foreground },
                    ]}
                  >
                    {label}
                  </Text>
                  {showLastUsed && (
                    <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: "#fff", opacity: 0.8, marginTop: 1 }}>
                      Last used
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const obs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
