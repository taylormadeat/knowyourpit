import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { planStyles as s } from "./styles";
import { fmtMinutes } from "@/utils/duration";
import { fmtDuration, formatDateTime } from "./utils";

type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  aiResult: any | null;
  applyAiPlan: () => void;
}

export function AiResultsModal(p: Props) {
  const { visible, onClose, colors, aiResult, applyAiPlan } = p;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[s.modalHandle, { backgroundColor: colors.border }]} />

          <LinearGradient
            colors={["#6C3BF5", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.aiModalHeader}
          >
            <Feather name="cpu" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.aiModalTitle}>PitMaster Plan</Text>
              {aiResult && (
                <Text style={s.aiModalSub}>
                  {aiResult.confidence?.toUpperCase()} confidence · {fmtMinutes(aiResult.estimatedDurationMinutes)} active cook
                </Text>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
            {aiResult && (
              <>
                <View style={[s.aiSection, { borderColor: colors.border }]}>
                  <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>PitMaster Analysis</Text>
                  <Text style={[s.aiBody, { color: colors.mutedForeground }]}>{aiResult.rationale}</Text>
                </View>

                <View style={[s.aiSection, { borderColor: colors.border }]}>
                  <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Suggested Schedule</Text>
                  {[
                    { icon: "power", label: "Light grill", val: aiResult.grillLightAt },
                    { icon: "zap", label: "Put food on", val: aiResult.suggestedStartAt },
                    { icon: "pause", label: "Pull off grill", val: aiResult.estimatedFinishAt },
                    { icon: "check-circle", label: "Ready to serve", val: aiResult.serveAt },
                  ].filter(r => r.val).map((row) => (
                    <View key={row.label} style={s.aiScheduleRow}>
                      <Feather name={row.icon as any} size={14} color="#6C3BF5" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.aiScheduleLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                        <Text style={[s.aiScheduleVal, { color: colors.foreground }]}>
                          {formatDateTime(new Date(row.val as string))}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {aiResult.wrap && (
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Wrapping Guidance</Text>
                    <View style={[s.wrapBadgeRow]}>
                      <View style={[s.wrapBadge, { backgroundColor: "#6C3BF5" + "18" }]}>
                        <Text style={[s.wrapBadgeText, { color: "#6C3BF5" }]}>
                          {aiResult.wrap.method === "none" ? "No wrap needed" : aiResult.wrap.method === "butcher_paper" ? "Butcher Paper" : "Foil (Texas Crutch)"}
                        </Text>
                      </View>
                      {aiResult.wrap.wrapAtMinutes > 0 && (
                        <View style={[s.wrapBadge, { backgroundColor: colors.muted }]}>
                          <Text style={[s.wrapBadgeText, { color: colors.foreground }]}>
                            At {fmtDuration(aiResult.wrap.wrapAtMinutes)} into cook
                          </Text>
                        </View>
                      )}
                      {aiResult.wrap.wrapTempF && (
                        <View style={[s.wrapBadge, { backgroundColor: colors.muted }]}>
                          <Text style={[s.wrapBadgeText, { color: colors.foreground }]}>
                            {aiResult.wrap.wrapTempF}°F internal
                          </Text>
                        </View>
                      )}
                    </View>
                    {aiResult.wrap.reason && (
                      <Text style={[s.aiBody, { color: colors.mutedForeground, marginTop: 8 }]}>{aiResult.wrap.reason}</Text>
                    )}
                    {aiResult.wrap.restMinutes > 0 && (
                      <View style={[s.restRow, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                        <Feather name="coffee" size={14} color={colors.primary} />
                        <Text style={[s.restText, { color: colors.foreground }]}>
                          Rest for <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{fmtDuration(aiResult.wrap.restMinutes)}</Text> after pulling
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {aiResult.tips && aiResult.tips.length > 0 && (
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Pit Master Tips</Text>
                    {aiResult.tips.map((tip: string, i: number) => (
                      <View key={i} style={s.tipRow}>
                        <View style={[s.tipBullet, { backgroundColor: "#6C3BF5" }]} />
                        <Text style={[s.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Pressable
                  onPress={applyAiPlan}
                  style={({ pressed }) => [
                    s.applyBtn,
                    { borderRadius: colors.radius },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <LinearGradient
                    colors={["#6C3BF5", "#A855F7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.applyBtnGradient}
                  >
                    <Feather name="check" size={18} color="#fff" />
                    <Text style={s.applyBtnText}>Apply PitMaster Plan</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={onClose}
                  style={[s.dismissBtn, { borderRadius: colors.radius, borderColor: colors.border }]}
                >
                  <Text style={[s.dismissBtnText, { color: colors.mutedForeground }]}>Keep manual plan</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
