import React, { forwardRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

const logoImg = require("@/assets/images/icon-transparent-light.png");

const CARD_SIZE = 1080;

const FALLBACK_VERDICT = "Smoked low and slow with knowyourpit.";

function firstSentence(text: string | null | undefined): string {
  if (!text) return FALLBACK_VERDICT;
  const trimmed = text.trim();
  if (!trimmed) return FALLBACK_VERDICT;
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  const sentence = (match ? match[0] : trimmed).trim();
  if (sentence.length > 180) {
    return sentence.slice(0, 177).trimEnd() + "…";
  }
  return sentence;
}

function fmtCookDuration(c: any): string {
  let mins: number | null = null;
  const start = c?.actualStartAt ? new Date(c.actualStartAt).getTime() : null;
  const end = c?.actualEndAt ? new Date(c.actualEndAt).getTime() : null;
  if (start && end && end > start) {
    mins = Math.round((end - start) / 60000);
  } else if (typeof c?.analysisResult?.cookDurationMinutes === "number") {
    mins = c.analysisResult.cookDurationMinutes;
  }
  if (mins == null || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface Props {
  cook: any;
}

export const CookShareCard = forwardRef<ViewShotRef, Props>(({ cook }, ref) => {
  const tenderness = cook?.ratingTenderness ?? 0;
  const flavor = cook?.ratingFlavor ?? 0;
  const bark = cook?.ratingBark ?? 0;
  const ratings = [tenderness, flavor, bark].filter((v) => v > 0);
  const overall = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : 0;

  const verdict = firstSentence(cook?.analysisResult?.assessment?.summary);
  const duration = fmtCookDuration(cook);
  const meatType = cook?.foodType || "Cook";
  const grillName = cook?.grillName ?? null;

  return (
    <ViewShot
      ref={ref}
      options={{ format: "png", quality: 1, result: "tmpfile", width: CARD_SIZE, height: CARD_SIZE }}
      style={cs.shotWrap}
    >
      <View style={cs.card}>
        <LinearGradient
          colors={["#1C1C1F", "#2D1A0E", "#0E0B08"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={cs.fireAccent} />

        <View style={cs.headerRow}>
          <Image source={logoImg} style={cs.logo} resizeMode="contain" />
          <Text style={cs.brand}>knowyourpit</Text>
        </View>

        <View style={cs.body}>
          <Text style={cs.eyebrow}>COOK COMPLETE</Text>
          <Text style={cs.meat} numberOfLines={2}>{meatType}</Text>
          {grillName ? <Text style={cs.grill} numberOfLines={1}>on {grillName}</Text> : null}

          <View style={cs.statsRow}>
            <View style={cs.statBlock}>
              <Text style={cs.statValue}>{duration}</Text>
              <Text style={cs.statLabel}>COOK TIME</Text>
            </View>
            <View style={cs.statDivider} />
            <View style={cs.statBlock}>
              <Text style={cs.statValue}>{overall > 0 ? overall.toFixed(1) : "—"}<Text style={cs.statValueSmall}>/5</Text></Text>
              <Text style={cs.statLabel}>OVERALL</Text>
            </View>
          </View>

          <View style={cs.ratingsBreakdown}>
            {[
              { label: "Tenderness", val: tenderness },
              { label: "Flavor", val: flavor },
              { label: "Bark", val: bark },
            ].map((r) => (
              <View key={r.label} style={cs.ratingRow}>
                <Text style={cs.ratingLabel}>{r.label}</Text>
                <Text style={cs.ratingStars}>
                  <Text style={cs.starOn}>{"★".repeat(r.val)}</Text>
                  <Text style={cs.starOff}>{"☆".repeat(5 - r.val)}</Text>
                </Text>
              </View>
            ))}
          </View>

          <View style={cs.verdictBox}>
            <Text style={cs.verdictTag}>PITMASTER VERDICT</Text>
            <Text style={cs.verdict}>“{verdict}”</Text>
          </View>
        </View>

        <View style={cs.footer}>
          <Text style={cs.footerLine}>knowyourpit.com</Text>
          <Text style={cs.footerLineMuted}>Get the app · App Store</Text>
        </View>
      </View>
    </ViewShot>
  );
});

CookShareCard.displayName = "CookShareCard";

const cs = StyleSheet.create({
  shotWrap: { width: CARD_SIZE, height: CARD_SIZE },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: "#0E0B08",
    padding: 80,
    overflow: "hidden",
  },
  fireAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: "#E84520",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginTop: 10,
  },
  logo: { width: 96, height: 96 },
  brand: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
    letterSpacing: -1,
  },
  body: { flex: 1, justifyContent: "center", marginTop: 20 },
  eyebrow: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#E84520",
    letterSpacing: 6,
    marginBottom: 18,
  },
  meat: {
    fontSize: 96,
    lineHeight: 104,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
    letterSpacing: -2,
  },
  grill: {
    fontSize: 36,
    fontFamily: "Inter_500Medium",
    color: "#B8A78F",
    marginTop: 10,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 50,
    paddingVertical: 28,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#3A2C1E",
  },
  statBlock: { flex: 1, alignItems: "center" },
  statDivider: { width: 2, height: 80, backgroundColor: "#3A2C1E" },
  statValue: {
    fontSize: 88,
    lineHeight: 96,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
    letterSpacing: -2,
  },
  statValueSmall: {
    fontSize: 44,
    color: "#B8A78F",
    fontFamily: "Inter_500Medium",
  },
  statLabel: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#B8A78F",
    letterSpacing: 4,
    marginTop: 8,
  },
  ratingsBreakdown: { marginTop: 36, gap: 14 },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ratingLabel: {
    fontSize: 28,
    fontFamily: "Inter_500Medium",
    color: "#D8C9AE",
  },
  ratingStars: { fontSize: 36 },
  starOn: { color: "#EAB308" },
  starOff: { color: "#3A2C1E" },
  verdictBox: {
    marginTop: 44,
    padding: 32,
    borderRadius: 24,
    backgroundColor: "rgba(232, 69, 32, 0.10)",
    borderWidth: 2,
    borderColor: "rgba(232, 69, 32, 0.45)",
  },
  verdictTag: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#E84520",
    letterSpacing: 4,
    marginBottom: 12,
  },
  verdict: {
    fontSize: 34,
    lineHeight: 46,
    fontFamily: "Inter_500Medium",
    color: "#F3EDE1",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
  },
  footerLine: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
    letterSpacing: 1,
  },
  footerLineMuted: {
    fontSize: 22,
    fontFamily: "Inter_500Medium",
    color: "#8A7D70",
    letterSpacing: 1,
  },
});
