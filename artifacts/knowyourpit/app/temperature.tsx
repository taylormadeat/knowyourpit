import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useScanTemperatureImage } from "@workspace/api-client-react";

export default function TemperatureScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const scanMutation = useScanTemperatureImage();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!res.canceled) {
      setImages((prev) => [...prev, ...res.assets.map((a) => a.uri)].slice(0, 5));
      setResult(null);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera access to take photos");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled) {
      setImages((prev) => [...prev, res.assets[0].uri].slice(0, 5));
      setResult(null);
    }
  };

  const analyze = async () => {
    if (images.length === 0) return;
    try {
      const formData = new FormData();
      images.forEach((uri, i) => {
        formData.append(`image_${i}`, {
          uri,
          type: "image/jpeg",
          name: `temp_${i}.jpg`,
        } as any);
      });
      const data = await scanMutation.mutateAsync({ data: formData as any });
      setResult(data);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", "Failed to analyze image. Check connection.");
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.title, { color: colors.foreground }]}>Temperature Scan</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.uploadZone, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]}>
          <Feather name="camera" size={32} color={colors.primary} />
          <Text style={[s.uploadTitle, { color: colors.foreground }]}>
            Upload thermometer photos
          </Text>
          <Text style={[s.uploadSub, { color: colors.mutedForeground }]}>
            AI will read temps from your images
          </Text>
          <View style={s.uploadBtns}>
            <Pressable
              style={[s.uploadBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={pickImage}
            >
              <Feather name="image" size={16} color="#fff" />
              <Text style={s.uploadBtnText}>Gallery</Text>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable
                style={[s.uploadBtn, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}
                onPress={takePhoto}
              >
                <Feather name="camera" size={16} color="#fff" />
                <Text style={s.uploadBtnText}>Camera</Text>
              </Pressable>
            )}
          </View>
        </View>

        {images.length > 0 && (
          <View>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
              {images.length} image{images.length > 1 ? "s" : ""} selected
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {images.map((uri, i) => (
                <View key={i} style={s.thumb}>
                  <Image source={{ uri }} style={s.thumbImg} />
                  <Pressable
                    style={[s.thumbDel, { backgroundColor: colors.destructive }]}
                    onPress={() => setImages((p) => p.filter((_, j) => j !== i))}
                  >
                    <Feather name="x" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                s.analyzeBtn,
                { backgroundColor: colors.primary, borderRadius: colors.radius },
                (scanMutation.isPending || pressed) && { opacity: 0.7 },
              ]}
              onPress={analyze}
              disabled={scanMutation.isPending}
            >
              {scanMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="zap" size={18} color="#fff" />
                  <Text style={s.analyzeBtnText}>Analyze with AI</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {result && (
          <View style={[s.resultCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={s.resultHeader}>
              <Feather name="thermometer" size={20} color={colors.primary} />
              <Text style={[s.resultTitle, { color: colors.foreground }]}>Analysis Result</Text>
            </View>
            {result.readings?.map((r: any, i: number) => (
              <View key={i} style={[s.reading, { borderTopColor: colors.border }]}>
                <Text style={[s.readingLabel, { color: colors.mutedForeground }]}>{r.probe || `Probe ${i + 1}`}</Text>
                <Text style={[s.readingTemp, { color: colors.primary }]}>{r.temperature}°F</Text>
              </View>
            ))}
            {result.analysis && (
              <Text style={[s.resultAnalysis, { color: colors.foreground }]}>{result.analysis}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold" },
  uploadZone: {
    borderWidth: 2, borderStyle: "dashed", borderRadius: 16,
    padding: 28, alignItems: "center", gap: 10,
  },
  uploadTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  uploadSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  uploadBtns: { flexDirection: "row", gap: 12, marginTop: 6 },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 10 },
  uploadBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 10 },
  thumb: { position: "relative" },
  thumbImg: { width: 80, height: 80, borderRadius: 10 },
  thumbDel: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 50, marginTop: 12 },
  analyzeBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  resultCard: { borderWidth: 1, padding: 16, gap: 12 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  resultTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  reading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 1 },
  readingLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  readingTemp: { fontSize: 22, fontFamily: "Inter_700Bold" },
  resultAnalysis: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
});
