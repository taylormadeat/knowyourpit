import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { isProduce, type MeatCut, type SizeMode } from "@/constants/meatCuts";

export type { SizeMode };

export interface SizeInputRowOutput {
  effectiveWeightLbs: number | null;
  sizingLabel: string | null;
  isEstimated: boolean;
  pieceCount: number | null;
  mode: SizeMode | "skip";
}

interface Props {
  cut: MeatCut | null;
  colors: any;
  onChange: (out: SizeInputRowOutput) => void;
  detectedWeightLbs?: number | null;
  onClearAiOverride?: () => void;
}

type DisplayMode = SizeMode | "skip";

function getAvailableModes(cut: MeatCut | null): DisplayMode[] {
  if (!cut) return ["weight", "skip"];
  if (cut.defaultSizeMode === "racks") return ["racks", "weight", "skip"];
  if (cut.isIndividualCook) return ["count", "weight", "skip"];
  return ["weight", "count", "skip"];
}

function getDefaultMode(cut: MeatCut | null): DisplayMode {
  if (!cut) return "weight";
  return cut.defaultSizeMode ?? "weight";
}

function getPieceUnit(cut: MeatCut): string {
  const n = cut.name.toLowerCase();
  // ── Vegetables ────────────────────────────────────────────────────
  if (n.includes("corn") || n.includes("cob")) return "ears";
  if (n.includes("bell pepper")) return "peppers";
  if (n.includes("portobello") || n.includes("mushroom")) return "mushrooms";
  if (n.includes("sweet potato")) return "sweet potatoes";
  if (n.includes("zucchini") || n.includes("squash")) return "zucchini";
  if (n.includes("onion")) return "onions";
  if (n.includes("eggplant")) return "eggplants";
  if (n.includes("jalapeño") || n.includes("jalapeno") || n.includes("stuffed")) return "peppers";
  if (n.includes("beet")) return "beets";
  if (n.includes("romaine") || n.includes("lettuce")) return "heads";
  if (n.includes("tomato")) return "tomatoes";
  if (n.includes("potato")) return "potatoes";
  // ── Fruit ─────────────────────────────────────────────────────────
  if (n.includes("peach")) return "peaches";
  if (n.includes("pineapple ring")) return "rings";
  if (n.includes("pineapple") && n.includes("spear")) return "spears";
  if (n.includes("watermelon")) return "wedges";
  if (n.includes("mango")) return "mangoes";
  if (n.includes("avocado")) return "avocados";
  if (n.includes("banana")) return "bananas";
  if (n.includes("plantain")) return "plantains";
  if (n.includes("fig")) return "figs";
  if (n.includes("pear")) return "pears";
  if (n.includes("citrus")) return "halves";
  if (n.includes("strawberr") || n.includes("stone fruit")) return "skewers";
  // ── Meat / Poultry / Seafood ───────────────────────────────────────
  if (n.includes("wing")) return "wings";
  if (n.includes("thigh")) return "thighs";
  if (n.includes("drumstick")) return "drumsticks";
  if (n.includes("leg quarter")) return "quarters";
  if (n.includes("breast")) return "breasts";
  if (n.includes("bratwurst") || n.includes("brat")) return "brats";
  if (n.includes("hot link")) return "links";
  if (n.includes("sausage") || n.includes("andouille") || n.includes("merguez")) return "links";
  if (n.includes("smashburger") || n.includes("burger") || n.includes("patties")) return "patties";
  if (n.includes("chop")) return "chops";
  if (n.includes("steak")) return "steaks";
  if (n.includes("fillet") || n.includes("filet")) return "fillets";
  if (n.includes("shrimp")) return "shrimp";
  if (n.includes("scallop")) return "scallops";
  if (n.includes("oyster")) return "oysters";
  if (n.includes("hen")) return "hens";
  if (n.includes("quail")) return "birds";
  if (n.includes("cheek")) return "cheeks";
  if (n.includes("shank")) return "shanks";
  if (n.includes("lobster")) return "lobsters";
  if (n.includes("tail")) return "tails";
  return "pieces";
}

function computeOutput(
  m: DisplayMode,
  weightInput: string,
  countInput: string,
  cut: MeatCut | null,
): SizeInputRowOutput {
  if (m === "weight") {
    const w = parseFloat(weightInput);
    const valid = !isNaN(w) && w > 0;
    return {
      mode: m,
      effectiveWeightLbs: valid ? w : null,
      sizingLabel: valid ? `${w} lbs` : null,
      isEstimated: false,
      pieceCount: null,
    };
  }

  if (m === "count" && cut) {
    const count = parseInt(countInput, 10);
    const valid = !isNaN(count) && count > 0;
    const totalLbs = (valid && cut.avgPieceWeightLbs != null) ? Math.round(count * cut.avgPieceWeightLbs * 10) / 10 : null;
    const unit = getPieceUnit(cut);
    const sizingLabel = valid
      ? `${count} ${unit} · ≈ ${totalLbs!.toFixed(1)} lbs est.`
      : null;
    return {
      mode: m,
      effectiveWeightLbs: totalLbs,
      sizingLabel,
      isEstimated: totalLbs != null,
      pieceCount: valid ? count : null,
    };
  }

  if (m === "racks" && cut && cut.avgRackWeightLbs) {
    const count = parseInt(countInput, 10);
    const valid = !isNaN(count) && count > 0;
    const totalLbs = valid ? Math.round(count * cut.avgRackWeightLbs * 10) / 10 : null;
    const sizingLabel = valid
      ? `${count} rack${count !== 1 ? "s" : ""} · ≈ ${totalLbs!.toFixed(1)} lbs est.`
      : null;
    return {
      mode: m,
      effectiveWeightLbs: totalLbs,
      sizingLabel,
      isEstimated: totalLbs != null,
      pieceCount: valid ? count : null,
    };
  }

  const fallbackWeight = cut?.avgPieceWeightLbs ?? null;
  return {
    mode: "skip",
    effectiveWeightLbs: fallbackWeight,
    sizingLabel: fallbackWeight != null ? `≈ ${fallbackWeight} lbs (typical estimate)` : null,
    isEstimated: fallbackWeight != null,
    pieceCount: null,
  };
}

export function SizeInputRow({ cut, colors, onChange, detectedWeightLbs, onClearAiOverride }: Props) {
  const [mode, setMode] = useState<DisplayMode>(getDefaultMode(cut));
  const [weightInput, setWeightInput] = useState("");
  const [countInput, setCountInput] = useState("");

  const cutName = cut?.name;

  useEffect(() => {
    const newMode = getDefaultMode(cut);
    setMode(newMode);
    setWeightInput("");
    setCountInput("");
  }, [cutName]);

  useEffect(() => {
    if (detectedWeightLbs != null) {
      setMode("weight");
      setWeightInput(String(detectedWeightLbs));
    }
  }, [detectedWeightLbs]);

  const emitChange = useCallback(
    (m: DisplayMode, wi: string, ci: string) => {
      onChange(computeOutput(m, wi, ci, cut));
    },
    [cut, onChange],
  );

  useEffect(() => {
    emitChange(mode, weightInput, countInput);
  }, [mode, weightInput, countInput, cutName, emitChange]);

  const availableModes = getAvailableModes(cut);
  const modeLabelMap: Record<DisplayMode, string> = {
    weight: "Weight",
    count: "Count",
    racks: "Racks",
    skip: "Skip",
  };

  const handleModeChange = (m: DisplayMode) => {
    setMode(m);
    onClearAiOverride?.();
  };

  const out = computeOutput(mode, weightInput, countInput, cut);
  const pieceUnit = cut ? getPieceUnit(cut) : "pieces";
  const rackWeight = cut?.avgRackWeightLbs;
  const radius = typeof colors.radius === "number" ? colors.radius : 8;
  const innerRadius = Math.max(0, radius - 3);

  return (
    <View>
      <View
        style={[
          styles.tabRow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: radius,
          },
        ]}
      >
        {availableModes.map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => handleModeChange(m)}
            activeOpacity={0.75}
            style={[
              styles.tab,
              mode === m && { backgroundColor: colors.primary },
              { borderRadius: innerRadius },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: mode === m ? "#fff" : colors.mutedForeground },
              ]}
            >
              {modeLabelMap[m]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === "weight" && (
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius,
              marginTop: 8,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="e.g. 12.5"
            placeholderTextColor={colors.mutedForeground}
            value={weightInput}
            onChangeText={(v) => {
              setWeightInput(v);
              onClearAiOverride?.();
            }}
            keyboardType="decimal-pad"
          />
          <Text style={[styles.unit, { color: colors.mutedForeground }]}>lbs</Text>
        </View>
      )}

      {mode === "count" && (
        <View style={{ marginTop: 8 }}>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius,
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder={`How many ${pieceUnit}?`}
              placeholderTextColor={colors.mutedForeground}
              value={countInput}
              onChangeText={(v) => {
                setCountInput(v);
                onClearAiOverride?.();
              }}
              keyboardType="number-pad"
            />
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>{pieceUnit}</Text>
          </View>
          {out.isEstimated && cut && (
            <View style={{ marginTop: 6 }}>
              <Text style={[styles.estimateText, { color: colors.mutedForeground }]}>
                {isProduce(cut.category)
                  ? `${countInput} × ≈ ${cut.avgPieceWeightLbs} lbs each · ≈ ${out.effectiveWeightLbs?.toFixed(1)} lbs total — estimate only`
                  : `≈ ${out.effectiveWeightLbs?.toFixed(1)} lbs total (${countInput} × ${cut.avgPieceWeightLbs} lbs avg) — estimate only`}
              </Text>
              {cut.isIndividualCook && !isProduce(cut.category) && (
                <Text style={[styles.estimateText, { color: colors.mutedForeground, marginTop: 2, fontStyle: "italic" }]}>
                  Cook time is based on individual piece size, not total quantity.
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {mode === "racks" && rackWeight != null && (
        <View style={{ marginTop: 8 }}>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius,
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="How many racks?"
              placeholderTextColor={colors.mutedForeground}
              value={countInput}
              onChangeText={(v) => {
                setCountInput(v);
                onClearAiOverride?.();
              }}
              keyboardType="number-pad"
            />
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>racks</Text>
          </View>
          {out.isEstimated && (
            <Text style={[styles.estimateText, { color: colors.mutedForeground, marginTop: 6 }]}>
              ≈ {out.effectiveWeightLbs?.toFixed(1)} lbs total ({countInput} × {rackWeight} lbs avg) — estimate only
            </Text>
          )}
        </View>
      )}

      {mode === "skip" && (
        <Text style={[styles.skipNote, { color: colors.mutedForeground, marginTop: 8 }]}>
          {cut && isProduce(cut.category)
            ? "Using a typical size estimate — entering count improves accuracy."
            : "Using a typical size estimate — entering weight improves accuracy."}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    borderWidth: 1,
    overflow: "hidden",
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  inputWrap: {
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  unit: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginLeft: 4,
  },
  estimateText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  skipNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
});
