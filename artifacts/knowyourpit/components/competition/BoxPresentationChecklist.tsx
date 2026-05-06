import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  COMPETITION_CATEGORY_LABEL,
  COMPETITION_CATEGORY_COLOR,
  COMPETITION_BOX_CHECKLIST,
  COMPETITION_BOX_PACKING_REMINDERS,
  type CompetitionCategory,
  type BoxChecklistItem,
} from "@/constants/competitionKnowledge";

interface Props {
  visible: boolean;
  onClose: () => void;
  category: CompetitionCategory;
  colors: any;
}

export function BoxPresentationChecklist({ visible, onClose, category, colors }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const items: BoxChecklistItem[] = COMPETITION_BOX_CHECKLIST[category] ?? [];
  const catColor = COMPETITION_CATEGORY_COLOR[category];
  const catLabel = COMPETITION_CATEGORY_LABEL[category];
  const dqItems = items.filter((i) => i.isDQ);
  const totalChecked = checked.size;
  const allChecked = totalChecked >= items.length;

  const toggleItem = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setChecked(new Set());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={s.backdrop} onPress={handleClose} />
        <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <LinearGradient
              colors={[catColor, catColor + "BB"]}
              style={s.headerIcon}
            >
              <Feather name="package" size={18} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: colors.foreground }]}>
                {catLabel} Box Checklist
              </Text>
              <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
                {totalChecked}/{items.length} steps complete
              </Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {dqItems.length > 0 && (
            <View style={[s.dqBanner, { backgroundColor: "#EF444418", borderColor: "#EF4444" }]}>
              <Feather name="alert-triangle" size={14} color="#EF4444" />
              <Text style={s.dqBannerText}>
                {dqItems.length} DQ rule{dqItems.length > 1 ? "s" : ""} — review carefully
              </Text>
            </View>
          )}

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const isChecked = checked.has(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleItem(item.id)}
                  style={({ pressed }) => [
                    s.item,
                    isChecked && { backgroundColor: catColor + "11" },
                    item.isDQ && !isChecked && { backgroundColor: "#EF444408" },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View
                    style={[
                      s.checkbox,
                      isChecked
                        ? { backgroundColor: catColor, borderColor: catColor }
                        : { borderColor: item.isDQ ? "#EF4444" : colors.border },
                    ]}
                  >
                    {isChecked && <Feather name="check" size={12} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.itemText,
                        { color: isChecked ? colors.mutedForeground : colors.foreground },
                        isChecked && { textDecorationLine: "line-through" },
                      ]}
                    >
                      {item.text}
                    </Text>
                    {item.isDQ && (
                      <View style={s.dqTag}>
                        <Feather name="alert-octagon" size={9} color="#EF4444" />
                        <Text style={s.dqTagText}>DQ IF VIOLATED</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}

            <View style={[s.reminderSection, { borderTopColor: colors.border }]}>
              <Text style={[s.reminderTitle, { color: colors.mutedForeground }]}>
                UNIVERSAL REMINDERS
              </Text>
              {COMPETITION_BOX_PACKING_REMINDERS.map((r, i) => (
                <View key={i} style={s.reminderRow}>
                  <Feather name="info" size={12} color={colors.mutedForeground} />
                  <Text style={[s.reminderText, { color: colors.mutedForeground }]}>{r}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              s.doneBtn,
              { borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
              allChecked
                ? { backgroundColor: "#22c55e" }
                : { backgroundColor: catColor },
            ]}
          >
            <Feather name={allChecked ? "check-circle" : "package"} size={16} color="#fff" />
            <Text style={s.doneBtnText}>
              {allChecked ? "All done — close" : "Close checklist"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 16 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  dqBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  dqBannerText: {
    color: "#EF4444",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    flex: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  itemText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  dqTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  dqTagText: {
    color: "#EF4444",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  reminderSection: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  reminderTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  reminderText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
  },
  doneBtnText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
