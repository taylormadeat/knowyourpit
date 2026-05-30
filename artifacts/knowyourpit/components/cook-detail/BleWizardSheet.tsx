import React, { useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type Brand = "inkbird" | "meater" | "govee" | "other";

const STEPS: Record<Brand, Array<{ icon: string; text: string }>> = {
  inkbird: [
    { icon: "power", text: "Enable Bluetooth before launching the app — Inkbird probes are missed when Bluetooth is toggled on after scanning starts." },
    { icon: "battery-charging", text: "Charge the probe fully. IBT-series devices stop broadcasting advertisements below ~10% battery." },
    { icon: "move", text: "Move within 1–2 metres of the probe for the initial scan, then step back once it appears." },
    { icon: "refresh-cw", text: "Press the probe's power button once to wake it if it has been idle for more than a few hours." },
    { icon: "smartphone", text: "If still not found, close and reopen the app — iOS can silently halt BLE scans after backgrounding." },
  ],
  meater: [
    { icon: "battery-charging", text: "Seat the probe in its charger for 10 seconds to wake it from sleep, then remove it before scanning." },
    { icon: "move", text: "Bring the probe within 1–2 metres of your phone. MEATER range is short until the initial GATT connection succeeds." },
    { icon: "bluetooth", text: "Ensure no other device (tablet, MEATER app on another phone) is already connected — MEATER only allows one connection at a time." },
    { icon: "power", text: "Enable Bluetooth before opening the cook screen. Scanning starts immediately on load." },
    { icon: "refresh-cw", text: "Still not found? Remove the probe from the charger, wait 5 seconds, then tap 'Try scanning again'." },
  ],
  govee: [
    { icon: "power", text: "Enable Bluetooth before opening the cook screen. Govee sensors broadcast passively and are seen immediately during a scan." },
    { icon: "battery-charging", text: "Charge or replace batteries — Govee sensors stop broadcasting when the battery is critically low." },
    { icon: "move", text: "Stay within 3 metres and avoid thick metal surfaces (grill lids, smoker walls) between the probe and your phone." },
    { icon: "refresh-cw", text: "Hold the Govee button for 3 seconds to reboot the sensor if it appears unresponsive." },
    { icon: "smartphone", text: "Close Govee Home or any other app that may be holding an exclusive Bluetooth connection to the sensor." },
  ],
  other: [
    { icon: "power", text: "Enable Bluetooth before opening the cook screen. The scan starts as soon as the Live Cook section loads." },
    { icon: "battery-charging", text: "Charge or replace the probe battery. Most Bluetooth probes go silent at low charge." },
    { icon: "move", text: "Start within 1–2 metres of the probe — move closer if your surroundings have heavy RF interference." },
    { icon: "refresh-cw", text: "Power-cycle the probe once (off, wait 3 seconds, on) to force a fresh advertisement packet." },
    { icon: "smartphone", text: "If scanning seems stuck, close and reopen the app. iOS can silently halt BLE scans after the phone is locked." },
  ],
};

const BRAND_LABELS: Record<Brand, string> = {
  inkbird: "Inkbird",
  meater: "MEATER",
  govee: "Govee",
  other: "Other",
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onRestartScan?: () => void;
}

export function BleWizardSheet({ visible, onClose, onRestartScan }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [brand, setBrand] = useState<Brand>("inkbird");

  const steps = STEPS[brand];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom + 16,
            maxHeight: "85%",
          }}
          onPress={() => {}}
        >
          {/* Handle bar */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.mutedForeground + "40" }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground }}>
                Probe Pairing Help
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                Select your probe brand for troubleshooting tips
              </Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Brand selector */}
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 16 }}>
            {(["inkbird", "meater", "govee", "other"] as Brand[]).map((b) => {
              const active = brand === b;
              return (
                <Pressable
                  key={b}
                  onPress={() => setBrand(b)}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1,
                    alignItems: "center",
                    borderColor: active ? "#3B82F6" : colors.border,
                    backgroundColor: active ? "#3B82F618" : "transparent",
                  }}
                >
                  <Text style={{
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                    fontSize: 12,
                    color: active ? "#3B82F6" : colors.mutedForeground,
                  }}>
                    {BRAND_LABELS[b]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Steps */}
          <ScrollView
            style={{ paddingHorizontal: 20 }}
            contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {steps.map((step, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "#3B82F618",
                  borderWidth: 1,
                  borderColor: "#3B82F630",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}>
                  <Feather name={step.icon as any} size={13} color="#3B82F6" />
                </View>
                <Text style={{
                  flex: 1,
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.foreground,
                  lineHeight: 19,
                  paddingTop: 4,
                }}>
                  {step.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Try scanning again button */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Pressable
              onPress={onRestartScan}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 13,
                borderRadius: 10,
                opacity: pressed ? 0.85 : 1,
                backgroundColor: "#FF6B2B",
              })}
            >
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" }}>
                Try scanning again
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
