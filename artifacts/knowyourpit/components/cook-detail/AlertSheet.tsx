import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { Feather } from "@expo/vector-icons";
import { s } from "./styles";

type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  cook: any;
  alertMode: "temp" | "timer";
  setAlertMode: (m: "temp" | "timer") => void;
  alertThreshold: string;
  setAlertThreshold: (v: string) => void;
  alertLabel: string;
  setAlertLabel: (v: string) => void;
  alertMinutesBefore: string;
  setAlertMinutesBefore: (v: string) => void;
  alertSaving: boolean;
  saveAlert: () => void;
}

export function AlertSheet(p: Props) {
  const {
    visible, onClose, colors, cook,
    alertMode, setAlertMode,
    alertThreshold, setAlertThreshold,
    alertLabel, setAlertLabel,
    alertMinutesBefore, setAlertMinutesBefore,
    alertSaving, saveAlert,
  } = p;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={s.grillOverlay}
        onPress={onClose}
      />
      <AppKeyboardAvoidingView style={{ justifyContent: "flex-end" }}>
        <View style={[s.alertSheet, { backgroundColor: colors.card }]}>
          <View style={[s.grillSheetHandle, { backgroundColor: colors.border }]} />
          <View style={[s.alertSheetHeader, { borderBottomColor: colors.border }]}>
            <Feather name="bell"  size={18} color="#EF4444" />
            <Text style={[s.grillSheetTitle, { color: colors.foreground, marginBottom: 0 }]}>
              Set Alert
            </Text>
            <Pressable onPress={onClose} style={{ marginLeft: "auto" }} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={[s.alertModeRow, { backgroundColor: colors.background, borderRadius: colors.radius }]}>
            <Pressable
              style={[s.alertModeBtn, alertMode === "temp" && { backgroundColor: "#EF444418" }, { borderRadius: colors.radius - 2 }]}
              onPress={() => setAlertMode("temp")}
            >
              <Feather name="thermometer" size={14} color={alertMode === "temp" ? "#EF4444" : colors.mutedForeground} />
              <Text style={[s.alertModeBtnText, { color: alertMode === "temp" ? "#EF4444" : colors.mutedForeground }]}>
                Temperature
              </Text>
            </Pressable>
            <Pressable
              style={[s.alertModeBtn, alertMode === "timer" && { backgroundColor: "#3B82F618" }, { borderRadius: colors.radius - 2 }]}
              onPress={() => setAlertMode("timer")}
            >
              <Feather name="clock" size={14} color={alertMode === "timer" ? "#3B82F6" : colors.mutedForeground} />
              <Text style={[s.alertModeBtnText, { color: alertMode === "timer" ? "#3B82F6" : colors.mutedForeground }]}>
                Timer
              </Text>
            </Pressable>
          </View>

          {alertMode === "temp" ? (
            <View style={{ gap: 12 }}>
              <View>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>
                  Notify me when probe reaches (°F)
                </Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder={`e.g. ${(cook as any)?.targetTempF ?? 203}`}
                  placeholderTextColor={colors.mutedForeground}
                  value={alertThreshold}
                  onChangeText={setAlertThreshold}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              <View>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>
                  Custom label <Text style={{ fontWeight: "400" }}>(optional)</Text>
                </Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder={`e.g. Time to pull the ${(cook as any)?.foodType ?? "meat"}`}
                  placeholderTextColor={colors.mutedForeground}
                  value={alertLabel}
                  onChangeText={setAlertLabel}
                />
              </View>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>
                  Alert me this many minutes before serve time
                </Text>
                <View style={s.alertTimerOptions}>
                  {["15", "30", "60", "90"].map((mins) => (
                    <Pressable
                      key={mins}
                      onPress={() => setAlertMinutesBefore(mins)}
                      style={[
                        s.alertTimerChip,
                        { borderColor: alertMinutesBefore === mins ? "#3B82F6" : colors.border },
                        alertMinutesBefore === mins && { backgroundColor: "#3B82F618" },
                        { borderRadius: colors.radius },
                      ]}
                    >
                      <Text style={[s.alertTimerChipText, { color: alertMinutesBefore === mins ? "#3B82F6" : colors.foreground }]}>
                        {mins} min
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, marginTop: 8 }]}
                  placeholder="Or enter minutes"
                  placeholderTextColor={colors.mutedForeground}
                  value={alertMinutesBefore}
                  onChangeText={setAlertMinutesBefore}
                  keyboardType="number-pad"
                />
              </View>
              {!(cook as any)?.plannedEndAt && (
                <View style={[s.alertWarning, { backgroundColor: "#F59E0B12", borderColor: "#F59E0B30", borderRadius: colors.radius }]}>
                  <Feather name="alert-triangle" size={14} color="#F59E0B" />
                  <Text style={[s.alertWarningText, { color: "#F59E0B" }]}>
                    No serve time set. Edit this cook to add a planned serve time.
                  </Text>
                </View>
              )}
              <View>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>
                  Custom label <Text style={{ fontWeight: "400" }}>(optional)</Text>
                </Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder={`e.g. Start resting the ${(cook as any)?.foodType ?? "meat"}`}
                  placeholderTextColor={colors.mutedForeground}
                  value={alertLabel}
                  onChangeText={setAlertLabel}
                />
              </View>
            </View>
          )}

          <Pressable
            style={[
              s.analyzeBtn,
              { borderRadius: colors.radius, overflow: "hidden", backgroundColor: "#EF4444", opacity: alertSaving ? 0.7 : 1 },
            ]}
            onPress={saveAlert}
            disabled={alertSaving}
          >
            <View style={[s.analyzeBtnGradient, { backgroundColor: "transparent" }]}>
              {alertSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="bell"  size={16} color="#fff" />
                  <Text style={s.analyzeBtnText}>Save Alert</Text>
                </>
              )}
            </View>
          </Pressable>
        </View>
      </AppKeyboardAvoidingView>
    </Modal>
  );
}
