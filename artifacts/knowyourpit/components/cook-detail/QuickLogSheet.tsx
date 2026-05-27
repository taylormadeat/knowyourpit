import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { ComponentProps } from "react";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCreateCookEvent } from "@workspace/api-client-react";
import type { CreateCookEventBodyEventType } from "@workspace/api-client-react";

type FeatherName = ComponentProps<typeof Feather>["name"];
type EventType = CreateCookEventBodyEventType;

interface EventButton {
  type: EventType;
  label: string;
  icon: FeatherName;
  color: string;
}

const EVENT_BUTTONS: EventButton[] = [
  { type: "lid_open",     label: "Lid Opened",  icon: "wind",          color: "#6B7280" },
  { type: "flare_up",    label: "Flare-Up",     icon: "alert-triangle",color: "#EF4444" },
  { type: "spritz",      label: "Spritz/Mop",    icon: "droplet",       color: "#3B82F6" },
  { type: "charcoal_add",label: "Charcoal",      icon: "plus-circle",   color: "#F97316" },
  { type: "wood_add",    label: "Wood Chunk",    icon: "package",       color: "#92400E" },
  { type: "fuel_low",    label: "Fuel Low",      icon: "trending-down", color: "#8B5CF6" },
  { type: "vent_adjust", label: "Vent Adjust",   icon: "sliders",       color: "#0EA5E9" },
  { type: "user_note",   label: "Note",          icon: "edit-3",        color: "#22c55e" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  cookId: number;
  colors: {
    card: string;
    border: string;
    foreground: string;
    mutedForeground: string;
    primary: string;
    radius: number;
    muted: string;
    background: string;
  };
  onEventLogged: () => void;
  onNoteLogged?: (noteText: string) => void;
}

export function QuickLogSheet({ visible, onClose, cookId, colors, onEventLogged, onNoteLogged }: Props) {
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const createEvent = useCreateCookEvent();

  const selectedBtn = selectedType ? EVENT_BUTTONS.find((b) => b.type === selectedType) : null;
  const isNoteRequired = selectedType === "user_note";

  const handleSelectType = (type: EventType) => {
    setSelectedType(type);
    setNote("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleSave = async (noteText: string) => {
    if (!selectedType) return;
    setSaving(true);
    try {
      await createEvent.mutateAsync({
        id: cookId,
        data: { eventType: selectedType, note: noteText.trim() || null },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onEventLogged();
      if (selectedType === "user_note" && noteText.trim()) {
        onNoteLogged?.(noteText.trim());
      }
      setSaveError(null);
      setNote("");
      setSelectedType(null);
      onClose();
    } catch {
      setSaveError("Couldn't save — check your connection and try again.");
      Alert.alert("Couldn't save", "Check your connection and try again.", [{ text: "OK" }]);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNote("");
    setSelectedType(null);
    setSaveError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#00000060" }} onPress={handleClose} />
      <AppKeyboardAvoidingView>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            paddingBottom: 32,
          }}
        >
          <LinearGradient
            colors={["#1C1C1F", "#2D1A0E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: "#F3EDE1" }}>
              Quick Log
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Feather name="x" size={22} color="#F3EDE1" />
            </Pressable>
          </LinearGradient>

          <View style={{ padding: 16 }}>
            {/* Event type selection */}
            {!selectedType && (
              <>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    color: colors.mutedForeground,
                    marginBottom: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  What just happened?
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {EVENT_BUTTONS.map((btn) => (
                    <Pressable
                      key={btn.type}
                      onPress={() => handleSelectType(btn.type)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 20,
                        backgroundColor: btn.color + "12",
                        borderWidth: 1,
                        borderColor: btn.color + "40",
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Feather name={btn.icon} size={14} color={btn.color} />
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: btn.color }}>
                        {btn.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Note + confirm step — shown for all event types */}
            {selectedType && selectedBtn && (
              <View style={{ gap: 12 }}>
                {/* Selected event badge + back link */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pressable
                    onPress={() => setSelectedType(null)}
                    hitSlop={8}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
                  </Pressable>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 14,
                      backgroundColor: selectedBtn.color + "18",
                      borderWidth: 1,
                      borderColor: selectedBtn.color + "40",
                    }}
                  >
                    <Feather name={selectedBtn.icon} size={13} color={selectedBtn.color} />
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: selectedBtn.color }}>
                      {selectedBtn.label}
                    </Text>
                  </View>
                </View>

                {/* Optional / required note input */}
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={
                    isNoteRequired
                      ? "What's happening? (required)"
                      : "Add a note (optional)"
                  }
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  autoFocus
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 72,
                    color: colors.foreground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    backgroundColor: colors.background,
                    textAlignVertical: "top",
                  }}
                />

                {/* Action buttons */}
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => handleSave(note)}
                    disabled={saving || (isNoteRequired && !note.trim())}
                    style={({ pressed }) => ({
                      backgroundColor: "#E84820",
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: "center",
                      opacity: pressed || saving || (isNoteRequired && !note.trim()) ? 0.6 : 1,
                    })}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" }}>
                        Log {selectedBtn.label}
                      </Text>
                    )}
                  </Pressable>

                  {/* Inline error feedback */}
                  {saveError && (
                    <Text style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 13,
                      color: "#EF4444",
                      textAlign: "center",
                      marginTop: -4,
                    }}>
                      {saveError}
                    </Text>
                  )}

                  {/* Quick-submit without note for non-required events */}
                  {!isNoteRequired && note.trim().length === 0 && (
                    <Pressable
                      onPress={() => handleSave("")}
                      disabled={saving}
                      style={({ pressed }) => ({
                        borderRadius: 10,
                        paddingVertical: 10,
                        alignItems: "center",
                        opacity: pressed || saving ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.mutedForeground }}>
                        Log without note
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </AppKeyboardAvoidingView>
    </Modal>
  );
}
