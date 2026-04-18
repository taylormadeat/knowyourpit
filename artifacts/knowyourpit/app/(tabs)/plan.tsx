import React, { useState, useMemo } from "react";
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
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
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
import {
  MEAT_CUTS,
  MEAT_CATEGORIES,
  MEAT_CUTS_BY_CATEGORY,
  type MeatCut,
} from "@/constants/meatCuts";

const UPCOMING_DAYS = 14;

function getUpcomingDates(): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < UPCOMING_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

function formatDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateTime(d: Date): string {
  return `${formatDate(d)} at ${formatTime(d.getHours(), d.getMinutes())}`;
}

function preheatMinsForGrill(grill: any | null): number {
  if (!grill) return 25;
  const t = (grill.type || "").toLowerCase();
  if (t.includes("gas")) return 15;
  if (t.includes("pellet")) return 30;
  if (t.includes("kamado") || t.includes("ceramic")) return 45;
  if (t.includes("offset")) return 40;
  if (t.includes("electric")) return 20;
  return 25;
}

interface CookSchedule {
  startAt: Date;
  preheatMins: number;
  cookMins: number;
  restMins: number;
  totalMins: number;
}

function calcSchedule(
  serveAt: Date,
  cut: MeatCut,
  weightLbs: number,
  grill: any | null
): CookSchedule {
  const preheatMins = preheatMinsForGrill(grill);
  const cookMins = Math.round(cut.minsPerLb * weightLbs);
  const restMins = cut.restMins;
  const totalMins = preheatMins + cookMins + restMins;
  const startAt = new Date(serveAt.getTime() - totalMins * 60 * 1000);
  return { startAt, preheatMins, cookMins, restMins, totalMins };
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Time slot helpers ──────────────────────────────────────────────────
const TIME_SLOTS: Array<{ h: number; m: number }> = (() => {
  const slots: Array<{ h: number; m: number }> = [];
  for (let h = 6; h <= 23; h++) {
    slots.push({ h, m: 0 });
    slots.push({ h, m: 30 });
  }
  return slots;
})();

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: grills } = useListGrills();
  const createCook = useCreateCook();

  // ── Form state ───────────────────────────────────────────────────────
  const [cookName, setCookName] = useState("");
  const [selectedCut, setSelectedCut] = useState<MeatCut | null>(null);
  const [weightLbs, setWeightLbs] = useState("");
  const [grillId, setGrillId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [targetTempF, setTargetTempF] = useState("");
  const [cookTempF, setCookTempF] = useState("");

  // ── Serve-by picker state ────────────────────────────────────────────
  const upcomingDates = useMemo(() => getUpcomingDates(), []);
  const defaultServeAt = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  }, []);
  const [serveAt, setServeAt] = useState<Date>(defaultServeAt);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // ── Meat picker state ────────────────────────────────────────────────
  const [meatPickerOpen, setMeatPickerOpen] = useState(false);
  const [meatCategory, setMeatCategory] = useState<string>(MEAT_CATEGORIES[0]);

  // ── Derived values ───────────────────────────────────────────────────
  const selectedGrill = useMemo(
    () => (grills as any[] | undefined)?.find((g: any) => g.id === grillId) ?? null,
    [grills, grillId]
  );

  const parsedWeight = parseFloat(weightLbs) || 0;
  const schedule = useMemo(() => {
    if (!selectedCut || parsedWeight <= 0) return null;
    return calcSchedule(serveAt, selectedCut, parsedWeight, selectedGrill);
  }, [selectedCut, parsedWeight, serveAt, selectedGrill]);

  // When user picks a meat cut, auto-fill temps
  const handlePickCut = (cut: MeatCut) => {
    setSelectedCut(cut);
    setTargetTempF(String(cut.targetTempF));
    setCookTempF(String(cut.cookTempF));
    setMeatPickerOpen(false);
  };

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedCut) {
      Alert.alert("Required", "Please select a meat cut");
      return;
    }
    if (!weightLbs || parsedWeight <= 0) {
      Alert.alert("Required", "Please enter the weight in lbs");
      return;
    }
    const preheatMins = preheatMinsForGrill(selectedGrill);
    try {
      await createCook.mutateAsync({
        data: {
          foodType: selectedCut.name,
          weightLbs: parsedWeight,
          targetTempF: targetTempF ? Number(targetTempF) : selectedCut.targetTempF,
          cookTempF: cookTempF ? Number(cookTempF) : selectedCut.cookTempF,
          grillId: grillId ?? undefined,
          notes: [
            cookName ? `Name: ${cookName}` : null,
            selectedCut.cookMethod ? `Method: ${selectedCut.cookMethod}` : null,
            notes || null,
          ].filter(Boolean).join("\n") || undefined,
          status: "planned",
          plannedEndAt: serveAt,
          plannedStartAt: schedule?.startAt,
          preheatMinutes: preheatMins,
          restMinutes: selectedCut.restMins,
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

  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="Plan a Cook" dark />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: botPad + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Cook Name ── */}
        <Label colors={colors}>Cook Name (optional)</Label>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[s.input, { color: colors.foreground }]}
            placeholder="e.g. Sunday Brisket Comp"
            placeholderTextColor={colors.mutedForeground}
            value={cookName}
            onChangeText={setCookName}
          />
        </View>

        {/* ── Meat Cut ── */}
        <Label colors={colors}>Meat Cut *</Label>
        <Pressable
          onPress={() => setMeatPickerOpen(true)}
          style={[
            s.dropdown,
            {
              backgroundColor: colors.card,
              borderColor: selectedCut ? colors.primary : colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            {selectedCut ? (
              <>
                <Text style={[s.dropdownValue, { color: colors.foreground }]}>{selectedCut.name}</Text>
                <Text style={[s.dropdownSub, { color: colors.mutedForeground }]}>
                  {selectedCut.category} · Target {selectedCut.targetTempF}°F · {selectedCut.cookMethod}
                </Text>
              </>
            ) : (
              <Text style={[s.dropdownPlaceholder, { color: colors.mutedForeground }]}>
                Select a cut of meat…
              </Text>
            )}
          </View>
          <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
        </Pressable>

        {/* ── Weight ── */}
        <Label colors={colors}>Weight (lbs) *</Label>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[s.input, { color: colors.foreground }]}
            placeholder="e.g. 12.5"
            placeholderTextColor={colors.mutedForeground}
            value={weightLbs}
            onChangeText={setWeightLbs}
            keyboardType="decimal-pad"
          />
          <Text style={[s.inputUnit, { color: colors.mutedForeground }]}>lbs</Text>
        </View>

        {/* ── Temp overrides ── */}
        <View style={s.tempRow}>
          <View style={{ flex: 1 }}>
            <Label colors={colors}>Target Temp (°F)</Label>
            <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                placeholder={selectedCut ? String(selectedCut.targetTempF) : "203"}
                placeholderTextColor={colors.mutedForeground}
                value={targetTempF}
                onChangeText={setTargetTempF}
                keyboardType="number-pad"
              />
              <Text style={[s.inputUnit, { color: colors.mutedForeground }]}>°F</Text>
            </View>
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Label colors={colors}>Cook Temp (°F)</Label>
            <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                placeholder={selectedCut ? String(selectedCut.cookTempF) : "225"}
                placeholderTextColor={colors.mutedForeground}
                value={cookTempF}
                onChangeText={setCookTempF}
                keyboardType="number-pad"
              />
              <Text style={[s.inputUnit, { color: colors.mutedForeground }]}>°F</Text>
            </View>
          </View>
        </View>

        {/* ── Grill Selection ── */}
        <Label colors={colors}>Grill</Label>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 12 }}
        >
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
              <Text style={[s.chipText, { color: grillId === g.id ? "#fff" : colors.foreground }]}>
                {g.name}
              </Text>
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

        {/* Grill stats card */}
        {selectedGrill && (
          <View style={[s.grillStatsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={s.grillStatsHeader}>
              <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.grillStatIcon}>
                <Feather name="wind" size={14} color="#fff" />
              </LinearGradient>
              <Text style={[s.grillStatsTitle, { color: colors.foreground }]}>{selectedGrill.name}</Text>
            </View>
            <View style={s.grillStatsGrid}>
              {selectedGrill.type && <StatCell label="Type" value={selectedGrill.type} colors={colors} />}
              {selectedGrill.minTempF && selectedGrill.maxTempF && (
                <StatCell label="Temp Range" value={`${selectedGrill.minTempF}°F – ${selectedGrill.maxTempF}°F`} colors={colors} />
              )}
              {selectedGrill.cookingSurfaceSqIn && (
                <StatCell label="Surface" value={`${selectedGrill.cookingSurfaceSqIn} sq in`} colors={colors} />
              )}
              {selectedGrill.numProbes && (
                <StatCell label="Probes" value={String(selectedGrill.numProbes)} colors={colors} />
              )}
              {selectedGrill.hopperSizeLbs && (
                <StatCell label="Hopper" value={`${selectedGrill.hopperSizeLbs} lbs`} colors={colors} />
              )}
              <StatCell
                label="Preheat Est."
                value={`~${preheatMinsForGrill(selectedGrill)} min`}
                colors={colors}
                highlight
              />
            </View>
            {selectedGrill.maxTempF && selectedCut && selectedCut.cookTempF > selectedGrill.maxTempF && (
              <View style={[s.tempWarning, { backgroundColor: "#ef4444" + "18" }]}>
                <Feather name="alert-triangle" size={14} color="#ef4444" />
                <Text style={s.tempWarningText}>
                  This grill's max temp ({selectedGrill.maxTempF}°F) may not reach the recommended cook temp ({selectedCut.cookTempF}°F)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Serve By ── */}
        <Label colors={colors}>When do you want to serve?</Label>
        <View style={[s.serveByCard, { backgroundColor: colors.card, borderColor: colors.primary + "40", borderRadius: colors.radius }]}>
          <View style={s.serveByRow}>
            <Feather name="calendar" size={16} color={colors.primary} />
            <Text style={[s.serveByLabel, { color: colors.mutedForeground }]}>Date</Text>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={[s.serveByBtn, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}
            >
              <Text style={[s.serveByBtnText, { color: colors.primary }]}>{formatDate(serveAt)}</Text>
            </Pressable>
          </View>
          <View style={[s.serveByDivider, { backgroundColor: colors.border }]} />
          <View style={s.serveByRow}>
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={[s.serveByLabel, { color: colors.mutedForeground }]}>Time</Text>
            <Pressable
              onPress={() => setTimePickerOpen(true)}
              style={[s.serveByBtn, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}
            >
              <Text style={[s.serveByBtnText, { color: colors.primary }]}>
                {formatTime(serveAt.getHours(), serveAt.getMinutes())}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Cook Schedule Summary ── */}
        {schedule && (
          <View style={[s.scheduleCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <LinearGradient
              colors={["#E84820", "#FF6B2B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.scheduleHeader}
            >
              <Feather name="clock" size={16} color="#fff" />
              <Text style={s.scheduleHeaderText}>Your Cook Schedule</Text>
            </LinearGradient>
            <View style={s.scheduleBody}>
              <ScheduleRow
                icon="power"
                label="Start Grill (preheat)"
                value={formatDateTime(schedule.startAt)}
                sub={`~${fmtDuration(schedule.preheatMins)} preheat`}
                colors={colors}
              />
              <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
              <ScheduleRow
                icon="zap"
                label="Put on the meat"
                value={formatDateTime(new Date(schedule.startAt.getTime() + schedule.preheatMins * 60000))}
                sub={`~${fmtDuration(schedule.cookMins)} cook time`}
                colors={colors}
              />
              <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
              <ScheduleRow
                icon="pause"
                label="Pull off the grill"
                value={formatDateTime(new Date(serveAt.getTime() - schedule.restMins * 60000))}
                sub={`~${fmtDuration(schedule.restMins)} rest`}
                colors={colors}
              />
              <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
              <ScheduleRow
                icon="check-circle"
                label="Serve!"
                value={formatDateTime(serveAt)}
                sub={`Total: ${fmtDuration(schedule.totalMins)}`}
                colors={colors}
                highlight
              />
            </View>
            {selectedCut?.notes && (
              <View style={[s.scheduleTip, { backgroundColor: colors.primary + "12" }]}>
                <Feather name="info" size={13} color={colors.primary} />
                <Text style={[s.scheduleTipText, { color: colors.foreground }]}>{selectedCut.notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Notes ── */}
        <Label colors={colors}>Notes</Label>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, height: 80 }]}>
          <TextInput
            style={[s.input, { color: colors.foreground, textAlignVertical: "top", paddingTop: 10 }]}
            placeholder="Rub recipe, wood choice, timing notes…"
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* ── Submit ── */}
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
              <Feather name="zap" size={18} color="#fff" />
              <Text style={s.submitText}>Save Cook Plan</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* ════ MEAT PICKER MODAL ════ */}
      <Modal
        visible={meatPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMeatPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Select a Meat Cut</Text>
              <Pressable onPress={() => setMeatPickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Category tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, padding: 14, paddingTop: 10 }}
            >
              {MEAT_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setMeatCategory(cat)}
                  style={[
                    s.catTab,
                    {
                      backgroundColor: meatCategory === cat ? colors.primary : colors.muted,
                      borderRadius: 20,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.catTabText,
                      { color: meatCategory === cat ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Cut list */}
            <FlatList
              data={MEAT_CUTS_BY_CATEGORY[meatCategory] ?? []}
              keyExtractor={(item) => item.name}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
              ItemSeparatorComponent={() => <View style={[s.cutSep, { backgroundColor: colors.border }]} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handlePickCut(item)}
                  style={({ pressed }) => [
                    s.cutRow,
                    pressed && { opacity: 0.7 },
                    selectedCut?.name === item.name && { backgroundColor: colors.primary + "12" },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cutName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[s.cutMeta, { color: colors.mutedForeground }]}>
                      Target {item.targetTempF}°F · Cook at {item.cookTempF}°F · ~{item.minsPerLb} min/lb
                    </Text>
                    {item.notes && (
                      <Text style={[s.cutNote, { color: colors.mutedForeground }]}>{item.notes}</Text>
                    )}
                  </View>
                  {selectedCut?.name === item.name && (
                    <Feather name="check-circle" size={18} color={colors.primary} />
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ════ DATE PICKER MODAL ════ */}
      <Modal
        visible={datePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheetSm, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Pick a Date</Text>
              <Pressable onPress={() => setDatePickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {upcomingDates.map((d) => {
                const isSelected =
                  d.getDate() === serveAt.getDate() &&
                  d.getMonth() === serveAt.getMonth() &&
                  d.getFullYear() === serveAt.getFullYear();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => {
                      const next = new Date(serveAt);
                      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      setServeAt(next);
                      setDatePickerOpen(false);
                    }}
                    style={[
                      s.dateRow,
                      isSelected && { backgroundColor: colors.primary + "18" },
                      { borderRadius: colors.radius },
                    ]}
                  >
                    <Text style={[s.dateText, { color: isSelected ? colors.primary : colors.foreground }]}>
                      {formatDate(d)}
                    </Text>
                    <Text style={[s.dateSubText, { color: colors.mutedForeground }]}>
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

      {/* ════ TIME PICKER MODAL ════ */}
      <Modal
        visible={timePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTimePickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheetSm, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Pick a Time</Text>
              <Pressable onPress={() => setTimePickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {TIME_SLOTS.map(({ h, m }) => {
                const isSelected = serveAt.getHours() === h && serveAt.getMinutes() === m;
                return (
                  <Pressable
                    key={`${h}:${m}`}
                    onPress={() => {
                      const next = new Date(serveAt);
                      next.setHours(h, m, 0, 0);
                      setServeAt(next);
                      setTimePickerOpen(false);
                    }}
                    style={[
                      s.dateRow,
                      isSelected && { backgroundColor: colors.primary + "18" },
                      { borderRadius: colors.radius },
                    ]}
                  >
                    <Text style={[s.dateText, { color: isSelected ? colors.primary : colors.foreground }]}>
                      {formatTime(h, m)}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Small components ────────────────────────────────────────────────────────

function Label({ children, colors }: { children: React.ReactNode; colors: any }) {
  return (
    <Text style={[s.label, { color: colors.foreground }]}>{children}</Text>
  );
}

function StatCell({ label, value, colors, highlight }: { label: string; value: string; colors: any; highlight?: boolean }) {
  return (
    <View style={s.statCell}>
      <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.statValue, { color: highlight ? colors.primary : colors.foreground }]}>{value}</Text>
    </View>
  );
}

function ScheduleRow({
  icon,
  label,
  value,
  sub,
  colors,
  highlight,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  colors: any;
  highlight?: boolean;
}) {
  return (
    <View style={s.scheduleRow}>
      <View style={[s.scheduleIcon, { backgroundColor: highlight ? colors.primary + "20" : colors.muted }]}>
        <Feather name={icon} size={14} color={highlight ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.scheduleLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[s.scheduleValue, { color: highlight ? colors.primary : colors.foreground }]}>{value}</Text>
        <Text style={[s.scheduleSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8, marginTop: 16 },

  inputWrap: {
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  input: { flex: 1, height: 48, fontSize: 15, fontFamily: "Inter_400Regular" },
  inputUnit: { fontSize: 13, fontFamily: "Inter_500Medium", marginLeft: 4 },

  tempRow: { flexDirection: "row", alignItems: "flex-start" },

  dropdown: {
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
  },
  dropdownValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  dropdownSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dropdownPlaceholder: { fontSize: 15, fontFamily: "Inter_400Regular" },

  grillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  grillStatsCard: {
    borderWidth: 1,
    marginBottom: 4,
    overflow: "hidden",
  },
  grillStatsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    paddingBottom: 8,
  },
  grillStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  grillStatsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grillStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    gap: 0,
  },
  statCell: {
    width: "50%",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 2 },
  statValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tempWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 10,
    marginTop: 0,
    padding: 10,
    borderRadius: 8,
  },
  tempWarningText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#ef4444" },

  serveByCard: {
    borderWidth: 1,
    overflow: "hidden",
  },
  serveByRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  serveByLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  serveByDivider: { height: 1, marginHorizontal: 14 },
  serveByBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  serveByBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  scheduleCard: { borderWidth: 1, overflow: "hidden", marginTop: 16 },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scheduleHeaderText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  scheduleBody: { paddingHorizontal: 14, paddingVertical: 8 },
  scheduleLine: { height: 1, marginLeft: 40, marginVertical: 4 },
  scheduleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8 },
  scheduleIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  scheduleLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 1 },
  scheduleValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scheduleSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  scheduleTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 12,
    marginTop: 0,
    padding: 10,
    borderRadius: 8,
  },
  scheduleTipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    marginTop: 20,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalSheetSm: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "65%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },

  catTab: { paddingHorizontal: 14, paddingVertical: 7 },
  catTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  cutRow: { paddingVertical: 12, paddingHorizontal: 4, flexDirection: "row", alignItems: "center" },
  cutSep: { height: 1, marginHorizontal: 4 },
  cutName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cutMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cutNote: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 2 },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 10,
  },
  dateText: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1 },
  dateSubText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
