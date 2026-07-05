import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

interface LiveProbeSectionProps {
  cookStatus: string | undefined;
  c: any;
  selectedMeaterProbe: any | null;
  selectedThermoworksProbe: any | null;
  cookCurrentTempF: number | null;
  selectedBleContextDevice: any | null;
  selectedLanProbe: any | null;
  selectedInkbirdProbe: any | null;
  currentPitTempF?: number | null;
}

export function LiveProbeSection({
  cookStatus, c,
  selectedMeaterProbe, selectedThermoworksProbe, cookCurrentTempF,
  selectedBleContextDevice, selectedLanProbe, selectedInkbirdProbe,
  currentPitTempF,
}: LiveProbeSectionProps) {
  if (cookStatus !== "active") return null;

  // Live meat reading, same precedence used for the "LIVE ON THE SMOKER" home
  // card and the live-activity widget: MEATER internal probe, then
  // ThermoWorks, then BLE/LAN/Inkbird fallbacks.
  const liveMeatTempF =
    selectedMeaterProbe?.internalTempF ??
    selectedThermoworksProbe?.tempF ??
    selectedBleContextDevice?.probeTempF ??
    selectedLanProbe?.probeTempF ??
    selectedInkbirdProbe?.tempF ??
    cookCurrentTempF ??
    null;

  let liveProbeSrcLabel: string | null = null;
  if (selectedMeaterProbe?.internalTempF != null) liveProbeSrcLabel = (selectedMeaterProbe as any).deviceName ?? "MEATER Probe";
  else if (selectedThermoworksProbe?.tempF != null) liveProbeSrcLabel = (selectedThermoworksProbe as any).deviceName ?? "ThermoWorks";
  else if (selectedBleContextDevice?.probeTempF != null) liveProbeSrcLabel = selectedBleContextDevice.name ?? "BLE Probe";
  else if (selectedLanProbe?.probeTempF != null) liveProbeSrcLabel = selectedLanProbe.deviceName ?? "LAN Probe";
  else if (selectedInkbirdProbe?.tempF != null) liveProbeSrcLabel = (selectedInkbirdProbe as any).deviceName ?? "Inkbird";

  // Prefer the live reading over the static planned value, mirroring the
  // Home screen's "Live on the Smoker" cards — falls back to target/setpoint
  // only when no live reading is available yet.
  const hasMeatReading = liveMeatTempF != null;
  const hasPitReading = currentPitTempF != null;
  const meatDisplayTempF = hasMeatReading ? liveMeatTempF : c.targetTempF ?? null;
  const pitDisplayTempF = hasPitReading ? currentPitTempF : c.cookTempF ?? null;

  if (meatDisplayTempF == null && pitDisplayTempF == null) return null;

  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {meatDisplayTempF != null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#22c55e12", borderWidth: 1, borderColor: "#22c55e30" }}>
          <Feather name={hasMeatReading ? "activity" : "thermometer"} size={11} color="#22c55e" />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#22c55e" }}>{Math.round(meatDisplayTempF)}°F</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#22c55e99" }}>
            {hasMeatReading ? (liveProbeSrcLabel ?? "meat") : "target"}
          </Text>
        </View>
      )}
      {pitDisplayTempF != null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#3b82f612", borderWidth: 1, borderColor: "#3b82f630" }}>
          <Feather name={hasPitReading ? "activity" : "wind"} size={11} color="#3b82f6" />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#3b82f6" }}>{Math.round(pitDisplayTempF)}°F</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#3b82f699" }}>
            {hasPitReading ? "pit" : "pit setpoint"}
          </Text>
        </View>
      )}
    </View>
  );
}
