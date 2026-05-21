import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s, edt } from "./styles";
import { EDIT_TIME_SLOTS } from "./constants";
import { formatEditDate, formatEditTime } from "./utils";
import {
  QP_COOK_METHODS,
  QP_INJECTION_OPTIONS,
  QP_SPRITZ_FREQUENCIES,
  QP_SPRITZ_LIQUIDS,
  QP_WRAP_FINISH_OPTIONS,
} from "@/constants/cookQuickPicks";
import { SettingsRow } from "@/components/plan-screen/SettingsRow";
import { OptionBottomSheet } from "@/components/plan-screen/OptionBottomSheet";

type Insets = { top: number; bottom: number; left: number; right: number };
type Colors = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  insets: Insets;
  saveEdit: () => void;
  editSaving: boolean;
  editFoodType: string;
  setEditFoodType: (v: string) => void;
  editSelectedGrill: any;
  grills: any[];
  setEditGrillPickerVisible: (v: boolean) => void;
  editGrillPickerVisible: boolean;
  editGrillId: number | null;
  setEditGrillId: (id: number | null) => void;
  editWeight: string;
  setEditWeight: (v: string) => void;
  editCookTemp: string;
  setEditCookTemp: (v: string) => void;
  editTargetTemp: string;
  setEditTargetTemp: (v: string) => void;
  editActualStartDate: Date | null;
  setEditActualStartDate: (d: Date | null) => void;
  editActualEndDate: Date | null;
  setEditActualEndDate: (d: Date | null) => void;
  editStartDateOpen: boolean;
  setEditStartDateOpen: (v: boolean) => void;
  editStartTimeOpen: boolean;
  setEditStartTimeOpen: (v: boolean) => void;
  editEndDateOpen: boolean;
  setEditEndDateOpen: (v: boolean) => void;
  editEndTimeOpen: boolean;
  setEditEndTimeOpen: (v: boolean) => void;
  editDates: Date[];
  editNotes: string;
  setEditNotes: (v: string) => void;
  editCookingMethod: string | null;
  setEditCookingMethod: (v: string | null) => void;
  editInjection: string | null;
  setEditInjection: (v: string | null) => void;
  editSpritzFrequency: string | null;
  setEditSpritzFrequency: (v: string | null) => void;
  editSpritzLiquid: string | null;
  setEditSpritzLiquid: (v: string | null) => void;
  editWrapFinish: string | null;
  setEditWrapFinish: (v: string | null) => void;
}

export function EditCookModal(p: Props) {
  const {
    visible, onClose, colors, insets, saveEdit, editSaving,
    editFoodType, setEditFoodType, editSelectedGrill, grills,
    setEditGrillPickerVisible, editGrillPickerVisible, editGrillId, setEditGrillId,
    editWeight, setEditWeight, editCookTemp, setEditCookTemp,
    editTargetTemp, setEditTargetTemp,
    editActualStartDate, setEditActualStartDate,
    editActualEndDate, setEditActualEndDate,
    editStartDateOpen, setEditStartDateOpen,
    editStartTimeOpen, setEditStartTimeOpen,
    editEndDateOpen, setEditEndDateOpen,
    editEndTimeOpen, setEditEndTimeOpen,
    editDates, editNotes, setEditNotes,
    editCookingMethod, setEditCookingMethod,
    editInjection, setEditInjection,
    editSpritzFrequency, setEditSpritzFrequency,
    editSpritzLiquid, setEditSpritzLiquid,
    editWrapFinish, setEditWrapFinish,
  } = p;

  const [cookMethodSheetOpen, setCookMethodSheetOpen] = useState(false);
  const [injectionSheetOpen, setInjectionSheetOpen] = useState(false);
  const [spritzSheetOpen, setSpritzSheetOpen] = useState(false);
  const [spritzLiquidSheetOpen, setSpritzLiquidSheetOpen] = useState(false);
  const [wrapFinishSheetOpen, setWrapFinishSheetOpen] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <LinearGradient colors={["#1C1C1F", "#2D1A0E"]} style={[s.editHeader, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={onClose} style={s.editCancelBtn}>
            <Text style={s.editCancelText}>Cancel</Text>
          </Pressable>
          <Text style={s.editHeaderTitle}>Edit Cook</Text>
          <Pressable onPress={saveEdit} disabled={editSaving} style={s.editSaveBtn}>
            {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.editSaveText}>Save</Text>}
          </Pressable>
        </LinearGradient>
        <View style={[s.editFireBar, { backgroundColor: "#E84820" }]} />

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={s.editFieldWrap}>
            <Text style={[s.editLabel, { color: colors.mutedForeground }]}>What did you cook?</Text>
            <TextInput
              style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              placeholder="e.g. Brisket, Pork Butt, Ribs"
              placeholderTextColor={colors.mutedForeground}
              value={editFoodType}
              onChangeText={setEditFoodType}
            />
          </View>

          <View style={s.editFieldWrap}>
            <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Grill / Smoker</Text>
            <Pressable
              onPress={() => setEditGrillPickerVisible(true)}
              style={[s.editInput, s.editPickerRow, { backgroundColor: colors.card, borderColor: editSelectedGrill ? "#6C3BF5" : colors.border, borderRadius: colors.radius }]}
            >
              {editSelectedGrill ? (
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="check-circle" size={13} color="#6C3BF5" />
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={1}>
                    {editSelectedGrill.name ?? `${editSelectedGrill.brand} ${editSelectedGrill.model ?? ""}`.trim()}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                  {grills.length === 0 ? "No grills in inventory" : "Select your grill…"}
                </Text>
              )}
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={s.editRow2}>
            <View style={[s.editFieldWrap, { flex: 1 }]}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
              <TextInput
                style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="14" placeholderTextColor={colors.mutedForeground}
                value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad"
              />
            </View>
            <View style={[s.editFieldWrap, { flex: 1 }]}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Pit Temp (°F)</Text>
              <TextInput
                style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="225" placeholderTextColor={colors.mutedForeground}
                value={editCookTemp} onChangeText={setEditCookTemp} keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={s.editRow2}>
            <View style={[s.editFieldWrap, { flex: 1 }]}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Internal Target (°F)</Text>
              <TextInput
                style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="203" placeholderTextColor={colors.mutedForeground}
                value={editTargetTemp} onChangeText={setEditTargetTemp} keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={s.editFieldWrap}>
            <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Start Time</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setEditStartDateOpen(true)}
                style={[s.editInput, s.editPickerBtn, { flex: 1, backgroundColor: colors.card, borderColor: editActualStartDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
              >
                <Feather name="calendar" size={13} color={editActualStartDate ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: editActualStartDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                  {editActualStartDate ? formatEditDate(editActualStartDate) : "Pick a date"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!editActualStartDate) setEditActualStartDate(new Date());
                  setEditStartTimeOpen(true);
                }}
                style={[s.editInput, s.editPickerBtn, { backgroundColor: colors.card, borderColor: editActualStartDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
              >
                <Feather name="clock" size={13} color={editActualStartDate ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: editActualStartDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                  {editActualStartDate ? formatEditTime(editActualStartDate.getHours(), editActualStartDate.getMinutes()) : "Time"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={s.editFieldWrap}>
            <Text style={[s.editLabel, { color: colors.mutedForeground }]}>End Time</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setEditEndDateOpen(true)}
                style={[s.editInput, s.editPickerBtn, { flex: 1, backgroundColor: colors.card, borderColor: editActualEndDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
              >
                <Feather name="calendar" size={13} color={editActualEndDate ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: editActualEndDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                  {editActualEndDate ? formatEditDate(editActualEndDate) : "Pick a date"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!editActualEndDate) setEditActualEndDate(new Date());
                  setEditEndTimeOpen(true);
                }}
                style={[s.editInput, s.editPickerBtn, { backgroundColor: colors.card, borderColor: editActualEndDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
              >
                <Feather name="clock" size={13} color={editActualEndDate ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: editActualEndDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                  {editActualEndDate ? formatEditTime(editActualEndDate.getHours(), editActualEndDate.getMinutes()) : "Time"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={s.editFieldWrap}>
            <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Techniques</Text>
            <View style={[ecm.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <SettingsRow
                label="Cooking Method"
                value={editCookingMethod}
                placeholder="Not set"
                icon="thermometer"
                iconColor="#E84820"
                onPress={() => setCookMethodSheetOpen(true)}
                onClear={() => setEditCookingMethod(null)}
                colors={colors}
              />
              <SettingsRow
                label="Injection"
                value={editInjection}
                placeholder="Not set"
                icon="droplet"
                iconColor="#6C3BF5"
                onPress={() => setInjectionSheetOpen(true)}
                onClear={() => setEditInjection(null)}
                colors={colors}
              />
              <SettingsRow
                label="Spritz Frequency"
                value={editSpritzFrequency}
                placeholder="Not set"
                icon="wind"
                iconColor="#0EA5E9"
                onPress={() => setSpritzSheetOpen(true)}
                onClear={() => setEditSpritzFrequency(null)}
                colors={colors}
              />
              <SettingsRow
                label="Spritz Liquid"
                value={editSpritzLiquid}
                placeholder="Not set"
                icon="droplet"
                iconColor="#22C55E"
                onPress={() => setSpritzLiquidSheetOpen(true)}
                onClear={() => setEditSpritzLiquid(null)}
                colors={colors}
              />
              <SettingsRow
                label="Wrap / Finish"
                value={editWrapFinish}
                placeholder="Not set"
                icon="package"
                iconColor="#F59E0B"
                onPress={() => setWrapFinishSheetOpen(true)}
                onClear={() => setEditWrapFinish(null)}
                colors={colors}
                isLast
              />
            </View>
          </View>

          <View style={s.editFieldWrap}>
            <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Cook Notes</Text>
            <TextInput
              style={[s.editTextArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              placeholder="Anything worth remembering — wood type, rubs, what you'd do differently…"
              placeholderTextColor={colors.mutedForeground}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <OptionBottomSheet
        visible={cookMethodSheetOpen}
        title="Cooking Method"
        options={QP_COOK_METHODS}
        selected={editCookingMethod}
        onChange={setEditCookingMethod}
        onClose={() => setCookMethodSheetOpen(false)}
        colors={colors}
      />

      <OptionBottomSheet
        visible={injectionSheetOpen}
        title="Injection"
        options={QP_INJECTION_OPTIONS}
        selected={editInjection}
        onChange={setEditInjection}
        onClose={() => setInjectionSheetOpen(false)}
        colors={colors}
      />

      <OptionBottomSheet
        visible={spritzSheetOpen}
        title="Spritz Frequency"
        options={QP_SPRITZ_FREQUENCIES}
        selected={editSpritzFrequency}
        onChange={setEditSpritzFrequency}
        onClose={() => setSpritzSheetOpen(false)}
        colors={colors}
      />

      <OptionBottomSheet
        visible={spritzLiquidSheetOpen}
        title="Spritz Liquid"
        options={QP_SPRITZ_LIQUIDS}
        selected={editSpritzLiquid}
        onChange={setEditSpritzLiquid}
        onClose={() => setSpritzLiquidSheetOpen(false)}
        colors={colors}
      />

      <OptionBottomSheet
        visible={wrapFinishSheetOpen}
        title="Wrap / Finish"
        options={QP_WRAP_FINISH_OPTIONS}
        selected={editWrapFinish}
        onChange={setEditWrapFinish}
        onClose={() => setWrapFinishSheetOpen(false)}
        colors={colors}
      />

      <Modal visible={editStartDateOpen} animationType="slide" transparent onRequestClose={() => setEditStartDateOpen(false)}>
        <View style={edt.overlay}>
          <View style={[edt.sheet, { backgroundColor: colors.card }]}>
            <View style={[edt.handle, { backgroundColor: colors.border }]} />
            <View style={[edt.header, { borderBottomColor: colors.border }]}>
              <Text style={[edt.title, { color: colors.foreground }]}>Start Date</Text>
              <Pressable onPress={() => setEditStartDateOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {editDates.map((d) => {
                const sel = editActualStartDate && d.getDate() === editActualStartDate.getDate() && d.getMonth() === editActualStartDate.getMonth() && d.getFullYear() === editActualStartDate.getFullYear();
                return (
                  <Pressable key={d.toISOString()} onPress={() => { const n = editActualStartDate ? new Date(editActualStartDate) : new Date(); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setEditActualStartDate(n); setEditStartDateOpen(false); }}
                    style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                    <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditDate(d)}</Text>
                    <Text style={[edt.rowSub, { color: colors.mutedForeground }]}>{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Text>
                    {sel && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={editStartTimeOpen} animationType="slide" transparent onRequestClose={() => setEditStartTimeOpen(false)}>
        <View style={edt.overlay}>
          <View style={[edt.sheet, { backgroundColor: colors.card }]}>
            <View style={[edt.handle, { backgroundColor: colors.border }]} />
            <View style={[edt.header, { borderBottomColor: colors.border }]}>
              <Text style={[edt.title, { color: colors.foreground }]}>Start Time</Text>
              <Pressable onPress={() => setEditStartTimeOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {EDIT_TIME_SLOTS.map(({ h, m }) => {
                const sel = editActualStartDate && editActualStartDate.getHours() === h && editActualStartDate.getMinutes() === m;
                return (
                  <Pressable key={`s${h}:${m}`} onPress={() => { const n = editActualStartDate ? new Date(editActualStartDate) : new Date(); n.setHours(h, m, 0, 0); setEditActualStartDate(n); setEditStartTimeOpen(false); }}
                    style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                    <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditTime(h, m)}</Text>
                    {sel && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={editEndDateOpen} animationType="slide" transparent onRequestClose={() => setEditEndDateOpen(false)}>
        <View style={edt.overlay}>
          <View style={[edt.sheet, { backgroundColor: colors.card }]}>
            <View style={[edt.handle, { backgroundColor: colors.border }]} />
            <View style={[edt.header, { borderBottomColor: colors.border }]}>
              <Text style={[edt.title, { color: colors.foreground }]}>End Date</Text>
              <Pressable onPress={() => setEditEndDateOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {editDates.map((d) => {
                const sel = editActualEndDate && d.getDate() === editActualEndDate.getDate() && d.getMonth() === editActualEndDate.getMonth() && d.getFullYear() === editActualEndDate.getFullYear();
                return (
                  <Pressable key={d.toISOString()} onPress={() => { const n = editActualEndDate ? new Date(editActualEndDate) : new Date(); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setEditActualEndDate(n); setEditEndDateOpen(false); }}
                    style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                    <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditDate(d)}</Text>
                    <Text style={[edt.rowSub, { color: colors.mutedForeground }]}>{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Text>
                    {sel && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={editEndTimeOpen} animationType="slide" transparent onRequestClose={() => setEditEndTimeOpen(false)}>
        <View style={edt.overlay}>
          <View style={[edt.sheet, { backgroundColor: colors.card }]}>
            <View style={[edt.handle, { backgroundColor: colors.border }]} />
            <View style={[edt.header, { borderBottomColor: colors.border }]}>
              <Text style={[edt.title, { color: colors.foreground }]}>End Time</Text>
              <Pressable onPress={() => setEditEndTimeOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {EDIT_TIME_SLOTS.map(({ h, m }) => {
                const sel = editActualEndDate && editActualEndDate.getHours() === h && editActualEndDate.getMinutes() === m;
                return (
                  <Pressable key={`e${h}:${m}`} onPress={() => { const n = editActualEndDate ? new Date(editActualEndDate) : new Date(); n.setHours(h, m, 0, 0); setEditActualEndDate(n); setEditEndTimeOpen(false); }}
                    style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                    <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditTime(h, m)}</Text>
                    {sel && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={editGrillPickerVisible} transparent animationType="slide" onRequestClose={() => setEditGrillPickerVisible(false)}>
        <Pressable style={s.grillOverlay} onPress={() => setEditGrillPickerVisible(false)} />
        <View style={[s.grillSheet, { backgroundColor: colors.card }]}>
          <View style={[s.grillSheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[s.grillSheetTitle, { color: colors.foreground }]}>Select Grill</Text>
          {editGrillId != null && (
            <TouchableOpacity onPress={() => { setEditGrillId(null); setEditGrillPickerVisible(false); }} style={[s.grillItem, { borderBottomColor: colors.border }]}>
              <Text style={[s.grillItemText, { color: colors.destructive }]}>Clear selection</Text>
            </TouchableOpacity>
          )}
          {grills.length === 0 ? (
            <Text style={[s.grillEmpty, { color: colors.mutedForeground }]}>No grills in your inventory yet.</Text>
          ) : (
            <FlatList
              data={grills}
              keyExtractor={(g: any) => String(g.id)}
              renderItem={({ item: g }: { item: any }) => (
                <TouchableOpacity
                  onPress={() => { setEditGrillId(g.id); setEditGrillPickerVisible(false); }}
                  style={[s.grillItem, { borderBottomColor: colors.border }, editGrillId === g.id && { backgroundColor: "#6C3BF5" + "12" }]}
                >
                  <Text style={[s.grillItemText, { color: colors.foreground }]}>
                    {g.name ?? `${g.brand ?? ""} ${g.model ?? ""}`.trim()}
                  </Text>
                  {g.brand && <Text style={[s.grillItemSub, { color: colors.mutedForeground }]}>{g.brand}</Text>}
                  {editGrillId === g.id && <Feather name="check" size={16} color="#6C3BF5" style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </Modal>
  );
}

const ecm = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 12,
  },
});
