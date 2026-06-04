import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Colors = any;

interface Props {
  visible: boolean;
  colors: Colors;
  saving: boolean;
  onSave: (tenderness: number, flavor: number, bark: number) => Promise<void>;
  onSkip: () => void;
}

const ROWS = [
  { label: "Tenderness", icon: "droplet" as const, key: "tenderness" as const },
  { label: "Flavor",     icon: "heart"   as const, key: "flavor"     as const },
  { label: "Bark/Color", icon: "layers"  as const, key: "bark"       as const },
];

export function RateCookSheet({ visible, colors, saving, onSave, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const [tenderness, setTenderness] = useState(0);
  const [flavor, setFlavor] = useState(0);
  const [bark, setBark] = useState(0);

  const setters = { tenderness: setTenderness, flavor: setFlavor, bark: setBark };
  const values  = { tenderness, flavor, bark };

  const handleSave = async () => {
    await onSave(tenderness, flavor, bark);
  };

  const rated = tenderness > 0 || flavor > 0 || bark > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: "#eab308" }]}>
              <Feather name="star" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                How did it turn out?
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                Your rating helps tune your PitMaster Score
              </Text>
            </View>
          </View>

          {/* Star rows */}
          {ROWS.map((row) => (
            <View key={row.key} style={[styles.rateRow, { borderTopColor: colors.border }]}>
              <View style={styles.rateLeft}>
                <Feather name={row.icon} size={14} color={colors.mutedForeground} />
                <Text style={[styles.rateLabel, { color: colors.foreground }]}>{row.label}</Text>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => {
                      const current = values[row.key];
                      setters[row.key](star === current ? 0 : star);
                    }}
                    hitSlop={8}
                    disabled={saving}
                  >
                    <Text style={[styles.star, {
                      color: star <= values[row.key] ? "#eab308" : colors.border,
                      opacity: saving ? 0.5 : 1,
                    }]}>
                      {star <= values[row.key] ? "★" : "☆"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.saveBtn,
                { backgroundColor: rated ? "#eab308" : colors.muted, opacity: saving ? 0.7 : 1 },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{rated ? "Save Rating" : "Save (unrated)"}</Text>
              }
            </Pressable>
            <Pressable style={styles.skipBtn} onPress={onSkip} disabled={saving}>
              <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
    opacity: 0.35,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  rateLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rateLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
  },
  star: {
    fontSize: 26,
  },
  actions: {
    marginTop: 8,
    gap: 8,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  skipBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
