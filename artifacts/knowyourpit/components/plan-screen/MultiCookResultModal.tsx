import React from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import type {
  MultiCookScheduleItem,
} from "@workspace/api-client-react";
import { planStyles as s } from "./styles";
import { fmtMinutes } from "@/utils/duration";

type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  multiResult: { schedule: MultiCookScheduleItem[]; serveAt: string; summary: string } | null;
  scheduleGrillLabels: (string | null)[];
  handleSaveMultiCooks: () => void;
  createCookPending: boolean;
}

export function MultiCookResultModal(p: Props) {
  const { visible, onClose, colors, multiResult, scheduleGrillLabels, handleSaveMultiCooks, createCookPending } = p;
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
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Cook Sequence</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            {multiResult && (() => {
              const fmtTime = (value: Date | string) =>
                new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Feather name="check-circle" size={16} color="#22c55e" />
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                    Everything ready by {fmtTime(multiResult.serveAt)}
                  </Text>
                </View>

                {multiResult.summary ? (
                  <View style={{ backgroundColor: "#6C3BF510", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 19 }}>
                      {multiResult.summary}
                    </Text>
                  </View>
                ) : null}

                {multiResult.schedule.map((item: MultiCookScheduleItem, idx: number) => {
                  const grillLabel = scheduleGrillLabels[idx] ?? null;
                  return (
                  <View
                    key={idx}
                    style={[{
                      borderWidth: 1,
                      borderRadius: 10,
                      marginBottom: 10,
                      overflow: "hidden",
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    }]}
                  >
                    <View style={{ backgroundColor: "#6C3BF518", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#6C3BF5", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" }}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{item.foodType}</Text>
                        {grillLabel ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Feather name="sliders" size={10} color={colors.mutedForeground} />
                            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{grillLabel}</Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontStyle: "italic" }}>No grill selected</Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                        {fmtMinutes(item.estimatedDurationMinutes)} cook
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 7 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Feather name="power" size={13} color={colors.mutedForeground} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>
                          {grillLabel ? `Light ${grillLabel}` : "Light grill"}
                        </Text>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                          {new Date(item.grillLightAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Feather name="zap" size={13} color="#E84820" />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>Meat on</Text>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#E84820" }}>
                          {new Date(item.meatOnAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                      {item.wrapMethod && item.wrapMethod !== "none" && item.wrapAtMinutes && item.wrapAtMinutes > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Feather name="package" size={13} color="#A855F7" />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>
                            {item.wrapMethod === "foil" ? "Wrap in foil" : "Wrap in butcher paper"}
                            {item.wrapTempF ? ` · ${item.wrapTempF}°F` : ""}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#A855F7" }}>
                            {new Date(new Date(item.meatOnAt).getTime() + item.wrapAtMinutes * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Feather name="pause" size={13} color={colors.mutedForeground} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>Pull off · rest {item.restMinutes}m</Text>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                          {new Date(item.estimatedFinishAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                      {item.wrapReason && item.wrapMethod && item.wrapMethod !== "none" ? (
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#A855F7", fontStyle: "italic", marginTop: 2 }}>
                          {item.wrapReason}
                        </Text>
                      ) : null}
                      {item.notes ? (
                        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontStyle: "italic", marginTop: 2 }}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  );
                })}

                <Pressable
                  onPress={handleSaveMultiCooks}
                  disabled={createCookPending}
                  style={({ pressed }) => [{
                    backgroundColor: "#6C3BF5",
                    borderRadius: colors.radius,
                    paddingVertical: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 4,
                    opacity: (pressed || createCookPending) ? 0.7 : 1,
                  }]}
                >
                  {createCookPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name="save" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                        Save {multiResult.schedule.length} Cooks to My Plan
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={onClose}
                  style={[s.dismissBtn, { borderRadius: colors.radius, borderColor: colors.border, marginTop: 10 }]}
                >
                  <Text style={[s.dismissBtnText, { color: colors.mutedForeground }]}>Close</Text>
                </Pressable>
              </>
              );
            })()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
