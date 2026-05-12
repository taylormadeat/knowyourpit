import React, { useState, useMemo, useEffect } from "react";
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
  useListCustomMeatCuts,
  useCreateCustomMeatCut,
  useUpdateCustomMeatCut,
  useDeleteCustomMeatCut,
  getListCooksQueryKey,
  getListCustomMeatCutsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
} from "@workspace/api-client-react";
import { MEAT_CATEGORIES, MEAT_CUTS, MEAT_CUTS_BY_CATEGORY, type MeatCut } from "@/constants/meatCuts";
import {
  QP_COOK_METHODS,
  QP_MEAT_START_TEMPS,
  QP_INJECTION_OPTIONS,
  QP_SPRITZ_FREQUENCIES,
  QP_WRAP_FINISH_OPTIONS,
  type QpCookMethod,
  type QpMeatStartTemp,
  type QpInjectionOption,
  type QpSpritzFrequency,
  type QpWrapFinishOption,
} from "@/constants/cookQuickPicks";
import { SettingsRow } from "@/components/plan-screen/SettingsRow";
import { OptionBottomSheet } from "@/components/plan-screen/OptionBottomSheet";

import { usePaywall } from "@/contexts/PaywallContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";

type PickerCut = MeatCut & { isCustom?: boolean; customId?: number };
const COOK_METHODS = ["Low & Slow", "Indirect", "Reverse Sear", "Direct Heat"];

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
  const { showPaywall, parseAndShowFromError } = usePaywall();
  const { data: paywallUsage } = usePaywallUsage();

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

  // Quick-pick state for the scanner "describe the cook" section
  const [qpMethod, setQpMethod] = useState<QpCookMethod | null>(null);
  const [qpStartTemp, setQpStartTemp] = useState<QpMeatStartTemp | null>(null);
  const [qpInjection, setQpInjection] = useState<QpInjectionOption | null>(null);
  const [qpSpritz, setQpSpritz] = useState<QpSpritzFrequency | null>(null);
  const [qpWrap, setQpWrap] = useState<QpWrapFinishOption | null>(null);
  const [qpOverflow, setQpOverflow] = useState("");

  // Which technique bottom-sheet is open
  type LogSheet = "cookMethod" | "meatStartTemp" | "injection" | "spritz" | "wrapFinish";
  const [activeLogSheet, setActiveLogSheet] = useState<LogSheet | null>(null);

  // Serialise chip selections into a natural-language string sent to the AI
  const scanNotes = useMemo(() => {
    const parts: string[] = [];
    if (qpMethod) parts.push(`Method: ${qpMethod}`);
    if (qpStartTemp) parts.push(`Starting temp: ${qpStartTemp}`);
    if (qpInjection) parts.push(`Injection: ${qpInjection}`);
    if (qpSpritz) parts.push(`Spritz: ${qpSpritz}`);
    if (qpWrap) parts.push(`Wrap/Finish: ${qpWrap}`);
    if (qpOverflow.trim()) parts.push(qpOverflow.trim());
    return parts.join(" · ");
  }, [qpMethod, qpStartTemp, qpInjection, qpSpritz, qpWrap, qpOverflow]);
  const [actualStartDate, setActualStartDate] = useState<Date | null>(null);
  const [logDatePickerOpen, setLogDatePickerOpen] = useState(false);
  const [logTimePickerOpen, setLogTimePickerOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  const [saving, setSaving] = useState(false);
  // True while the auto-grade analyze call is running inside the Save handler.
  // Used to surface a "Grading & saving…" label on the Save button so the
  // user knows what is happening during the (potentially slow) AI call.
  const [autoGrading, setAutoGrading] = useState(false);
  const [meatPickerVisible, setMeatPickerVisible] = useState(false);
  const [meatCatTab, setMeatCatTab] = useState<string>(MEAT_CATEGORIES[0]);
  const [aiScanned, setAiScanned] = useState(false);

  // Custom meat cut editor state
  const [customCutEditorVisible, setCustomCutEditorVisible] = useState(false);
  const [editingCustomCutId, setEditingCustomCutId] = useState<number | null>(null);
  const [ccName, setCcName] = useState("");
  const [ccCategory, setCcCategory] = useState<string>(MEAT_CATEGORIES[0]);
  const [ccTargetTempF, setCcTargetTempF] = useState("");
  const [ccCookTempF, setCcCookTempF] = useState("");
  const [ccMinsPerLb, setCcMinsPerLb] = useState("");
  const [ccRestMins, setCcRestMins] = useState("");
  const [ccCookMethod, setCcCookMethod] = useState("");
  const [ccCookMethodSheetOpen, setCcCookMethodSheetOpen] = useState(false);

  const { data: customCutsData } = useListCustomMeatCuts();
  const customCuts: any[] = Array.isArray(customCutsData) ? customCutsData : [];
  const createCustomCut = useCreateCustomMeatCut();
  const updateCustomCut = useUpdateCustomMeatCut();
  const deleteCustomCut = useDeleteCustomMeatCut();

  const allMeatCuts: PickerCut[] = useMemo(() => {
    const builtin: PickerCut[] = MEAT_CUTS.map((c) => ({ ...c }));
    const customs: PickerCut[] = customCuts.map((c) => ({
      name: c.name,
      category: c.category,
      targetTempF: c.targetTempF,
      cookTempF: c.cookTempF,
      minsPerLb: c.minsPerLb,
      restMins: c.restMins,
      cookMethod: c.cookMethod ?? undefined,
      notes: c.notes ?? undefined,
      isCustom: true,
      customId: c.id,
    }));
    return [...customs, ...builtin];
  }, [customCuts]);

  const meatCutsForCategory = useMemo(() => {
    return allMeatCuts.filter((c) => c.category === meatCatTab);
  }, [allMeatCuts, meatCatTab]);

  function resetCustomCutForm() {
    setEditingCustomCutId(null);
    setCcName("");
    setCcCategory(meatCatTab);
    setCcTargetTempF("");
    setCcCookTempF("");
    setCcMinsPerLb("");
    setCcRestMins("");
    setCcCookMethod("");
  }

  function openCustomCutEditor(cut: PickerCut | null) {
    if (cut && cut.isCustom && cut.customId) {
      setEditingCustomCutId(cut.customId);
      setCcName(cut.name);
      setCcCategory(cut.category);
      setCcTargetTempF(String(cut.targetTempF));
      setCcCookTempF(String(cut.cookTempF));
      setCcMinsPerLb(String(cut.minsPerLb));
      setCcRestMins(String(cut.restMins));
      setCcCookMethod(cut.cookMethod ?? "");
    } else {
      resetCustomCutForm();
    }
    setCustomCutEditorVisible(true);
  }

  async function saveCustomCut() {
    const name = ccName.trim();
    const targetT = parseFloat(ccTargetTempF);
    const cookT = parseFloat(ccCookTempF);
    const mpl = parseFloat(ccMinsPerLb);
    const rm = parseInt(ccRestMins, 10);
    if (!name) {
      Alert.alert("Name required", "Give your cut a name.");
      return;
    }
    if (isNaN(targetT) || isNaN(cookT) || isNaN(mpl) || isNaN(rm)) {
      Alert.alert("Numbers required", "Target temp, cook temp, mins/lb, and rest mins must be numbers.");
      return;
    }
    const body = {
      name,
      category: ccCategory,
      targetTempF: targetT,
      cookTempF: cookT,
      minsPerLb: mpl,
      restMins: rm,
      cookMethod: ccCookMethod.trim() || null,
    };
    try {
      if (editingCustomCutId != null) {
        await updateCustomCut.mutateAsync({ id: editingCustomCutId, data: body });
      } else {
        await createCustomCut.mutateAsync({ data: body });
      }
      qc.invalidateQueries({ queryKey: getListCustomMeatCutsQueryKey() });
      setCustomCutEditorVisible(false);
      resetCustomCutForm();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Save failed", "Could not save the custom cut. Please try again.");
    }
  }

  function handleDeleteCustomCut(cut: PickerCut) {
    if (!cut.customId) return;
    Alert.alert(
      "Delete custom cut?",
      `Remove "${cut.name}" from your custom cuts.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCustomCut.mutateAsync({ id: cut.customId! });
              qc.invalidateQueries({ queryKey: getListCustomMeatCutsQueryKey() });
            } catch {
              Alert.alert("Delete failed", "Could not delete the custom cut.");
            }
          },
        },
      ],
    );
  }



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
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
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

  // Free-tier mount check: if the user has hit the total cook cap, show the paywall immediately.
  useEffect(() => {
    if (paywallUsage && !paywallUsage.unlimited && paywallUsage.remaining.cooks <= 0) {
      showPaywall({ trigger: "cook_limit_reached", foodType: foodType?.trim() || null });
    }
  }, [paywallUsage]);

  const analyze = async () => {
    if (images.length === 0 && !scanNotes.trim()) {
      Alert.alert("Add something", "Pick at least one thermometer photo, or describe the cook in the notes.");
      return;
    }
    // No client-side lifetime gradedCooks gate. Manual analyze is bounded only
    // by the server-enforced daily AI scan cap (3/day for free users); on 402
    // responses, parseAndShowFromError surfaces the ai_analyze_limit_reached
    // paywall modal in the catch block below.
    setAnalyzing(true);
    setResult(null);
    try {
      const contextPayload: any = {};
      if (foodType.trim()) contextPayload.foodType = foodType.trim();
      if (targetTempF.trim()) contextPayload.targetTempF = parseFloat(targetTempF);
      if (cookTempF.trim()) contextPayload.cookTempF = parseFloat(cookTempF);
      if (weightLbs.trim()) contextPayload.weightLbs = parseFloat(weightLbs);

      const combinedNotes = [scanNotes.trim(), cookNotes.trim()].filter(Boolean).join("\n") || null;
      const data: any = await analyzeMutation.mutateAsync({
        data: {
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          cookNotes: combinedNotes,
          cookContext: Object.keys(contextPayload).length > 0 ? contextPayload : undefined,
        } as any,
      });

      setResult(data);
      setAiScanned(true);

      // Auto-populate form fields from detected data (only if field is still empty)
      if (data.detectedFoodType && !foodType.trim()) {
        // Try to fuzzy-match against known meat cuts (built-in + custom) for a canonical name.
        // Uses a scored ranking instead of first-match to avoid false positives from shared
        // cooking-method words (e.g. "Smoked" in "Smoked Sausage Links" matching "Center Cut
        // Smoked Salmon"). Scoring: count significant words (≥4 chars) from the cut name that
        // appear in the detected string, divided by total significant words (ratio 0–1). On ties,
        // prefer the longer (more specific) cut name. Exact containment is checked first as a
        // top-priority shortcut.
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const needle = norm(data.detectedFoodType);

        // matchSub: within score-2 ties, ranks by match direction so that cuts
        // which are *strictly more specific* than the detected string (e.g.
        // "Salmon Fillet" for detected "Salmon") beat exact equivalents (e.g. a
        // custom cut named exactly "Salmon"), which in turn beat cuts that are
        // *less specific* than detected. Lower sub = better.
        const matchSub = (hay: string): 0 | 1 | 2 => {
          const hayHasNeedle = hay.includes(needle);
          const needleHasHay = needle.includes(hay);
          if (hayHasNeedle && !needleHasHay) return 0; // cut is strictly more specific
          if (hayHasNeedle && needleHasHay) return 1;  // exact equivalence
          return 2;                                     // cut is less specific
        };

        const scoreCut = (cutName: string): number => {
          const hay = norm(cutName);
          // Tier 1: exact containment in either direction — perfect match
          if (hay.includes(needle) || needle.includes(hay)) return 2;
          // Tier 2: split the ORIGINAL cut name into individual words first (before
          // normalizing), then score by ratio of significant words (≥4 chars) that
          // appear as substrings of the needle. Using the original split avoids the
          // one-big-blob problem that occurs when normalizing the whole name at once
          // (e.g. "Salmon Fillet" → "salmonfillet" would never substring-match).
          const words = cutName
            .split(/[\s\-\/\(\),]+/)
            .map((w) => norm(w))
            .filter((w) => w.length >= 4);
          if (words.length === 0) return 0;
          const matched = words.filter((w) => needle.includes(w)).length;
          return matched / words.length;
        };

        const scored = allMeatCuts
          .map((c, idx) => ({ cut: c, score: scoreCut(c.name), hay: norm(c.name), idx }))
          .filter((x) => x.score > 0)
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.score === 2) {
              // Within exact-containment ties, rank by match direction first:
              // sub=0 (cut strictly more specific) beats sub=1 (exact) beats sub=2.
              // Within the same sub-tier, preserve list order so the first entry in
              // MEAT_CUTS wins (e.g. "Salmon Fillet" before "Cold-Smoked Salmon (Lox)").
              const subDiff = matchSub(a.hay) - matchSub(b.hay);
              if (subDiff !== 0) return subDiff;
              return a.idx - b.idx;
            }
            // For ratio ties: prefer the more specific (longer) cut name.
            return b.hay.length - a.hay.length;
          });
        const cutMatch = scored[0]?.cut ?? null;
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
    } catch (err) {
      // If the server returned a 402 paywall response (e.g. free user hit the
      // daily AI analyze cap), show the paywall modal instead of a generic
      // alert. Falls through to the alert for any other error.
      const handled = parseAndShowFromError(err);
      if (!handled) {
        const serverMsg = (err as any)?.response?.data?.error ?? (err as any)?.data?.error ?? null;
        Alert.alert(
          "Scan failed",
          typeof serverMsg === "string" ? serverMsg : "Could not analyze the images. Check your connection and try again.",
        );
      }
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
      // Auto-grade pass: if the user did not run "Analyze with PitMaster"
      // manually but supplied at least one image, cook notes, or a final
      // temperature, run the analyze mutation in-line so the saved cook ends
      // up graded automatically. Failures (network, paywall, missing data)
      // never block the save: paywall responses still surface the existing
      // paywall modal via parseAndShowFromError; everything else is silently
      // swallowed and the cook is saved ungraded.
      let autoResult: any = null;
      const hasGradeableData =
        images.length > 0 ||
        scanNotes.trim().length > 0 ||
        cookNotes.trim().length > 0 ||
        targetTempF.trim().length > 0 ||
        cookTempF.trim().length > 0;
      if (!result && hasGradeableData) {
        // No client-side lifetime gradedCooks gate. Run the analyze pass
        // unconditionally; the server enforces the daily 3/day AI scan cap
        // and returns 402 if exceeded, which parseAndShowFromError surfaces
        // as the ai_analyze_limit_reached paywall. Other errors (network,
        // missing data) are swallowed so the save proceeds ungraded.
        setAutoGrading(true);
        try {
          const contextPayload: any = {};
          if (foodType.trim()) contextPayload.foodType = foodType.trim();
          if (targetTempF.trim()) contextPayload.targetTempF = parseFloat(targetTempF);
          if (cookTempF.trim()) contextPayload.cookTempF = parseFloat(cookTempF);
          if (weightLbs.trim()) contextPayload.weightLbs = parseFloat(weightLbs);
          const aiNotes = [scanNotes.trim(), cookNotes.trim()].filter(Boolean).join("\n") || null;
          autoResult = await analyzeMutation.mutateAsync({
            data: {
              images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
              cookNotes: aiNotes,
              cookContext: Object.keys(contextPayload).length > 0 ? contextPayload : undefined,
            } as any,
          });
        } catch (err) {
          // 402 → existing paywall modal. Anything else (network, AI error,
          // missing data) is swallowed silently so the save proceeds.
          parseAndShowFromError(err);
          autoResult = null;
        } finally {
          setAutoGrading(false);
        }
      }

      const effectiveResult = result ?? autoResult;

      const payload: any = {
        foodType: foodType.trim(),
        status: "completed",
        notes: (() => {
          const cn = cookNotes.trim();
          const sn = scanNotes.trim();
          if (cn && sn) return `${cn}\n\nTechnique: ${sn}`;
          if (cn) return cn;
          if (sn) return `Technique: ${sn}`;
          return null;
        })(),
      };
      if (selectedGrillId != null) payload.grillId = selectedGrillId;
      if (targetTempF.trim() && !isNaN(parseFloat(targetTempF))) payload.targetTempF = parseFloat(targetTempF);
      if (cookTempF.trim() && !isNaN(parseFloat(cookTempF))) payload.cookTempF = parseFloat(cookTempF);
      if (weightLbs.trim() && !isNaN(parseFloat(weightLbs))) payload.weightLbs = parseFloat(weightLbs);
      // Prefer user-entered start time; fall back to AI-detected date
      if (actualStartDate) {
        payload.actualStartAt = actualStartDate.toISOString();
      } else if (effectiveResult?.detectedCookDate) {
        const d = new Date(effectiveResult.detectedCookDate);
        if (!isNaN(d.getTime())) payload.actualStartAt = d.toISOString();
      }
      if (effectiveResult) {
        payload.analysisResult = {
          probes: effectiveResult.probes,
          events: effectiveResult.events,
          cookDurationMinutes: effectiveResult.cookDurationMinutes,
          detectedFoodType: effectiveResult.detectedFoodType,
          detectedWeightLbs: effectiveResult.detectedWeightLbs,
          detectedCookTempF: effectiveResult.detectedCookTempF,
          detectedTargetTempF: effectiveResult.detectedTargetTempF,
          detectedGrillBrand: effectiveResult.detectedGrillBrand,
          detectedWoodType: effectiveResult.detectedWoodType,
          detectedRub: effectiveResult.detectedRub,
          assessment: effectiveResult.assessment,
          analyzedAt: new Date().toISOString(),
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

          <View style={{ gap: 10 }}>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>
              Describe the cook <Text style={{ fontWeight: "400" }}>(helps PitMaster analyse time and technique)</Text>
            </Text>

            {/* Compact technique settings rows — matches EditCookModal layout */}
            <View
              style={{
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                paddingHorizontal: 12,
                overflow: "hidden",
              }}
            >
              <SettingsRow
                label="Cooking Method"
                icon="thermometer"
                iconColor="#E84820"
                value={qpMethod}
                placeholder="Any"
                onPress={() => setActiveLogSheet("cookMethod")}
                colors={colors}
              />
              <SettingsRow
                label="Meat Starting Temp"
                icon="sun"
                value={qpStartTemp}
                placeholder="Any"
                onPress={() => setActiveLogSheet("meatStartTemp")}
                colors={colors}
              />
              <SettingsRow
                label="Injection"
                icon="droplet"
                iconColor="#6C3BF5"
                value={qpInjection}
                placeholder="Any"
                onPress={() => setActiveLogSheet("injection")}
                colors={colors}
              />
              <SettingsRow
                label="Spritz Frequency"
                icon="wind"
                iconColor="#0EA5E9"
                value={qpSpritz}
                placeholder="Any"
                onPress={() => setActiveLogSheet("spritz")}
                colors={colors}
              />
              <SettingsRow
                label="Wrap / Finish"
                icon="package"
                iconColor="#F59E0B"
                value={qpWrap}
                placeholder="Any"
                onPress={() => setActiveLogSheet("wrapFinish")}
                colors={colors}
                isLast
              />
            </View>

            <OptionBottomSheet
              visible={activeLogSheet === "cookMethod"}
              title="Cooking Method"
              options={QP_COOK_METHODS}
              selected={qpMethod}
              onChange={(v) => setQpMethod(v as QpCookMethod | null)}
              onClose={() => setActiveLogSheet(null)}
              colors={colors}
            />
            <OptionBottomSheet
              visible={activeLogSheet === "meatStartTemp"}
              title="Meat Starting Temp"
              options={QP_MEAT_START_TEMPS}
              selected={qpStartTemp}
              onChange={(v) => setQpStartTemp(v as QpMeatStartTemp | null)}
              onClose={() => setActiveLogSheet(null)}
              colors={colors}
            />
            <OptionBottomSheet
              visible={activeLogSheet === "injection"}
              title="Injection"
              options={QP_INJECTION_OPTIONS}
              selected={qpInjection}
              onChange={(v) => setQpInjection(v as QpInjectionOption | null)}
              onClose={() => setActiveLogSheet(null)}
              colors={colors}
            />
            <OptionBottomSheet
              visible={activeLogSheet === "spritz"}
              title="Spritz Frequency"
              options={QP_SPRITZ_FREQUENCIES}
              selected={qpSpritz}
              onChange={(v) => setQpSpritz(v as QpSpritzFrequency | null)}
              onClose={() => setActiveLogSheet(null)}
              colors={colors}
            />
            <OptionBottomSheet
              visible={activeLogSheet === "wrapFinish"}
              title="Wrap / Finish"
              options={QP_WRAP_FINISH_OPTIONS}
              selected={qpWrap}
              onChange={(v) => setQpWrap(v as QpWrapFinishOption | null)}
              onClose={() => setActiveLogSheet(null)}
              colors={colors}
            />

            <View>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Anything else?</Text>
              <TextInput
                style={[s.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, minHeight: 56 }]}
                placeholder="e.g. 12lb brisket, wrapped at hour 6, 3-hour stall…"
                placeholderTextColor={colors.mutedForeground}
                value={qpOverflow}
                onChangeText={setQpOverflow}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Free-tier remaining-analyzes counter. Hidden for Pro. */}
          {paywallUsage && !paywallUsage.unlimited && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                color:
                  paywallUsage.remaining.aiAnalyzesToday <= 1
                    ? colors.primary
                    : colors.mutedForeground,
                textAlign: "center",
                marginTop: 6,
                marginBottom: -2,
              }}
            >
              {paywallUsage.remaining.aiAnalyzesToday} of {paywallUsage.limits.aiAnalyzePerDay} free
              analyses left today
            </Text>
          )}
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
                    {result.detectedCookTempF != null ? <SummaryCell label="Pit Temp" value={`${Math.round(result.detectedCookTempF)}°F`} colors={colors} /> : null}
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
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Pit Temp (°F)</Text>
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
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Internal Target (°F)</Text>
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

            {/* ── Technique quick-picks ── */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Technique</Text>
              <View
                style={{
                  borderRadius: colors.radius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  paddingHorizontal: 12,
                  overflow: "hidden",
                }}
              >
                <SettingsRow
                  label="Cooking Method"
                  icon="thermometer"
                  iconColor="#E84820"
                  value={qpMethod}
                  placeholder="Any"
                  onPress={() => setActiveLogSheet("cookMethod")}
                  colors={colors}
                />
                <SettingsRow
                  label="Meat Starting Temp"
                  icon="sun"
                  value={qpStartTemp}
                  placeholder="Any"
                  onPress={() => setActiveLogSheet("meatStartTemp")}
                  colors={colors}
                />
                <SettingsRow
                  label="Injection"
                  icon="droplet"
                  iconColor="#6C3BF5"
                  value={qpInjection}
                  placeholder="Any"
                  onPress={() => setActiveLogSheet("injection")}
                  colors={colors}
                />
                <SettingsRow
                  label="Spritz Frequency"
                  icon="wind"
                  iconColor="#0EA5E9"
                  value={qpSpritz}
                  placeholder="Any"
                  onPress={() => setActiveLogSheet("spritz")}
                  colors={colors}
                />
                <SettingsRow
                  label="Wrap / Finish"
                  icon="package"
                  iconColor="#F59E0B"
                  value={qpWrap}
                  placeholder="Any"
                  onPress={() => setActiveLogSheet("wrapFinish")}
                  colors={colors}
                  isLast
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator color="#fff" />
                <Text style={s.saveBtnText}>{autoGrading ? "Grading & saving…" : "Saving…"}</Text>
              </View>
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
            data={meatCutsForCategory}
            keyExtractor={(item: PickerCut) => (item.isCustom ? `custom-${item.customId}` : `builtin-${item.name}`)}
            style={{ maxHeight: 340 }}
            ItemSeparatorComponent={() => <View style={[gp.sep, { backgroundColor: colors.border }]} />}
            ListEmptyComponent={
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={[gp.emptyText, { color: colors.mutedForeground }]}>
                  No cuts in this category yet. Add your own below.
                </Text>
              </View>
            }
            renderItem={({ item }: { item: PickerCut }) => {
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={[gp.rowName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                      {item.isCustom && (
                        <View style={mp.customBadge}>
                          <Text style={mp.customBadgeText}>Custom</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[gp.rowSub, { color: colors.mutedForeground }]}>
                      {item.cookMethod ? `${item.cookMethod} · ` : ""}Target {item.targetTempF}°F
                    </Text>
                  </View>
                  {item.isCustom && (
                    <View style={{ flexDirection: "row", gap: 4, marginRight: 6 }}>
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation();
                          openCustomCutEditor(item);
                        }}
                        style={mp.iconBtn}
                      >
                        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomCut(item);
                        }}
                        style={mp.iconBtn}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {isSelected && <Feather name="check" size={16} color="#E84820" />}
                </TouchableOpacity>
              );
            }}
            ListFooterComponent={
              <TouchableOpacity
                onPress={() => openCustomCutEditor(null)}
                style={gp.footerBtn}
              >
                <Feather name="plus-circle" size={15} color="#E84820" />
                <Text style={[gp.footerBtnText, { color: "#E84820" }]}>Add custom cut</Text>
              </TouchableOpacity>
            }
          />

          {foodType && (
            <TouchableOpacity onPress={() => { setFoodType(""); setMeatPickerVisible(false); }} style={gp.clearBtn}>
              <Text style={[gp.clearBtnText, { color: colors.mutedForeground }]}>Clear selection</Text>
            </TouchableOpacity>
          )}
          </View>
        </View>
      </Modal>

      {/* Custom meat cut editor */}
      <Modal
        visible={customCutEditorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomCutEditorVisible(false)}
      >
        <View style={gp.modalWrap}>
          <Pressable style={gp.backdrop} onPress={() => setCustomCutEditorVisible(false)} />
          <View style={[gp.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16, maxHeight: "90%" }]}>
            <View style={[gp.handle, { backgroundColor: colors.border }]} />
            <Text style={[gp.title, { color: colors.foreground }]}>
              {editingCustomCutId != null ? "Edit Custom Cut" : "New Custom Cut"}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12, paddingHorizontal: 4 }}>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Name</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                    placeholder="e.g. Wagyu Tri-Tip"
                    placeholderTextColor={colors.mutedForeground}
                    value={ccName}
                    onChangeText={setCcName}
                  />
                </View>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {MEAT_CATEGORIES.map((c) => {
                      const active = ccCategory === c;
                      return (
                        <Pressable
                          key={c}
                          onPress={() => setCcCategory(c)}
                          style={[
                            mp.catTab,
                            { borderColor: active ? "#E84820" : colors.border, backgroundColor: active ? "#E84820" : "transparent" },
                          ]}
                        >
                          <Text style={[mp.catTabText, { color: active ? "#fff" : colors.foreground }]}>{c}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Target temp °F</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                      placeholder="203"
                      placeholderTextColor={colors.mutedForeground}
                      value={ccTargetTempF}
                      onChangeText={setCcTargetTempF}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Cook temp °F</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                      placeholder="225"
                      placeholderTextColor={colors.mutedForeground}
                      value={ccCookTempF}
                      onChangeText={setCcCookTempF}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Mins / lb</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                      placeholder="60"
                      placeholderTextColor={colors.mutedForeground}
                      value={ccMinsPerLb}
                      onChangeText={setCcMinsPerLb}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Rest mins</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                      placeholder="30"
                      placeholderTextColor={colors.mutedForeground}
                      value={ccRestMins}
                      onChangeText={setCcRestMins}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View>
                  <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Cook method</Text>
                  <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.background, overflow: "hidden", paddingHorizontal: 12 }}>
                    <SettingsRow
                      label="Cook Method"
                      icon="thermometer"
                      iconColor="#E84820"
                      value={ccCookMethod || null}
                      placeholder="Not set"
                      onPress={() => setCcCookMethodSheetOpen(true)}
                      onClear={() => setCcCookMethod("")}
                      colors={colors}
                      isLast
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14, paddingHorizontal: 4 }}>
              <TouchableOpacity
                style={[s.nowBtn, { borderColor: colors.border, borderRadius: colors.radius, flex: 1 }]}
                onPress={() => setCustomCutEditorVisible(false)}
              >
                <Text style={[s.nowBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.nowBtn, { borderColor: "#E84820", backgroundColor: "#E84820", borderRadius: colors.radius, flex: 1 }]}
                onPress={saveCustomCut}
                disabled={createCustomCut.isPending || updateCustomCut.isPending}
              >
                <Text style={[s.nowBtnText, { color: "#fff" }]}>
                  {createCustomCut.isPending || updateCustomCut.isPending ? "Saving…" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <OptionBottomSheet
        visible={ccCookMethodSheetOpen}
        title="Cook Method"
        options={COOK_METHODS}
        selected={ccCookMethod || null}
        onChange={(v) => setCcCookMethod(v ?? "")}
        onClose={() => setCcCookMethodSheetOpen(false)}
        colors={colors}
        allowDeselect
      />

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

});

const gp = StyleSheet.create({
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
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
  customBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: "#E8482022" },
  customBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#E84820", letterSpacing: 0.3 },
  iconBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
});

const dp2 = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, maxHeight: "70%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 14, gap: 10 },
  rowText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

