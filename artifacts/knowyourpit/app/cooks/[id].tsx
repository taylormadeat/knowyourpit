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
  useScanTemperatureImage,
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

type ScanReading = {
  probeName: string;
  finishingTempF: number;
  minTempF: number | null;
  maxTempF: number | null;
};

type ScanResult = {
  readings: ScanReading[];
  cookDurationMinutes: number | null;
  noDataFound: boolean;
  rawExtraction: string | null;
  detectedFoodType: string | null;
  detectedCookDate: string | null;
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
  const scanMutation = useScanTemperatureImage();

  const [scanImages, setScanImages] = useState<Array<{ uri: string; base64: string; mimeType: string }>>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/cooks" as any);
    }
  };

  const goHome = () => router.replace("/(tabs)" as any);

  const handleDelete = () => {
    Alert.alert("Delete Cook", "Remove this cook session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
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
        .map((a) => ({
          uri: a.uri,
          base64: a.base64!,
          mimeType: (a.mimeType as string) || "image/jpeg",
        }))
        .slice(0, 5);
      setScanImages((prev) => [...prev, ...picked].slice(0, 5));
      setScanResults([]);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera access to take photos");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0].base64) {
      setScanImages((prev) =>
        [...prev, {
          uri: res.assets[0].uri,
          base64: res.assets[0].base64!,
          mimeType: (res.assets[0].mimeType as string) || "image/jpeg",
        }].slice(0, 5)
      );
      setScanResults([]);
    }
  };

  const removeImage = (idx: number) => {
    setScanImages((prev) => prev.filter((_, i) => i !== idx));
    setScanResults([]);
  };

  const analyzeImages = async () => {
    if (scanImages.length === 0) return;
    setScanning(true);
    setScanResults([]);
    try {
      const results: ScanResult[] = [];
      for (const img of scanImages) {
        const data = await scanMutation.mutateAsync({
          data: { base64Image: img.base64, mimeType: img.mimeType } as any,
        });
        results.push(data as any);
      }
      setScanResults(results);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Scan failed", "Could not analyze the image. Check your connection and try again.");
    } finally {
      setScanning(false);
    }
  };

  const allReadings = scanResults.flatMap((r) => r.readings ?? []);
  const detectedFood = scanResults.find((r) => r.detectedFoodType)?.detectedFoodType;
  const detectedDuration = scanResults.find((r) => r.cookDurationMinutes != null)?.cookDurationMinutes;
  const rawDescriptions = scanResults.map((r) => r.rawExtraction).filter(Boolean);

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

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <LinearGradient
        colors={["#1C1C1F", "#2D1A0E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: topPad + 14 }]}
      >
        <LogoBackground opacity={0.06} />
        <Pressable onPress={goBack} style={s.backBtn}>
          <Feather name="chevron-left" size={24} color="#F3EDE1" />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {c.foodType || "Cook"}
        </Text>
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
      >
        {/* Status badge */}
        <View style={[s.statusBar, { backgroundColor: statusColor + "18", borderRadius: colors.radius }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>{c.status?.toUpperCase()}</Text>
        </View>

        {/* Detail card */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {[
            { label: "Food", value: c.foodType },
            { label: "Grill", value: c.grillName },
            { label: "Weight", value: c.weightLbs ? `${c.weightLbs} lbs` : null },
            { label: "Target Temp", value: c.targetTempF ? `${c.targetTempF}°F` : null },
            { label: "Cook Temp", value: c.cookTempF ? `${c.cookTempF}°F` : null },
            { label: "Planned Start", value: c.plannedStartAt ? new Date(c.plannedStartAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
            { label: "Serve By", value: c.plannedEndAt ? new Date(c.plannedEndAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
          ]
            .filter((r) => r.value)
            .map((row, i, arr) => (
              <View
                key={row.label}
                style={[s.row, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
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

        {/* ── Temperature Scan section ───────────────────────────── */}
        <View style={[s.scanSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={s.scanHeader}>
            <View style={[s.scanIconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="thermometer" size={16} color={colors.primary} />
            </View>
            <Text style={[s.scanTitle, { color: colors.foreground }]}>Log Temperature Data</Text>
          </View>

          <Text style={[s.scanSub, { color: colors.mutedForeground }]}>
            Upload photos of your thermometer, grill controller, or cook app screenshot — AI reads the temps for you.
          </Text>

          {/* Photo buttons */}
          <View style={s.scanBtns}>
            <Pressable
              style={[s.scanBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={pickImages}
            >
              <Feather name="image" size={15} color="#fff" />
              <Text style={s.scanBtnText}>Gallery</Text>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable
                style={[s.scanBtn, { backgroundColor: colors.secondary || "#555", borderRadius: colors.radius }]}
                onPress={takePhoto}
              >
                <Feather name="camera" size={15} color="#fff" />
                <Text style={s.scanBtnText}>Camera</Text>
              </Pressable>
            )}
          </View>

          {/* Thumbnail strip */}
          {scanImages.length > 0 && (
            <View style={s.thumbRow}>
              {scanImages.map((img, i) => (
                <View key={i} style={s.thumb}>
                  <Image source={{ uri: img.uri }} style={s.thumbImg} />
                  <Pressable
                    style={[s.thumbDel, { backgroundColor: colors.destructive }]}
                    onPress={() => removeImage(i)}
                  >
                    <Feather name="x" size={11} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Analyze button */}
          {scanImages.length > 0 && (
            <Pressable
              style={({ pressed }) => [
                s.analyzeBtn,
                { backgroundColor: colors.primary, borderRadius: colors.radius },
                (scanning || pressed) && { opacity: 0.7 },
              ]}
              onPress={analyzeImages}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.analyzeBtnText}>Analyzing…</Text>
                </>
              ) : (
                <>
                  <Feather name="zap" size={16} color="#fff" />
                  <Text style={s.analyzeBtnText}>
                    Analyze {scanImages.length} image{scanImages.length > 1 ? "s" : ""} with AI
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {/* Results */}
          {scanResults.length > 0 && (
            <View style={[s.scanResults, { borderTopColor: colors.border }]}>
              {allReadings.length > 0 ? (
                <>
                  <Text style={[s.resultsLabel, { color: colors.mutedForeground }]}>Readings detected</Text>
                  {allReadings.map((r, i) => (
                    <View key={i} style={[s.readingRow, { borderTopColor: colors.border }]}>
                      <View>
                        <Text style={[s.probeName, { color: colors.foreground }]}>{r.probeName}</Text>
                        {(r.minTempF != null || r.maxTempF != null) && (
                          <Text style={[s.probeRange, { color: colors.mutedForeground }]}>
                            {r.minTempF != null ? `${r.minTempF}°F` : "?"}
                            {" → "}
                            {r.maxTempF != null ? `${r.maxTempF}°F` : "?"}
                          </Text>
                        )}
                      </View>
                      <Text style={[s.probeFinish, { color: colors.primary }]}>{r.finishingTempF}°F</Text>
                    </View>
                  ))}

                  {detectedFood && (
                    <View style={[s.metaRow, { borderTopColor: colors.border }]}>
                      <Feather name="tag" size={13} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>Detected: {detectedFood}</Text>
                    </View>
                  )}
                  {detectedDuration != null && (
                    <View style={[s.metaRow, { borderTopColor: colors.border }]}>
                      <Feather name="clock" size={13} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                        Cook time: {Math.floor(detectedDuration / 60)}h {detectedDuration % 60}m
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={s.noDataRow}>
                  <Feather name="alert-circle" size={16} color={colors.mutedForeground} />
                  <Text style={[s.noDataText, { color: colors.mutedForeground }]}>
                    No temperature data found in{" "}
                    {scanResults.length === 1 ? "this image" : "these images"}.
                    {rawDescriptions[0] ? `\n${rawDescriptions[0]}` : ""}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {nextStatus && (
          <Pressable
            style={({ pressed }) => [
              s.actionBtn,
              { backgroundColor: statusColor, borderRadius: colors.radius },
              (updateCook.isPending || pressed) && { opacity: 0.7 },
            ]}
            onPress={() => handleStatusUpdate(nextStatus)}
            disabled={updateCook.isPending}
          >
            {updateCook.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather
                  name={nextStatus === "active" ? "play" : "check-circle"}
                  size={18}
                  color="#fff"
                />
                <Text style={s.actionText}>
                  {nextStatus === "active" ? "Start Cook" : "Mark Complete"}
                </Text>
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

  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 18, paddingBottom: 16, overflow: "hidden",
  },
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

  scanSection: { borderWidth: 1, padding: 16, gap: 12 },
  scanHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  scanIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  scanTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  scanSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  scanBtns: { flexDirection: "row", gap: 10 },
  scanBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  scanBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { position: "relative" },
  thumbImg: { width: 72, height: 72, borderRadius: 8 },
  thumbDel: {
    position: "absolute", top: 3, right: 3,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  analyzeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 46,
  },
  analyzeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  scanResults: { borderTopWidth: 1, paddingTop: 14, gap: 0 },
  resultsLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 },
  readingRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, paddingVertical: 10,
  },
  probeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  probeRange: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  probeFinish: { fontSize: 22, fontFamily: "Inter_700Bold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, paddingTop: 10 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  noDataRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noDataText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52 },
  actionText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  homeLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  homeLinkText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
