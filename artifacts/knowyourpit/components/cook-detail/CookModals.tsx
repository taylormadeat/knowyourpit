import React from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { WrapTempSheet } from "@/components/cook-detail/WrapTempSheet";
import { AddToPlannedCookModal } from "@/components/cook-detail/AddToPlannedCookModal";
import { EditCookModal } from "@/components/cook-detail/EditCookModal";
import { EditCookTimesSheet } from "@/components/cook-detail/EditCookTimesSheet";
import { UnifiedCheckinSheet } from "@/components/cook-detail/UnifiedCheckinSheet";
import { CheckinPreviewSheet } from "@/components/cook-detail/CheckinPreviewSheet";
import { PitMasterChatModal } from "@/components/PitMasterChatModal";
import { RateCookSheet } from "@/components/cook-detail/RateCookSheet";

/** Returns 3–4 suggested questions tailored to the cook's food type. */
function getCookSuggestions(foodType: string | null | undefined): string[] {
  const lower = (foodType ?? "").toLowerCase();
  if (lower.includes("brisket")) {
    return ["Am I in the stall?", "Should I wrap now?", "How's my bark looking?", "When should I pull it off?"];
  }
  if (lower.includes("rib") || lower.includes("spare") || lower.includes("baby back")) {
    return ["Is it time to wrap the ribs?", "How do I know when they're done?", "What does good bark look like?", "My color looks off — what's going on?"];
  }
  if (lower.includes("pork") || lower.includes("butt") || lower.includes("shoulder") || lower.includes("pulled")) {
    return ["Am I in the stall?", "When should I wrap?", "How do I know it's ready to pull?", "How do I get a better bark?"];
  }
  if (lower.includes("chicken") || lower.includes("wing") || lower.includes("turkey")) {
    return ["How do I get crispier skin?", "Is my temp on track?", "How do I know when it's fully cooked?", "Should I be spritzing?"];
  }
  if (lower.includes("salmon") || lower.includes("fish")) {
    return ["What temp should I pull the salmon?", "How do I know when it's done?", "Should I brine it first?", "What wood pairs best?"];
  }
  if (lower.includes("tri tip") || lower.includes("tri-tip") || lower.includes("steak")) {
    return ["What internal temp should I target?", "Should I reverse sear?", "How long should I rest it?", "How do I get a better crust?"];
  }
  return ["Temp stalled — now what?", "Am I on track with timing?", "Is it time to wrap?", "How do I get better bark?"];
}

interface CookModalsProps {
  // Shared
  cookStatus: string | undefined;
  cookSeqData: any;
  cook: any;
  id: string;
  colors: any;
  insets: any;
  grills: any[];
  // Wrap temp
  wrapTempPending: { key: string; itemIdx: number } | null;
  confirmWrap: (key: string, itemIdx: number, tempF: number | null) => void;
  // Add to session
  addToSessionOpen: boolean;
  setAddToSessionOpen: (v: boolean) => void;
  // Edit cook
  editVisible: boolean;
  setEditVisible: (v: boolean) => void;
  editGrillPickerVisible: boolean;
  setEditGrillPickerVisible: (v: boolean) => void;
  editFoodType: string;
  setEditFoodType: (v: string) => void;
  editWeight: string;
  setEditWeight: (v: string) => void;
  editCookTemp: string;
  setEditCookTemp: (v: string) => void;
  editTargetTemp: string;
  setEditTargetTemp: (v: string) => void;
  editGrillId: number | null;
  setEditGrillId: (v: number | null) => void;
  editActualStartDate: Date | null;
  setEditActualStartDate: (v: Date | null) => void;
  editActualEndDate: Date | null;
  setEditActualEndDate: (v: Date | null) => void;
  editStartDateOpen: boolean;
  setEditStartDateOpen: (v: boolean) => void;
  editStartTimeOpen: boolean;
  setEditStartTimeOpen: (v: boolean) => void;
  editEndDateOpen: boolean;
  setEditEndDateOpen: (v: boolean) => void;
  editEndTimeOpen: boolean;
  setEditEndTimeOpen: (v: boolean) => void;
  editDates: any;
  editNotes: string;
  setEditNotes: (v: string) => void;
  editCookingMethod: string | null;
  setEditCookingMethod: (v: string | null) => void;
  editInjection: string | null;
  setEditInjection: (v: string | null) => void;
  editSpritzFrequency: string | null;
  setEditSpritzFrequency: (v: string | null) => void;
  editWrapFinish: string | null;
  setEditWrapFinish: (v: string | null) => void;
  editSaving: boolean;
  editSelectedGrill: any;
  saveEdit: () => void;
  // Edit times
  editTimesVisible: boolean;
  setEditTimesVisible: (v: boolean) => void;
  editTimesSaving: boolean;
  handleSaveCookTimes: (meatOnAt: Date, thawStartAt: Date | null) => Promise<void>;
  // Toasts
  checkinSavedToast: string | null;
  setCheckinSavedToast: (v: string | null) => void;
  autoCheckinToast: string | null;
  setAutoCheckinToast: (v: string | null) => void;
  planUpdatedToast: string | null;
  setPlanUpdatedToast: (v: string | null) => void;
  inkbirdToastMounted: boolean;
  inkbirdToastAnim: Animated.Value;
  setInkbirdReconnectToast: (v: boolean) => void;
  bleReconnectToast: string | null;
  setBleReconnectToast: (v: string | null) => void;
  // Unified checkin
  activeCheckin: any;
  checkinModalVisible: boolean;
  setCheckinModalVisible: (v: boolean) => void;
  currentPitTempF: number | null;
  tempMode: "probe" | "manual";
  selectedMeaterProbe: any | null;
  selectedThermoworksProbe: any | null;
  selectedInkbirdProbe: any | null;
  selectedBleContextDevice: any | null;
  selectedLanProbe: any | null;
  weather: any;
  cookCheckins: any[];
  onCheckinSaved: (savedInternalTempF: number | null) => void;
  onRequestAnalyze: (opts?: any) => Promise<void>;
  result: any;
  // Preview checkin
  plannedCheckinPreviewSc: any;
  setPlannedCheckinPreviewSc: (v: any) => void;
  // Chat
  chatModalVisible: boolean;
  setChatModalVisible: (v: boolean) => void;
  // Rating
  showRatingPrompt: boolean;
  rateSaving: boolean;
  saveRatings: (t: number, f: number, b: number) => Promise<void>;
  setShowRatingPrompt: (v: boolean) => void;
}

export function CookModals({
  cookStatus, cookSeqData, cook, id, colors, insets, grills,
  wrapTempPending, confirmWrap,
  addToSessionOpen, setAddToSessionOpen,
  editVisible, setEditVisible,
  editGrillPickerVisible, setEditGrillPickerVisible,
  editFoodType, setEditFoodType,
  editWeight, setEditWeight,
  editCookTemp, setEditCookTemp,
  editTargetTemp, setEditTargetTemp,
  editGrillId, setEditGrillId,
  editActualStartDate, setEditActualStartDate,
  editActualEndDate, setEditActualEndDate,
  editStartDateOpen, setEditStartDateOpen,
  editStartTimeOpen, setEditStartTimeOpen,
  editEndDateOpen, setEditEndDateOpen,
  editEndTimeOpen, setEditEndTimeOpen,
  editDates, editNotes, setEditNotes,
  editCookingMethod, setEditCookingMethod,
  editInjection, setEditInjection,
  editSpritzFrequency, setEditSpritzFrequency,
  editWrapFinish, setEditWrapFinish,
  editSaving, editSelectedGrill, saveEdit,
  editTimesVisible, setEditTimesVisible, editTimesSaving, handleSaveCookTimes,
  checkinSavedToast, setCheckinSavedToast,
  autoCheckinToast, setAutoCheckinToast,
  planUpdatedToast, setPlanUpdatedToast,
  inkbirdToastMounted, inkbirdToastAnim, setInkbirdReconnectToast,
  bleReconnectToast, setBleReconnectToast,
  activeCheckin, checkinModalVisible, setCheckinModalVisible,
  currentPitTempF, tempMode,
  selectedMeaterProbe, selectedThermoworksProbe, selectedInkbirdProbe,
  selectedBleContextDevice, selectedLanProbe,
  weather, cookCheckins, onCheckinSaved, onRequestAnalyze, result,
  plannedCheckinPreviewSc, setPlannedCheckinPreviewSc,
  chatModalVisible, setChatModalVisible,
  showRatingPrompt, rateSaving, saveRatings, setShowRatingPrompt,
}: CookModalsProps) {
  const currentInternalTempF = tempMode === "probe"
    ? (selectedMeaterProbe?.internalTempF ?? selectedThermoworksProbe?.tempF ?? selectedInkbirdProbe?.tempF ?? selectedBleContextDevice?.probeTempF ?? selectedLanProbe?.probeTempF ?? null)
    : null;
  const probeSource: "meater" | "thermoworks" | "inkbird" | null = tempMode !== "probe" ? null
    : selectedMeaterProbe?.internalTempF != null ? "meater"
    : selectedThermoworksProbe?.tempF != null ? "thermoworks"
    : selectedInkbirdProbe?.tempF != null ? "inkbird"
    : null;

  return (
    <>
      {wrapTempPending && (() => {
        const item = cookSeqData?.schedule?.[wrapTempPending.itemIdx] as any;
        const wrapLabel = item?.wrapMethod === "foil" ? "Wrap in foil" : item?.wrapMethod === "butcher_paper" ? "Wrap in butcher paper" : "Confirm Wrap";
        return <WrapTempSheet visible wrapTempF={item?.wrapTempF ?? null} wrapLabel={wrapLabel} onSkip={() => confirmWrap(wrapTempPending.key, wrapTempPending.itemIdx, null)} onConfirm={(tempF) => confirmWrap(wrapTempPending.key, wrapTempPending.itemIdx, tempF)} colors={colors} />;
      })()}

      <AddToPlannedCookModal visible={addToSessionOpen} onClose={() => setAddToSessionOpen(false)} colors={colors} insets={insets} cookId={Number(id)} cookFoodType={(cook as any)?.foodType ?? null} cookWeightLbs={(cook as any)?.weightLbs ?? null} cookGrillId={(cook as any)?.grillId ?? null} grills={grills} onSuccess={() => {}} />

      <EditCookModal visible={editVisible} onClose={() => setEditVisible(false)} colors={colors} insets={insets} saveEdit={saveEdit} editSaving={editSaving} editFoodType={editFoodType} setEditFoodType={setEditFoodType} editSelectedGrill={editSelectedGrill} grills={grills} setEditGrillPickerVisible={setEditGrillPickerVisible} editGrillPickerVisible={editGrillPickerVisible} editGrillId={editGrillId} setEditGrillId={setEditGrillId} editWeight={editWeight} setEditWeight={setEditWeight} editCookTemp={editCookTemp} setEditCookTemp={setEditCookTemp} editTargetTemp={editTargetTemp} setEditTargetTemp={setEditTargetTemp} editActualStartDate={editActualStartDate} setEditActualStartDate={setEditActualStartDate} editActualEndDate={editActualEndDate} setEditActualEndDate={setEditActualEndDate} editStartDateOpen={editStartDateOpen} setEditStartDateOpen={setEditStartDateOpen} editStartTimeOpen={editStartTimeOpen} setEditStartTimeOpen={setEditStartTimeOpen} editEndDateOpen={editEndDateOpen} setEditEndDateOpen={setEditEndDateOpen} editEndTimeOpen={editEndTimeOpen} setEditEndTimeOpen={setEditEndTimeOpen} editDates={editDates} editNotes={editNotes} setEditNotes={setEditNotes} editCookingMethod={editCookingMethod} setEditCookingMethod={setEditCookingMethod} editInjection={editInjection} setEditInjection={setEditInjection} editSpritzFrequency={editSpritzFrequency} setEditSpritzFrequency={setEditSpritzFrequency} editWrapFinish={editWrapFinish} setEditWrapFinish={setEditWrapFinish} />

      {cookStatus === "active" && <EditCookTimesSheet visible={editTimesVisible} fromFrozen={!!(cook as any)?.fromFrozen} initialMeatOnAt={(cook as any)?.actualStartAt ? new Date((cook as any).actualStartAt) : cookSeqData?.schedule?.[0]?.meatOnAt ? new Date(cookSeqData.schedule[0].meatOnAt as string) : null} initialThawStartAt={(cook as any)?.actualThawStartAt ? new Date((cook as any).actualThawStartAt) : (cookSeqData?.frozen as any)?.thawStartAt ? new Date((cookSeqData!.frozen as any).thawStartAt) : null} estimatedFinishAt={cookSeqData?.schedule?.[0]?.estimatedFinishAt ?? null} saving={editTimesSaving} onClose={() => setEditTimesVisible(false)} onSave={handleSaveCookTimes} colors={colors} />}

      {checkinSavedToast != null && <View style={{ position: "absolute", bottom: 90 + insets.bottom, left: 16, right: 16, backgroundColor: "#1C1C1F", borderColor: "#22c55e", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8, zIndex: 9999 }}><Feather name="check-circle" size={16} color="#22c55e" /><Text style={{ flex: 1, color: "#F3EDE1", fontFamily: "Inter_400Regular", fontSize: 13 }}>{checkinSavedToast}</Text><Pressable onPress={() => setCheckinSavedToast(null)} hitSlop={10}><Feather name="x" size={14} color="#9CA3AF" /></Pressable></View>}
      {autoCheckinToast != null && <View style={{ position: "absolute", bottom: checkinSavedToast != null ? 150 + insets.bottom : 90 + insets.bottom, left: 16, right: 16, backgroundColor: "#1C1C1F", borderColor: "#22c55e", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8, zIndex: 9999 }}><Feather name="check-circle" size={16} color="#22c55e" /><Text style={{ flex: 1, color: "#F3EDE1", fontFamily: "Inter_400Regular", fontSize: 13 }}>{autoCheckinToast}</Text><Pressable onPress={() => setAutoCheckinToast(null)} hitSlop={10}><Feather name="x" size={14} color="#9CA3AF" /></Pressable></View>}
      {inkbirdToastMounted && <Animated.View style={{ position: "absolute", bottom: (checkinSavedToast != null ? 60 : 0) + (autoCheckinToast != null ? 60 : 0) + 90 + insets.bottom, left: 16, right: 16, backgroundColor: "#1C1C1F", borderColor: "#22c55e", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8, zIndex: 9999, opacity: inkbirdToastAnim, transform: [{ translateY: inkbirdToastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}><Feather name="wifi" size={16} color="#22c55e" /><Text style={{ flex: 1, color: "#F3EDE1", fontFamily: "Inter_400Regular", fontSize: 13 }}>Inkbird reconnected ✓</Text><Pressable onPress={() => setInkbirdReconnectToast(false)} hitSlop={10}><Feather name="x" size={14} color="#9CA3AF" /></Pressable></Animated.View>}
      {bleReconnectToast != null && <View style={{ position: "absolute", bottom: (checkinSavedToast != null ? 60 : 0) + (autoCheckinToast != null ? 60 : 0) + (inkbirdToastMounted ? 60 : 0) + 90 + insets.bottom, left: 16, right: 16, backgroundColor: "#1C1C1F", borderColor: "#22c55e", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8, zIndex: 9999 }}><Feather name="wifi" size={16} color="#22c55e" /><Text style={{ flex: 1, color: "#F3EDE1", fontFamily: "Inter_400Regular", fontSize: 13 }}>{bleReconnectToast} reconnected ✓</Text><Pressable onPress={() => setBleReconnectToast(null)} hitSlop={10}><Feather name="x" size={14} color="#9CA3AF" /></Pressable></View>}
      {planUpdatedToast != null && <View style={{ position: "absolute", bottom: (checkinSavedToast != null ? 60 : 0) + (autoCheckinToast != null ? 60 : 0) + (inkbirdToastMounted ? 60 : 0) + (bleReconnectToast != null ? 60 : 0) + 90 + insets.bottom, left: 16, right: 16, backgroundColor: "#1C1C1F", borderColor: "#f97316", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8, zIndex: 9999 }}><Feather name="zap" size={16} color="#f97316" /><Text style={{ flex: 1, color: "#F3EDE1", fontFamily: "Inter_400Regular", fontSize: 13 }}>{planUpdatedToast}</Text><Pressable onPress={() => setPlanUpdatedToast(null)} hitSlop={10}><Feather name="x" size={14} color="#9CA3AF" /></Pressable></View>}

      {activeCheckin && (
        <UnifiedCheckinSheet
          visible={checkinModalVisible} onClose={() => setCheckinModalVisible(false)}
          cookId={Number(id)} colors={colors} phase={activeCheckin.phase}
          scheduledAt={activeCheckin.scheduledAt} foodType={cook?.foodType}
          weightLbs={cook?.weightLbs ?? null} sizingLabel={cook?.sizingLabel ?? null}
          currentInternalTempF={currentInternalTempF}
          currentPitTempF={currentPitTempF}
          probeSource={probeSource}
          lastCheckinInternalTempF={cookCheckins.length > 0 ? (cookCheckins[cookCheckins.length - 1] as any).internalTempF ?? null : null}
          targetCookTempF={cook?.cookTempF ?? null} targetFoodTempF={cook?.targetTempF ?? null}
          weatherTempF={weather?.tempF ?? null} weatherWindSpeedMph={weather?.windSpeedMph ?? null}
          cookSpritzFrequency={(cook as any)?.spritzFrequency ?? null}
          cookWrapFinish={(cook as any)?.wrapFinish ?? null}
          onRequestAnalyze={async (opts) => { await onRequestAnalyze(opts); }}
          result={result}
          onCheckinSaved={onCheckinSaved}
          aiCheckins={cookSeqData?.aiCheckins ?? null}
        />
      )}

      <CheckinPreviewSheet visible={plannedCheckinPreviewSc != null} onClose={() => setPlannedCheckinPreviewSc(null)} colors={colors} sc={plannedCheckinPreviewSc} meatOnMs={cookSeqData?.schedule?.[0]?.meatOnAt ? new Date(cookSeqData.schedule[0].meatOnAt).getTime() : null} aiCheckins={cookSeqData?.aiCheckins ?? null} />
      <PitMasterChatModal
        visible={chatModalVisible}
        onClose={() => setChatModalVisible(false)}
        contextLabel={cook?.foodType ?? undefined}
        cookSuggestions={getCookSuggestions(cook?.foodType)}
      />
      <RateCookSheet visible={showRatingPrompt} colors={colors} saving={rateSaving} onSave={async (t, f, b) => { await saveRatings(t, f, b); setShowRatingPrompt(false); }} onSkip={() => setShowRatingPrompt(false)} />
    </>
  );
}
