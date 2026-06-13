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
  multiResult: { schedule: MultiCookScheduleItem[]; serveAt: string; summary: string; sharedGrillTips?: string | null } | null;
  isStreaming?: boolean;
  isRetrying?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  scheduleGrillLabels: (string | null)[];
  handleSaveMultiCooks: () => void;
  createCookPending: boolean;
}

function SkeletonRow({ colors }: { colors: Colors }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: 10,
        marginBottom: 10,
        overflow: "hidden",
        borderColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ backgroundColor: "#6C3BF518", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#6C3BF530" }} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ width: 100, height: 12, borderRadius: 6, backgroundColor: colors.border }} />
          <View style={{ width: 60, height: 10, borderRadius: 5, backgroundColor: colors.border }} />
        </View>
        <View style={{ width: 60, height: 10, borderRadius: 5, backgroundColor: colors.border }} />
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 13, height: 13, borderRadius: 6, backgroundColor: colors.border }} />
            <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.border }} />
            <View style={{ width: 40, height: 12, borderRadius: 5, backgroundColor: colors.border }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function MultiCookResultModal(p: Props) {
  const { visible, onClose, colors, multiResult, isStreaming, isRetrying, hasError, onRetry, scheduleGrillLabels, handleSaveMultiCooks, createCookPending } = p;
  const hasItems = multiResult && multiResult.schedule.length > 0;
  const busy = isStreaming || isRetrying;

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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Cook Sequence</Text>
              {busy && (
                <ActivityIndicator size="small" color="#6C3BF5" />
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={10} disabled={busy}>
              <Feather name="x" size={22} color={busy ? colors.border : colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Retrying banner — sits above scroll content */}
          {isRetrying && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#F59E0B18",
              borderBottomWidth: 1,
              borderBottomColor: "#F59E0B40",
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}>
              <ActivityIndicator size="small" color="#F59E0B" />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#F59E0B", flex: 1 }}>
                Having trouble… retrying
              </Text>
            </View>
          )}

          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
            {/* Error state — both attempts failed */}
            {hasError && (
              <View style={{ alignItems: "center", paddingVertical: 32, gap: 16 }}>
                <View style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#EF444420",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Feather name="alert-circle" size={26} color="#EF4444" />
                </View>
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                    Sequencer timed out
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 19 }}>
                    The AI took too long to respond. Tap Retry to try again.
                  </Text>
                </View>
                {onRetry && (
                  <Pressable
                    onPress={onRetry}
                    style={({ pressed }) => [{
                      backgroundColor: "#6C3BF5",
                      borderRadius: colors.radius,
                      paddingVertical: 12,
                      paddingHorizontal: 28,
                      flexDirection: "row" as const,
                      alignItems: "center" as const,
                      gap: 8,
                      opacity: pressed ? 0.7 : 1,
                    }]}
                  >
                    <Feather name="refresh-cw" size={15} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>Retry</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={onClose}
                  style={[s.dismissBtn, { borderRadius: colors.radius, borderColor: colors.border }]}
                >
                  <Text style={[s.dismissBtnText, { color: colors.mutedForeground }]}>Close</Text>
                </Pressable>
              </View>
            )}

            {/* Streaming header row */}
            {isStreaming && !hasItems && !hasError && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <ActivityIndicator size="small" color="#6C3BF5" />
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                  Sequencing your cooks…
                </Text>
              </View>
            )}

            {/* Retrying skeleton when no items yet */}
            {isRetrying && !hasItems && !hasError && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <ActivityIndicator size="small" color="#F59E0B" />
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                  Retrying…
                </Text>
              </View>
            )}

            {/* Partial results arrive progressively */}
            {hasItems && !hasError && (() => {
              const fmtTime = (value: Date | string) =>
                new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return (
                <>
                  {!busy && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Feather name="check-circle" size={16} color="#22c55e" />
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                        Everything ready by {fmtTime(multiResult.serveAt)}
                      </Text>
                    </View>
                  )}

                  {busy && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <ActivityIndicator size="small" color="#6C3BF5" />
                      <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                        Generating schedule…
                      </Text>
                    </View>
                  )}

                  {!busy && multiResult.summary ? (
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
                          {item.isSharedGrillFollowOn ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <Feather name="thermometer" size={13} color="#F59E0B" />
                              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#F59E0B", flex: 1 }}>
                                Grill already hot · add meat
                              </Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <Feather name="power" size={13} color={colors.mutedForeground} />
                              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>
                                {grillLabel ? `Light ${grillLabel}` : "Light grill"}
                              </Text>
                              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                                {new Date(item.grillLightAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </Text>
                            </View>
                          )}
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

                  {/* Skeleton placeholder for items still being generated */}
                  {busy && <SkeletonRow colors={colors} />}

                  {/* Shared grill tips callout — shown when multiple items share a grill */}
                  {!busy && multiResult.sharedGrillTips ? (
                    <View style={{
                      backgroundColor: "#F59E0B18",
                      borderWidth: 1,
                      borderColor: "#F59E0B40",
                      borderRadius: 10,
                      padding: 14,
                      marginTop: 4,
                      gap: 8,
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Feather name="info" size={15} color="#F59E0B" />
                        <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#F59E0B" }}>
                          Shared grill tips
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 20 }}>
                        {multiResult.sharedGrillTips}
                      </Text>
                    </View>
                  ) : null}
                </>
              );
            })()}

            {/* Pure skeleton when no items have arrived yet */}
            {!hasItems && isStreaming && !hasError && (
              <>
                <SkeletonRow colors={colors} />
                <SkeletonRow colors={colors} />
              </>
            )}

            {/* Pure skeleton while retrying with no items */}
            {!hasItems && isRetrying && !hasError && (
              <>
                <SkeletonRow colors={colors} />
                <SkeletonRow colors={colors} />
              </>
            )}

            {/* Action buttons — only shown when streaming is complete and no error */}
            {!busy && !hasError && hasItems && (
              <>
                <Pressable
                  onPress={handleSaveMultiCooks}
                  disabled={createCookPending}
                  style={({ pressed }) => [{
                    backgroundColor: "#6C3BF5",
                    borderRadius: colors.radius,
                    paddingVertical: 14,
                    flexDirection: "row" as const,
                    alignItems: "center" as const,
                    justifyContent: "center" as const,
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
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
