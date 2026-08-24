import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

interface LiveProbeSectionProps {
  cookStatus: string | undefined;
  tempMode?: "probe" | "manual";
  selectedBleContextDevice: any | null;
  selectedLanProbe: any | null;
  selectedInkbirdProbe: any | null;
  currentPitTempF?: number | null;
}

export function LiveProbeSection({
  cookStatus, tempMode = "manual",
  selectedBleContextDevice, selectedLanProbe, selectedInkbirdProbe,
  currentPitTempF,
}: LiveProbeSectionProps) {
  if (cookStatus !== "active" || tempMode !== "probe") return null;

  // Only confirmed readings from the currently selected, connected probes
  // belong in this upper row. Planned target/setpoint values are deliberately
  // not used here because they look like current readings.
  const liveMeatTempF =
    selectedBleContextDevice?.probeTempF ??
    selectedLanProbe?.probeTempF ??
    selectedInkbirdProbe?.tempF ??
    null;

  let liveProbeSrcLabel: string | null = null;
  if (selectedBleContextDevice?.probeTempF != null) liveProbeSrcLabel = selectedBleContextDevice.name ?? "BLE Probe";
  else if (selectedLanProbe?.probeTempF != null) liveProbeSrcLabel = selectedLanProbe.deviceName ?? "LAN Probe";
  else if (selectedInkbirdProbe?.tempF != null) liveProbeSrcLabel = (selectedInkbirdProbe as any).deviceName ?? "Inkbird";

  const hasMeatReading = liveMeatTempF != null;
  const hasPitReading = currentPitTempF != null;

  if (!hasMeatReading && !hasPitReading) return null;

  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {hasMeatReading && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#22c55e12", borderWidth: 1, borderColor: "#22c55e30" }}>
          <Feather name={hasMeatReading ? "activity" : "thermometer"} size={11} color="#22c55e" />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#22c55e" }}>{Math.round(liveMeatTempF!)}°F</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#22c55e99" }}>
            {liveProbeSrcLabel ?? "live meat"}
          </Text>
        </View>
      )}
      {hasPitReading && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#3b82f612", borderWidth: 1, borderColor: "#3b82f630" }}>
          <Feather name="activity" size={11} color="#3b82f6" />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#3b82f6" }}>{Math.round(currentPitTempF!)}°F</Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#3b82f699" }}>
            live pit
          </Text>
        </View>
      )}
    </View>
  );
}
