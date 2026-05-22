import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { Feather } from "@expo/vector-icons";

interface Props {
  visible: boolean;
  wrapTempF: number | null;
  wrapLabel: string;
  onSkip: () => void;
  onConfirm: (tempF: number | null) => void;
  colors: any;
}

export function WrapTempSheet({
  visible,
  wrapTempF,
  wrapLabel,
  onSkip,
  onConfirm,
  colors,
}: Props) {
  const [input, setInput] = useState("");

  useEffect(() => {
    if (visible) setInput("");
  }, [visible]);

  const handleConfirm = () => {
    const parsed = parseFloat(input);
    onConfirm(isNaN(parsed) ? null : parsed);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <AppKeyboardAvoidingView style={{ flex: 1 }}>
        <Pressable style={ws.overlay} onPress={onSkip} />
        <View
          style={[
            ws.sheet,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <View style={[ws.handle, { backgroundColor: colors.mutedForeground + "55" }]} />

          <View style={ws.titleRow}>
            <View style={[ws.iconWrap, { backgroundColor: "#A855F720" }]}>
              <Feather name="thermometer" size={16} color="#A855F7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ws.title, { color: colors.foreground }]}>{wrapLabel}</Text>
              <Text style={[ws.desc, { color: colors.mutedForeground }]}>
                Log the internal temp now to refine your finish estimate.
              </Text>
            </View>
          </View>

          {wrapTempF != null && (
            <View style={[ws.planRow, { backgroundColor: colors.border + "55" }]}>
              <Feather name="target" size={13} color={colors.mutedForeground} />
              <Text style={[ws.planLabel, { color: colors.mutedForeground }]}>
                Target wrap temp
              </Text>
              <Text style={[ws.planVal, { color: colors.foreground }]}>{wrapTempF}°F</Text>
            </View>
          )}

          <TextInput
            style={[
              ws.input,
              {
                borderColor: colors.border,
                color: colors.foreground,
                backgroundColor: colors.background,
              },
            ]}
            placeholder="Current internal temp (°F)"
            placeholderTextColor={colors.mutedForeground + "88"}
            keyboardType="decimal-pad"
            value={input}
            onChangeText={setInput}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />

          <View style={ws.btns}>
            <Pressable
              onPress={onSkip}
              style={[ws.skipBtn, { borderColor: colors.border }]}
            >
              <Text style={[ws.skipText, { color: colors.mutedForeground }]}>Skip</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={ws.confirmBtn}>
              <Text style={ws.confirmText}>Confirm Wrap</Text>
            </Pressable>
          </View>
        </View>
      </AppKeyboardAvoidingView>
    </Modal>
  );
}

const ws = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 3,
  },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  planLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  planVal: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  btns: {
    flexDirection: "row",
    gap: 12,
  },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#A855F7",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
