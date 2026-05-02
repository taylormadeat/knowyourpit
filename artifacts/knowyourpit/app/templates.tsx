import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { useColors } from "@/hooks/useColors";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useLayout } from "@/hooks/useLayout";
import {
  useListCookTemplates,
  useUpdateCookTemplate,
  useDeleteCookTemplate,
  useListGrills,
  getListCookTemplatesQueryKey,
  type CookTemplate,
  type Grill,
} from "@workspace/api-client-react";

export default function TemplatesScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const botPad = useBottomInset();
  const { isTablet, contentMaxWidth } = useLayout();

  const { data: templates, isLoading } = useListCookTemplates();
  const { data: grills } = useListGrills();
  const updateTpl = useUpdateCookTemplate();
  const deleteTpl = useDeleteCookTemplate();

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CookTemplate | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const swipeRefs = useRef(new Map<number, Swipeable | null>());

  const grillName = (id: number | null) =>
    (grills as Grill[] | undefined)?.find((g) => g.id === id)?.name ?? null;

  const closeAllSwipes = (exceptId?: number) => {
    swipeRefs.current.forEach((r, id) => {
      if (id !== exceptId) r?.close();
    });
  };

  const openRename = (tpl: CookTemplate) => {
    closeAllSwipes();
    setRenameTarget(tpl);
    setRenameValue(tpl.name);
    setRenameOpen(true);
  };

  const saveRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      Alert.alert("Name required", "Please enter a name for this template.");
      return;
    }
    try {
      await updateTpl.mutateAsync({ id: renameTarget.id, data: { name } });
      qc.invalidateQueries({ queryKey: getListCookTemplatesQueryKey() });
      setRenameOpen(false);
      setRenameTarget(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not rename template.");
    }
  };

  const confirmDelete = (tpl: CookTemplate) => {
    Alert.alert(
      "Delete template?",
      `Remove "${tpl.name}"? This can't be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => swipeRefs.current.get(tpl.id)?.close(),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTpl.mutateAsync({ id: tpl.id });
              qc.invalidateQueries({ queryKey: getListCookTemplatesQueryKey() });
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not delete template.");
            }
          },
        },
      ],
    );
  };

  const list: CookTemplate[] = templates ?? [];

  const renderRightActions =
    (tpl: CookTemplate) =>
    (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: [-160, -80, 0],
        outputRange: [1, 0.95, 0.7],
        extrapolate: "clamp",
      });
      return (
        <View style={s.swipeActions}>
          <Pressable
            onPress={() => openRename(tpl)}
            style={[s.swipeBtn, { backgroundColor: colors.primary }]}
          >
            <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
              <Feather name="edit-2" size={18} color="#fff" />
              <Text style={s.swipeText}>Rename</Text>
            </Animated.View>
          </Pressable>
          <Pressable
            onPress={() => confirmDelete(tpl)}
            style={[s.swipeBtn, { backgroundColor: colors.destructive }]}
          >
            <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
              <Feather name="trash-2" size={18} color="#fff" />
              <Text style={s.swipeText}>Delete</Text>
            </Animated.View>
          </Pressable>
        </View>
      );
    };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="Cook Templates" showBack dark />

      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: botPad + 24, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={isTablet ? { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" } : null}>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Save successful cook setups so you can reuse them in one tap from the Plan a Cook screen. Swipe a template left to rename or delete it.
          </Text>

          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : list.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Feather name="bookmark" size={28} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No templates yet</Text>
              <Text style={[s.emptyBody, { color: colors.mutedForeground }]}>
                Open a planned or completed cook and tap the bookmark icon in the header to save its setup here.
              </Text>
            </View>
          ) : (
            list.map((tpl) => {
              const gName = grillName(tpl.grillId);
              const meta: string[] = [];
              if (tpl.foodType) meta.push(tpl.foodType);
              if (tpl.weightLbs != null) meta.push(`${tpl.weightLbs} lbs`);
              if (tpl.cookTempF != null) meta.push(`${tpl.cookTempF}°F pit`);
              if (tpl.targetTempF != null) meta.push(`target ${tpl.targetTempF}°F`);
              return (
                <Swipeable
                  key={tpl.id}
                  ref={(r) => {
                    swipeRefs.current.set(tpl.id, r);
                  }}
                  renderRightActions={renderRightActions(tpl)}
                  onSwipeableWillOpen={() => closeAllSwipes(tpl.id)}
                  overshootRight={false}
                  friction={2}
                  containerStyle={{ marginBottom: 10, borderRadius: colors.radius, overflow: "hidden" }}
                >
                  <View
                    style={[
                      s.row,
                      { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[s.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {tpl.name}
                      </Text>
                      <Text style={[s.rowMeta, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {meta.join(" · ")}
                      </Text>
                      {gName ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Feather name="wind" size={11} color={colors.mutedForeground} />
                          <Text style={[s.rowMeta, { color: colors.mutedForeground }]}>{gName}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Feather name="chevron-left" size={16} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
                  </View>
                </Swipeable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.modalOverlay}
        >
          <View style={[s.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Rename Template</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholder="Template name"
              placeholderTextColor={colors.mutedForeground}
              style={[s.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, borderRadius: colors.radius }]}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => setRenameOpen(false)}
                style={[s.modalBtn, { backgroundColor: colors.muted, borderRadius: colors.radius }]}
              >
                <Text style={[s.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveRename}
                disabled={updateTpl.isPending}
                style={[s.modalBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              >
                {updateTpl.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[s.modalBtnText, { color: "#fff" }]}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 14, lineHeight: 18 },
  emptyCard: { padding: 22, borderWidth: 1, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 4 },
  emptyBody: { fontSize: 12.5, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  row: {
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontSize: 14.5, fontFamily: "Inter_700Bold" },
  rowMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  swipeActions: { flexDirection: "row", height: "100%" },
  swipeBtn: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
  modalCard: { padding: 18, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  modalInput: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_500Medium", fontSize: 14 },
  modalBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
