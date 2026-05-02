import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { planStyles as s } from "./styles";
import { formatDate, formatTime, TIME_SLOTS } from "./utils";

type Colors = any;

interface DateProps {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  serveAt: Date;
  setServeAt: (d: Date) => void;
  upcomingDates: Date[];
}

export function DatePickerModal(p: DateProps) {
  const { visible, onClose, colors, serveAt, setServeAt, upcomingDates } = p;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <View style={[s.modalSheetSm, { backgroundColor: colors.card }]}>
          <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Pick a Date</Text>
            <Pressable onPress={onClose} hitSlop={10}>
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
                    onClose();
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
  );
}

interface TimeProps {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  serveAt: Date;
  setServeAt: (d: Date) => void;
}

export function TimePickerModal(p: TimeProps) {
  const { visible, onClose, colors, serveAt, setServeAt } = p;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.modalOverlay}>
        <View style={[s.modalSheetSm, { backgroundColor: colors.card }]}>
          <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Pick a Time</Text>
            <Pressable onPress={onClose} hitSlop={10}>
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
                    onClose();
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
  );
}
