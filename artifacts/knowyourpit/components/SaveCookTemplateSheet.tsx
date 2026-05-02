import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useCreateCookTemplate,
  getListCookTemplatesQueryKey,
} from "@workspace/api-client-react";

export interface CookTemplateDraft {
  defaultName: string;
  foodType: string;
  meatCategory?: string | null;
  weightLbs?: number | null;
  grillId?: number | null;
  cookTempF?: number | null;
  targetTempF?: number | null;
  notes?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  draft: CookTemplateDraft | null;
}

export function SaveCookTemplateSheet({ visible, onClose, draft }: Props) {
  const colors = useColors();
  const qc = useQueryClient();
  const create = useCreateCookTemplate();
  const [name, setName] = useState("");

  useEffect(() => {
    if (visible && draft) setName(draft.defaultName);
  }, [visible, draft]);

  const handleSave = async () => {
    if (!draft) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Give this template a name so you can find it later.");
      return;
    }
    try {
      await create.mutateAsync({
        data: {
          name: trimmed,
          foodType: draft.foodType,
          meatCategory: draft.meatCategory ?? null,
          weightLbs: draft.weightLbs ?? null,
          grillId: draft.grillId ?? null,
          cookTempF: draft.cookTempF ?? null,
          targetTempF: draft.targetTempF ?? null,
          notes: draft.notes ?? null,
        },
      });
      qc.invalidateQueries({ queryKey: getListCookTemplatesQueryKey() });
      onClose();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save template.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.overlay}
      >
        <View
          style={[
            s.card,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Feather name="bookmark" size={16} color={colors.primary} />
            <Text style={[s.title, { color: colors.foreground }]}>Save as Template</Text>
          </View>
          <Text style={[s.sub, { color: colors.mutedForeground }]}>
            Save this cook setup so you can re-plan it in one tap from the Plan a Cook screen.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="Template name"
            placeholderTextColor={colors.mutedForeground}
            style={[
              s.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderRadius: colors.radius,
              },
            ]}
          />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Pressable
              onPress={onClose}
              style={[s.btn, { backgroundColor: colors.muted, borderRadius: colors.radius }]}
            >
              <Text style={[s.btnText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={create.isPending}
              style={[s.btn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              {create.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[s.btnText, { color: "#fff" }]}>Save Template</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
  card: { padding: 18, borderWidth: 1 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 14 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_500Medium", fontSize: 14 },
  btn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  btnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
