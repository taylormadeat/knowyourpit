import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCookQueryKey } from "@workspace/api-client-react";
import { SettingsRow } from "@/components/plan-screen/SettingsRow";
import { OptionBottomSheet } from "@/components/plan-screen/OptionBottomSheet";
import {
  QP_COOK_METHODS,
  QP_INJECTION_OPTIONS,
  QP_SPRITZ_FREQUENCIES,
  QP_WRAP_FINISH_OPTIONS,
} from "@/constants/cookQuickPicks";

interface TechniquesSectionProps {
  c: any;
  colors: any;
  id: string;
  techsExpanded: boolean;
  setTechsExpanded: (fn: (v: boolean) => boolean) => void;
  techMethodSheetOpen: boolean;
  setTechMethodSheetOpen: (v: boolean) => void;
  techInjectionSheetOpen: boolean;
  setTechInjectionSheetOpen: (v: boolean) => void;
  techSpritzSheetOpen: boolean;
  setTechSpritzSheetOpen: (v: boolean) => void;
  techWrapFinishSheetOpen: boolean;
  setTechWrapFinishSheetOpen: (v: boolean) => void;
  saveTechnique: (data: any) => Promise<void>;
  updateCookMutate: (args: { id: number; data: any }) => Promise<any>;
}

export function TechniquesSection({
  c, colors, id,
  techsExpanded, setTechsExpanded,
  techMethodSheetOpen, setTechMethodSheetOpen,
  techInjectionSheetOpen, setTechInjectionSheetOpen,
  techSpritzSheetOpen, setTechSpritzSheetOpen,
  techWrapFinishSheetOpen, setTechWrapFinishSheetOpen,
  saveTechnique, updateCookMutate,
}: TechniquesSectionProps) {
  const qc = useQueryClient();
  const numId = Number(id);
  const invalidate = () => qc.invalidateQueries({ queryKey: getGetCookQueryKey(numId) });

  const hasTechValues = !!(c.cookingMethod || c.injection || c.spritzFrequency || c.wrapFinish);

  return (
    <>
      <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
        <Pressable onPress={() => setTechsExpanded((v) => !v)} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, flex: 1 }}>Techniques Used</Text>
          {hasTechValues && !techsExpanded && (
            <View style={{ flexDirection: "row", gap: 5 }}>
              {[c.cookingMethod, c.injection, c.spritzFrequency, c.wrapFinish].filter(Boolean).map((v: string, i: number) => (
                <View key={i} style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.muted }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: colors.mutedForeground }}>{v}</Text>
                </View>
              ))}
            </View>
          )}
          <Feather name={techsExpanded ? "chevron-down" : "chevron-right"} size={14} color={colors.mutedForeground} />
        </Pressable>
        {techsExpanded && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
            <SettingsRow label="Cooking Method" value={c.cookingMethod ?? null} placeholder="Not set" icon="thermometer" iconColor="#E84820" onPress={() => setTechMethodSheetOpen(true)} onClear={() => saveTechnique({ cookingMethod: null })} colors={colors} />
            <SettingsRow label="Injection" value={c.injection ?? null} placeholder="Not set" icon="droplet" iconColor="#6C3BF5" onPress={() => setTechInjectionSheetOpen(true)} onClear={() => saveTechnique({ injection: null })} colors={colors} />
            <SettingsRow label="Spritz/Mop Frequency" value={c.spritzFrequency ?? null} placeholder="Not set" icon="wind" iconColor="#0EA5E9" onPress={() => setTechSpritzSheetOpen(true)} onClear={() => saveTechnique({ spritzFrequency: null })} colors={colors} />
            <SettingsRow label="Wrap / Finish" value={c.wrapFinish ?? null} placeholder="Not set" icon="package" iconColor="#F59E0B" onPress={() => setTechWrapFinishSheetOpen(true)} onClear={() => saveTechnique({ wrapFinish: null })} colors={colors} isLast />
          </View>
        )}
      </View>

      <OptionBottomSheet visible={techMethodSheetOpen} title="Cooking Method" options={QP_COOK_METHODS} selected={c.cookingMethod ?? null} onChange={async (v) => { await updateCookMutate({ id: numId, data: { cookingMethod: v } }); await invalidate(); }} onClose={() => setTechMethodSheetOpen(false)} colors={colors} />
      <OptionBottomSheet visible={techInjectionSheetOpen} title="Injection" options={QP_INJECTION_OPTIONS} selected={c.injection ?? null} onChange={async (v) => { await updateCookMutate({ id: numId, data: { injection: v } }); await invalidate(); }} onClose={() => setTechInjectionSheetOpen(false)} colors={colors} />
      <OptionBottomSheet visible={techSpritzSheetOpen} title="Spritz Frequency" options={QP_SPRITZ_FREQUENCIES} selected={c.spritzFrequency ?? null} onChange={async (v) => { await updateCookMutate({ id: numId, data: { spritzFrequency: v } }); await invalidate(); }} onClose={() => setTechSpritzSheetOpen(false)} colors={colors} />
      <OptionBottomSheet visible={techWrapFinishSheetOpen} title="Wrap / Finish" options={QP_WRAP_FINISH_OPTIONS} selected={c.wrapFinish ?? null} onChange={async (v) => { await updateCookMutate({ id: numId, data: { wrapFinish: v } }); await invalidate(); }} onClose={() => setTechWrapFinishSheetOpen(false)} colors={colors} />
    </>
  );
}
