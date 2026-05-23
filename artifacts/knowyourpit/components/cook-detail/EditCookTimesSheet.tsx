import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";

type PickerTarget = "meatOnDate" | "meatOnTime" | "thawDate" | "thawTime" | null;

function buildPastDates(limit: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < limit; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

function buildTimeSlots(forDate: Date): Array<{ h: number; m: number }> {
  const slots: Array<{ h: number; m: number }> = [];
  const now = new Date();
  const isToday =
    forDate.getDate() === now.getDate() &&
    forDate.getMonth() === now.getMonth() &&
    forDate.getFullYear() === now.getFullYear();
  for (let h = 0; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (isToday) {
        const slotMs = new Date(forDate).setHours(h, m, 0, 0);
        if (slotMs > now.getTime()) continue;
      }
      slots.push({ h, m });
    }
  }
  return slots.reverse();
}

function fmtDate(d: Date): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === now.getTime()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} · ${fmtTime(d.getHours(), d.getMinutes())}`;
}

interface Props {
  visible: boolean;
  fromFrozen: boolean;
  initialMeatOnAt: Date | null;
  initialThawStartAt: Date | null;
  estimatedFinishAt: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (meatOnAt: Date, thawStartAt: Date | null) => void;
  colors: any;
}

export function EditCookTimesSheet({
  visible,
  fromFrozen,
  initialMeatOnAt,
  initialThawStartAt,
  estimatedFinishAt,
  saving,
  onClose,
  onSave,
  colors,
}: Props) {
  const [meatOnDate, setMeatOnDate] = useState<Date>(initialMeatOnAt ?? new Date());
  const [thawDate, setThawDate] = useState<Date>(initialThawStartAt ?? new Date());
  const [activePicker, setActivePicker] = useState<PickerTarget>(null);

  useEffect(() => {
    if (visible) {
      setMeatOnDate(initialMeatOnAt ?? new Date());
      setThawDate(initialThawStartAt ?? new Date());
      setActivePicker(null);
    }
  }, [visible]);

  const pastDates = useMemo(() => buildPastDates(8), []);

  const meatOnTimeSlots = useMemo(() => {
    const d = new Date(meatOnDate);
    d.setHours(0, 0, 0, 0);
    return buildTimeSlots(d);
  }, [meatOnDate]);

  const thawTimeSlots = useMemo(() => {
    const d = new Date(thawDate);
    d.setHours(0, 0, 0, 0);
    return buildTimeSlots(d);
  }, [thawDate]);

  const meatOnInFuture = meatOnDate.getTime() > Date.now();
  const thawInFuture = fromFrozen && thawDate.getTime() > Date.now();
  const hasError = meatOnInFuture || thawInFuture;

  const correctedFinishMs = useMemo(() => {
    if (!estimatedFinishAt) return null;
    if (!initialMeatOnAt) return null;
    const originalMeatOnMs = initialMeatOnAt.getTime();
    const delta = meatOnDate.getTime() - originalMeatOnMs;
    return new Date(estimatedFinishAt).getTime() + delta;
  }, [meatOnDate, initialMeatOnAt, estimatedFinishAt]);

  const mayBeAlreadyDone =
    correctedFinishMs !== null && correctedFinishMs < Date.now() + 10 * 60 * 1000;

  const handleSave = () => {
    if (hasError) return;
    onSave(meatOnDate, fromFrozen ? thawDate : null);
  };

  const renderPicker = () => {
    if (!activePicker) return null;
    const isDatePicker = activePicker === "meatOnDate" || activePicker === "thawDate";
    const isMeatOn = activePicker === "meatOnDate" || activePicker === "meatOnTime";
    const currentDate = isMeatOn ? meatOnDate : thawDate;
    const setDate = isMeatOn ? setMeatOnDate : setThawDate;
    const timeSlots = isMeatOn ? meatOnTimeSlots : thawTimeSlots;
    const pickerTitle = isDatePicker
      ? (isMeatOn ? "Meat On — Pick Date" : "Thaw Start — Pick Date")
      : (isMeatOn ? "Meat On — Pick Time" : "Thaw Start — Pick Time");

    return (
      <View style={[es.subPicker, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={es.subPickerHeader}>
          <Pressable onPress={() => setActivePicker(null)} hitSlop={10} style={es.subPickerBack}>
            <Feather name="arrow-left" size={18} color={colors.primary} />
            <Text style={[es.subPickerBackLabel, { color: colors.primary }]}>Back</Text>
          </Pressable>
          <Text style={[es.subPickerTitle, { color: colors.foreground }]}>{pickerTitle}</Text>
        </View>
        <ScrollView contentContainerStyle={es.subPickerList}>
          {isDatePicker
            ? pastDates.map((d) => {
                const selected =
                  d.getDate() === currentDate.getDate() &&
                  d.getMonth() === currentDate.getMonth() &&
                  d.getFullYear() === currentDate.getFullYear();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => {
                      const next = new Date(currentDate);
                      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      if (next.getTime() > Date.now()) {
                        next.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
                      }
                      setDate(next);
                      setActivePicker(null);
                    }}
                    style={[
                      es.pickerRow,
                      selected && { backgroundColor: colors.primary + "18" },
                    ]}
                  >
                    <Text style={[es.pickerRowText, { color: selected ? colors.primary : colors.foreground }]}>
                      {fmtDate(d)}
                    </Text>
                    <Text style={[es.pickerRowSub, { color: colors.mutedForeground }]}>
                      {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </Text>
                    {selected && <Feather name="check" size={15} color={colors.primary} />}
                  </Pressable>
                );
              })
            : timeSlots.map(({ h, m }) => {
                const selected = currentDate.getHours() === h && currentDate.getMinutes() === m;
                return (
                  <Pressable
                    key={`${h}:${m}`}
                    onPress={() => {
                      const next = new Date(currentDate);
                      next.setHours(h, m, 0, 0);
                      setDate(next);
                      setActivePicker(null);
                    }}
                    style={[
                      es.pickerRow,
                      selected && { backgroundColor: colors.primary + "18" },
                    ]}
                  >
                    <Text style={[es.pickerRowText, { color: selected ? colors.primary : colors.foreground }]}>
                      {fmtTime(h, m)}
                    </Text>
                    {selected && <Feather name="check" size={15} color={colors.primary} />}
                  </Pressable>
                );
              })}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={activePicker ? () => setActivePicker(null) : onClose}>
      <Pressable style={es.overlay} onPress={activePicker ? () => setActivePicker(null) : onClose} />
      <AppKeyboardAvoidingView style={[es.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={[es.handle, { backgroundColor: colors.mutedForeground + "55" }]} />

        {/* Title row */}
        <View style={es.titleRow}>
          <View style={[es.iconWrap, { backgroundColor: "#3B82F620" }]}>
            <Feather name="clock" size={16} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[es.title, { color: colors.foreground }]}>Edit Cook Times</Text>
            <Text style={[es.desc, { color: colors.mutedForeground }]}>
              Correct the actual timestamps so countdowns and notifications stay accurate.
            </Text>
          </View>
        </View>

        {/* Warning banners */}
        {(meatOnInFuture || thawInFuture) && (
          <View style={[es.warnBanner, { backgroundColor: "#EF444420", borderColor: "#EF444460" }]}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={[es.warnText, { color: "#EF4444" }]}>
              {meatOnInFuture ? "Meat-on time cannot be in the future." : "Thaw start cannot be in the future."}
            </Text>
          </View>
        )}

        {!hasError && mayBeAlreadyDone && (
          <View style={[es.warnBanner, { backgroundColor: "#F9731620", borderColor: "#F9731660" }]}>
            <Feather name="alert-triangle" size={14} color="#F97316" />
            <Text style={[es.warnText, { color: "#F97316" }]}>
              Cook may already be done — check your grill.
            </Text>
          </View>
        )}

        {/* Meat on grill field */}
        <View style={[es.fieldCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[es.fieldLabel, { color: colors.mutedForeground }]}>Meat on grill</Text>
          <Text style={[es.fieldValue, { color: meatOnInFuture ? "#EF4444" : colors.foreground }]}>
            {fmtDateTime(meatOnDate)}
          </Text>
          <View style={es.fieldBtns}>
            <Pressable
              onPress={() => setActivePicker("meatOnDate")}
              style={[es.fieldBtn, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}
            >
              <Feather name="calendar" size={13} color={colors.primary} />
              <Text style={[es.fieldBtnText, { color: colors.primary }]}>Date</Text>
            </Pressable>
            <Pressable
              onPress={() => setActivePicker("meatOnTime")}
              style={[es.fieldBtn, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}
            >
              <Feather name="clock" size={13} color={colors.primary} />
              <Text style={[es.fieldBtnText, { color: colors.primary }]}>Time</Text>
            </Pressable>
          </View>
        </View>

        {/* Thaw started field (frozen only) */}
        {fromFrozen && (
          <View style={[es.fieldCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[es.fieldLabel, { color: colors.mutedForeground }]}>Thaw started</Text>
            <Text style={[es.fieldValue, { color: thawInFuture ? "#EF4444" : colors.foreground }]}>
              {fmtDateTime(thawDate)}
            </Text>
            <View style={es.fieldBtns}>
              <Pressable
                onPress={() => setActivePicker("thawDate")}
                style={[es.fieldBtn, { backgroundColor: "#06B6D418", borderRadius: 8 }]}
              >
                <Feather name="calendar" size={13} color="#06B6D4" />
                <Text style={[es.fieldBtnText, { color: "#06B6D4" }]}>Date</Text>
              </Pressable>
              <Pressable
                onPress={() => setActivePicker("thawTime")}
                style={[es.fieldBtn, { backgroundColor: "#06B6D418", borderRadius: 8 }]}
              >
                <Feather name="clock" size={13} color="#06B6D4" />
                <Text style={[es.fieldBtnText, { color: "#06B6D4" }]}>Time</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Save button */}
        <View style={es.btns}>
          <Pressable
            onPress={onClose}
            style={[es.cancelBtn, { borderColor: colors.border }]}
            disabled={saving}
          >
            <Text style={[es.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving || hasError}
            style={[es.saveBtn, (saving || hasError) && { opacity: 0.5 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={es.saveText}>Save Changes</Text>
            )}
          </Pressable>
        </View>

        {/* Inline sub-picker overlay */}
        {activePicker && renderPicker()}
      </AppKeyboardAvoidingView>
    </Modal>
  );
}

const es = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  desc: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 9,
    borderWidth: 1,
  },
  warnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  fieldCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  fieldBtns: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  fieldBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fieldBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  btns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  subPicker: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: 380,
  },
  subPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  subPickerBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subPickerBackLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  subPickerTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  subPickerList: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 8,
  },
  pickerRowText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  pickerRowSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
