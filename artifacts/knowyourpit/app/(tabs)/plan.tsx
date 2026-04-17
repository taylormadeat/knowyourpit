import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { AppHeader } from "@/components/AppHeader";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useListGrills,
  useCreateCook,
  getListCooksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
} from "@workspace/api-client-react";

const MEAT_TYPES = ["Brisket", "Pork Butt", "Ribs", "Chicken", "Salmon", "Lamb", "Other"];
const COOK_METHODS = ["Low & Slow", "Hot & Fast", "Reverse Sear", "Direct Heat", "Indirect"];

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: grills } = useListGrills();
  const createCook = useCreateCook();

  const [name, setName] = useState("");
  const [meatType, setMeatType] = useState("");
  const [targetTemp, setTargetTemp] = useState("");
  const [cookMethod, setCookMethod] = useState("");
  const [grillId, setGrillId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const handleSubmit = async () => {
    if (!meatType && !name) {
      Alert.alert("Required", "Enter a name or select a meat type");
      return;
    }
    try {
      await createCook.mutateAsync({
        data: {
          name: name || meatType,
          meatType: meatType || name,
          targetTemp: targetTemp ? Number(targetTemp) : undefined,
          cookMethod: cookMethod || undefined,
          grillId: grillId || undefined,
          notes: notes || undefined,
          status: "planned",
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
      router.push("/(tabs)/cooks" as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to create cook");
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Plan a Cook" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: botPad + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.label, { color: colors.foreground }]}>Cook Name</Text>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[s.input, { color: colors.foreground }]}
            placeholder="e.g. Sunday Brisket"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
          />
        </View>

        <Text style={[s.label, { color: colors.foreground }]}>Meat Type</Text>
        <View style={s.chips}>
          {MEAT_TYPES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMeatType(m === meatType ? "" : m)}
              style={[
                s.chip,
                {
                  backgroundColor: meatType === m ? colors.primary : colors.card,
                  borderColor: meatType === m ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[s.chipText, { color: meatType === m ? "#fff" : colors.foreground }]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[s.label, { color: colors.foreground }]}>Cook Method</Text>
        <View style={s.chips}>
          {COOK_METHODS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setCookMethod(m === cookMethod ? "" : m)}
              style={[
                s.chip,
                {
                  backgroundColor: cookMethod === m ? colors.secondary : colors.card,
                  borderColor: cookMethod === m ? colors.secondary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[s.chipText, { color: cookMethod === m ? "#fff" : colors.foreground }]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[s.label, { color: colors.foreground }]}>Target Temp (°F)</Text>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[s.input, { color: colors.foreground }]}
            placeholder="e.g. 203"
            placeholderTextColor={colors.mutedForeground}
            value={targetTemp}
            onChangeText={setTargetTemp}
            keyboardType="number-pad"
          />
        </View>

        <Text style={[s.label, { color: colors.foreground }]}>Grill</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
          {(grills as any[] || []).map((g: any) => (
            <Pressable
              key={g.id}
              onPress={() => setGrillId(g.id === grillId ? null : g.id)}
              style={[
                s.grillChip,
                {
                  backgroundColor: grillId === g.id ? colors.primary : colors.card,
                  borderColor: grillId === g.id ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather name="wind" size={14} color={grillId === g.id ? "#fff" : colors.primary} />
              <Text style={[s.chipText, { color: grillId === g.id ? "#fff" : colors.foreground }]}>{g.name}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push("/grills" as any)}
            style={[s.grillChip, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <Feather name="plus" size={14} color={colors.mutedForeground} />
            <Text style={[s.chipText, { color: colors.mutedForeground }]}>Add Grill</Text>
          </Pressable>
        </ScrollView>

        <Text style={[s.label, { color: colors.foreground }]}>Notes</Text>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, height: 90 }]}>
          <TextInput
            style={[s.input, { color: colors.foreground, textAlignVertical: "top", paddingTop: 10 }]}
            placeholder="Rub recipe, timing notes..."
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            s.submitBtn,
            { backgroundColor: colors.primary, borderRadius: colors.radius },
            (createCook.isPending || pressed) && { opacity: 0.7 },
          ]}
          onPress={handleSubmit}
          disabled={createCook.isPending}
        >
          {createCook.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="flame" size={18} color="#fff" />
              <Text style={s.submitText}>Start Planning</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8, marginTop: 4 },
  inputWrap: { borderWidth: 1, paddingHorizontal: 14, marginBottom: 20 },
  input: { height: 48, fontSize: 15, fontFamily: "Inter_400Regular" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  grillChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, marginTop: 8 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
