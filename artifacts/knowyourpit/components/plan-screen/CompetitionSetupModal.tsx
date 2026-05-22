import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABEL,
  COMPETITION_CATEGORY_COLOR,
  COMPETITION_CATEGORY_FOOD_TYPE,
  COMPETITION_CATEGORY_CUT_OPTIONS,
  COMPETITION_CATEGORY_DEFAULT_WEIGHT_LBS,
  COMPETITION_DEFAULT_TURN_INS,
  COMPETITION_WALK_TIME_DEFAULT_MINUTES,
  COMPETITION_WALK_TIME_MIN_MINUTES,
  COMPETITION_WALK_TIME_MAX_MINUTES,
  type CompetitionCategory,
} from "@/constants/competitionKnowledge";
import { MEAT_CUTS, type MeatCut } from "@/constants/meatCuts";
import { formatDate, formatTime, getUpcomingDates } from "./utils";

const TURN_IN_SLOTS: Array<{ h: number; m: number }> = (() => {
  const slots: Array<{ h: number; m: number }> = [];
  for (let h = 8; h <= 18; h++) {
    for (const m of [0, 15, 30, 45]) slots.push({ h, m });
  }
  return slots;
})();

export interface CompetitionItem {
  category: CompetitionCategory;
  cut: MeatCut;
  weightLbs: string;
  turnInAt: Date;
  grillId: number | null;
  walkMinutes: number;
}

export interface CompetitionPayload {
  competitionName: string;
  competitionDate: Date;
  items: CompetitionItem[];
}

function setTimeOnDate(base: Date, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function fmtTimeFromDate(d: Date): string {
  return formatTime(d.getHours(), d.getMinutes());
}

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: any;
  defaultGrillId: number | null;
  onContinue: (payload: CompetitionPayload) => void;
  pending: boolean;
}

export function CompetitionSetupModal({
  visible,
  onClose,
  colors,
  defaultGrillId,
  onContinue,
  pending,
}: Props) {
  const [competitionName, setCompetitionName] = useState("");
  const initialDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [competitionDate, setCompetitionDate] = useState<Date>(initialDate);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<CompetitionCategory, boolean>>({
    chicken: true,
    ribs: true,
    pork: true,
    brisket: true,
  });
  const [weights, setWeights] = useState<Record<CompetitionCategory, string>>(() => {
    const o: any = {};
    for (const c of COMPETITION_CATEGORIES) o[c] = String(COMPETITION_CATEGORY_DEFAULT_WEIGHT_LBS[c]);
    return o;
  });
  const [turnInTimes, setTurnInTimes] = useState<Record<CompetitionCategory, Date>>(() => {
    const o: any = {};
    for (const c of COMPETITION_CATEGORIES) {
      o[c] = setTimeOnDate(initialDate, COMPETITION_DEFAULT_TURN_INS[c].hour, COMPETITION_DEFAULT_TURN_INS[c].minute);
    }
    return o;
  });
  const [timePickerFor, setTimePickerFor] = useState<CompetitionCategory | null>(null);
  const [selectedCuts, setSelectedCuts] = useState<Record<CompetitionCategory, string>>(() => {
    const o = {} as Record<CompetitionCategory, string>;
    for (const c of COMPETITION_CATEGORIES) o[c] = COMPETITION_CATEGORY_FOOD_TYPE[c];
    return o;
  });
  const [cutPickerFor, setCutPickerFor] = useState<CompetitionCategory | null>(null);
  const [walkMinutes, setWalkMinutes] = useState<Record<CompetitionCategory, number>>(() => {
    const o: any = {};
    for (const c of COMPETITION_CATEGORIES) o[c] = COMPETITION_WALK_TIME_DEFAULT_MINUTES;
    return o;
  });

  const upcomingDates = useMemo(() => getUpcomingDates(), []);

  useEffect(() => {
    setTurnInTimes((prev) => {
      const next: Record<CompetitionCategory, Date> = { ...prev };
      for (const c of COMPETITION_CATEGORIES) {
        const t = prev[c];
        next[c] = setTimeOnDate(competitionDate, t.getHours(), t.getMinutes());
      }
      return next;
    });
  }, [competitionDate]);

  const enabledCount = COMPETITION_CATEGORIES.filter((c) => enabled[c]).length;
  const canContinue = enabledCount > 0 && !pending;

  const handleContinue = () => {
    if (!canContinue) return;
    const items: CompetitionItem[] = [];
    for (const c of COMPETITION_CATEGORIES) {
      if (!enabled[c]) continue;
      const cutName = selectedCuts[c];
      const cut = MEAT_CUTS.find((m) => m.name === cutName);
      if (!cut) continue;
      items.push({
        category: c,
        cut,
        weightLbs: weights[c] || String(COMPETITION_CATEGORY_DEFAULT_WEIGHT_LBS[c]),
        turnInAt: turnInTimes[c],
        grillId: defaultGrillId,
        walkMinutes: walkMinutes[c],
      });
    }
    if (items.length === 0) return;
    onContinue({
      competitionName: competitionName.trim() || "My Competition",
      competitionDate,
      items,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <LinearGradient colors={["#EAB308", "#F59E0B"]} style={s.headerIcon}>
                  <Feather name="award" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[s.title, { color: colors.foreground }]}>Competition Setup</Text>
              </View>
              <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
                Backwards-plan each category to its turn-in time
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 540 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[s.label, { color: colors.mutedForeground }]}>COMPETITION NAME</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                placeholder="e.g. Memphis in May"
                placeholderTextColor={colors.mutedForeground}
                value={competitionName}
                onChangeText={setCompetitionName}
              />
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>COMPETITION DAY</Text>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius, flexDirection: "row", alignItems: "center" }]}
            >
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[s.input, { color: colors.foreground, marginLeft: 8 }]}>
                {formatDate(competitionDate)}
                {"  "}
                <Text style={{ color: colors.mutedForeground }}>
                  {competitionDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </Pressable>

            <Text style={[s.label, { color: colors.mutedForeground, marginTop: 14 }]}>CATEGORIES & TURN-IN TIMES</Text>
            {COMPETITION_CATEGORIES.map((c) => {
              const isOn = enabled[c];
              const color = COMPETITION_CATEGORY_COLOR[c];
              const def = COMPETITION_DEFAULT_TURN_INS[c];
              const isDefault =
                turnInTimes[c].getHours() === def.hour && turnInTimes[c].getMinutes() === def.minute;
              return (
                <View
                  key={c}
                  style={[
                    s.catCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: isOn ? color : colors.border,
                      borderRadius: colors.radius,
                      opacity: isOn ? 1 : 0.55,
                    },
                  ]}
                >
                  <View style={s.catRow}>
                    <Pressable
                      onPress={() => setEnabled((p) => ({ ...p, [c]: !p[c] }))}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
                    >
                      <View style={[s.catSwatch, { backgroundColor: color + (isOn ? "" : "55") }]}>
                        <Feather name={isOn ? "check" : "circle"} size={14} color="#fff" />
                      </View>
                      <Text style={[s.catName, { color: colors.foreground }]}>{COMPETITION_CATEGORY_LABEL[c]}</Text>
                    </Pressable>
                    {isOn ? (
                      <Pressable
                        onPress={() => setCutPickerFor(c)}
                        style={[
                          s.turnInPill,
                          {
                            backgroundColor: color + "22",
                            borderColor: color,
                            borderRadius: colors.radius - 2,
                          },
                        ]}
                      >
                        <Feather name="scissors" size={11} color={color} />
                        <Text style={[s.turnInText, { color, maxWidth: 130 }]} numberOfLines={1}>
                          {selectedCuts[c]}
                        </Text>
                        <Feather name="chevron-down" size={11} color={color} />
                      </Pressable>
                    ) : (
                      <Text style={[s.catSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {selectedCuts[c]}
                      </Text>
                    )}
                  </View>
                  {isOn && (
                    <View style={s.catBody}>
                      <View style={s.catFieldRow}>
                        <Text style={[s.catFieldLabel, { color: colors.mutedForeground }]}>Weight</Text>
                        <View style={[s.weightWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius - 2 }]}>
                          <TextInput
                            style={[s.weightInput, { color: colors.foreground }]}
                            value={weights[c]}
                            onChangeText={(v) => setWeights((p) => ({ ...p, [c]: v.replace(/[^0-9.]/g, "") }))}
                            keyboardType="decimal-pad"
                            placeholder={String(COMPETITION_CATEGORY_DEFAULT_WEIGHT_LBS[c])}
                            placeholderTextColor={colors.mutedForeground}
                          />
                          <Text style={[s.weightUnit, { color: colors.mutedForeground }]}>lbs</Text>
                        </View>
                      </View>
                      <View style={s.catFieldRow}>
                        <Text style={[s.catFieldLabel, { color: colors.mutedForeground }]}>Walk</Text>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Pressable
                            onPress={() => setWalkMinutes((p) => ({ ...p, [c]: Math.max(COMPETITION_WALK_TIME_MIN_MINUTES, p[c] - 1) }))}
                            style={[s.stepperBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                            hitSlop={4}
                          >
                            <Feather name="minus" size={14} color={colors.foreground} />
                          </Pressable>
                          <Text style={[s.stepperVal, { color: colors.foreground }]}>{walkMinutes[c]} min</Text>
                          <Pressable
                            onPress={() => setWalkMinutes((p) => ({ ...p, [c]: Math.min(COMPETITION_WALK_TIME_MAX_MINUTES, p[c] + 1) }))}
                            style={[s.stepperBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                            hitSlop={4}
                          >
                            <Feather name="plus" size={14} color={colors.foreground} />
                          </Pressable>
                          <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }]}>
                            to turn-in table
                          </Text>
                        </View>
                      </View>
                      <View style={s.catFieldRow}>
                        <Text style={[s.catFieldLabel, { color: colors.mutedForeground }]}>Turn-in</Text>
                        <Pressable
                          onPress={() => setTimePickerFor(c)}
                          style={[
                            s.turnInPill,
                            {
                              backgroundColor: color + "22",
                              borderColor: color,
                              borderRadius: colors.radius - 2,
                            },
                          ]}
                        >
                          <Feather name="clock" size={12} color={color} />
                          <Text style={[s.turnInText, { color }]}>{fmtTimeFromDate(turnInTimes[c])}</Text>
                          {isDefault ? (
                            <Text style={[s.turnInDefault, { color }]}> · default</Text>
                          ) : null}
                          <Feather name="chevron-down" size={12} color={color} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            disabled={!canContinue}
            onPress={handleContinue}
            activeOpacity={0.85}
            style={{ marginTop: 8 }}
          >
            <LinearGradient
              colors={canContinue ? ["#EAB308", "#F59E0B"] : ["#9CA3AF", "#9CA3AF"]}
              style={[s.cta, { borderRadius: colors.radius }]}
            >
              <Feather name="zap" size={16} color="#fff" />
              <Text style={s.ctaText}>
                {pending
                  ? "Building plan…"
                  : enabledCount > 0
                    ? `Build Competition Plan (${enabledCount})`
                    : "Pick at least one category"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Date sub-modal ── */}
        <Modal visible={datePickerOpen} transparent animationType="slide" onRequestClose={() => setDatePickerOpen(false)}>
          <View style={s.subOverlay}>
            <Pressable style={s.backdrop} onPress={() => setDatePickerOpen(false)} />
            <View style={[s.subSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.handle} />
              <View style={s.subHeader}>
                <Text style={[s.title, { color: colors.foreground }]}>Pick Competition Day</Text>
                <Pressable onPress={() => setDatePickerOpen(false)} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 380 }}>
                {upcomingDates.map((d) => {
                  const isSel =
                    d.getDate() === competitionDate.getDate() &&
                    d.getMonth() === competitionDate.getMonth() &&
                    d.getFullYear() === competitionDate.getFullYear();
                  return (
                    <Pressable
                      key={d.toISOString()}
                      onPress={() => {
                        const next = new Date(competitionDate);
                        next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                        setCompetitionDate(next);
                        setDatePickerOpen(false);
                      }}
                      style={[
                        s.subRow,
                        isSel && { backgroundColor: colors.primary + "18" },
                        { borderRadius: colors.radius },
                      ]}
                    >
                      <Text style={[s.subRowText, { color: isSel ? colors.primary : colors.foreground }]}>
                        {formatDate(d)}
                      </Text>
                      <Text style={[s.subRowSub, { color: colors.mutedForeground }]}>
                        {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </Text>
                      {isSel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Per-category turn-in time sub-modal ── */}
        <Modal
          visible={timePickerFor !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setTimePickerFor(null)}
        >
          <View style={s.subOverlay}>
            <Pressable style={s.backdrop} onPress={() => setTimePickerFor(null)} />
            <View style={[s.subSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.handle} />
              <View style={s.subHeader}>
                <Text style={[s.title, { color: colors.foreground }]}>
                  {timePickerFor ? `${COMPETITION_CATEGORY_LABEL[timePickerFor]} Turn-In` : "Turn-In Time"}
                </Text>
                <Pressable onPress={() => setTimePickerFor(null)} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 380 }}>
                {TURN_IN_SLOTS.map(({ h, m }) => {
                  const cur = timePickerFor ? turnInTimes[timePickerFor] : null;
                  const isSel = cur ? cur.getHours() === h && cur.getMinutes() === m : false;
                  return (
                    <Pressable
                      key={`${h}:${m}`}
                      onPress={() => {
                        if (!timePickerFor) return;
                        setTurnInTimes((p) => ({
                          ...p,
                          [timePickerFor]: setTimeOnDate(competitionDate, h, m),
                        }));
                        setTimePickerFor(null);
                      }}
                      style={[
                        s.subRow,
                        isSel && timePickerFor && { backgroundColor: COMPETITION_CATEGORY_COLOR[timePickerFor] + "22" },
                        { borderRadius: colors.radius },
                      ]}
                    >
                      <Text
                        style={[
                          s.subRowText,
                          { color: isSel && timePickerFor ? COMPETITION_CATEGORY_COLOR[timePickerFor] : colors.foreground },
                        ]}
                      >
                        {formatTime(h, m)}
                      </Text>
                      {isSel && timePickerFor && (
                        <Feather name="check" size={16} color={COMPETITION_CATEGORY_COLOR[timePickerFor]} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
        {/* ── Per-category cut picker sub-modal ── */}
        <Modal
          visible={cutPickerFor !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setCutPickerFor(null)}
        >
          <View style={s.subOverlay}>
            <Pressable style={s.backdrop} onPress={() => setCutPickerFor(null)} />
            <View style={[s.subSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.handle} />
              <View style={s.subHeader}>
                <Text style={[s.title, { color: colors.foreground }]}>
                  {cutPickerFor ? `${COMPETITION_CATEGORY_LABEL[cutPickerFor]} — Choose cut` : "Choose cut"}
                </Text>
                <Pressable onPress={() => setCutPickerFor(null)} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 380 }}>
                {cutPickerFor &&
                  COMPETITION_CATEGORY_CUT_OPTIONS[cutPickerFor].map((name) => {
                    const isSel = selectedCuts[cutPickerFor] === name;
                    const catColor = COMPETITION_CATEGORY_COLOR[cutPickerFor];
                    return (
                      <Pressable
                        key={name}
                        onPress={() => {
                          setSelectedCuts((p) => ({ ...p, [cutPickerFor]: name }));
                          setCutPickerFor(null);
                        }}
                        style={[
                          s.subRow,
                          isSel && { backgroundColor: catColor + "22" },
                          { borderRadius: colors.radius },
                        ]}
                      >
                        <Text style={[s.subRowText, { color: isSel ? catColor : colors.foreground }]}>
                          {name}
                        </Text>
                        {isSel && <Feather name="check" size={16} color={catColor} />}
                      </Pressable>
                    );
                  })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  subOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  subSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 8,
    marginBottom: 4,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  subRowText: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  subRowSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 10,
  },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  headerIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 17 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2, marginLeft: 36 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  inputWrap: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  input: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  catCard: { padding: 12, borderWidth: 1, marginBottom: 8 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  catSwatch: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  catName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  catSub: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  catBody: { marginTop: 10, gap: 8 },
  catFieldRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  catFieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, width: 60 },
  weightWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, flex: 1 },
  weightInput: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
  weightUnit: { fontFamily: "Inter_400Regular", fontSize: 12 },
  turnInPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  turnInText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  turnInDefault: { fontFamily: "Inter_400Regular", fontSize: 10 },
  stepperBtn: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepperVal: { fontFamily: "Inter_600SemiBold", fontSize: 13, minWidth: 44, textAlign: "center" },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  ctaText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
});
