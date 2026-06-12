import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { CookHealthScoreCard } from "@/components/cook-detail/CookHealthScoreCard";
interface CookAnalysisSectionProps {
  colors: any;
  cookStatus: string | undefined;
  cookId: number;
  isMeatOn: boolean;
  checkinCount: number;
  lastDecision: any;
  onGradeChange: (grade: string, quip: string | null) => void;
  proactiveCoachingNote: string | null;
  setProactiveCoachingNote: (v: string | null) => void;
  fGradeQuip: string | null;
  compact?: boolean;
  healthBreakdownOpen?: boolean;
  onHealthBreakdownOpenHandled?: () => void;
}

export function CookAnalysisSection({
  colors, cookStatus, cookId, isMeatOn, checkinCount, lastDecision, onGradeChange,
  proactiveCoachingNote, setProactiveCoachingNote, fGradeQuip, compact,
  healthBreakdownOpen, onHealthBreakdownOpenHandled,
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

      {fGradeQuip && cookStatus === "active" && (
        <View style={{ backgroundColor: "#EF444415", borderRadius: colors.radius as number, borderWidth: 1, borderColor: "#EF444450", padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Feather name="alert-octagon" size={16} color="#EF4444" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#EF4444", marginBottom: 4 }}>PitMaster Says: Cut Your Losses</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground as string, lineHeight: 18 }}>{fGradeQuip}</Text>
          </View>
        </View>
      )}

      {(cookStatus === "active" || cookStatus === "completed") && (cookStatus !== "active" || isMeatOn) && (
        <CookHealthScoreCard
          cookId={cookId} colors={colors} cookStatus={cookStatus}
          checkinCount={checkinCount}
          lastDecision={cookStatus === "active" ? (lastDecision ?? null) : null}
          onGradeChange={(grade, quip) => { if (cookStatus === "active") onGradeChange(grade, quip); }}
          compact={compact}
          externalOpen={healthBreakdownOpen}
          onExternalOpenHandled={onHealthBreakdownOpenHandled}
        />
      )}
    </>
  );
}
