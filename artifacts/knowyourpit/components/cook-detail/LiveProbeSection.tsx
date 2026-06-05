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
}

export function LiveProbeSection({
  cookStatus, c,
  selectedMeaterProbe, selectedThermoworksProbe, cookCurrentTempF,
  selectedBleContextDevice, selectedLanProbe, selectedInkbirdProbe,
}: LiveProbeSectionProps) {
  if (cookStatus !== "active") return null;

  const liveProbeTemp = selectedMeaterProbe?.internalTempF ?? selectedThermoworksProbe?.tempF ?? cookCurrentTempF;
  if (c.targetTempF == null && c.cookTempF == null && liveProbeTemp == null) return null;

  let liveProbeSrcLabel: string | null = null;
  if (selectedMeaterProbe?.internalTempF != null) liveProbeSrcLabel = (selectedMeaterProbe as any).deviceName ?? "MEATER Probe";
  else if (selectedThermoworksProbe?.tempF != null) liveProbeSrcLabel = (selectedThermoworksProbe as any).deviceName ?? "ThermoWorks";
  else if (selectedBleContextDevice?.probeTempF != null) liveProbeSrcLabel = selectedBleContextDevice.name ?? "BLE Probe";
  else if (selectedLanProbe?.probeTempF != null) liveProbeSrcLabel = selectedLanProbe.deviceName ?? "LAN Probe";
  else if (selectedInkbirdProbe?.tempF != null) liveProbeSrcLabel = (selectedInkbirdProbe as any).deviceName ?? "Inkbird";

  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {c.targetTempF != null && c.targetTempF > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#22c55e12", borderWidth: 1, borderColor: "#22c55e30" }}>
          <Feather name="thermometer" size={11} color="#22c55e" />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#22c55e" }}>{c.targetTempF}°F</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#22c55e99" }}>target</Text>
        </View>
      )}
      {c.cookTempF != null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#3b82f612", borderWidth: 1, borderColor: "#3b82f630" }}>
          <Feather name="wind" size={11} color="#3b82f6" />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#3b82f6" }}>{c.cookTempF}°F</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#3b82f699" }}>pit</Text>
        </View>
      )}
      {liveProbeTemp != null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F59E0B12", borderWidth: 1, borderColor: "#F59E0B30" }}>
          <Feather name="activity" size={11} color="#F59E0B" />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#F59E0B" }}>{Math.round(liveProbeTemp)}°F</Text>
          {liveProbeSrcLabel != null && <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#F59E0B99" }}>{liveProbeSrcLabel}</Text>}
        </View>
      )}
    </View>
  );
}
