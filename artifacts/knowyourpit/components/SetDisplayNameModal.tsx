/**
 * SetDisplayNameModal
 *
 * Shown once to users who have no firstName and no displayName — typically
 * Apple Sign-In users who chose to hide their email (so Apple sends no name
 * back to Clerk). Prompts them to enter a display name so the app can greet
 * them personally. Dismissable without entering a name; the "seen" flag is
 * written to AsyncStorage in both cases so we never ask twice.
 */
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";

export const NAME_PROMPT_SEEN_KEY = "knowyourpit:hasSeenNamePrompt";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function SetDisplayNameModal({ visible, onDismiss }: Props) {
  const colors = useColors();
  const { user } = useUser();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || !user) return;
    setSaving(true);
    try {
      await user.update({
        unsafeMetadata: {
          ...((user.unsafeMetadata as object) ?? {}),
          displayName: trimmed,
        },
      });
      onDismiss();
    } catch (err: any) {
      Alert.alert(
        "Couldn't save name",
        err?.errors?.[0]?.longMessage || err?.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Backdrop — tap to skip */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <View
          style={[
            s.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius + 4,
            },
          ]}
        >
          {/* Header */}
          <Text style={[s.title, { color: colors.foreground }]}>
            What should we call you?
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Add a name so the app can greet you properly. You can always change
            it later in your profile.
          </Text>

          {/* Input */}
          <TextInput
            style={[
              s.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            maxLength={60}
          />

          {/* Actions */}
          <View style={s.actions}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [
                s.btn,
                s.btnSkip,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[s.btnText, { color: colors.mutedForeground }]}>
                Skip
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={saving || !name.trim()}
              style={({ pressed }) => [
                s.btn,
                s.btnSave,
                {
                  backgroundColor: colors.primary,
                  opacity: saving || !name.trim() ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[s.btnText, { color: "#fff" }]}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderWidth: 1,
    // Lift above the backdrop so touches register on the sheet only
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSkip: {
    borderWidth: 1,
  },
  btnSave: {},
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
