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
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { LogoBackground } from "@/components/LogoBackground";
import { TempGraph } from "@/components/TempGraph";
import {
  useAnalyzeCook,
  useCreateCook,
  useListGrills,
  getListCooksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
} from "@workspace/api-client-react";
import { useMeaterReadings, type MeaterProbe } from "@/hooks/useMeaterReadings";
import { MEAT_CATEGORIES, MEAT_CUTS, MEAT_CUTS_BY_CATEGORY, type MeatCut } from "@/constants/meatCuts";
import { usePaywall } from "@/contexts/PaywallContext";

const logoImg = require("@/assets/images/logo.png");

function formatPickDate(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatPickTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const LOG_TIME_SLOTS: Array<{ h: number; m: number }> = (() => {
  const slots: Array<{ h: number; m: number }> = [];
  for (let h = 0; h <= 23; h++) {
    slots.push({ h, m: 0 });
    slots.push({ h, m: 30 });
  }
  return slots;
})();

type PickedImage = { uri: string; base64: string; mimeType: string };

type Assessment = {
  verdict: string;
  summary: string;
  whatWentWell: string[];
  suggestions: string[];
};

const VERDICT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  perfect:     { label: "Perfect Cook!",  color: "#22c55e", icon: "award" },
  good:        { label: "Good Cook",      color: "#84cc16", icon: "thumbs-up" },
  overcooked:  { label: "Overcooked",     color: "#f97316", icon: "thermometer" },
  undercooked: { label: "Undercooked",    color: "#3b82f6", icon: "thermometer" },
  needs_work:  { label: "Needs Work",     color: "#eab308", icon: "tool" },
};

const EVENT_ICONS: Record<string, string> = {
  wrap: "package",
  stall: "pause-circle",
  spike: "zap",
  done: "check-circle",
  note: "message-circle",
};

type ProbeData = {
  probeName: string;
  finishingTempF: number;
  minTempF: number | null;
  maxTempF: number | null;
  timeSeries: Array<{ timeMinutes: number; tempF: number }>;
};

type AnalysisResult = {
  probes: ProbeData[];
  events: Array<{ type: string; timeMinutes: number; description: string }>;
  cookDurationMinutes: number | null;
  detectedFoodType: string | null;
  detectedCookDate: string | null;
  detectedWeightLbs: number | null;
  detectedCookTempF: number | null;
  detectedTargetTempF: number | null;
  detectedGrillBrand: string | null;
  detectedWoodType: string | null;
  detectedRub: string | null;
  noDataFound: boolean;
  rawExtraction: string | null;
  assessment: Assessment | null;
};

function SummaryCell({ label, value, colors, highlight }: { label: string; value: string; colors: any; highlight?: boolean }) {
  return (
    <View style={sc.cell}>
      <Text style={[sc.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[sc.value, { color: highlight ? "#A855F7" : colors.foreground }]}>{value}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  cell: { width: "48%", paddingVertical: 10, paddingHorizontal: 12 },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 },
  value: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

export default function LogCookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const analyzeMutation = useAnalyzeCook();
  const createCook = useCreateCook();
  const { parseAndShowFromError } = usePaywall();

  const topPad = useTopInset();
  const botPad = useBottomInset();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [cardWidth, setCardWidth] = useState(300);

  const [foodType, setFoodType] = useState("");
  const [selectedGrillId, setSelectedGrillId] = useState<number | null>(null);
  const [grillPickerVisible, setGrillPickerVisible] = useState(false);
  const [targetTempF, setTargetTempF] = useState("");
  const [cookTempF, setCookTempF] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [cookNotes, setCookNotes] = useState("");
  const [scanNotes, setScanNotes] = useState("");
  const [actualStartDate, setActualStartDate] = useState<Date | null>(null);
  const [logDatePickerOpen, setLogDatePickerOpen] = useState(false);
  const [logTimePickerOpen, setLogTimePickerOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  const [saving, setSaving] = useState(false);
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [meatPickerVisible, setMeatPickerVisible] = useState(false);
  const [meatCatTab, setMeatCatTab] = useState<string>(MEAT_CATEGORIES[0]);
  const [aiScanned, setAiScanned] = useState(false);

  const { data: meaterData } = useMeaterReadings();
  const activeProbes: MeaterProbe[] = meaterData?.linked ? (meaterData.probes ?? []) : [];

  const selectProbe = (probe: MeaterProbe) => {
    if (selectedProbeId === probe.deviceId) {
      setSelectedProbeId(null);
      return;
    }
    setSelectedProbeId(probe.deviceId);
    if (probe.targetMaxTempF != null && !targetTempF.trim()) {
      setTargetTempF(String(probe.targetMaxTempF));
    }
    if (probe.cookName && !foodType.trim()) {
      setFoodType(probe.cookName);
    }
  };

  const todayCal = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const calRows = useMemo(() => {
    const firstDay = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [calendarViewDate]);
  const calPrevMonth = () => setCalendarViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
  const calNextMonth = () => setCalendarViewDate(d => {
    const n = new Date(d); n.setMonth(n.getMonth() + 1);
    const cap = new Date(); cap.setDate(1); cap.setHours(0, 0, 0, 0);
    return n <= cap ? n : d;
  });

  const { data: grillsList } = useListGrills();
  const grills: any[] = Array.isArray(grillsList) ? grillsList : [];
  const selectedGrill = useMemo(() => grills.find((g: any) => g.id === selectedGrillId) ?? null, [grills, selectedGrillId]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/cooks" as any);
  };

  const onCardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width - 32;
    if (w > 100) setCardWidth(w);
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
    if (images.length === 0 && !scanNotes.trim()) {
      Alert.alert("Add something", "Pick at least one thermometer photo, or describe the cook in the notes.");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const contextPayload: any = {};
      if (foodType.trim()) contextPayload.foodType = foodType.trim();
      if (targetTempF.trim()) contextPayload.targetTempF = parseFloat(targetTempF);
      if (cookTempF.trim()) contextPayload.cookTempF = parseFloat(cookTempF);
      if (weightLbs.trim()) contextPayload.weightLbs = parseFloat(weightLbs);

      const data: any = await analyzeMutation.mutateAsync({
        data: {
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          cookNotes: scanNotes.trim() || null,
          cookContext: Object.keys(contextPayload).length > 0 ? contextPayload : undefined,
        } as any,
      });

      setResult(data);
      setAiScanned(true);

      // Auto-populate form fields from detected data (only if field is still empty)
      if (data.detectedFoodType && !foodType.trim()) {
        // Try to fuzzy-match against known meat cuts for a canonical name
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const needle = norm(data.detectedFoodType);
        const cutMatch = MEAT_CUTS.find((c) => {
          const hay = norm(c.name);
          return hay.includes(needle) || needle.includes(norm(c.name.split(" ")[0]));
        });
        const resolvedFoodType = cutMatch ? cutMatch.name : data.detectedFoodType;
        setFoodType(resolvedFoodType);
        // Auto-set temps from matched cut if still empty
        if (cutMatch) {
          if (!targetTempF.trim()) setTargetTempF(String(cutMatch.targetTempF));
          if (!cookTempF.trim()) setCookTempF(String(cutMatch.cookTempF));
        }
      }
      if (data.detectedWeightLbs != null && !weightLbs.trim()) setWeightLbs(String(data.detectedWeightLbs));
      if (data.detectedCookTempF != null && !cookTempF.trim()) setCookTempF(String(Math.round(data.detectedCookTempF)));
      if (data.detectedTargetTempF != null && !targetTempF.trim()) setTargetTempF(String(Math.round(data.detectedTargetTempF)));
      if (data.detectedGrillBrand && selectedGrillId == null && grills.length > 0) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const needle = norm(data.detectedGrillBrand);
        const match = grills.find((g: any) => {
          const haystack = norm(`${g.brand ?? ""} ${g.name ?? ""} ${g.model ?? ""} ${g.type ?? ""}`);
          return haystack.includes(needle) || needle.includes(norm(g.brand ?? "").substring(0, 4));
        });
        if (match) setSelectedGrillId(match.id);
      }

      // Append wood type / rub to cook notes if detected and not already mentioned
      const extras: string[] = [];
      if (data.detectedWoodType) extras.push(`Wood/pellets: ${data.detectedWoodType}`);
      if (data.detectedRub) extras.push(`Rub/seasoning: ${data.detectedRub}`);
      if (extras.length > 0 && !cookNotes.trim()) setCookNotes(extras.join("\n"));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Scan failed", "Could not analyze the images. Check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!foodType.trim()) {
      Alert.alert("Food type required", "Enter what you cooked — e.g. Brisket, Pork Butt, Ribs.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        foodType: foodType.trim(),
        status: "completed",
        notes: cookNotes.trim() || (scanNotes.trim() ? `Cook notes:\n${scanNotes.trim()}` : null),
      };
      if (selectedGrillId != null) payload.grillId = selectedGrillId;
      if (targetTempF.trim() && !isNaN(parseFloat(targetTempF))) payload.targetTempF = parseFloat(targetTempF);
      if (cookTempF.trim() && !isNaN(parseFloat(cookTempF))) payload.cookTempF = parseFloat(cookTempF);
      if (weightLbs.trim() && !isNaN(parseFloat(weightLbs))) payload.weightLbs = parseFloat(weightLbs);
      // Prefer user-entered start time; fall back to AI-detected date
      if (actualStartDate) {
        payload.actualStartAt = actualStartDate.toISOString();
      } else if (result?.detectedCookDate) {
        const d = new Date(result.detectedCookDate);
        if (!isNaN(d.getTime())) payload.actualStartAt = d.toISOString();
      }
      if (result) {
        payload.analysisResult = {
          probes: result.probes,
          events: result.events,
          cookDurationMinutes: result.cookDurationMinutes,
          detectedFoodType: result.detectedFoodType,
          detectedWeightLbs: result.detectedWeightLbs,
          detectedCookTempF: result.detectedCookTempF,
          detectedTargetTempF: result.detectedTargetTempF,
          detectedGrillBrand: result.detectedGrillBrand,
          detectedWoodType: result.detectedWoodType,
          detectedRub: result.detectedRub,
          assessment: result.assessment,
        };
      }

      const cook = await createCook.mutateAsync({ data: payload });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
      qc.invalidateQueries({ queryKey: ["home", "insights"] });
      qc.invalidateQueries({ queryKey: ["paywall", "usage"] });

      const newId = (cook as any)?.id;
      if (newId) router.replace(`/cooks/${newId}` as any);
      else goBack();
    } catch (err) {
      // 402 from server (free plan cook cap) → paywall modal. Anything else
      // falls back to the generic alert.
      if (!parseAndShowFromError(err)) {
        Alert.alert("Save failed", "Could not save the cook. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const assessment = result?.assessment ?? null;
  const verdictCfg = assessment ? (VERDICT_CONFIG[assessment.verdict] ?? VERDICT_CONFIG.needs_work) : null;
  const graphProbes = (result?.probes ?? []).filter((p) => p.timeSeries && p.timeSeries.length >= 2);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
        <Text style={s.headerTitle}>Log a Past Cook</Text>
        <Pressable onPress={goBack} hitSlop={8}>
          <Image source={logoImg} style={s.headerLogo} resizeMode="contain" />
        </Pressable>
      </LinearGradient>
      <View style={s.fireBar} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: botPad + 60, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── AI Scanner card ────────────────────────────── */}
        <View
          style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
          onLayout={onCardLayout}
        >
          <View style={s.sectionHeader}>
            <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.sectionIcon}>
              <Feather name="camera" size={15} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>PitMaster Image Scanner</Text>
              <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>
                Upload thermometer photos — PitMaster reads temps, builds a graph, and grades the cook
              </Text>
            </View>
          </View>

          <View style={s.photoRow}>
            <Pressable style={[s.photoBtn, { borderColor: colors.border, borderRadius: colors.radius }]} onPress={pickImages}>
              <Feather name="image" size={16} color="#A855F7" />
              <Text style={[s.photoBtnText, { color: colors.foreground }]}>Upload Photos</Text>
            </Pressable>
          </View>

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
              {images.length < 5 && (
                <Pressable style={[s.addMoreThumb, { borderColor: colors.border }]} onPress={pickImages}>
                  <Feather name="plus" size={18} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          )}

          <View>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>
              Describe the cook <Text style={{ fontWeight: "400" }}>(helps PitMaster when images are unclear)</Text>
            </Text>
            <TextInput
              style={[s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              placeholder="e.g. 12lb brisket, wrapped at hour 5, hit 203°F after 14 hours…"
              placeholderTextColor={colors.mutedForeground}
              value={scanNotes}
              onChangeText={setScanNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={({ pressed }) => [s.scanBtn, { borderRadius: colors.radius }, (analyzing || pressed) && { opacity: 0.75 }]}
            onPress={analyze}
            disabled={analyzing}
          >
            <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.scanBtnGradient}>
              {analyzing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.scanBtnText}>PitMaster is reading your cook…</Text>
                </>
              ) : (
                <>
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={s.scanBtnText}>
                    {images.length > 0
                      ? `Scan ${images.length} image${images.length > 1 ? "s" : ""} with PitMaster`
                      : "Analyze Cook Notes with PitMaster"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* ── Results ───────────────────────────── */}
          {result && (
            <View style={[s.results, { borderTopColor: colors.border }]}>

              {/* Verdict banner */}
              {verdictCfg && assessment && (
                <View style={[s.verdictBanner, { backgroundColor: verdictCfg.color + "18", borderColor: verdictCfg.color + "40", borderRadius: colors.radius }]}>
                  <Feather name={verdictCfg.icon as any} size={20} color={verdictCfg.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.verdictLabel, { color: verdictCfg.color }]}>{verdictCfg.label}</Text>
                    {assessment.summary ? <Text style={[s.verdictSummary, { color: colors.foreground }]}>{assessment.summary}</Text> : null}
                  </View>
                </View>
              )}

              {/* Cook summary card — matches Plan a Cook schedule style */}
              {(result.cookDurationMinutes != null || result.detectedFoodType || result.detectedWeightLbs != null || result.detectedCookTempF != null || result.detectedTargetTempF != null || result.detectedGrillBrand || result.detectedWoodType || result.detectedRub) && (
                <View style={[s.summaryCard, { backgroundColor: colors.background, borderColor: "#A855F7" + "30", borderRadius: colors.radius }]}>
                  <LinearGradient colors={["#6C3BF5", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.summaryHeader}>
                    <Feather name="cpu" size={14} color="#fff" />
                    <Text style={s.summaryHeaderText}>PitMaster Scan Summary</Text>
                  </LinearGradient>
                  <View style={s.summaryGrid}>
                    {result.detectedFoodType ? <SummaryCell label="Cut Detected" value={result.detectedFoodType} colors={colors} /> : null}
                    {result.cookDurationMinutes != null ? <SummaryCell label="Cook Duration" value={`${Math.floor(result.cookDurationMinutes / 60)}h ${result.cookDurationMinutes % 60}m`} colors={colors} highlight /> : null}
                    {result.detectedWeightLbs != null ? <SummaryCell label="Weight" value={`${result.detectedWeightLbs} lbs`} colors={colors} /> : null}
                    {result.detectedCookTempF != null ? <SummaryCell label="Cook Temp" value={`${Math.round(result.detectedCookTempF)}°F`} colors={colors} /> : null}
                    {result.detectedTargetTempF != null ? <SummaryCell label="Finish Temp" value={`${Math.round(result.detectedTargetTempF)}°F`} colors={colors} /> : null}
                    {result.detectedGrillBrand ? <SummaryCell label="Grill / Smoker" value={result.detectedGrillBrand} colors={colors} /> : null}
                    {result.detectedWoodType ? <SummaryCell label="Wood / Pellets" value={result.detectedWoodType} colors={colors} /> : null}
                    {result.detectedRub ? <SummaryCell label="Rub / Season" value={result.detectedRub} colors={colors} /> : null}
                    {result.probes.length > 0 ? <SummaryCell label="Probes Read" value={`${result.probes.length} probe${result.probes.length > 1 ? "s" : ""}`} colors={colors} /> : null}
                  </View>
                </View>
              )}

              {/* Temperature graph */}
              {graphProbes.length > 0 && (
                <View style={[s.graphWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Temperature Over Time</Text>
                  <TempGraph
                    probes={graphProbes}
                    events={result.events}
                    targetTempF={targetTempF ? parseFloat(targetTempF) : null}
                    width={cardWidth}
                    height={180}
                  />
                </View>
              )}

              {/* PitMaster tips */}
              {((assessment?.whatWentWell?.length ?? 0) > 0 || (assessment?.suggestions?.length ?? 0) > 0) && (
                <View style={[s.tipsCard, { backgroundColor: colors.background, borderColor: "#A855F7" + "30", borderRadius: colors.radius }]}>
                  <LinearGradient colors={["#6C3BF5", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.summaryHeader}>
                    <Feather name="zap" size={14} color="#fff" />
                    <Text style={s.summaryHeaderText}>PitMaster Feedback</Text>
                  </LinearGradient>
                  <View style={{ padding: 12, gap: 8 }}>
                    {(assessment?.whatWentWell ?? []).map((item, i) => (
                      <View key={`w${i}`} style={s.bulletRow}>
                        <Feather name="check-circle" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                        <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                      </View>
                    ))}
                    {(assessment?.suggestions ?? []).map((tip, i) => (
                      <View key={`s${i}`} style={s.bulletRow}>
                        <View style={[s.tipNum, { backgroundColor: "#A855F7" + "20" }]}>
                          <Text style={[s.tipNumText, { color: "#A855F7" }]}>{i + 1}</Text>
                        </View>
                        <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {result.noDataFound && result.probes.length === 0 && (
                <View style={s.infoRow}>
                  <Feather name="info" size={14} color={colors.mutedForeground} />
                  <Text style={[s.infoText, { color: colors.mutedForeground }]}>
                    No temperature data detected — assessment based on notes only.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Live MEATER probes ────────────────────── */}
        {activeProbes.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={s.sectionHeader}>
              <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.sectionIcon}>
                <Feather name="thermometer" size={15} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Live MEATER Probes</Text>
                <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>
                  Select a probe to auto-fill temperature from your active cook
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#34C759" }} />
                <Text style={{ fontSize: 10, color: "#34C759", fontFamily: "Inter_600SemiBold" }}>LIVE</Text>
              </View>
            </View>

            {activeProbes.map((probe) => {
              const isSelected = selectedProbeId === probe.deviceId;
              return (
                <Pressable
                  key={probe.deviceId}
                  onPress={() => selectProbe(probe)}
                  style={({ pressed }) => [
                    s.probePickRow,
                    {
                      borderColor: isSelected ? "#E84820" : colors.border,
                      backgroundColor: isSelected ? "#E8482008" : "transparent",
                      borderRadius: colors.radius,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                      {probe.deviceName}
                    </Text>
                    {probe.cookName ? (
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                        {probe.cookName}{probe.cookState ? ` · ${probe.cookState}` : ""}
                      </Text>
                    ) : null}
                  </View>
                  {probe.internalTempF != null && (
                    <View style={[s.probeTempBadge, { backgroundColor: "#E84820" + "18" }]}>
                      <Text style={{ color: "#E84820", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                        {probe.internalTempF}°F
                      </Text>
                    </View>
                  )}
                  <View style={[
                    s.probeSelectCircle,
                    {
                      borderColor: isSelected ? "#E84820" : colors.border,
                      backgroundColor: isSelected ? "#E84820" : "transparent",
                    },
                  ]}>
                    {isSelected && <Feather name="check" size={12} color="#fff" />}
                  </View>
                </Pressable>
              );
            })}

            {selectedProbeId && (
              <View style={[s.probeLinkedBanner, { backgroundColor: "#E84820" + "10", borderColor: "#E84820" + "30", borderRadius: colors.radius }]}>
                <Feather name="link" size={13} color="#E84820" />
                <Text style={{ color: "#E84820", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
                  Probe linked — temperature field has been auto-filled from your live cook
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Manual entry form ─────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={s.sectionHeader}>
            <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.sectionIcon}>
              <Feather name="edit-3" size={15} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Cook Details</Text>
              <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>
                PitMaster fills these in automatically — review and adjust before saving
              </Text>
            </View>
          </View>

          <View style={s.formBody}>
            {/* ── What did you cook? (meat cut selector) ── */}
            <View style={s.fieldWrap}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                  What did you cook? <Text style={{ color: colors.destructive }}>*</Text>
                </Text>
                {aiScanned && !foodType.trim() && (
                  <View style={s.needsFillBadge}>
                    <Feather name="alert-circle" size={11} color="#F59E0B" />
                    <Text style={s.needsFillText}>Fill this in</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => setMeatPickerVisible(true)}
                style={[s.input, s.grillPicker, {
                  backgroundColor: colors.background,
                  borderColor: aiScanned && !foodType.trim() ? "#F59E0B" : foodType ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                }]}
              >
                {foodType ? (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="check-circle" size={13} color={colors.primary} />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={1}>
                      {foodType}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    Select a meat cut…
                  </Text>
                )}
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* ── Weight ── */}
            <View style={s.fieldWrap}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Weight (lbs)</Text>
                {aiScanned && !weightLbs.trim() && (
                  <View style={s.needsFillBadge}>
                    <Feather name="alert-circle" size={11} color="#F59E0B" />
                    <Text style={s.needsFillText}>Fill this in</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: aiScanned && !weightLbs.trim() ? "#F59E0B" : colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="14"
                placeholderTextColor={colors.mutedForeground}
                value={weightLbs}
                onChangeText={setWeightLbs}
                keyboardType="decimal-pad"
              />
            </View>

            {/* ── Grill (full-width own row) ── */}
            <View style={s.fieldWrap}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Grill / Smoker</Text>
                {aiScanned && !selectedGrillId && (
                  <View style={s.needsFillBadge}>
                    <Feather name="alert-circle" size={11} color="#F59E0B" />
                    <Text style={s.needsFillText}>Fill this in</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => setGrillPickerVisible(true)}
                style={[s.input, s.grillPicker, {
                  backgroundColor: colors.background,
                  borderColor: aiScanned && !selectedGrillId ? "#F59E0B" : selectedGrill ? "#6C3BF5" : colors.border,
                  borderRadius: colors.radius,
                }]}
              >
                {selectedGrill ? (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="check-circle" size={13} color="#6C3BF5" />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={1}>
                      {selectedGrill.name ?? `${selectedGrill.brand} ${selectedGrill.model ?? ""}`.trim()}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {grills.length === 0 ? "Add grills to your inventory first" : "Select your grill…"}
                  </Text>
                )}
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* ── Temps (side by side) ── */}
            <View style={s.row2}>
              <View style={[s.fieldWrap, { flex: 1 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Cook Temp (°F)</Text>
                  {aiScanned && !cookTempF.trim() && (
                    <View style={s.needsFillBadge}>
                      <Feather name="alert-circle" size={11} color="#F59E0B" />
                      <Text style={s.needsFillText}>Fill</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: aiScanned && !cookTempF.trim() ? "#F59E0B" : colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="225"
                  placeholderTextColor={colors.mutedForeground}
                  value={cookTempF}
                  onChangeText={setCookTempF}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[s.fieldWrap, { flex: 1 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Target Temp (°F)</Text>
                  {aiScanned && !targetTempF.trim() && (
                    <View style={s.needsFillBadge}>
                      <Feather name="alert-circle" size={11} color="#F59E0B" />
                      <Text style={s.needsFillText}>Fill</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: aiScanned && !targetTempF.trim() ? "#F59E0B" : colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="203"
                  placeholderTextColor={colors.mutedForeground}
                  value={targetTempF}
                  onChangeText={setTargetTempF}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Cook notes</Text>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="Anything worth remembering — wood type, rubs, tweaks…"
                placeholderTextColor={colors.mutedForeground}
                value={cookNotes}
                onChangeText={setCookNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>When did this cook happen?</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => {
                    const base = actualStartDate ? new Date(actualStartDate) : new Date();
                    base.setDate(1); base.setHours(0, 0, 0, 0);
                    setCalendarViewDate(base);
                    setLogDatePickerOpen(true);
                  }}
                  style={[s.input, s.pickerBtn, { flex: 1, backgroundColor: colors.background, borderColor: actualStartDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="calendar" size={14} color={actualStartDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: actualStartDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {actualStartDate ? formatPickDate(actualStartDate) : "Pick a date"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!actualStartDate) setActualStartDate(new Date());
                    setLogTimePickerOpen(true);
                  }}
                  style={[s.input, s.pickerBtn, { backgroundColor: colors.background, borderColor: actualStartDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="clock" size={14} color={actualStartDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: actualStartDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {actualStartDate ? formatPickTime(actualStartDate.getHours(), actualStartDate.getMinutes()) : "Time"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Save */}
        <Pressable
          style={({ pressed }) => [s.saveBtn, { borderRadius: colors.radius }, (saving || pressed) && { opacity: 0.75 }]}
          onPress={save}
          disabled={saving}
        >
          <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.saveBtnGradient}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="save" size={17} color="#fff" />
                <Text style={s.saveBtnText}>Save to Cook Log</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable onPress={goBack} style={s.cancelLink}>
          <Text style={[s.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
      </ScrollView>

      {/* ════ LOG DATE PICKER MODAL ════ */}
      <Modal visible={logDatePickerOpen} animationType="slide" transparent onRequestClose={() => setLogDatePickerOpen(false)}>
        <View style={dp2.overlay}>
          <View style={[dp2.sheet, { backgroundColor: colors.card }]}>
            <View style={[dp2.handle, { backgroundColor: colors.border }]} />
            <View style={[dp2.header, { borderBottomColor: colors.border }]}>
              <Text style={[dp2.title, { color: colors.foreground }]}>When did you cook?</Text>
              <Pressable onPress={() => setLogDatePickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {/* Month navigation */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 }}>
              <Pressable onPress={calPrevMonth} hitSlop={12} style={{ padding: 6 }}>
                <Feather name="chevron-left" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_600SemiBold" }}>
                {calendarViewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>
              <Pressable
                onPress={calNextMonth}
                hitSlop={12}
                style={{ padding: 6 }}
                disabled={calendarViewDate.getFullYear() === todayCal.getFullYear() && calendarViewDate.getMonth() === todayCal.getMonth()}
              >
                <Feather
                  name="chevron-right"
                  size={22}
                  color={calendarViewDate.getFullYear() === todayCal.getFullYear() && calendarViewDate.getMonth() === todayCal.getMonth() ? colors.mutedForeground + "50" : colors.foreground}
                />
              </Pressable>
            </View>
            {/* Day names */}
            <View style={{ flexDirection: "row", paddingHorizontal: 10, marginBottom: 4 }}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(dn => (
                <View key={dn} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>{dn}</Text>
                </View>
              ))}
            </View>
            {/* Day grid */}
            <View style={{ paddingHorizontal: 10, paddingBottom: 28 }}>
              {calRows.map((row, ri) => (
                <View key={ri} style={{ flexDirection: "row" }}>
                  {row.map((cell, ci) => {
                    if (!cell) return <View key={ci} style={{ flex: 1 }} />;
                    const cellDay = new Date(cell); cellDay.setHours(0, 0, 0, 0);
                    const isToday = cellDay.getTime() === todayCal.getTime();
                    const isFuture = cellDay > todayCal;
                    const isSelected = !!(actualStartDate &&
                      cellDay.getDate() === actualStartDate.getDate() &&
                      cellDay.getMonth() === actualStartDate.getMonth() &&
                      cellDay.getFullYear() === actualStartDate.getFullYear());
                    return (
                      <Pressable
                        key={ci}
                        disabled={isFuture}
                        onPress={() => {
                          const next = actualStartDate ? new Date(actualStartDate) : new Date();
                          next.setFullYear(cell.getFullYear(), cell.getMonth(), cell.getDate());
                          setActualStartDate(next);
                          setLogDatePickerOpen(false);
                        }}
                        style={{ flex: 1, alignItems: "center", paddingVertical: 5 }}
                      >
                        <View style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: isSelected ? colors.primary : isToday ? colors.primary + "22" : "transparent",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <Text style={{
                            color: isSelected ? "#fff" : isFuture ? colors.mutedForeground + "55" : isToday ? colors.primary : colors.foreground,
                            fontSize: 14,
                            fontFamily: isSelected || isToday ? "Inter_600SemiBold" : "Inter_400Regular",
                          }}>
                            {cell.getDate()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ LOG TIME PICKER MODAL ════ */}
      <Modal visible={logTimePickerOpen} animationType="slide" transparent onRequestClose={() => setLogTimePickerOpen(false)}>
        <View style={dp2.overlay}>
          <View style={[dp2.sheet, { backgroundColor: colors.card }]}>
            <View style={[dp2.handle, { backgroundColor: colors.border }]} />
            <View style={[dp2.header, { borderBottomColor: colors.border }]}>
              <Text style={[dp2.title, { color: colors.foreground }]}>What time?</Text>
              <Pressable onPress={() => setLogTimePickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {LOG_TIME_SLOTS.map(({ h, m }) => {
                const isSelected = actualStartDate && actualStartDate.getHours() === h && actualStartDate.getMinutes() === m;
                return (
                  <Pressable
                    key={`${h}:${m}`}
                    onPress={() => {
                      const next = actualStartDate ? new Date(actualStartDate) : new Date();
                      next.setHours(h, m, 0, 0);
                      setActualStartDate(next);
                      setLogTimePickerOpen(false);
                    }}
                    style={[dp2.row, isSelected && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}
                  >
                    <Text style={[dp2.rowText, { color: isSelected ? colors.primary : colors.foreground }]}>
                      {formatPickTime(h, m)}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Meat cut picker modal ── */}
      <Modal
        visible={meatPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMeatPickerVisible(false)}
      >
        <View style={gp.modalWrap}>
          <Pressable style={gp.backdrop} onPress={() => setMeatPickerVisible(false)} />
          <View style={[gp.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[gp.handle, { backgroundColor: colors.border }]} />
          <Text style={[gp.title, { color: colors.foreground }]}>What Did You Cook?</Text>

          {/* Category tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
            {MEAT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setMeatCatTab(cat)}
                style={[
                  mp.catTab,
                  meatCatTab === cat
                    ? { backgroundColor: "#E84820", borderColor: "#E84820" }
                    : { backgroundColor: "transparent", borderColor: colors.border },
                ]}
              >
                <Text style={[mp.catTabText, { color: meatCatTab === cat ? "#fff" : colors.mutedForeground }]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <FlatList
            data={MEAT_CUTS_BY_CATEGORY[meatCatTab] ?? []}
            keyExtractor={(item: MeatCut) => item.name}
            style={{ maxHeight: 340 }}
            ItemSeparatorComponent={() => <View style={[gp.sep, { backgroundColor: colors.border }]} />}
            renderItem={({ item }: { item: MeatCut }) => {
              const isSelected = foodType === item.name;
              return (
                <TouchableOpacity
                  style={[gp.row, isSelected && { backgroundColor: "#E84820" + "12" }]}
                  onPress={() => {
                    setFoodType(item.name);
                    if (!targetTempF.trim()) setTargetTempF(String(item.targetTempF));
                    if (!cookTempF.trim()) setCookTempF(String(item.cookTempF));
                    setMeatPickerVisible(false);
                  }}
                >
                  <View style={gp.rowText}>
                    <Text style={[gp.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[gp.rowSub, { color: colors.mutedForeground }]}>
                      {item.cookMethod} · Target {item.targetTempF}°F
                    </Text>
                  </View>
                  {isSelected && <Feather name="check" size={16} color="#E84820" />}
                </TouchableOpacity>
              );
            }}
          />

          {foodType && (
            <TouchableOpacity onPress={() => { setFoodType(""); setMeatPickerVisible(false); }} style={gp.clearBtn}>
              <Text style={[gp.clearBtnText, { color: colors.mutedForeground }]}>Clear selection</Text>
            </TouchableOpacity>
          )}
          </View>
        </View>
      </Modal>

      {/* Grill picker modal */}
      <Modal
        visible={grillPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGrillPickerVisible(false)}
      >
        <View style={gp.modalWrap}>
          <Pressable style={gp.backdrop} onPress={() => setGrillPickerVisible(false)} />
          <View style={[gp.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[gp.handle, { backgroundColor: colors.border }]} />
          <Text style={[gp.title, { color: colors.foreground }]}>Select Grill / Smoker</Text>

          {grills.length === 0 ? (
            <View style={gp.empty}>
              <Feather name="inbox" size={32} color={colors.mutedForeground} />
              <Text style={[gp.emptyText, { color: colors.mutedForeground }]}>No grills in your inventory yet.</Text>
              <TouchableOpacity
                onPress={() => { setGrillPickerVisible(false); router.push("/grills" as any); }}
                style={gp.addBtn}
              >
                <LinearGradient colors={["#6C3BF5", "#A855F7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={gp.addBtnGrad}>
                  <Feather name="plus" size={15} color="#fff" />
                  <Text style={gp.addBtnText}>Add Your Grills</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={grills}
              keyExtractor={(g: any) => String(g.id)}
              style={{ maxHeight: 340 }}
              ItemSeparatorComponent={() => <View style={[gp.sep, { backgroundColor: colors.border }]} />}
              renderItem={({ item }: { item: any }) => {
                const isSelected = item.id === selectedGrillId;
                const displayName = item.name ?? `${item.brand ?? ""} ${item.model ?? ""}`.trim();
                const subtitle = [item.brand, item.type].filter(Boolean).join(" · ");
                return (
                  <TouchableOpacity
                    style={[gp.row, isSelected && { backgroundColor: "#6C3BF5" + "12" }]}
                    onPress={() => { setSelectedGrillId(item.id); setGrillPickerVisible(false); }}
                  >
                    <View style={gp.rowText}>
                      <Text style={[gp.rowName, { color: colors.foreground }]} numberOfLines={1}>{displayName}</Text>
                      {subtitle ? <Text style={[gp.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{subtitle}</Text> : null}
                    </View>
                    {isSelected && <Feather name="check" size={16} color="#6C3BF5" />}
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <TouchableOpacity
                  onPress={() => { setGrillPickerVisible(false); router.push("/grills" as any); }}
                  style={gp.footerBtn}
                >
                  <Feather name="plus-circle" size={15} color="#6C3BF5" />
                  <Text style={[gp.footerBtnText, { color: "#6C3BF5" }]}>Add another grill</Text>
                </TouchableOpacity>
              }
            />
          )}

          {selectedGrillId != null && (
            <TouchableOpacity onPress={() => { setSelectedGrillId(null); setGrillPickerVisible(false); }} style={gp.clearBtn}>
              <Text style={[gp.clearBtnText, { color: colors.mutedForeground }]}>Clear selection</Text>
            </TouchableOpacity>
          )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 16, overflow: "hidden" },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#F3EDE1", letterSpacing: -0.3 },
  headerLogo: { width: 28, height: 28, opacity: 0.9 },
  fireBar: { height: 2, backgroundColor: "#E84820" },

  card: { borderWidth: 1, padding: 16, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 3 },

  photoRow: { flexDirection: "row", gap: 10 },
  photoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, paddingVertical: 11 },
  photoBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { position: "relative" },
  thumbImg: { width: 70, height: 70, borderRadius: 8 },
  thumbDel: { position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  addMoreThumb: { width: 70, height: 70, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 8 },

  scanBtn: { overflow: "hidden" },
  scanBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, height: 50 },
  scanBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },

  results: { borderTopWidth: 1, paddingTop: 14, gap: 12 },
  verdictBanner: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, padding: 14 },
  verdictLabel: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  verdictSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  summaryCard: { borderWidth: 1, overflow: "hidden" },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  summaryHeaderText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 4 },
  tipsCard: { borderWidth: 1, overflow: "hidden" },

  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingBottom: 5 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  tipNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  tipNumText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  graphWrap: { borderWidth: 1, padding: 12, overflow: "hidden" },
  subLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  formBody: { gap: 12 },
  fieldWrap: { gap: 6 },
  row2: { flexDirection: "row", gap: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular" },
  grillPicker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  needsFillBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F59E0B18", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  needsFillText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#F59E0B" },
  textArea: { borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, lineHeight: 20 },

  saveBtn: { overflow: "hidden" },
  saveBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 54 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  cancelLink: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  nowBtn: { borderWidth: 1, height: 44, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  nowBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pickerBtn: { flexDirection: "row", alignItems: "center", gap: 7 },

  probePickRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, marginBottom: 8 },
  probeTempBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  probeSelectCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  probeLinkedBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderWidth: 1, marginTop: 4 },
});

const gp = StyleSheet.create({
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingHorizontal: 16, maxHeight: "80%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12, paddingHorizontal: 4 },
  sep: { height: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 14 },
  rowText: { flex: 1, marginRight: 8 },
  rowName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 32 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  addBtn: { overflow: "hidden", borderRadius: 12 },
  addBtnGrad: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  addBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footerBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 4 },
  footerBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  clearBtn: { alignItems: "center", paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: "#ffffff15" },
  clearBtnText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});

const mp = StyleSheet.create({
  catTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  catTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

const dp2 = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, maxHeight: "70%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 14, gap: 10 },
  rowText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
