import React from "react";
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import type {
  MultiCookScheduleItem,
} from "@workspace/api-client-react";
import { planStyles as s } from "./styles";
import { fmtMinutes } from "@/utils/duration";
import { formatTime } from "./utils";

type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  multiResult: { schedule: MultiCookScheduleItem[]; serveAt: string; summary: string; sharedGrillTips?: string | null } | null;
  targetServeAt: Date;
  isStreaming?: boolean;
  isRetrying?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  scheduleGrillLabels: (string | null)[];
  handleSaveMultiCooks: () => void;
  createCookPending: boolean;
  isRetryingSave?: boolean;
  saveSettledCount?: number;
  saveTotalCount?: number;
  failedIndices?: Set<number>;
  onRetryFailed?: () => void;
}

interface GrillGroup {
  label: string | null;
  items: { item: MultiCookScheduleItem; originalIdx: number }[];
}

function buildGrillGroups(
  schedule: MultiCookScheduleItem[],
  grillLabels: (string | null)[],
): GrillGroup[] {
  const groups: GrillGroup[] = [];
  const groupMap = new Map<string, GrillGroup>();

  schedule.forEach((item, idx) => {
    const label = grillLabels[idx] ?? null;
    const key = label ?? "__none__";
    if (!groupMap.has(key)) {
      const group: GrillGroup = { label, items: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key)!.items.push({ item, originalIdx: idx });
  });

  for (const group of groups) {
    group.items.sort(
      (a, b) =>
        new Date(a.item.meatOnAt).getTime() - new Date(b.item.meatOnAt).getTime(),
    );
  }

  return groups;
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

function calendarDayDiff(ts: string | Date, ref: Date): number {
  const a = new Date(ts);
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const rDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((aDay.getTime() - rDay.getTime()) / 86_400_000);
}

function DayBadge({ diff }: { diff: number }) {
  if (diff === 0) return null;
  let label: string;
  if (diff === -1) label = "Day Before";
  else if (diff === 1) label = "Next Day";
  else if (diff < -1) label = `${Math.abs(diff)} Days Before`;
  else label = `${diff} Days After`;
  return (
    <View style={{
      backgroundColor: "#F59E0B",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 6,
    }}>
      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#fff" }}>{label}</Text>
    </View>
  );
}

function ScheduleCard({
  item,
  originalIdx,
  grillLabel,
  colors,
  showGrillSubLabel,
  hasFailed,
  serveDate,
}: {
  item: MultiCookScheduleItem;
  originalIdx: number;
  grillLabel: string | null;
  colors: Colors;
  showGrillSubLabel: boolean;
  hasFailed?: boolean;
  serveDate: Date;
}) {
  const fmtTime = (value: Date | string) => {
    const d = new Date(value);
    return formatTime(d.getHours(), d.getMinutes());
  };

  const grillLightDiff = calendarDayDiff(item.grillLightAt, serveDate);
  const meatOnDiff = calendarDayDiff(item.meatOnAt, serveDate);

  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: 10,
        marginBottom: 10,
        overflow: "hidden",
        borderColor: hasFailed ? "#EF4444" : colors.border,
        backgroundColor: colors.background,
      }}
    >
      <View style={{
        backgroundColor: hasFailed ? "#EF444418" : "#6C3BF518",
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}>
        {hasFailed ? (
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }}>
            <Feather name="alert-circle" size={13} color="#fff" />
          </View>
        ) : (
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#6C3BF5", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" }}>{originalIdx + 1}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: hasFailed ? "#EF4444" : colors.foreground }}>{item.foodType}</Text>
          {hasFailed ? (
            <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#EF4444" }}>
              Save failed · will retry
            </Text>
          ) : showGrillSubLabel ? (
            grillLabel ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="sliders" size={10} color={colors.mutedForeground} />
                <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{grillLabel}</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontStyle: "italic" }}>No grill selected</Text>
            )
          ) : null}
        </View>
        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: hasFailed ? "#EF4444" : colors.mutedForeground }}>
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
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                {fmtTime(item.grillLightAt)}
              </Text>
              <DayBadge diff={grillLightDiff} />
            </View>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Feather name="zap" size={13} color="#E84820" />
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>Meat on</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#E84820" }}>
              {fmtTime(item.meatOnAt)}
            </Text>
            <DayBadge diff={meatOnDiff} />
          </View>
        </View>
        {item.wrapMethod && item.wrapMethod !== "none" && item.wrapAtMinutes && item.wrapAtMinutes > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="package" size={13} color="#A855F7" />
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>
              {item.wrapMethod === "foil" ? "Wrap in foil" : "Wrap in butcher paper"}
              {item.wrapTempF ? ` · ${item.wrapTempF}°F` : ""}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#A855F7" }}>
              {(() => {
                const d = new Date(new Date(item.meatOnAt).getTime() + item.wrapAtMinutes * 60000);
                return formatTime(d.getHours(), d.getMinutes());
              })()}
            </Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Feather name="pause" size={13} color={colors.mutedForeground} />
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>Pull off · rest {item.restMinutes}m</Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
            {fmtTime(item.estimatedFinishAt)}
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
}

export function MultiCookResultModal(p: Props) {
  const {
    visible, onClose, colors, multiResult, targetServeAt, isStreaming, isRetrying, hasError, onRetry,
    scheduleGrillLabels, handleSaveMultiCooks, createCookPending, isRetryingSave,
    saveSettledCount = 0, saveTotalCount = 0,
    failedIndices, onRetryFailed,
  } = p;
  const saveBusy = createCookPending || !!isRetryingSave;
  const hasItems = multiResult && multiResult.schedule.length > 0;
  const busy = isStreaming || isRetrying;
  const hasPartialFailure = !!(failedIndices && failedIndices.size > 0);

  const grillGroups: GrillGroup[] = React.useMemo(() => {
    if (!multiResult) return [];
    return buildGrillGroups(multiResult.schedule, scheduleGrillLabels);
  }, [multiResult, scheduleGrillLabels]);

  const isMultiGrill = grillGroups.length > 1;

  const serveAtDiffMin = React.useMemo(() => {
    if (!multiResult?.serveAt) return 0;
    const actual = new Date(multiResult.serveAt).getTime();
    const target = targetServeAt.getTime();
    return Math.round((actual - target) / 60000);
  }, [multiResult?.serveAt, targetServeAt]);

  const showServeAtWarning = Math.abs(serveAtDiffMin) > 5;

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
              return (
                <>
                  {!busy && !hasPartialFailure && (
                    <View style={{ marginBottom: 14, gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Feather name="check-circle" size={16} color="#22c55e" />
                        <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                          Everything ready by {formatTime(targetServeAt.getHours(), targetServeAt.getMinutes())}
                        </Text>
                      </View>
                      {showServeAtWarning && multiResult && (() => {
                        const actualDate = new Date(multiResult.serveAt);
                        const actualTime = formatTime(actualDate.getHours(), actualDate.getMinutes());
                        const absDiff = Math.abs(serveAtDiffMin);
                        const direction = serveAtDiffMin > 0 ? "after" : "before";
                        return (
                          <View style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 7,
                            backgroundColor: "#F59E0B18",
                            borderRadius: 8,
                            padding: 10,
                            borderWidth: 1,
                            borderColor: "#F59E0B40",
                          }}>
                            <Feather name="alert-triangle" size={14} color="#F59E0B" style={{ marginTop: 1 }} />
                            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#F59E0B", flex: 1, lineHeight: 18 }}>
                              Heads up: schedule finishes at {actualTime} — {absDiff} min {direction} your target
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {!busy && hasPartialFailure && (
                    <View style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 14,
                      backgroundColor: "#EF444418",
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: "#EF444440",
                    }}>
                      <Feather name="alert-circle" size={16} color="#EF4444" />
                      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#EF4444", flex: 1 }}>
                        {failedIndices!.size} of {multiResult.schedule.length} {failedIndices!.size === 1 ? "cook" : "cooks"} failed to save
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

                  {isMultiGrill ? (
                    grillGroups.map((group, groupIdx) => (
                      <View key={groupIdx}>
                        <View style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 7,
                          marginTop: groupIdx === 0 ? 0 : 10,
                          marginBottom: 8,
                          paddingBottom: 6,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}>
                          <Feather name="sliders" size={13} color={colors.mutedForeground} />
                          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground, flex: 1 }}>
                            {group.label ?? "No grill selected"}
                          </Text>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                            {group.items.length} {group.items.length === 1 ? "item" : "items"}
                          </Text>
                        </View>

                        {group.items.map(({ item, originalIdx }) => (
                          <ScheduleCard
                            key={originalIdx}
                            item={item}
                            originalIdx={originalIdx}
                            grillLabel={group.label}
                            colors={colors}
                            showGrillSubLabel={false}
                            hasFailed={failedIndices?.has(originalIdx)}
                            serveDate={targetServeAt}
                          />
                        ))}
                      </View>
                    ))
                  ) : (
                    grillGroups[0]?.items.map(({ item, originalIdx }) => (
                      <ScheduleCard
                        key={originalIdx}
                        item={item}
                        originalIdx={originalIdx}
                        grillLabel={scheduleGrillLabels[originalIdx] ?? null}
                        colors={colors}
                        showGrillSubLabel={true}
                        hasFailed={failedIndices?.has(originalIdx)}
                        serveDate={targetServeAt}
                      />
                    ))
                  )}

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
                {/* Partial failure: show Retry Failed button */}
                {hasPartialFailure ? (
                  <>
                    <Pressable
                      onPress={onRetryFailed}
                      disabled={saveBusy}
                      style={({ pressed }) => [{
                        backgroundColor: "#EF4444",
                        borderRadius: colors.radius,
                        paddingVertical: 14,
                        flexDirection: "row" as const,
                        alignItems: "center" as const,
                        justifyContent: "center" as const,
                        gap: 8,
                        marginTop: 4,
                        opacity: (pressed || saveBusy) ? 0.7 : 1,
                      }]}
                    >
                      {saveBusy ? (
                        <>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                            {`Retrying ${saveSettledCount} of ${saveTotalCount}…`}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Feather name="refresh-cw" size={16} color="#fff" />
                          <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                            Retry {failedIndices!.size} Failed {failedIndices!.size === 1 ? "Cook" : "Cooks"}
                          </Text>
                        </>
                      )}
                    </Pressable>

                    <Text style={{
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                      color: colors.mutedForeground,
                      textAlign: "center",
                      marginTop: 8,
                    }}>
                      Check your connection and try again
                    </Text>
                  </>
                ) : (
                  /* All saved: show normal Save button */
                  <Pressable
                    onPress={handleSaveMultiCooks}
                    disabled={saveBusy}
                    style={({ pressed }) => [{
                      backgroundColor: "#6C3BF5",
                      borderRadius: colors.radius,
                      paddingVertical: 14,
                      flexDirection: "row" as const,
                      alignItems: "center" as const,
                      justifyContent: "center" as const,
                      gap: 8,
                      marginTop: 4,
                      opacity: (pressed || saveBusy) ? 0.7 : 1,
                    }]}
                  >
                    {saveBusy ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                          {isRetryingSave
                            ? `Retrying ${saveSettledCount} of ${saveTotalCount}…`
                            : `Saving ${saveSettledCount} of ${saveTotalCount}…`}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Feather name="save" size={16} color="#fff" />
                        <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                          Save {multiResult.schedule.length} Cooks to My Plan
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

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
