import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCook,
  useUpdateCook,
  useAiMultiCook,
  type MultiCookScheduleItem,
  getGetCookQueryKey,
  getListCooksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
} from "@workspace/api-client-react";
import { MultiCookAddItemModal } from "@/components/plan-screen/MultiCookAddItemModal";
import { DatePickerModal, TimePickerModal } from "@/components/plan-screen/DateTimePickerModals";
import { planStyles as s } from "@/components/plan-screen/styles";
import {
  formatDate,
  formatTime,
  getUpcomingDates,
  preheatMinsForGrill,
} from "@/components/plan-screen/utils";
import { MEAT_CUTS, type MeatCut } from "@/constants/meatCuts";
import { fmtMinutes } from "@/utils/duration";

type Colors = any;
type Insets = { top: number; bottom: number; left: number; right: number };

interface MultiItem {
  cut: MeatCut;
  weightLbs: string;
  grillId: number | null;
  cookMethod: import("@/constants/cookQuickPicks").QpCookMethod | null;
  meatStartTemp: import("@/constants/cookQuickPicks").QpMeatStartTemp | null;
  injection: import("@/constants/cookQuickPicks").QpInjectionOption | null;
  spritz: import("@/constants/cookQuickPicks").QpSpritzFrequency | null;
  wrapFinish: import("@/constants/cookQuickPicks").QpWrapFinishOption | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  insets: Insets;
  cookId: number;
  cookFoodType: string | null;
  cookWeightLbs: number | null;
  cookGrillId: number | null;
  grills: any[];
  onSuccess: () => void;
}

function makeDefaultServeAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  return d;
}

export function AddToPlannedCookModal(p: Props) {
  const {
    visible,
    onClose,
    colors,
    insets,
    cookId,
    cookFoodType,
    cookWeightLbs,
    cookGrillId,
    grills,
    onSuccess,
  } = p;

  const qc = useQueryClient();
  const createCook = useCreateCook();
  const updateCook = useUpdateCook();
  const aiMultiCook = useAiMultiCook();

  const [step, setStep] = useState<"setup" | "result">("setup");
  const [additionalItems, setAdditionalItems] = useState<MultiItem[]>([]);
  const [serveAt, setServeAt] = useState<Date>(makeDefaultServeAt);
  const [aiResult, setAiResult] = useState<{
    schedule: MultiCookScheduleItem[];
    serveAt: string;
    summary: string;
  } | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [multiAddCat, setMultiAddCat] = useState("Beef");
  const [multiPickedCut, setMultiPickedCut] = useState<MeatCut | null>(null);
  const [multiAddWeightInput, setMultiAddWeightInput] = useState("");
  const [saving, setSaving] = useState(false);

  const upcomingDates = useMemo(() => getUpcomingDates(), []);

  const anchorGrill = useMemo(
    () => (grills as any[]).find((g: any) => g.id === cookGrillId) ?? null,
    [grills, cookGrillId],
  );

  const scheduleGrillLabels = useMemo(() => {
    if (!aiResult) return [];
    const anchorFoodTypeLower = (cookFoodType ?? "").toLowerCase();
    let anchorUsed = false;
    return aiResult.schedule.map((item) => {
      if (!anchorUsed && item.foodType.toLowerCase() === anchorFoodTypeLower) {
        anchorUsed = true;
        return anchorGrill?.name ?? null;
      }
      const inputItem = additionalItems.find(
        (m) => m.cut.name.toLowerCase() === item.foodType.toLowerCase(),
      );
      const grillId = inputItem?.grillId ?? cookGrillId;
      if (!grillId) return null;
      return (grills as any[]).find((g: any) => g.id === grillId)?.name ?? null;
    });
  }, [aiResult, additionalItems, cookFoodType, cookGrillId, grills, anchorGrill]);

  const handleReset = () => {
    setStep("setup");
    setAdditionalItems([]);
    setServeAt(makeDefaultServeAt());
    setAiResult(null);
    setMultiAddCat("Beef");
    setMultiPickedCut(null);
    setMultiAddWeightInput("");
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleGenerate = async () => {
    if (additionalItems.length === 0) {
      Alert.alert(
        "Add Items",
        "Add at least one more item to create a multi-cook session.",
      );
      return;
    }
    try {
      const anchorCut = MEAT_CUTS.find(
        (c) => c.name.toLowerCase() === (cookFoodType ?? "").toLowerCase(),
      );
      const allItems = [
        {
          foodType: cookFoodType ?? "Meat",
          weightLbs:
            cookWeightLbs != null && cookWeightLbs > 0
              ? cookWeightLbs
              : undefined,
          cookTempF: anchorCut?.cookTempF,
          targetTempF: anchorCut?.targetTempF,
          grillId: cookGrillId ?? undefined,
          preheatMinutes: preheatMinsForGrill(anchorGrill),
        },
        ...additionalItems.map((item) => {
          const itemGrill =
            item.grillId != null
              ? ((grills as any[]).find((g: any) => g.id === item.grillId) ??
                null)
              : anchorGrill;
          return {
            foodType: item.cut.name,
            weightLbs:
              parseFloat(item.weightLbs) > 0
                ? parseFloat(item.weightLbs)
                : undefined,
            cookTempF: item.cut.cookTempF,
            targetTempF: item.cut.targetTempF,
            grillId: item.grillId ?? cookGrillId ?? undefined,
            preheatMinutes: preheatMinsForGrill(itemGrill),
          };
        }),
      ];
      const result = await aiMultiCook.mutateAsync({
        data: {
          items: allItems,
          serveAt: serveAt.toISOString(),
        },
      });
      setAiResult(result as any);
      setStep("result");
    } catch (e: any) {
      Alert.alert(
        "PitMaster Error",
        e?.message || "Could not sequence cooks. Try again.",
      );
    }
  };

  const handleSave = async () => {
    if (!aiResult) return;
    setSaving(true);
    try {
      const sessionId = Crypto.randomUUID();
      const serveTimeStr = new Date(aiResult.serveAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const sessionLabel = `Multi-cook session · Serve at ${serveTimeStr}`;
      const seqData = {
        schedule: aiResult.schedule,
        serveAt: aiResult.serveAt,
        summary: (aiResult as any).summary ?? null,
      };

      const anchorFoodTypeLower = (cookFoodType ?? "").toLowerCase();
      const anchorScheduleItem =
        aiResult.schedule.find(
          (item) => item.foodType.toLowerCase() === anchorFoodTypeLower,
        ) ?? aiResult.schedule[0];

      await updateCook.mutateAsync({
        id: cookId,
        data: {
          sessionId,
          sessionLabel,
          sequenceData: seqData,
          plannedStartAt: new Date(anchorScheduleItem.meatOnAt).toISOString(),
        } as any,
      });

      const remainingItems = [...additionalItems];
      for (const scheduleItem of aiResult.schedule) {
        if (scheduleItem === anchorScheduleItem) continue;

        const inputIdx = remainingItems.findIndex(
          (m) => m.cut.name.toLowerCase() === scheduleItem.foodType.toLowerCase(),
        );
        const inputItem =
          inputIdx >= 0 ? remainingItems.splice(inputIdx, 1)[0] : undefined;
        const inputWeightLbs = inputItem
          ? parseFloat(inputItem.weightLbs) || undefined
          : undefined;
        const resolvedGrillId =
          inputItem?.grillId ?? cookGrillId ?? undefined;
        const matchedCut = MEAT_CUTS.find(
          (c) => c.name.toLowerCase() === scheduleItem.foodType.toLowerCase(),
        );

        const wrapMethodDb =
          scheduleItem.wrapMethod === "foil"
            ? ("foil" as const)
            : scheduleItem.wrapMethod === "butcher_paper"
              ? ("butcher_paper" as const)
              : scheduleItem.wrapMethod === "none"
                ? ("none" as const)
                : undefined;

        await createCook.mutateAsync({
          data: {
            foodType: scheduleItem.foodType,
            weightLbs: inputWeightLbs,
            cookTempF: matchedCut?.cookTempF ?? undefined,
            targetTempF: matchedCut?.targetTempF ?? undefined,
            grillId: resolvedGrillId,
            plannedStartAt: new Date(
              scheduleItem.meatOnAt,
            ).toISOString(),
            sessionId,
            sessionLabel,
            notes: sessionLabel,
            ...(wrapMethodDb !== undefined && { wrapMethod: wrapMethodDb }),
            ...(scheduleItem.wrapAtMinutes &&
              scheduleItem.wrapAtMinutes > 0 && {
                wrapAtMinutes: Math.round(scheduleItem.wrapAtMinutes),
              }),
            ...(scheduleItem.wrapTempF && {
              wrapTempF: Math.round(scheduleItem.wrapTempF),
            }),
            ...(scheduleItem.wrapReason && {
              wrapReason: scheduleItem.wrapReason,
            }),
            sequenceData: seqData as any,
          } as any,
        });
      }

      await qc.invalidateQueries({ queryKey: getGetCookQueryKey(cookId) });
      await qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      await qc.invalidateQueries({
        queryKey: getGetDashboardSummaryQueryKey(),
      });
      await qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
      onSuccess();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const fmtTime = (v: Date | string) =>
    new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const canGenerate = additionalItems.length > 0;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <View style={[s.modalOverlay, { justifyContent: "flex-end" }]}>
          <View
            style={[
              s.modalSheet,
              { backgroundColor: colors.card, maxHeight: "92%" },
            ]}
          >
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />

            <View
              style={[s.modalHeader, { borderBottomColor: colors.border }]}
            >
              {step === "result" ? (
                <Pressable
                  onPress={() => setStep("setup")}
                  hitSlop={10}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Feather
                    name="arrow-left"
                    size={18}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[s.modalTitle, { color: colors.foreground }]}
                  >
                    Cook Sequence
                  </Text>
                </Pressable>
              ) : (
                <Text style={[s.modalTitle, { color: colors.foreground }]}>
                  Add to Planned Cook
                </Text>
              )}
              <Pressable onPress={handleClose} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                padding: 16,
                paddingBottom: insets.bottom + 24,
              }}
            >
              {step === "setup" ? (
                <>
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 11,
                      color: colors.mutedForeground,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 8,
                    }}
                  >
                    This Cook (anchor)
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: "#E84820",
                      borderRadius: colors.radius,
                      padding: 12,
                      marginBottom: 20,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: "#E84820",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="anchor" size={13} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: "Inter_700Bold",
                          fontSize: 14,
                          color: colors.foreground,
                        }}
                      >
                        {cookFoodType ?? "Cook"}
                      </Text>
                      {(cookWeightLbs != null || anchorGrill) && (
                        <Text
                          style={{
                            fontFamily: "Inter_400Regular",
                            fontSize: 12,
                            color: colors.mutedForeground,
                          }}
                        >
                          {[
                            cookWeightLbs != null
                              ? `${cookWeightLbs} lbs`
                              : null,
                            anchorGrill?.name ?? null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      )}
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 10,
                        backgroundColor: "#E8482018",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 10,
                          color: "#E84820",
                        }}
                      >
                        Anchor
                      </Text>
                    </View>
                  </View>

                  {additionalItems.length > 0 && (
                    <>
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 11,
                          color: colors.mutedForeground,
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          marginBottom: 8,
                        }}
                      >
                        Added Items
                      </Text>
                      <View
                        style={{
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: colors.radius,
                          marginBottom: 12,
                          overflow: "hidden",
                        }}
                      >
                        {additionalItems.map((item, idx) => (
                          <View
                            key={idx}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderBottomWidth:
                                idx < additionalItems.length - 1 ? 1 : 0,
                              borderBottomColor: colors.border,
                              gap: 10,
                            }}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: "#6C3BF5",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 10,
                                  fontFamily: "Inter_700Bold",
                                }}
                              >
                                {idx + 2}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontFamily: "Inter_600SemiBold",
                                  fontSize: 13,
                                  color: colors.foreground,
                                }}
                              >
                                {item.cut.name}
                              </Text>
                              {item.weightLbs ? (
                                <Text
                                  style={{
                                    fontFamily: "Inter_400Regular",
                                    fontSize: 11,
                                    color: colors.mutedForeground,
                                  }}
                                >
                                  {item.weightLbs} lbs
                                </Text>
                              ) : null}
                            </View>
                            <Pressable
                              onPress={() =>
                                setAdditionalItems((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              hitSlop={10}
                            >
                              <Feather
                                name="trash-2"
                                size={14}
                                color={colors.mutedForeground}
                              />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  <Pressable
                    onPress={() => setAddItemOpen(true)}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row" as const,
                        alignItems: "center" as const,
                        justifyContent: "center" as const,
                        gap: 8,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        borderRadius: colors.radius,
                        paddingVertical: 11,
                        marginBottom: 22,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Feather name="plus" size={16} color={colors.primary} />
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 14,
                        color: colors.primary,
                      }}
                    >
                      Add Another Item
                    </Text>
                  </Pressable>

                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 11,
                      color: colors.mutedForeground,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 8,
                    }}
                  >
                    Target Serve Time
                  </Text>
                  <View
                    style={{ flexDirection: "row", gap: 10, marginBottom: 26 }}
                  >
                    <Pressable
                      onPress={() => setDatePickerOpen(true)}
                      style={({ pressed }) => [
                        {
                          flex: 1,
                          flexDirection: "row" as const,
                          alignItems: "center" as const,
                          gap: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: colors.radius,
                          paddingHorizontal: 12,
                          paddingVertical: 11,
                          backgroundColor: colors.background,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name="calendar"
                        size={14}
                        color={colors.primary}
                      />
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 13,
                          color: colors.foreground,
                        }}
                      >
                        {formatDate(serveAt)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setTimePickerOpen(true)}
                      style={({ pressed }) => [
                        {
                          flex: 1,
                          flexDirection: "row" as const,
                          alignItems: "center" as const,
                          gap: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: colors.radius,
                          paddingHorizontal: 12,
                          paddingVertical: 11,
                          backgroundColor: colors.background,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Feather name="clock" size={14} color={colors.primary} />
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 13,
                          color: colors.foreground,
                        }}
                      >
                        {formatTime(
                          serveAt.getHours(),
                          serveAt.getMinutes(),
                        )}
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={handleGenerate}
                    disabled={!canGenerate || aiMultiCook.isPending}
                    style={({ pressed }) => [
                      {
                        backgroundColor: canGenerate ? "#6C3BF5" : colors.muted,
                        borderRadius: colors.radius,
                        paddingVertical: 14,
                        flexDirection: "row" as const,
                        alignItems: "center" as const,
                        justifyContent: "center" as const,
                        gap: 8,
                        opacity:
                          pressed || aiMultiCook.isPending ? 0.7 : 1,
                      },
                    ]}
                  >
                    {aiMultiCook.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Feather
                          name="zap"
                          size={16}
                          color={canGenerate ? "#fff" : colors.mutedForeground}
                        />
                        <Text
                          style={{
                            fontFamily: "Inter_700Bold",
                            fontSize: 15,
                            color: canGenerate
                              ? "#fff"
                              : colors.mutedForeground,
                          }}
                        >
                          Generate Schedule
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {!canGenerate && (
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: colors.mutedForeground,
                        textAlign: "center",
                        marginTop: 8,
                      }}
                    >
                      Add at least one more item to generate a schedule
                    </Text>
                  )}
                </>
              ) : aiResult ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    <Feather name="check-circle" size={16} color="#22c55e" />
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: "Inter_600SemiBold",
                        color: colors.foreground,
                      }}
                    >
                      Everything ready by {fmtTime(aiResult.serveAt)}
                    </Text>
                  </View>

                  {aiResult.summary ? (
                    <View
                      style={{
                        backgroundColor: "#6C3BF510",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 16,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: "Inter_400Regular",
                          color: colors.foreground,
                          lineHeight: 19,
                        }}
                      >
                        {aiResult.summary}
                      </Text>
                    </View>
                  ) : null}

                  {(() => {
                    const anchorFoodTypeLower = (
                      cookFoodType ?? ""
                    ).toLowerCase();
                    let anchorMarked = false;
                    return aiResult.schedule.map(
                      (item: MultiCookScheduleItem, idx: number) => {
                        const isAnchor =
                          !anchorMarked &&
                          item.foodType.toLowerCase() === anchorFoodTypeLower;
                        if (isAnchor) anchorMarked = true;
                        const grillLabel = scheduleGrillLabels[idx] ?? null;
                        return (
                          <View
                            key={idx}
                            style={{
                              borderWidth: 1,
                              borderRadius: 10,
                              marginBottom: 10,
                              overflow: "hidden",
                              borderColor: isAnchor
                                ? "#E84820"
                                : colors.border,
                              backgroundColor: colors.background,
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: isAnchor
                                  ? "#E8482018"
                                  : "#6C3BF518",
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <View
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  backgroundColor: isAnchor
                                    ? "#E84820"
                                    : "#6C3BF5",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {isAnchor ? (
                                  <Feather
                                    name="anchor"
                                    size={11}
                                    color="#fff"
                                  />
                                ) : (
                                  <Text
                                    style={{
                                      color: "#fff",
                                      fontSize: 11,
                                      fontFamily: "Inter_700Bold",
                                    }}
                                  >
                                    {idx + 1}
                                  </Text>
                                )}
                              </View>
                              <View style={{ flex: 1, gap: 2 }}>
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontFamily: "Inter_700Bold",
                                    color: colors.foreground,
                                  }}
                                >
                                  {item.foodType}
                                  {isAnchor ? " (this cook)" : ""}
                                </Text>
                                {grillLabel ? (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <Feather
                                      name="sliders"
                                      size={10}
                                      color={colors.mutedForeground}
                                    />
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontFamily: "Inter_500Medium",
                                        color: colors.mutedForeground,
                                      }}
                                    >
                                      {grillLabel}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontFamily: "Inter_400Regular",
                                      color: colors.mutedForeground,
                                      fontStyle: "italic",
                                    }}
                                  >
                                    No grill selected
                                  </Text>
                                )}
                              </View>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: "Inter_500Medium",
                                  color: colors.mutedForeground,
                                }}
                              >
                                {fmtMinutes(item.estimatedDurationMinutes)} cook
                              </Text>
                            </View>
                            <View
                              style={{
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                gap: 7,
                              }}
                            >
                              {item.warning ? (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "flex-start",
                                    gap: 8,
                                    backgroundColor: "#EF444418",
                                    borderWidth: 1,
                                    borderColor: "#EF4444",
                                    borderRadius: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    marginBottom: 4,
                                  }}
                                >
                                  <Feather
                                    name="alert-triangle"
                                    size={14}
                                    color="#EF4444"
                                    style={{ marginTop: 1 }}
                                  />
                                  <Text
                                    style={{
                                      flex: 1,
                                      fontSize: 12,
                                      fontFamily: "Inter_600SemiBold",
                                      color: "#EF4444",
                                      lineHeight: 17,
                                    }}
                                  >
                                    {item.warning}
                                  </Text>
                                </View>
                              ) : null}
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <Feather
                                  name="power"
                                  size={13}
                                  color={colors.mutedForeground}
                                />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_400Regular",
                                    color: colors.mutedForeground,
                                    flex: 1,
                                  }}
                                >
                                  {grillLabel
                                    ? `Light ${grillLabel}`
                                    : "Light grill"}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontFamily: "Inter_700Bold",
                                    color: colors.foreground,
                                  }}
                                >
                                  {fmtTime(item.grillLightAt)}
                                </Text>
                              </View>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <Feather
                                  name="zap"
                                  size={13}
                                  color="#E84820"
                                />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_400Regular",
                                    color: colors.mutedForeground,
                                    flex: 1,
                                  }}
                                >
                                  Meat on
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontFamily: "Inter_700Bold",
                                    color: "#E84820",
                                  }}
                                >
                                  {fmtTime(item.meatOnAt)}
                                </Text>
                              </View>
                              {item.wrapMethod &&
                                item.wrapMethod !== "none" &&
                                item.wrapAtMinutes &&
                                item.wrapAtMinutes > 0 && (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 10,
                                    }}
                                  >
                                    <Feather
                                      name="package"
                                      size={13}
                                      color="#A855F7"
                                    />
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        fontFamily: "Inter_400Regular",
                                        color: colors.mutedForeground,
                                        flex: 1,
                                      }}
                                    >
                                      {item.wrapMethod === "foil"
                                        ? "Wrap in foil"
                                        : "Wrap in butcher paper"}
                                      {item.wrapTempF
                                        ? ` · ${item.wrapTempF}°F`
                                        : ""}
                                    </Text>
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        fontFamily: "Inter_600SemiBold",
                                        color: "#A855F7",
                                      }}
                                    >
                                      {fmtTime(
                                        new Date(
                                          new Date(item.meatOnAt).getTime() +
                                            item.wrapAtMinutes * 60000,
                                        ),
                                      )}
                                    </Text>
                                  </View>
                                )}
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <Feather
                                  name="pause"
                                  size={13}
                                  color={colors.mutedForeground}
                                />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_400Regular",
                                    color: colors.mutedForeground,
                                    flex: 1,
                                  }}
                                >
                                  Pull off · rest {item.restMinutes}m
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontFamily: "Inter_600SemiBold",
                                    color: colors.foreground,
                                  }}
                                >
                                  {fmtTime(item.estimatedFinishAt)}
                                </Text>
                              </View>
                              {item.notes ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontFamily: "Inter_400Regular",
                                    color: colors.mutedForeground,
                                    fontStyle: "italic",
                                    marginTop: 2,
                                  }}
                                >
                                  {item.notes}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        );
                      },
                    );
                  })()}

                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={({ pressed }) => [
                      {
                        backgroundColor: "#6C3BF5",
                        borderRadius: colors.radius,
                        paddingVertical: 14,
                        flexDirection: "row" as const,
                        alignItems: "center" as const,
                        justifyContent: "center" as const,
                        gap: 8,
                        marginTop: 4,
                        opacity: pressed || saving ? 0.7 : 1,
                      },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Feather name="link" size={16} color="#fff" />
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 15,
                            fontFamily: "Inter_700Bold",
                          }}
                        >
                          Save & Link {aiResult.schedule.length} Cooks
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => setStep("setup")}
                    style={[
                      s.dismissBtn,
                      {
                        borderRadius: colors.radius,
                        borderColor: colors.border,
                        marginTop: 10,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.dismissBtnText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Back
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <MultiCookAddItemModal
        visible={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        colors={colors}
        multiAddCat={multiAddCat}
        setMultiAddCat={setMultiAddCat}
        multiPickedCut={multiPickedCut}
        setMultiPickedCut={setMultiPickedCut}
        multiAddWeightInput={multiAddWeightInput}
        setMultiAddWeightInput={setMultiAddWeightInput}
        setMultiItems={setAdditionalItems}
      />

      <DatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        colors={colors}
        serveAt={serveAt}
        setServeAt={setServeAt}
        upcomingDates={upcomingDates}
      />

      <TimePickerModal
        visible={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        colors={colors}
        serveAt={serveAt}
        setServeAt={setServeAt}
      />
    </>
  );
}
