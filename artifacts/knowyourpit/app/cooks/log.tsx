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

const logoImg = require("@/assets/images/logo.png");

function getPastDates(): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

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

function DetectedPill({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[dp.pill, { backgroundColor: "#A855F7" + "12", borderColor: "#A855F7" + "25" }]}>
      <Text style={[dp.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[dp.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}
const dp = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90 },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  value: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

export default function LogCookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const analyzeMutation = useAnalyzeCook();
  const createCook = useCreateCook();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

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

  const [saving, setSaving] = useState(false);

  const pastDates = useMemo(() => getPastDates(), []);

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

      // Auto-populate form fields from detected data (only if field is still empty)
      if (data.detectedFoodType && !foodType.trim()) setFoodType(data.detectedFoodType);
      if (data.detectedWeightLbs != null && !weightLbs.trim()) setWeightLbs(String(data.detectedWeightLbs));
      if (data.detectedCookTempF != null && !cookTempF.trim()) setCookTempF(String(Math.round(data.detectedCookTempF)));
      if (data.detectedTargetTempF != null && !targetTempF.trim()) setTargetTempF(String(Math.round(data.detectedTargetTempF)));
      if (data.detectedGrillBrand && selectedGrillId == null && grills.length > 0) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const needle = norm(data.detectedGrillBrand);
        const match = grills.find((g: any) => {
          const haystack = norm(`${g.brand ?? ""} ${g.name ?? ""} ${g.model ?? ""}`);
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

      const newId = (cook as any)?.id;
      if (newId) router.replace(`/cooks/${newId}` as any);
      else goBack();
    } catch {
      Alert.alert("Save failed", "Could not save the cook. Please try again.");
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
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>AI Image Scanner</Text>
              <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>
                Upload thermometer photos — AI reads temps, builds a graph, and grades the cook
              </Text>
            </View>
          </View>

          <View style={s.photoRow}>
            <Pressable style={[s.photoBtn, { borderColor: colors.border, borderRadius: colors.radius }]} onPress={pickImages}>
              <Feather name="image" size={16} color="#A855F7" />
              <Text style={[s.photoBtnText, { color: colors.foreground }]}>Gallery</Text>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable style={[s.photoBtn, { borderColor: colors.border, borderRadius: colors.radius }]} onPress={takePhoto}>
                <Feather name="camera" size={16} color="#A855F7" />
                <Text style={[s.photoBtnText, { color: colors.foreground }]}>Camera</Text>
              </Pressable>
            )}
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
              Describe the cook <Text style={{ fontWeight: "400" }}>(helps AI when images are unclear)</Text>
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
                  <Text style={s.scanBtnText}>AI is reading your cook…</Text>
                </>
              ) : (
                <>
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={s.scanBtnText}>
                    {images.length > 0
                      ? `Scan ${images.length} image${images.length > 1 ? "s" : ""} with AI`
                      : "Analyze Cook Notes with AI"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* ── Results ───────────────────────────── */}
          {result && (
            <View style={[s.results, { borderTopColor: colors.border }]}>

              {/* Verdict */}
              {verdictCfg && assessment && (
                <View style={[s.verdictBanner, { backgroundColor: verdictCfg.color + "18", borderColor: verdictCfg.color + "40", borderRadius: colors.radius }]}>
                  <Feather name={verdictCfg.icon as any} size={20} color={verdictCfg.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.verdictLabel, { color: verdictCfg.color }]}>{verdictCfg.label}</Text>
                    {assessment.summary ? <Text style={[s.verdictSummary, { color: colors.foreground }]}>{assessment.summary}</Text> : null}
                  </View>
                </View>
              )}

              {/* Auto-detected cook details */}
              {(result.detectedFoodType || result.detectedWeightLbs != null || result.detectedCookTempF != null || result.detectedTargetTempF != null || result.detectedGrillBrand || result.detectedWoodType || result.detectedRub || result.cookDurationMinutes != null) && (
                <View style={[s.detectedCard, { backgroundColor: colors.background, borderColor: "#A855F7" + "30", borderRadius: colors.radius }]}>
                  <View style={s.detectedHeader}>
                    <Feather name="check-circle" size={13} color="#A855F7" />
                    <Text style={[s.detectedTitle, { color: "#A855F7" }]}>Auto-filled your cook details</Text>
                  </View>
                  <View style={s.detectedGrid}>
                    {result.detectedFoodType ? <DetectedPill label="Cut" value={result.detectedFoodType} colors={colors} /> : null}
                    {result.detectedWeightLbs != null ? <DetectedPill label="Weight" value={`${result.detectedWeightLbs} lbs`} colors={colors} /> : null}
                    {result.detectedCookTempF != null ? <DetectedPill label="Cook temp" value={`${Math.round(result.detectedCookTempF)}°F`} colors={colors} /> : null}
                    {result.detectedTargetTempF != null ? <DetectedPill label="Target temp" value={`${Math.round(result.detectedTargetTempF)}°F`} colors={colors} /> : null}
                    {result.detectedGrillBrand ? <DetectedPill label="Grill" value={result.detectedGrillBrand} colors={colors} /> : null}
                    {result.detectedWoodType ? <DetectedPill label="Wood" value={result.detectedWoodType} colors={colors} /> : null}
                    {result.detectedRub ? <DetectedPill label="Rub" value={result.detectedRub} colors={colors} /> : null}
                    {result.cookDurationMinutes != null ? <DetectedPill label="Duration" value={`${Math.floor(result.cookDurationMinutes / 60)}h ${result.cookDurationMinutes % 60}m`} colors={colors} /> : null}
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

              {/* Probe readings */}
              {result.probes.length > 0 && (
                <View style={[s.subSection, { borderTopColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Temperature Readings</Text>
                  {result.probes.map((p, i) => (
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

              {/* Events timeline */}
              {result.events.length > 0 && (
                <View style={[s.subSection, { borderTopColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Cook Timeline</Text>
                  {result.events.map((ev, i) => {
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

              {/* What went well */}
              {(assessment?.whatWentWell?.length ?? 0) > 0 && (
                <View style={[s.subSection, { borderTopColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>What Went Well</Text>
                  {assessment!.whatWentWell.map((item, i) => (
                    <View key={i} style={s.bulletRow}>
                      <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                      <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Suggestions */}
              {(assessment?.suggestions?.length ?? 0) > 0 && (
                <View style={[s.subSection, { borderTopColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Next Time, Try This</Text>
                  {assessment!.suggestions.map((tip, i) => (
                    <View key={i} style={s.bulletRow}>
                      <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                      <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}

              {result.noDataFound && result.probes.length === 0 && (
                <View style={s.infoRow}>
                  <Feather name="info" size={14} color={colors.mutedForeground} />
                  <Text style={[s.infoText, { color: colors.mutedForeground }]}>
                    No temperature data detected in images — assessment based on notes only.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Manual entry form ─────────────────────── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={s.sectionHeader}>
            <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.sectionIcon}>
              <Feather name="edit-3" size={15} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Cook Details</Text>
              <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>
                AI fills these in automatically — review and adjust before saving
              </Text>
            </View>
          </View>

          <View style={s.formBody}>
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>
                What did you cook? <Text style={{ color: colors.destructive }}>*</Text>
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="e.g. Brisket, Pork Butt, Baby Back Ribs"
                placeholderTextColor={colors.mutedForeground}
                value={foodType}
                onChangeText={setFoodType}
              />
            </View>

            <View style={s.row2}>
              <View style={[s.fieldWrap, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="14"
                  placeholderTextColor={colors.mutedForeground}
                  value={weightLbs}
                  onChangeText={setWeightLbs}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[s.fieldWrap, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Grill / Smoker</Text>
                <Pressable
                  onPress={() => setGrillPickerVisible(true)}
                  style={[s.input, s.grillPicker, { backgroundColor: colors.background, borderColor: selectedGrill ? "#6C3BF5" : colors.border, borderRadius: colors.radius }]}
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
            </View>

            <View style={s.row2}>
              <View style={[s.fieldWrap, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Cook Temp (°F)</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="225"
                  placeholderTextColor={colors.mutedForeground}
                  value={cookTempF}
                  onChangeText={setCookTempF}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[s.fieldWrap, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Target Temp (°F)</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
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
                  onPress={() => setLogDatePickerOpen(true)}
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
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {pastDates.map((d) => {
                const isSelected = actualStartDate &&
                  d.getDate() === actualStartDate.getDate() &&
                  d.getMonth() === actualStartDate.getMonth() &&
                  d.getFullYear() === actualStartDate.getFullYear();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => {
                      const next = actualStartDate ? new Date(actualStartDate) : new Date();
                      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      setActualStartDate(next);
                      setLogDatePickerOpen(false);
                    }}
                    style={[dp2.row, isSelected && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}
                  >
                    <Text style={[dp2.rowText, { color: isSelected ? colors.primary : colors.foreground }]}>
                      {formatPickDate(d)}
                    </Text>
                    <Text style={[dp2.rowSub, { color: colors.mutedForeground }]}>
                      {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
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

      {/* Grill picker modal */}
      <Modal
        visible={grillPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGrillPickerVisible(false)}
      >
        <Pressable style={gp.overlay} onPress={() => setGrillPickerVisible(false)} />
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

  graphWrap: { borderWidth: 1, padding: 12, overflow: "hidden" },
  subSection: { borderTopWidth: 1, paddingTop: 12, gap: 0 },
  subLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  probeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingVertical: 10 },
  probeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  probeRange: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  probeFinish: { fontSize: 22, fontFamily: "Inter_700Bold" },
  eventRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderTopWidth: 1, paddingVertical: 9 },
  eventIconWrap: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 1 },
  eventDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  eventTime: { fontSize: 12, fontFamily: "Inter_500Medium", paddingTop: 4 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingBottom: 5 },
  bulletNum: { fontSize: 13, fontFamily: "Inter_700Bold", minWidth: 16 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  detectedCard: { borderWidth: 1, padding: 12, gap: 8 },
  detectedHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  detectedTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detectedGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  formBody: { gap: 12 },
  fieldWrap: { gap: 6 },
  row2: { flexDirection: "row", gap: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular" },
  grillPicker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textArea: { borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, lineHeight: 20 },

  saveBtn: { overflow: "hidden" },
  saveBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 54 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  cancelLink: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  nowBtn: { borderWidth: 1, height: 44, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  nowBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pickerBtn: { flexDirection: "row", alignItems: "center", gap: 7 },
});

const gp = StyleSheet.create({
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
