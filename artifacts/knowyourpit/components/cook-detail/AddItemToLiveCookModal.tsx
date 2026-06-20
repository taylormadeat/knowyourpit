import React, { useState, useCallback } from "react";
import {
  View, Text, Modal, Pressable, ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { MultiCookAddItemModal } from "@/components/plan-screen/MultiCookAddItemModal";
import { useListGrills } from "@workspace/api-client-react";
import { getTokenSafe } from "@/lib/getTokenSafe";
import { useAuth } from "@clerk/expo";
import type { MultiItem } from "@/components/plan-screen/MultiCookAddItemModal";
import type { MeatCut } from "@/constants/meatCuts";
import { MEAT_CATEGORIES } from "@/constants/meatCuts";
import { useAmbientWeather } from "@/hooks/useAmbientWeather";

type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  cookId: number;
  cookFoodType: string;
  remainingEstimateMinutes: number | null;
  effectivePro?: boolean;
  onSuccess: (result: {
    sessionId: string;
    sequenceData: any;
    warning: string | null;
  }) => void;
}

export function AddItemToLiveCookModal({
  visible,
  onClose,
  colors,
  cookId,
  cookFoodType,
  remainingEstimateMinutes,
  effectivePro = false,
  onSuccess,
}: Props) {
  const { getToken } = useAuth();
  const weather = useAmbientWeather();
  const { data: grillsList } = useListGrills();
  const grills: any[] = Array.isArray(grillsList) ? grillsList : [];

  // State for MultiCookAddItemModal
  const [addItemVisible, setAddItemVisible] = useState(false);
  const [multiAddCat, setMultiAddCat] = useState<string>(MEAT_CATEGORIES[0] ?? "Beef");
  const [multiPickedCut, setMultiPickedCut] = useState<MeatCut | null>(null);
  const [pendingItem, setPendingItem] = useState<MultiItem | null>(null);
  const [saving, setSaving] = useState(false);

  const isNearlyDone = remainingEstimateMinutes != null && remainingEstimateMinutes < 30;

  const handleOpenAddItem = useCallback(() => {
    setMultiPickedCut(null);
    setMultiAddCat(MEAT_CATEGORIES[0] ?? "Beef");
    setPendingItem(null);
    setAddItemVisible(true);
  }, []);

  const handleItemAdded = useCallback((updater: (prev: MultiItem[]) => MultiItem[]) => {
    const result = updater([]);
    const newItem = result[0];
    if (newItem) {
      setPendingItem(newItem);
      setAddItemVisible(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!pendingItem) return;
    setSaving(true);
    try {
      const token = await getTokenSafe(getToken);
      if (!token) {
        Alert.alert("Session Expired", "Please sign out and sign back in.");
        setSaving(false);
        return;
      }

      const grill = pendingItem.grillId != null
        ? (grills.find((g: any) => g.id === pendingItem.grillId) ?? null)
        : null;
      const weightLbs = (pendingItem.sizeOutput.effectiveWeightLbs ?? 0) > 0
        ? pendingItem.sizeOutput.effectiveWeightLbs!
        : undefined;
      const baselineEstimateMinutes = pendingItem.cut.minsPerLb > 0 && weightLbs != null && weightLbs > 0
        ? Math.round(pendingItem.cut.minsPerLb * weightLbs)
        : undefined;
      const preheatMins = grill?.type === "gas" ? 15 : grill?.type === "pellet" ? 20 : 25;

      const payload = {
        items: [{
          foodType: pendingItem.cut.name,
          weightLbs,
          cookTempF: pendingItem.cookTempF ? parseFloat(pendingItem.cookTempF) : pendingItem.cut.cookTempF,
          targetTempF: pendingItem.targetTempF ? parseFloat(pendingItem.targetTempF) : pendingItem.cut.targetTempF,
          grillId: pendingItem.grillId ?? undefined,
          grillName: grill?.name ?? undefined,
          preheatMinutes: preheatMins,
          cookingMethod: pendingItem.cookMethod ?? undefined,
          fromFrozen: pendingItem.isFrozen || undefined,
          thawMethod: pendingItem.isFrozen ? pendingItem.thawMethod : undefined,
          notes: pendingItem.notes || undefined,
          cookingStylePreset: pendingItem.cookingStylePreset ?? undefined,
          baselineEstimateMinutes,
          restMins: pendingItem.cut.restMins > 0 ? pendingItem.cut.restMins : undefined,
        }],
        outdoorTempF: weather.tempF ?? undefined,
        outdoorTempIsForecast: weather.tempF != null ? weather.isForecast : undefined,
      };

      const apiBase =
        process.env.EXPO_PUBLIC_API_URL ??
        (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), 55_000);
      let response: Response;
      try {
        response = await fetch(`${apiBase}/api/cooks/${cookId}/add-items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutTimer);
      }

      if (response.status === 401) {
        Alert.alert("Session Expired", "Please sign out and sign back in.");
        return;
      }
      if (response.status === 422) {
        const data = await response.json();
        Alert.alert("Cannot Add Item", data.error ?? "Session is at capacity.");
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        Alert.alert("Error", data.error ?? "Something went wrong. Please try again.");
        return;
      }

      const data = await response.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess({
        sessionId: data.sessionId,
        sequenceData: data.sequenceData,
        warning: data.warning ?? null,
      });
      onClose();
    } catch (err: any) {
      if (err.name === "AbortError") {
        Alert.alert("Timed Out", "The request took too long. Please try again.");
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }, [pendingItem, cookId, grills, weather, getToken, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    if (saving) return;
    setPendingItem(null);
    setAddItemVisible(false);
    onClose();
  }, [saving, onClose]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <AppKeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000060" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: colors.foreground }}>
                  Add Item to Cook
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                  {cookFoodType} is already on the grill
                </Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
              {isNearlyDone && (
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F9731618", borderWidth: 1, borderColor: "#F9731650", borderRadius: 10, padding: 12 }}>
                  <Feather name="alert-triangle" size={15} color="#F97316" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: "#F97316", lineHeight: 19 }}>
                    {cookFoodType} is nearly done ({Math.round(remainingEstimateMinutes!)} min left). The grill may free up before new items need it — plan accordingly.
                  </Text>
                </View>
              )}

              {pendingItem ? (
                <View style={{ gap: 12 }}>
                  <View style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#6C3BF515", alignItems: "center", justifyContent: "center" }}>
                        <Feather name="check" size={16} color="#6C3BF5" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: colors.foreground }}>{pendingItem.cut.name}</Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                          {[
                            pendingItem.sizeOutput.effectiveWeightLbs ? `${pendingItem.sizeOutput.effectiveWeightLbs} lbs` : null,
                            pendingItem.cookMethod,
                            pendingItem.grillId && grills.find((g: any) => g.id === pendingItem.grillId)?.name,
                          ].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => { setPendingItem(null); Haptics.selectionAsync(); }}
                        hitSlop={10}
                        style={{ padding: 6 }}
                      >
                        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                      PitMaster will schedule this around your active {cookFoodType} cook.
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      backgroundColor: "#6C3BF5",
                      borderRadius: 12,
                      paddingVertical: 15,
                      opacity: (saving || pressed) ? 0.7 : 1,
                    })}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Feather name="cpu" size={16} color="#fff" />
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" }}>
                          Generate Schedule
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {saving && (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, textAlign: "center" }}>
                      PitMaster is building your interleaved schedule…
                    </Text>
                  )}
                </View>
              ) : (
                <Pressable
                  onPress={handleOpenAddItem}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 16,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#6C3BF515", alignItems: "center", justifyContent: "center" }}>
                    <Feather name="plus" size={18} color="#6C3BF5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 15, color: colors.foreground }}>
                      Pick a cut to add
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                      PitMaster will sequence it around {cookFoodType}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </ScrollView>
          </View>
        </AppKeyboardAvoidingView>
      </Modal>

      <MultiCookAddItemModal
        visible={addItemVisible}
        onClose={() => setAddItemVisible(false)}
        colors={colors}
        multiAddCat={multiAddCat}
        setMultiAddCat={setMultiAddCat}
        multiPickedCut={multiPickedCut}
        setMultiPickedCut={setMultiPickedCut}
        setMultiItems={handleItemAdded}
        effectivePro={effectivePro}
      />
    </>
  );
}
