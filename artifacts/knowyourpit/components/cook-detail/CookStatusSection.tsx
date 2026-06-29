import React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCookQueryKey, getListCooksQueryKey } from "@workspace/api-client-react";
import { ThawStatusBanner } from "@/components/cook-detail/ThawStatusBanner";

interface CookStatusSectionProps {
  c: any;
  colors: any;
  cookStatus: string | undefined;
  statusColor: string;
  id: string;
  dismissCookOutlier: { mutateAsync: (args: any) => Promise<any>; isPending?: boolean };
  cookSeqData: any;
  effectiveMeatOnMs: number | null;
  nowMs: number;
  handleMarkThawStarted: () => void;
  markingThaw: boolean;
}

export function CookStatusSection({
  c, colors, cookStatus, statusColor, id,
  dismissCookOutlier,
  cookSeqData, effectiveMeatOnMs, nowMs, handleMarkThawStarted, markingThaw,
}: CookStatusSectionProps) {
  const qc = useQueryClient();
  const router = useRouter();
  const isMeatOn = effectiveMeatOnMs == null || effectiveMeatOnMs <= nowMs;

  return (
    <>
      {cookStatus !== "active" && (
        <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, borderWidth: 1, borderColor: statusColor + "40", backgroundColor: statusColor + "18" }]}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: statusColor, textTransform: "uppercase", letterSpacing: 0.8 }}>{c.status?.toUpperCase()}</Text>
          {(() => {
            const sizeText = (c.sizingLabel as string | null | undefined) ?? (typeof c.weightLbs === "number" ? `${c.weightLbs} lbs` : null);
            if (!sizeText) return null;
            return <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.card, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: colors.border, marginLeft: 4 }}><Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.foreground }}>{sizeText}</Text></View>;
          })()}
          {(c.ratingTenderness || c.ratingBark || c.ratingFlavor) && (
            <View style={{ flexDirection: "row", gap: 5, marginLeft: 4 }}>
              {[{ label: "T", val: c.ratingTenderness }, { label: "F", val: c.ratingFlavor }, { label: "B", val: c.ratingBark }].filter(r => r.val).map((r, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: colors.mutedForeground }}>{r.label}</Text>
                  <Text style={{ fontSize: 10, color: "#eab308" }}>{"★".repeat(r.val!)}{"☆".repeat(5 - r.val!)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {c.status === "completed" && c.isOutlier && !c.outlierDismissed && (
        <View style={{ borderRadius: colors.radius, backgroundColor: "#f59e0b12", borderWidth: 1, borderColor: "#f59e0b40", paddingHorizontal: 14, paddingVertical: 11, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Feather name="alert-triangle" size={14} color="#f59e0b" /><Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#f59e0b" }}>Cook flagged for review</Text></View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>This cook had few or no check-ins and its duration differed significantly from the AI prediction. It's been excluded from your grill fingerprint to keep your future predictions accurate.</Text>
          <Pressable onPress={async () => {
            try {
              await dismissCookOutlier.mutateAsync({ id: c.id });
              qc.invalidateQueries({ queryKey: getGetCookQueryKey(c.id) });
              qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
            } catch { Alert.alert("Error", "Could not update this cook. Please try again."); }
          }} style={({ pressed }) => ({ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#f59e0b18", borderRadius: 8, borderWidth: 1, borderColor: "#f59e0b55", paddingHorizontal: 12, paddingVertical: 7, opacity: pressed ? 0.7 : 1 })}>
            <Feather name="check" size={13} color="#f59e0b" />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#f59e0b" }}>Mark as accurate</Text>
          </Pressable>
        </View>
      )}

      <ThawStatusBanner
        cookStatus={cookStatus} isMeatOn={isMeatOn}
        actualStartAt={(c as any).actualStartAt ? new Date((c as any).actualStartAt).toISOString() : null}
        cookSeqData={cookSeqData} meatOnMs={effectiveMeatOnMs} nowMs={nowMs}
        thawMethod={(c as any).thawMethod ?? null}
        actualThawStartAt={(c as any).actualThawStartAt ? new Date((c as any).actualThawStartAt).toISOString() : null}
        onMarkThawStarted={handleMarkThawStarted} markingThaw={markingThaw} colors={colors}
      />

      {cookStatus === "planned" && !!(c as any).fromFrozen && !!(c as any).actualThawStartAt && (
        <Pressable onPress={() => router.push(`/(tabs)/plan?replanCookId=${id}` as any)} style={({ pressed }) => ({ flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6, borderWidth: 1, borderColor: "#38bdf8", borderRadius: colors.radius, paddingVertical: 10, marginTop: 4, opacity: pressed ? 0.7 : 1 })}>
          <Feather name="sliders" size={14} color="#38bdf8" /><Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#38bdf8" }}>Adjust Timing</Text>
        </Pressable>
      )}
    </>
  );
}
