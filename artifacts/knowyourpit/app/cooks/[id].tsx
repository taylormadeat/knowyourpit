import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  LayoutChangeEvent,
  Modal,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { LogoBackground } from "@/components/LogoBackground";
import { TempGraph } from "@/components/TempGraph";
import {
  useGetCook,
  useDeleteCook,
  useUpdateCook,
  useAnalyzeCook,
  useListGrills,
  getListCooksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
} from "@workspace/api-client-react";

function formatDT(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const m = dt.getMonth() + 1;
  const day = dt.getDate();
  const h = dt.getHours() % 12 || 12;
  const min = String(dt.getMinutes()).padStart(2, "0");
  const ampm = dt.getHours() < 12 ? "AM" : "PM";
  return `${m}/${day}/${dt.getFullYear()} ${h}:${min} ${ampm}`;
}

function getEditDates(): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 30; i >= -7; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

function formatEditDate(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatEditTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const EDIT_TIME_SLOTS: Array<{ h: number; m: number }> = (() => {
  const slots: Array<{ h: number; m: number }> = [];
  for (let h = 0; h <= 23; h++) {
    slots.push({ h, m: 0 });
    slots.push({ h, m: 30 });
  }
  return slots;
})();

const logoImg = require("@/assets/images/logo.png");

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

const VERDICT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  perfect:    { label: "Perfect Cook", color: "#22c55e", icon: "award" },
  good:       { label: "Good Cook",    color: "#84cc16", icon: "thumbs-up" },
  overcooked: { label: "Overcooked",   color: "#f97316", icon: "thermometer" },
  undercooked:{ label: "Undercooked",  color: "#3b82f6", icon: "thermometer" },
  needs_work: { label: "Needs Work",   color: "#eab308", icon: "tool" },
};

const EVENT_ICONS: Record<string, string> = {
  wrap: "package",
  stall: "pause-circle",
  spike: "zap",
  done: "check-circle",
  note: "message-circle",
};

type PickedImage = { uri: string; base64: string; mimeType: string };

type Assessment = {
  verdict: string;
  summary: string;
  whatWentWell: string[];
  suggestions: string[];
};

type AnalysisResult = {
  probes: Array<{ probeName: string; finishingTempF: number; minTempF: number | null; maxTempF: number | null }>;
  events: Array<{ type: string; timeMinutes: number; description: string }>;
  cookDurationMinutes: number | null;
  detectedFoodType: string | null;
  noDataFound: boolean;
  rawExtraction: string | null;
  assessment: Assessment | null;
};

export default function CookDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: cook, isLoading } = useGetCook(Number(id));
  const deleteCook = useDeleteCook();
  const updateCook = useUpdateCook();
  const analyzeMutation = useAnalyzeCook();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [cookNotes, setCookNotes] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cardWidth, setCardWidth] = useState(300);

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editGrillPickerVisible, setEditGrillPickerVisible] = useState(false);
  const [editFoodType, setEditFoodType] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editCookTemp, setEditCookTemp] = useState("");
  const [editTargetTemp, setEditTargetTemp] = useState("");
  const [editGrillId, setEditGrillId] = useState<number | null>(null);
  const [editActualStartDate, setEditActualStartDate] = useState<Date | null>(null);
  const [editActualEndDate, setEditActualEndDate] = useState<Date | null>(null);
  const [editStartDateOpen, setEditStartDateOpen] = useState(false);
  const [editStartTimeOpen, setEditStartTimeOpen] = useState(false);
  const [editEndDateOpen, setEditEndDateOpen] = useState(false);
  const [editEndTimeOpen, setEditEndTimeOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const editDates = useMemo(() => getEditDates(), []);

  const { data: grillsList } = useListGrills();
  const grills: any[] = Array.isArray(grillsList) ? grillsList : [];
  const editSelectedGrill = useMemo(() => grills.find((g: any) => g.id === editGrillId) ?? null, [grills, editGrillId]);

  const onCardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width - 32;
    if (w > 100) setCardWidth(w);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/cooks" as any);
  };
  const goHome = () => router.replace("/(tabs)" as any);

  const handleDelete = () => {
    Alert.alert("Delete Cook", "Remove this cook session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteCook.mutateAsync({ id: Number(id) });
          qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
          goBack();
        },
      },
    ]);
  };

  const handleStatusUpdate = async (status: string) => {
    const updatePayload: any = { status };
    if (status === "active" && !(cook as any)?.actualStartAt) {
      updatePayload.actualStartAt = new Date();
    }
    if (status === "completed" && !(cook as any)?.actualEndAt) {
      updatePayload.actualEndAt = new Date();
    }
    await updateCook.mutateAsync({ id: Number(id), data: updatePayload });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const openEdit = () => {
    const c = cook as any;
    setEditFoodType(c?.foodType ?? "");
    setEditWeight(c?.weightLbs != null ? String(c.weightLbs) : "");
    setEditCookTemp(c?.cookTempF != null ? String(c.cookTempF) : "");
    setEditTargetTemp(c?.targetTempF != null ? String(c.targetTempF) : "");
    setEditGrillId(c?.grillId ?? null);
    setEditActualStartDate(c?.actualStartAt ? new Date(c.actualStartAt) : null);
    setEditActualEndDate(c?.actualEndAt ? new Date(c.actualEndAt) : null);
    setEditNotes(c?.notes ?? "");
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!editFoodType.trim()) {
      Alert.alert("Food type required", "Enter what you cooked.");
      return;
    }
    setEditSaving(true);
    try {
      const payload: any = { foodType: editFoodType.trim(), notes: editNotes.trim() || null };
      payload.grillId = editGrillId ?? null;
      if (editWeight.trim() && !isNaN(parseFloat(editWeight))) payload.weightLbs = parseFloat(editWeight);
      else payload.weightLbs = null;
      if (editCookTemp.trim() && !isNaN(parseFloat(editCookTemp))) payload.cookTempF = parseFloat(editCookTemp);
      else payload.cookTempF = null;
      if (editTargetTemp.trim() && !isNaN(parseFloat(editTargetTemp))) payload.targetTempF = parseFloat(editTargetTemp);
      else payload.targetTempF = null;
      payload.actualStartAt = editActualStartDate ?? null;
      payload.actualEndAt = editActualEndDate ?? null;
      await updateCook.mutateAsync({ id: Number(id), data: payload });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setEditVisible(false);
    } catch {
      Alert.alert("Save failed", "Could not save changes. Please try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const pickImages = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled) {
      const picked = res.assets
        .filter((a) => a.base64)
        .map((a) => ({ uri: a.uri, base64: a.base64!, mimeType: (a.mimeType as string) || "image/jpeg" }))
        .slice(0, 5);
      setImages((prev) => [...prev, ...picked].slice(0, 5));
      setResult(null);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access to take photos"); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0].base64) {
      setImages((prev) => [...prev, {
        uri: res.assets[0].uri,
        base64: res.assets[0].base64!,
        mimeType: (res.assets[0].mimeType as string) || "image/jpeg",
      }].slice(0, 5));
      setResult(null);
    }
  };

  const removeImage = (idx: number) => { setImages((p) => p.filter((_, i) => i !== idx)); setResult(null); };

  const analyze = async () => {
    if (images.length === 0 && !cookNotes.trim()) {
      Alert.alert("Add something", "Upload at least one thermometer image or add cook notes before analyzing.");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const c = cook as any;
      const data: any = await analyzeMutation.mutateAsync({
        data: {
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          cookNotes: cookNotes.trim() || null,
          cookContext: {
            foodType: c?.foodType,
            targetTempF: c?.targetTempF,
            cookTempF: c?.cookTempF,
            weightLbs: c?.weightLbs,
            wrapMethod: c?.wrapMethod ?? null,
            wrapAtMinutes: c?.wrapAtMinutes ?? null,
            wrapTempF: c?.wrapTempF ?? null,
            wrapReason: c?.wrapReason ?? null,
            restMinutes: c?.restMinutes ?? null,
            preheatMinutes: c?.preheatMinutes ?? null,
          },
        } as any,
      });
      setResult(data);
      // Save analysis result to the cook record
      await updateCook.mutateAsync({
        id: Number(id),
        data: {
          analysisResult: {
            probes: data.probes,
            events: data.events,
            cookDurationMinutes: data.cookDurationMinutes,
            detectedFoodType: data.detectedFoodType,
            assessment: data.assessment,
          },
        } as any,
      });
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Analysis failed", "Could not analyze the cook. Please check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <LogoBackground opacity={0.04} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!cook) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <LogoBackground opacity={0.04} />
        <Text style={{ color: colors.mutedForeground }}>Cook not found</Text>
        <Pressable onPress={goBack} style={s.goBackBtn}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const c = cook as any;
  const statusColor = STATUS_COLORS[c.status] || colors.primary;
  const nextStatus = c.status === "planned" ? "active" : c.status === "active" ? "completed" : null;
  const assessment = result?.assessment as Assessment | null | undefined;
  const verdictCfg = assessment ? (VERDICT_CONFIG[assessment.verdict] ?? VERDICT_CONFIG.needs_work) : null;

  // Stored analysis from DB
  const storedAnalysis = c.analysisResult as AnalysisResult | null | undefined;
  const storedAssessment = storedAnalysis?.assessment ?? null;
  const storedVerdictCfg = storedAssessment ? (VERDICT_CONFIG[storedAssessment.verdict] ?? VERDICT_CONFIG.needs_work) : null;
  const storedGraphProbes = (storedAnalysis?.probes ?? []).filter((p: any) => p.timeSeries && p.timeSeries.length >= 2);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <LinearGradient
        colors={["#1C1C1F", "#2D1A0E"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: topPad + 14 }]}
      >
        <LogoBackground opacity={0.06} />
        <Pressable onPress={goBack} style={s.backBtn}>
          <Feather name="chevron-left" size={24} color="#F3EDE1" />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{c.foodType || "Cook"}</Text>
        <View style={s.headerRight}>
          <Pressable onPress={openEdit} style={s.editBtn} hitSlop={8}>
            <Feather name="edit-2" size={17} color="#F3EDE1" />
          </Pressable>
          <Pressable onPress={handleDelete} style={s.delBtn}>
            <Feather name="trash-2" size={18} color="#ef4444" />
          </Pressable>
          <Pressable onPress={goHome} hitSlop={8}>
            <Image source={logoImg} style={s.headerLogo} resizeMode="contain" />
          </Pressable>
        </View>
      </LinearGradient>
      <View style={s.fireBar} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status */}
        <View style={[s.statusBar, { backgroundColor: statusColor + "18", borderRadius: colors.radius }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>{c.status?.toUpperCase()}</Text>
        </View>

        {/* Cook details card */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {[
            { label: "Food", value: c.foodType },
            { label: "Grill", value: (c as any).grillName },
            { label: "Weight", value: c.weightLbs ? `${c.weightLbs} lbs` : null },
            { label: "Target Temp", value: c.targetTempF ? `${c.targetTempF}°F` : null },
            { label: "Cook Temp", value: c.cookTempF ? `${c.cookTempF}°F` : null },
            { label: "Planned Start", value: c.plannedStartAt ? new Date(c.plannedStartAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
            { label: "Serve By", value: c.plannedEndAt ? new Date(c.plannedEndAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
            { label: "Started", value: c.actualStartAt ? formatDT(c.actualStartAt) : null },
            { label: "Finished", value: c.actualEndAt ? formatDT(c.actualEndAt) : null },
            { label: "Preheat", value: c.preheatMinutes ? `${c.preheatMinutes} min` : null },
            { label: "Wrap", value: (() => {
                const parts: string[] = [];
                if (c.wrapMethod === "foil") parts.push("Foil (Texas Crutch)");
                else if (c.wrapMethod === "butcher_paper") parts.push("Butcher Paper");
                else if (c.wrapMethod === "none") parts.push("No wrap");
                if (c.wrapAtMinutes) parts.push(`at ${Math.floor(c.wrapAtMinutes / 60)}h ${c.wrapAtMinutes % 60}m`);
                if (c.wrapTempF) parts.push(`${c.wrapTempF}°F internal`);
                return parts.length ? parts.join(" · ") : null;
              })() },
            { label: "Wrap Notes", value: c.wrapReason ?? null },
            { label: "Rest", value: c.restMinutes ? `${c.restMinutes} min` : null },
          ].filter((r) => r.value).map((row, i, arr) => (
            <View key={row.label} style={[s.row, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
              <Text style={[s.rowValue, { color: colors.foreground }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {c.notes && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, padding: 14 }]}>
            <Text style={[s.notesLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <Text style={[s.notesText, { color: colors.foreground }]}>{c.notes}</Text>
          </View>
        )}

        {/* ── Stored AI analysis ──────────────────────────────── */}
        {storedAnalysis && (
          <View
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            onLayout={onCardLayout}
          >
            <View style={s.logHeader}>
              <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.logIconWrap}>
                <Feather name="activity" size={15} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.logTitle, { color: colors.foreground }]}>AI Cook Analysis</Text>
                <Text style={[s.logSub, { color: colors.mutedForeground }]}>Saved from image scan</Text>
              </View>
              {storedVerdictCfg && (
                <View style={[s.verdictPill, { backgroundColor: storedVerdictCfg.color + "22" }]}>
                  <Feather name={storedVerdictCfg.icon as any} size={12} color={storedVerdictCfg.color} />
                  <Text style={[s.verdictPillText, { color: storedVerdictCfg.color }]}>{storedVerdictCfg.label}</Text>
                </View>
              )}
            </View>

            {storedAssessment?.summary ? (
              <Text style={[s.storedSummary, { color: colors.foreground }]}>{storedAssessment.summary}</Text>
            ) : null}

            {storedGraphProbes.length > 0 && (
              <View style={[s.graphWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Temperature Graph</Text>
                <TempGraph
                  probes={storedGraphProbes}
                  events={storedAnalysis?.events ?? []}
                  targetTempF={c.targetTempF ?? null}
                  width={cardWidth}
                  height={190}
                />
              </View>
            )}

            {(storedAnalysis?.probes?.length ?? 0) > 0 && (
              <View style={[s.subSection, { borderTopColor: colors.border }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Probe Readings</Text>
                {storedAnalysis!.probes.map((p: any, i: number) => (
                  <View key={i} style={[s.probeRow, { borderTopColor: colors.border }]}>
                    <View>
                      <Text style={[s.probeName, { color: colors.foreground }]}>{p.probeName}</Text>
                      {(p.minTempF != null || p.maxTempF != null) && (
                        <Text style={[s.probeRange, { color: colors.mutedForeground }]}>
                          {p.minTempF ?? "?"}°F → {p.maxTempF ?? "?"}°F
                        </Text>
                      )}
                    </View>
                    <Text style={[s.probeFinish, { color: "#A855F7" }]}>{p.finishingTempF}°F</Text>
                  </View>
                ))}
              </View>
            )}

            {(storedAnalysis?.events?.length ?? 0) > 0 && (
              <View style={[s.subSection, { borderTopColor: colors.border }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Cook Timeline</Text>
                {storedAnalysis!.events.map((ev: any, i: number) => {
                  const hrs = Math.floor(ev.timeMinutes / 60);
                  const mins = ev.timeMinutes % 60;
                  return (
                    <View key={i} style={[s.eventRow, { borderTopColor: colors.border }]}>
                      <View style={[s.eventIconWrap, { backgroundColor: "#A855F7" + "18" }]}>
                        <Feather name={(EVENT_ICONS[ev.type] ?? "circle") as any} size={13} color="#A855F7" />
                      </View>
                      <Text style={[s.eventDesc, { color: colors.foreground, flex: 1 }]}>{ev.description}</Text>
                      <Text style={[s.eventTime, { color: colors.mutedForeground }]}>
                        {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {(storedAssessment?.whatWentWell?.length ?? 0) > 0 && (
              <View style={[s.subSection, { borderTopColor: colors.border }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground }]}>What Went Well</Text>
                {storedAssessment!.whatWentWell.map((item: string, i: number) => (
                  <View key={i} style={s.bulletRow}>
                    <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                    <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {(storedAssessment?.suggestions?.length ?? 0) > 0 && (
              <View style={[s.subSection, { borderTopColor: colors.border }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Next Time, Try This</Text>
                {storedAssessment!.suggestions.map((tip: string, i: number) => (
                  <View key={i} style={s.bulletRow}>
                    <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                    <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Log This Cook section ───────────────────────────── */}
        <View
          style={[s.logSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
          onLayout={onCardLayout}
        >
          {/* Header */}
          <View style={s.logHeader}>
            <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.logIconWrap}>
              <Feather name="thermometer" size={15} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.logTitle, { color: colors.foreground }]}>Log This Cook</Text>
              <Text style={[s.logSub, { color: colors.mutedForeground }]}>
                Upload thermometer photos · AI reads temps, assesses the cook, and gives personalized tips
              </Text>
            </View>
          </View>

          {/* Photo buttons */}
          <View style={s.photoBtns}>
            <Pressable style={[s.photoBtn, { borderColor: colors.border, borderRadius: colors.radius }]} onPress={pickImages}>
              <Feather name="image" size={15} color={colors.primary} />
              <Text style={[s.photoBtnText, { color: colors.foreground }]}>Gallery</Text>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable style={[s.photoBtn, { borderColor: colors.border, borderRadius: colors.radius }]} onPress={takePhoto}>
                <Feather name="camera" size={15} color={colors.primary} />
                <Text style={[s.photoBtnText, { color: colors.foreground }]}>Camera</Text>
              </Pressable>
            )}
          </View>

          {/* Thumbnails */}
          {images.length > 0 && (
            <View style={s.thumbRow}>
              {images.map((img, i) => (
                <View key={i} style={s.thumb}>
                  <Image source={{ uri: img.uri }} style={s.thumbImg} />
                  <Pressable style={[s.thumbDel, { backgroundColor: colors.destructive }]} onPress={() => removeImage(i)}>
                    <Feather name="x" size={11} color="#fff" />
                  </Pressable>
                </View>
              ))}
              <Pressable style={[s.addMoreThumb, { borderColor: colors.border, borderRadius: 8 }]} onPress={pickImages}>
                <Feather name="plus" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          {/* Notes input */}
          <View>
            <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
              Cook notes <Text style={{ fontWeight: "400" }}>(optional — tell AI what happened)</Text>
            </Text>
            <TextInput
              style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              placeholder="e.g. Wrapped at 4hrs, had a big stall around 160°F, grill ran hot in the last hour..."
              placeholderTextColor={colors.mutedForeground}
              value={cookNotes}
              onChangeText={setCookNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Analyze button */}
          <Pressable
            style={({ pressed }) => [
              s.analyzeBtn,
              { borderRadius: colors.radius },
              (analyzing || pressed) && { opacity: 0.75 },
            ]}
            onPress={analyze}
            disabled={analyzing}
          >
            <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.analyzeBtnGradient}>
              {analyzing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.analyzeBtnText}>AI is analyzing your cook…</Text>
                </>
              ) : (
                <>
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={s.analyzeBtnText}>
                    {images.length > 0
                      ? `Analyze ${images.length} image${images.length > 1 ? "s" : ""} with AI`
                      : "Analyze Cook with AI"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* ── Results ───────────────────────────────────────── */}
          {result && (
            <View style={[s.results, { borderTopColor: colors.border }]}>

              {/* Verdict banner */}
              {verdictCfg && assessment && (
                <View style={[s.verdictBanner, { backgroundColor: verdictCfg.color + "18", borderColor: verdictCfg.color + "40", borderRadius: colors.radius }]}>
                  <Feather name={verdictCfg.icon as any} size={20} color={verdictCfg.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.verdictLabel, { color: verdictCfg.color }]}>{verdictCfg.label}</Text>
                    {assessment.summary ? (
                      <Text style={[s.verdictSummary, { color: colors.foreground }]}>{assessment.summary}</Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Temperature graph */}
              {(result.probes as any[]).filter((p) => p.timeSeries?.length >= 2).length > 0 && (
                <View style={[s.graphWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Temperature Graph</Text>
                  <TempGraph
                    probes={(result.probes as any[]).filter((p) => p.timeSeries?.length >= 2)}
                    events={result.events}
                    targetTempF={c?.targetTempF ?? null}
                    width={cardWidth}
                    height={180}
                  />
                </View>
              )}

              {/* Probe readings */}
              {result.probes.length > 0 && (
                <View style={[s.subSection, { borderColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Temperature Readings</Text>
                  {result.probes.map((p, i) => (
                    <View key={i} style={[s.probeRow, { borderTopColor: colors.border }]}>
                      <View>
                        <Text style={[s.probeName, { color: colors.foreground }]}>{p.probeName}</Text>
                        {(p.minTempF != null || p.maxTempF != null) && (
                          <Text style={[s.probeRange, { color: colors.mutedForeground }]}>
                            {p.minTempF != null ? `${p.minTempF}°F` : "?"} → {p.maxTempF != null ? `${p.maxTempF}°F` : "?"}
                          </Text>
                        )}
                      </View>
                      <Text style={[s.probeFinish, { color: colors.primary }]}>{p.finishingTempF}°F</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Events timeline */}
              {result.events.length > 0 && (
                <View style={[s.subSection, { borderColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Cook Timeline</Text>
                  {result.events.map((ev, i) => {
                    const hrs = Math.floor(ev.timeMinutes / 60);
                    const mins = ev.timeMinutes % 60;
                    const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                    return (
                      <View key={i} style={[s.eventRow, { borderTopColor: colors.border }]}>
                        <View style={[s.eventIconWrap, { backgroundColor: colors.primary + "18" }]}>
                          <Feather name={(EVENT_ICONS[ev.type] ?? "circle") as any} size={13} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.eventDesc, { color: colors.foreground }]}>{ev.description}</Text>
                        </View>
                        <Text style={[s.eventTime, { color: colors.mutedForeground }]}>{timeStr}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* What went well */}
              {assessment?.whatWentWell?.length > 0 && (
                <View style={[s.subSection, { borderColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>What Went Well</Text>
                  {assessment.whatWentWell.map((item, i) => (
                    <View key={i} style={s.bulletRow}>
                      <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                      <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Suggestions */}
              {assessment?.suggestions?.length > 0 && (
                <View style={[s.subSection, { borderColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Next Time, Try This</Text>
                  {assessment.suggestions.map((tip, i) => (
                    <View key={i} style={s.bulletRow}>
                      <Text style={[s.bulletNum, { color: colors.primary }]}>{i + 1}</Text>
                      <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* No data fallback */}
              {result.noDataFound && result.probes.length === 0 && (
                <View style={s.noDataRow}>
                  <Feather name="info" size={15} color={colors.mutedForeground} />
                  <Text style={[s.noDataText, { color: colors.mutedForeground }]}>
                    No temperature data found in images — assessment based on your cook notes only.
                    {result.rawExtraction ? `\n${result.rawExtraction}` : ""}
                  </Text>
                </View>
              )}

              {/* Detected meta */}
              {(result.detectedFoodType || result.cookDurationMinutes != null) && (
                <View style={[s.metaRow, { borderTopColor: colors.border }]}>
                  {result.detectedFoodType && (
                    <View style={s.metaPill}>
                      <Feather name="tag" size={12} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>{result.detectedFoodType}</Text>
                    </View>
                  )}
                  {result.cookDurationMinutes != null && (
                    <View style={s.metaPill}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                        {Math.floor(result.cookDurationMinutes / 60)}h {result.cookDurationMinutes % 60}m
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Status action button */}
        {nextStatus && (
          <Pressable
            style={({ pressed }) => [s.actionBtn, { backgroundColor: statusColor, borderRadius: colors.radius }, (updateCook.isPending || pressed) && { opacity: 0.7 }]}
            onPress={() => handleStatusUpdate(nextStatus)}
            disabled={updateCook.isPending}
          >
            {updateCook.isPending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Feather name={nextStatus === "active" ? "play" : "check-circle"} size={18} color="#fff" />
                <Text style={s.actionText}>{nextStatus === "active" ? "Start Cook" : "Mark Complete"}</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Grade prompt — completed cook with no stored analysis */}
        {c.status === "completed" && !storedAnalysis && !result && (
          <View style={[s.gradePrompt, { backgroundColor: "#E84820" + "12", borderColor: "#E84820" + "35", borderRadius: colors.radius }]}>
            <Feather name="award" size={18} color="#E84820" />
            <View style={{ flex: 1 }}>
              <Text style={[s.gradePromptTitle, { color: colors.foreground }]}>Get your cook graded</Text>
              <Text style={[s.gradePromptSub, { color: colors.mutedForeground }]}>
                Upload thermometer photos or add notes below — AI will grade this cook{c.wrapMethod ? " against your original plan" : ""}.
              </Text>
            </View>
          </View>
        )}

        <Pressable onPress={goHome} style={s.homeLink}>
          <Feather name="home" size={14} color={colors.mutedForeground} />
          <Text style={[s.homeLinkText, { color: colors.mutedForeground }]}>Back to Home</Text>
        </Pressable>
      </ScrollView>

      {/* ── Edit Cook Modal ──────────────────────────────────── */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <LinearGradient colors={["#1C1C1F", "#2D1A0E"]} style={[s.editHeader, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={() => setEditVisible(false)} style={s.editCancelBtn}>
              <Text style={s.editCancelText}>Cancel</Text>
            </Pressable>
            <Text style={s.editHeaderTitle}>Edit Cook</Text>
            <Pressable onPress={saveEdit} disabled={editSaving} style={s.editSaveBtn}>
              {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.editSaveText}>Save</Text>}
            </Pressable>
          </LinearGradient>
          <View style={[s.editFireBar, { backgroundColor: "#E84820" }]} />

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">

            {/* Food type */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>What did you cook?</Text>
              <TextInput
                style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="e.g. Brisket, Pork Butt, Ribs"
                placeholderTextColor={colors.mutedForeground}
                value={editFoodType}
                onChangeText={setEditFoodType}
              />
            </View>

            {/* Grill picker */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Grill / Smoker</Text>
              <Pressable
                onPress={() => setEditGrillPickerVisible(true)}
                style={[s.editInput, s.editPickerRow, { backgroundColor: colors.card, borderColor: editSelectedGrill ? "#6C3BF5" : colors.border, borderRadius: colors.radius }]}
              >
                {editSelectedGrill ? (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="check-circle" size={13} color="#6C3BF5" />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={1}>
                      {editSelectedGrill.name ?? `${editSelectedGrill.brand} ${editSelectedGrill.model ?? ""}`.trim()}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {grills.length === 0 ? "No grills in inventory" : "Select your grill…"}
                  </Text>
                )}
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Weight / temps row */}
            <View style={s.editRow2}>
              <View style={[s.editFieldWrap, { flex: 1 }]}>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="14" placeholderTextColor={colors.mutedForeground}
                  value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad"
                />
              </View>
              <View style={[s.editFieldWrap, { flex: 1 }]}>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Cook Temp (°F)</Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="225" placeholderTextColor={colors.mutedForeground}
                  value={editCookTemp} onChangeText={setEditCookTemp} keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={s.editRow2}>
              <View style={[s.editFieldWrap, { flex: 1 }]}>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Target Temp (°F)</Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="203" placeholderTextColor={colors.mutedForeground}
                  value={editTargetTemp} onChangeText={setEditTargetTemp} keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Start time */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Start Time</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setEditStartDateOpen(true)}
                  style={[s.editInput, s.editPickerBtn, { flex: 1, backgroundColor: colors.card, borderColor: editActualStartDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="calendar" size={13} color={editActualStartDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: editActualStartDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {editActualStartDate ? formatEditDate(editActualStartDate) : "Pick a date"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!editActualStartDate) setEditActualStartDate(new Date());
                    setEditStartTimeOpen(true);
                  }}
                  style={[s.editInput, s.editPickerBtn, { backgroundColor: colors.card, borderColor: editActualStartDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="clock" size={13} color={editActualStartDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: editActualStartDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {editActualStartDate ? formatEditTime(editActualStartDate.getHours(), editActualStartDate.getMinutes()) : "Time"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* End time */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>End Time</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setEditEndDateOpen(true)}
                  style={[s.editInput, s.editPickerBtn, { flex: 1, backgroundColor: colors.card, borderColor: editActualEndDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="calendar" size={13} color={editActualEndDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: editActualEndDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {editActualEndDate ? formatEditDate(editActualEndDate) : "Pick a date"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!editActualEndDate) setEditActualEndDate(new Date());
                    setEditEndTimeOpen(true);
                  }}
                  style={[s.editInput, s.editPickerBtn, { backgroundColor: colors.card, borderColor: editActualEndDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="clock" size={13} color={editActualEndDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: editActualEndDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {editActualEndDate ? formatEditTime(editActualEndDate.getHours(), editActualEndDate.getMinutes()) : "Time"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Notes */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Cook Notes</Text>
              <TextInput
                style={[s.editTextArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="Anything worth remembering — wood type, rubs, what you'd do differently…"
                placeholderTextColor={colors.mutedForeground}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* ════ START DATE PICKER ════ */}
        <Modal visible={editStartDateOpen} animationType="slide" transparent onRequestClose={() => setEditStartDateOpen(false)}>
          <View style={edt.overlay}>
            <View style={[edt.sheet, { backgroundColor: colors.card }]}>
              <View style={[edt.handle, { backgroundColor: colors.border }]} />
              <View style={[edt.header, { borderBottomColor: colors.border }]}>
                <Text style={[edt.title, { color: colors.foreground }]}>Start Date</Text>
                <Pressable onPress={() => setEditStartDateOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
                {editDates.map((d) => {
                  const sel = editActualStartDate && d.getDate() === editActualStartDate.getDate() && d.getMonth() === editActualStartDate.getMonth() && d.getFullYear() === editActualStartDate.getFullYear();
                  return (
                    <Pressable key={d.toISOString()} onPress={() => { const n = editActualStartDate ? new Date(editActualStartDate) : new Date(); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setEditActualStartDate(n); setEditStartDateOpen(false); }}
                      style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                      <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditDate(d)}</Text>
                      <Text style={[edt.rowSub, { color: colors.mutedForeground }]}>{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Text>
                      {sel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ════ START TIME PICKER ════ */}
        <Modal visible={editStartTimeOpen} animationType="slide" transparent onRequestClose={() => setEditStartTimeOpen(false)}>
          <View style={edt.overlay}>
            <View style={[edt.sheet, { backgroundColor: colors.card }]}>
              <View style={[edt.handle, { backgroundColor: colors.border }]} />
              <View style={[edt.header, { borderBottomColor: colors.border }]}>
                <Text style={[edt.title, { color: colors.foreground }]}>Start Time</Text>
                <Pressable onPress={() => setEditStartTimeOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
                {EDIT_TIME_SLOTS.map(({ h, m }) => {
                  const sel = editActualStartDate && editActualStartDate.getHours() === h && editActualStartDate.getMinutes() === m;
                  return (
                    <Pressable key={`s${h}:${m}`} onPress={() => { const n = editActualStartDate ? new Date(editActualStartDate) : new Date(); n.setHours(h, m, 0, 0); setEditActualStartDate(n); setEditStartTimeOpen(false); }}
                      style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                      <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditTime(h, m)}</Text>
                      {sel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ════ END DATE PICKER ════ */}
        <Modal visible={editEndDateOpen} animationType="slide" transparent onRequestClose={() => setEditEndDateOpen(false)}>
          <View style={edt.overlay}>
            <View style={[edt.sheet, { backgroundColor: colors.card }]}>
              <View style={[edt.handle, { backgroundColor: colors.border }]} />
              <View style={[edt.header, { borderBottomColor: colors.border }]}>
                <Text style={[edt.title, { color: colors.foreground }]}>End Date</Text>
                <Pressable onPress={() => setEditEndDateOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
                {editDates.map((d) => {
                  const sel = editActualEndDate && d.getDate() === editActualEndDate.getDate() && d.getMonth() === editActualEndDate.getMonth() && d.getFullYear() === editActualEndDate.getFullYear();
                  return (
                    <Pressable key={d.toISOString()} onPress={() => { const n = editActualEndDate ? new Date(editActualEndDate) : new Date(); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setEditActualEndDate(n); setEditEndDateOpen(false); }}
                      style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                      <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditDate(d)}</Text>
                      <Text style={[edt.rowSub, { color: colors.mutedForeground }]}>{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Text>
                      {sel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ════ END TIME PICKER ════ */}
        <Modal visible={editEndTimeOpen} animationType="slide" transparent onRequestClose={() => setEditEndTimeOpen(false)}>
          <View style={edt.overlay}>
            <View style={[edt.sheet, { backgroundColor: colors.card }]}>
              <View style={[edt.handle, { backgroundColor: colors.border }]} />
              <View style={[edt.header, { borderBottomColor: colors.border }]}>
                <Text style={[edt.title, { color: colors.foreground }]}>End Time</Text>
                <Pressable onPress={() => setEditEndTimeOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
                {EDIT_TIME_SLOTS.map(({ h, m }) => {
                  const sel = editActualEndDate && editActualEndDate.getHours() === h && editActualEndDate.getMinutes() === m;
                  return (
                    <Pressable key={`e${h}:${m}`} onPress={() => { const n = editActualEndDate ? new Date(editActualEndDate) : new Date(); n.setHours(h, m, 0, 0); setEditActualEndDate(n); setEditEndTimeOpen(false); }}
                      style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                      <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditTime(h, m)}</Text>
                      {sel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Grill picker sub-modal */}
        <Modal visible={editGrillPickerVisible} transparent animationType="slide" onRequestClose={() => setEditGrillPickerVisible(false)}>
          <Pressable style={s.grillOverlay} onPress={() => setEditGrillPickerVisible(false)} />
          <View style={[s.grillSheet, { backgroundColor: colors.card }]}>
            <View style={[s.grillSheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.grillSheetTitle, { color: colors.foreground }]}>Select Grill</Text>
            {editGrillId != null && (
              <TouchableOpacity onPress={() => { setEditGrillId(null); setEditGrillPickerVisible(false); }} style={[s.grillItem, { borderBottomColor: colors.border }]}>
                <Text style={[s.grillItemText, { color: colors.destructive }]}>Clear selection</Text>
              </TouchableOpacity>
            )}
            {grills.length === 0 ? (
              <Text style={[s.grillEmpty, { color: colors.mutedForeground }]}>No grills in your inventory yet.</Text>
            ) : (
              <FlatList
                data={grills}
                keyExtractor={(g: any) => String(g.id)}
                renderItem={({ item: g }: { item: any }) => (
                  <TouchableOpacity
                    onPress={() => { setEditGrillId(g.id); setEditGrillPickerVisible(false); }}
                    style={[s.grillItem, { borderBottomColor: colors.border }, editGrillId === g.id && { backgroundColor: "#6C3BF5" + "12" }]}
                  >
                    <Text style={[s.grillItemText, { color: colors.foreground }]}>
                      {g.name ?? `${g.brand ?? ""} ${g.model ?? ""}`.trim()}
                    </Text>
                    {g.brand && <Text style={[s.grillItemSub, { color: colors.mutedForeground }]}>{g.brand}</Text>}
                    {editGrillId === g.id && <Feather name="check" size={16} color="#6C3BF5" style={{ marginLeft: "auto" }} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  goBackBtn: { marginTop: 16, padding: 12 },

  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 16, overflow: "hidden" },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#F3EDE1", letterSpacing: -0.3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerLogo: { width: 28, height: 28, opacity: 0.9 },
  delBtn: { padding: 4 },
  fireBar: { height: 2, backgroundColor: "#E84820" },

  statusBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 },

  card: { borderWidth: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 14, fontFamily: "Inter_400Regular", maxWidth: "55%", textAlign: "right" },
  notesLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },

  logSection: { borderWidth: 1, padding: 16, gap: 14 },
  logHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  logIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  logTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  logSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 3 },

  photoBtns: { flexDirection: "row", gap: 10 },
  photoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, paddingVertical: 10 },
  photoBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { position: "relative" },
  thumbImg: { width: 72, height: 72, borderRadius: 8 },
  thumbDel: { position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  addMoreThumb: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed" },

  notesInputLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  notesInput: { borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, lineHeight: 20 },

  analyzeBtn: { overflow: "hidden" },
  analyzeBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, height: 50 },
  analyzeBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },

  results: { borderTopWidth: 1, paddingTop: 16, gap: 14 },

  verdictBanner: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, padding: 14 },
  verdictLabel: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  verdictSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  verdictPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  verdictPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  storedSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  graphWrap: { borderWidth: 1, padding: 12, overflow: "hidden" },

  subSection: { borderTopWidth: 1, paddingTop: 12, gap: 0 },
  subLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },

  probeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingVertical: 10 },
  probeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  probeRange: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  probeFinish: { fontSize: 22, fontFamily: "Inter_700Bold" },

  eventRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderTopWidth: 1, paddingVertical: 10 },
  eventIconWrap: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 1 },
  eventDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  eventTime: { fontSize: 12, fontFamily: "Inter_500Medium", paddingTop: 4 },

  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingBottom: 6 },
  bulletNum: { fontSize: 13, fontFamily: "Inter_700Bold", minWidth: 16 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  noDataRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noDataText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, borderTopWidth: 1, paddingTop: 10 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52 },
  actionText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  homeLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  homeLinkText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  editBtn: { padding: 4 },
  gradePrompt: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, padding: 14 },
  gradePromptTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  gradePromptSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  editHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 16, gap: 10 },
  editFireBar: { height: 2 },
  editCancelBtn: { minWidth: 60 },
  editCancelText: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#F3EDE1", opacity: 0.8 },
  editHeaderTitle: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: "Inter_700Bold", color: "#F3EDE1" },
  editSaveBtn: { minWidth: 60, alignItems: "flex-end" },
  editSaveText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FF6B2B" },
  editFieldWrap: { gap: 6 },
  editLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
  editInput: { borderWidth: 1, height: 44, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  editPickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editRow2: { flexDirection: "row", gap: 12 },
  editTextArea: { borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 100, lineHeight: 20 },
  nowBtn: { borderWidth: 1, height: 44, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  nowBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  editPickerBtn: { flexDirection: "row", alignItems: "center", gap: 7 },

  grillOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  grillSheet: { maxHeight: "65%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  grillSheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  grillSheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12 },
  grillItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  grillItemText: { fontSize: 15, fontFamily: "Inter_500Medium", flex: 1 },
  grillItemSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginRight: 8 },
  grillEmpty: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 20 },
});

const edt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, maxHeight: "70%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 14, gap: 10 },
  rowMain: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
