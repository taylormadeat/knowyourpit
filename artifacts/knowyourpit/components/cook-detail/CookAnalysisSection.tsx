import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { CookHealthScoreCard } from "@/components/cook-detail/CookHealthScoreCard";

interface CookAnalysisSectionProps {
  colors: any;
  cookStatus: string | undefined;
  proactiveCoachingNote: string | null;
  setProactiveCoachingNote: (v: string | null) => void;
  cookId?: number;
  healthBreakdownOpen?: boolean;
  onHealthBreakdownOpenHandled?: () => void;
}

export function CookAnalysisSection({
  colors, cookStatus, proactiveCoachingNote, setProactiveCoachingNote,
  cookId, healthBreakdownOpen, onHealthBreakdownOpenHandled,
}: CookAnalysisSectionProps) {
  return (
    <>
      {proactiveCoachingNote && (
        <View style={{ backgroundColor: "#EAB30815", borderRadius: colors.radius as number, borderWidth: 1, borderColor: "#EAB30850", padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Feather name="alert-circle" size={16} color="#EAB308" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#EAB308", marginBottom: 4 }}>PitMaster Alert</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground as string, lineHeight: 18 }}>{proactiveCoachingNote}</Text>
          </View>
          <Pressable onPress={() => setProactiveCoachingNote(null)} hitSlop={8}><Feather name="x" size={16} color={colors.mutedForeground as string} /></Pressable>
        </View>
      )}

      {cookStatus === "completed" && cookId != null && (
        <CookHealthScoreCard
          cookId={cookId}
          colors={colors}
          cookStatus={cookStatus}
          checkinCount={0}
          lastDecision={null}
          compact={true}
          externalOpen={healthBreakdownOpen}
          onExternalOpenHandled={onHealthBreakdownOpenHandled}
        />
      )}
    </>
  );
}
