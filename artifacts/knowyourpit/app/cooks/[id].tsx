import React, { useState } from "react";
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
import {
  useGetCook,
  useDeleteCook,
  useUpdateCook,
  useAnalyzeCook,
  getListCooksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
} from "@workspace/api-client-react";

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

  const { data: cook, isLoading } = useGetCook({ id: Number(id) });
  const deleteCook = useDeleteCook();
  const updateCook = useUpdateCook();
  const analyzeMutation = useAnalyzeCook();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [cookNotes, setCookNotes] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
    await updateCook.mutateAsync({ id: Number(id), data: { status } });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
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
      const data = await analyzeMutation.mutateAsync({
        data: {
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          cookNotes: cookNotes.trim() || null,
          cookContext: {
            foodType: c?.foodType,
            targetTempF: c?.targetTempF,
            cookTempF: c?.cookTempF,
            weightLbs: c?.weightLbs,
          },
        } as any,
      });
      setResult(data as any);
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
            { label: "Grill", value: c.grillName },
            { label: "Weight", value: c.weightLbs ? `${c.weightLbs} lbs` : null },
            { label: "Target Temp", value: c.targetTempF ? `${c.targetTempF}°F` : null },
            { label: "Cook Temp", value: c.cookTempF ? `${c.cookTempF}°F` : null },
            { label: "Planned Start", value: c.plannedStartAt ? new Date(c.plannedStartAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
            { label: "Serve By", value: c.plannedEndAt ? new Date(c.plannedEndAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
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

        {/* ── Log This Cook section ───────────────────────────── */}
        <View style={[s.logSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
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

        <Pressable onPress={goHome} style={s.homeLink}>
          <Feather name="home" size={14} color={colors.mutedForeground} />
          <Text style={[s.homeLinkText, { color: colors.mutedForeground }]}>Back to Home</Text>
        </Pressable>
      </ScrollView>
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
});
