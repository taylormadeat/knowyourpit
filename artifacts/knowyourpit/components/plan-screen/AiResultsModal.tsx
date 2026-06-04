import React, { useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { planStyles as s } from "./styles";
import { fmtMinutes } from "@/utils/duration";
import { fmtDuration, formatDateTime } from "./utils";

type Colors = any;

interface SelectedChips {
  cookingMethod?: string | null;
  meatStartTemp?: string | null;
  injection?: string | null;
  spritzFrequency?: string | null;
  wrapFinish?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  aiResult: any | null;
  applyAiPlan: () => void;
  grillName?: string;
  selectedChips?: SelectedChips;
  retrying?: boolean;
}

const CHIP_LABELS: { key: keyof SelectedChips; label: string }[] = [
  { key: "cookingMethod", label: "Method" },
  { key: "meatStartTemp", label: "Start Temp" },
  { key: "injection", label: "Injection" },
  { key: "spritzFrequency", label: "Spritz/Mop" },
  { key: "wrapFinish", label: "Wrap" },
];

export function AiResultsModal(p: Props) {
  const { visible, onClose, colors, aiResult, applyAiPlan, grillName, selectedChips, retrying } = p;

  const activeChips = selectedChips
    ? CHIP_LABELS.filter((c) => selectedChips[c.key])
    : [];

  const [checkinsExpanded, setCheckinsExpanded] = useState(false);

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
                {/* ── Timeout notice ── */}
                {aiResult.timedOut && (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 14,
                    marginBottom: 2,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: "#F59E0B18",
                    borderWidth: 1,
                    borderColor: "#F59E0B40",
                    borderRadius: 10,
                  }}>
                    {retrying ? (
                      <ActivityIndicator size="small" color="#F59E0B" />
                    ) : (
                      <Feather name="clock" size={14} color="#F59E0B" />
                    )}
                    <Text style={{
                      flex: 1,
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#D97706",
                      lineHeight: 17,
                    }}>
                      {retrying
                        ? "Getting your personalized plan — updating in a moment…"
                        : "Taking longer than usual — here's a rough estimate. Tap \"Apply\" or try again for a personalized plan."}
                    </Text>
                  </View>
                )}

                {/* ── Technique selections echo ── */}
                {activeChips.length > 0 && (
                  <View style={{
                    marginTop: 14,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                  }}>
                    <Text style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 11,
                      color: colors.mutedForeground,
                      marginRight: 2,
                    }}>
                      Your picks:
                    </Text>
                    {activeChips.map(({ key, label }) => (
                      <View
                        key={key}
                        style={{
                          backgroundColor: "#6C3BF5" + "15",
                          borderColor: "#6C3BF5" + "40",
                          borderWidth: 1,
                          borderRadius: 20,
                          paddingHorizontal: 10,
                          paddingVertical: 3,
                        }}
                      >
                        <Text style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 11,
                          color: "#6C3BF5",
                        }}>
                          {label}: {selectedChips![key]}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

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
                  {(aiResult.fingerprintSource === "grill" || aiResult.fingerprintSource === "user") && (() => {
                    const note: string | null = aiResult.fingerprintNote ?? null;
                    const countMatch = note ? note.match(/across (\d+) cook/) : null;
                    const n = countMatch ? parseInt(countMatch[1], 10) : null;
                    const cookWord = n === 1 ? "cook" : "cooks";
                    let label: string;
                    if (aiResult.fingerprintSource === "grill") {
                      label = n != null
                        ? `Tuned to your ${n} ${cookWord} on this grill`
                        : "Tuned to your cook history on this grill";
                    } else {
                      const meatMatch = note ? note.match(/learned pace on ([^(]+?) \(across all grills\)/) : null;
                      const meat = meatMatch ? meatMatch[1].trim() : null;
                      label = n != null && meat
                        ? `Tuned to your ${n} ${meat} ${cookWord}`
                        : n != null
                          ? `Tuned to your ${n} personal ${cookWord}`
                          : "Tuned to your personal cook history";
                    }
                    return (
                      <View style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 10,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}>
                        <Feather name="bar-chart-2" size={12} color={colors.mutedForeground} />
                        <Text style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 12,
                          color: colors.mutedForeground,
                          flex: 1,
                        }}>
                          {label}
                        </Text>
                      </View>
                    );
                  })()}
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

                {aiResult.checkins && aiResult.checkins.length > 0 && (
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <Pressable
                      onPress={() => setCheckinsExpanded((v) => !v)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                      hitSlop={8}
                    >
                      <Feather name="clock" size={14} color="#6C3BF5" />
                      <Text style={[s.aiSectionTitle, { color: colors.foreground, flex: 1, marginBottom: 0 }]}>
                        Check-In Schedule
                      </Text>
                      <View style={{
                        backgroundColor: "#6C3BF5" + "18",
                        borderColor: "#6C3BF5" + "40",
                        borderWidth: 1,
                        borderRadius: 12,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        marginRight: 4,
                      }}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6C3BF5" }}>
                          {aiResult.checkins.length} check-ins
                        </Text>
                      </View>
                      <Feather
                        name={checkinsExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </Pressable>

                    {checkinsExpanded && (
                      <View style={{ marginTop: 12 }}>
                        {aiResult.checkins.map((ci: any, i: number) => {
                          const isWrap = /wrap/i.test(ci.label);
                          return (
                            <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                              <View style={{ alignItems: "center", width: 32 }}>
                                <View style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: isWrap ? "#F59E0B18" : "#6C3BF5" + "15",
                                  borderWidth: 1,
                                  borderColor: isWrap ? "#F59E0B40" : "#6C3BF5" + "30",
                                }}>
                                  <Feather
                                    name={isWrap ? "package" : "check-circle"}
                                    size={12}
                                    color={isWrap ? "#F59E0B" : "#6C3BF5"}
                                  />
                                </View>
                                {i < aiResult.checkins.length - 1 && (
                                  <View style={{ width: 1, flex: 1, backgroundColor: colors.border, marginTop: 3 }} />
                                )}
                              </View>
                              <View style={{ flex: 1, paddingBottom: i < aiResult.checkins.length - 1 ? 4 : 0 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                  <Text style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_700Bold",
                                    color: isWrap ? "#F59E0B" : colors.foreground,
                                    flex: 1,
                                  }}>
                                    {ci.label}
                                  </Text>
                                  <Text style={{
                                    fontSize: 11,
                                    fontFamily: "Inter_600SemiBold",
                                    color: colors.mutedForeground,
                                  }}>
                                    +{fmtDuration(ci.offsetMinutes)}
                                  </Text>
                                  {ci.expectedInternalTempRange && (
                                    <View style={{
                                      backgroundColor: colors.muted,
                                      borderRadius: 8,
                                      paddingHorizontal: 6,
                                      paddingVertical: 2,
                                    }}>
                                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                                        {ci.expectedInternalTempRange[0]}–{ci.expectedInternalTempRange[1]}°F
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                {ci.coachingNote ? (
                                  <Text style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_400Regular",
                                    color: colors.mutedForeground,
                                    lineHeight: 17,
                                  }}>
                                    {ci.coachingNote}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
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
