import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import Svg, { Polyline, Polygon, Circle, Line, Text as SvgText } from "react-native-svg";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { useListCooks, type Cook } from "@workspace/api-client-react";
import { LogoBackground } from "@/components/LogoBackground";
import {
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABEL,
  COMPETITION_CATEGORY_COLOR,
  COMPETITION_SCORING,
  placementLabel,
  computePercentile,
  type CompetitionCategory,
} from "@/constants/competitionKnowledge";

interface CategoryStats {
  category: CompetitionCategory;
  totalCooks: number;
  bestPlacement: number | null;
  bestPlacementTeamCount: number | null;
  avgAppearance: number | null;
  avgTaste: number | null;
  avgTexture: number | null;
  avgTotal: number | null;
  recentScores: { appearance: number | null; taste: number | null; texture: number | null; total: number | null; competitionName: string | null; date: string }[];
}

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n != null);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function computeSubScoreTotal(appearance: number | null, taste: number | null, texture: number | null): number | null {
  if (appearance == null && taste == null && texture == null) return null;
  return (appearance ?? 0) + (taste ?? 0) + (texture ?? 0);
}

export default function CompetitionCareerScreen() {
  const colors = useColors();
  const { isTablet, contentMaxWidth } = useLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: allCooks, isLoading } = useListCooks();

  const competitionCooks = useMemo(() => {
    if (!allCooks) return [];
    return allCooks.filter((c) => c.isCompetition === true && c.status === "completed");
  }, [allCooks]);

  const totalCompetitions = useMemo(() => {
    const compNames = new Set<string>();
    for (const c of competitionCooks) {
      const key = c.competitionName
        ? `${c.competitionName}::${new Date(c.createdAt).toDateString()}`
        : `anon::${new Date(c.createdAt).toDateString()}`;
      compNames.add(key);
    }
    return compNames.size;
  }, [competitionCooks]);

  const top3Rate = useMemo(() => {
    const placed = competitionCooks.filter((c) => c.competitionPlacement != null && c.competitionPlacement > 0);
    if (!placed.length) return null;
    const top3 = placed.filter((c) => (c.competitionPlacement ?? Infinity) <= 3);
    return Math.round((top3.length / placed.length) * 100);
  }, [competitionCooks]);

  const categoryStats = useMemo((): CategoryStats[] => {
    return COMPETITION_CATEGORIES.map((cat) => {
      const catCooks = competitionCooks.filter((c) => c.competitionCategory === cat);
      if (!catCooks.length) return { category: cat, totalCooks: 0, bestPlacement: null, bestPlacementTeamCount: null, avgAppearance: null, avgTaste: null, avgTexture: null, avgTotal: null, recentScores: [] };

      const placements = catCooks.map((c) => c.competitionPlacement).filter((p): p is number => p != null && p > 0);
      const bestPlacement = placements.length ? Math.min(...placements) : null;
      // For the best-placement entry, grab the team count from the same cook
      const bestCook = bestPlacement != null
        ? catCooks.find((c) => c.competitionPlacement === bestPlacement)
        : null;
      const bestPlacementTeamCount: number | null = bestCook?.competitionTeamCount ?? null;

      const scores = catCooks.map((c) => {
        const appearance = c.judgeScoreAppearance ?? null;
        const taste = c.judgeScoreTaste ?? null;
        const texture = c.judgeScoreTexture ?? null;
        const total = (appearance != null || taste != null || texture != null)
          ? computeSubScoreTotal(appearance, taste, texture)
          : c.judgeScore ?? null;
        return { appearance, taste, texture, total, competitionName: c.competitionName, date: c.createdAt };
      });

      const recent10 = [...scores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

      return {
        category: cat,
        totalCooks: catCooks.length,
        bestPlacement,
        bestPlacementTeamCount,
        avgAppearance: avg(scores.map((s) => s.appearance)),
        avgTaste: avg(scores.map((s) => s.taste)),
        avgTexture: avg(scores.map((s) => s.texture)),
        avgTotal: avg(scores.map((s) => s.total)),
        recentScores: recent10,
      };
    });
  }, [competitionCooks]);

  const radarData = useMemo(() => {
    return COMPETITION_CATEGORIES.map((cat) => {
      const stats = categoryStats.find((s) => s.category === cat);
      const maxAppearance = COMPETITION_SCORING.maxAppearance;
      const maxTaste = COMPETITION_SCORING.maxTaste;
      const maxTexture = COMPETITION_SCORING.maxTexture;
      const maxTotal = COMPETITION_SCORING.maxScore;
      return {
        category: cat,
        appearancePct: stats?.avgAppearance != null ? (stats.avgAppearance / maxAppearance) * 100 : null,
        tastePct: stats?.avgTaste != null ? (stats.avgTaste / maxTaste) * 100 : null,
        texturePct: stats?.avgTexture != null ? (stats.avgTexture / maxTexture) * 100 : null,
        totalPct: stats?.avgTotal != null ? (stats.avgTotal / maxTotal) * 100 : null,
      };
    });
  }, [categoryStats]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/more" as any);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} style={s.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.headerCenter}>
          <LinearGradient colors={["#EAB308", "#F59E0B"]} style={s.headerBadge}>
            <Feather name="award" size={12} color="#fff" />
          </LinearGradient>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Competition Career</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <View style={isTablet ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" } : null}>

            {competitionCooks.length === 0 ? (
              <View style={s.empty}>
                <Feather name="award" size={48} color={colors.mutedForeground} />
                <Text style={[s.emptyTitle, { color: colors.foreground }]}>No competition data yet</Text>
                <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                  Log results after your first competition to start building your career stats.
                </Text>
              </View>
            ) : (
              <>
                <View style={s.summaryRow}>
                  <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <Text style={[s.statNum, { color: "#EAB308" }]}>{totalCompetitions}</Text>
                    <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Competitions</Text>
                  </View>
                  <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <Text style={[s.statNum, { color: top3Rate != null && top3Rate >= 25 ? "#22c55e" : colors.foreground }]}>
                      {top3Rate != null ? `${top3Rate}%` : "—"}
                    </Text>
                    <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Top-3 Rate</Text>
                  </View>
                  <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <Text style={[s.statNum, { color: colors.foreground }]}>{competitionCooks.length}</Text>
                    <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Total Entries</Text>
                  </View>
                </View>

                <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>BY CATEGORY</Text>
                {categoryStats.map((stats) => {
                  if (stats.totalCooks === 0) return null;
                  const catColor = COMPETITION_CATEGORY_COLOR[stats.category];
                  const scoreBarWidth = stats.avgTotal != null ? (stats.avgTotal / COMPETITION_SCORING.maxScore) : 0;
                  return (
                    <View key={stats.category} style={[s.catCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                      <View style={s.catCardHeader}>
                        <View style={[s.catDot, { backgroundColor: catColor }]} />
                        <Text style={[s.catName, { color: colors.foreground }]}>
                          {COMPETITION_CATEGORY_LABEL[stats.category]}
                        </Text>
                        <Text style={[s.catCount, { color: colors.mutedForeground }]}>
                          {stats.totalCooks} entr{stats.totalCooks === 1 ? "y" : "ies"}
                        </Text>
                        {stats.bestPlacement != null && (
                          <View style={[s.placementPill, { backgroundColor: catColor + "22", borderColor: catColor }]}>
                            <Text style={[s.placementPillText, { color: catColor }]}>
                              Best: {placementLabel(stats.bestPlacement)}
                            </Text>
                          </View>
                        )}
                        {stats.bestPlacement != null && stats.bestPlacementTeamCount != null && (() => {
                          const pct = computePercentile(stats.bestPlacement, stats.bestPlacementTeamCount);
                          return pct ? (
                            <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: "#EAB30820", borderWidth: 1, borderColor: "#EAB308" }}>
                              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: "#EAB308" }}>{pct}</Text>
                            </View>
                          ) : null;
                        })()}
                      </View>

                      {stats.avgTotal != null && (
                        <View style={{ marginBottom: 10 }}>
                          <View style={s.scoreRow}>
                            <Text style={[s.scoreLabel, { color: colors.mutedForeground }]}>Avg Total</Text>
                            <Text style={[s.scoreValue, { color: colors.foreground }]}>
                              {stats.avgTotal.toFixed(1)}<Text style={{ color: colors.mutedForeground }}>/360</Text>
                            </Text>
                          </View>
                          <View style={[s.barTrack, { backgroundColor: colors.border }]}>
                            <View style={[s.barFill, { width: `${scoreBarWidth * 100}%` as unknown as number, backgroundColor: catColor }]} />
                          </View>
                        </View>
                      )}

                      {(stats.avgAppearance != null || stats.avgTaste != null || stats.avgTexture != null) && (
                        <View style={s.subScoreRow}>
                          {stats.avgAppearance != null && (
                            <View style={s.subScoreItem}>
                              <Text style={[s.subScoreLabel, { color: colors.mutedForeground }]}>Appearance</Text>
                              <Text style={[s.subScoreValue, { color: colors.foreground }]}>
                                {stats.avgAppearance.toFixed(1)}<Text style={{ color: colors.mutedForeground, fontSize: 10 }}>/60</Text>
                              </Text>
                            </View>
                          )}
                          {stats.avgTaste != null && (
                            <View style={s.subScoreItem}>
                              <Text style={[s.subScoreLabel, { color: colors.mutedForeground }]}>Taste</Text>
                              <Text style={[s.subScoreValue, { color: colors.foreground }]}>
                                {stats.avgTaste.toFixed(1)}<Text style={{ color: colors.mutedForeground, fontSize: 10 }}>/150</Text>
                              </Text>
                            </View>
                          )}
                          {stats.avgTexture != null && (
                            <View style={s.subScoreItem}>
                              <Text style={[s.subScoreLabel, { color: colors.mutedForeground }]}>Texture</Text>
                              <Text style={[s.subScoreValue, { color: colors.foreground }]}>
                                {stats.avgTexture.toFixed(1)}<Text style={{ color: colors.mutedForeground, fontSize: 10 }}>/150</Text>
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {stats.recentScores.length > 1 && stats.recentScores.some((r) => r.total != null) && (
                        <View style={[s.trendSection, { borderTopColor: colors.border }]}>
                          <Text style={[s.trendTitle, { color: colors.mutedForeground }]}>SCORE TREND (last {Math.min(stats.recentScores.length, 10)} competitions)</Text>
                          {(() => {
                            const chartW = 280; const chartH = 60;
                            const pts = stats.recentScores.slice(0, 10).reverse();
                            const validPts = pts.filter((p) => p.total != null);
                            if (validPts.length < 2) return null;
                            const minVal = Math.min(...validPts.map((p) => p.total!));
                            const maxVal = Math.max(...validPts.map((p) => p.total!));
                            const range = Math.max(maxVal - minVal, 1);
                            const xStep = chartW / (pts.length - 1);
                            let prevX: number | null = null; let prevY: number | null = null;
                            const circles: { x: number; y: number; total: number }[] = [];
                            const lineSegments: string[] = [];
                            pts.forEach((p, i) => {
                              if (p.total == null) return;
                              const x = Math.round(i * xStep);
                              const y = Math.round(chartH - ((p.total - minVal) / range) * (chartH - 8) - 4);
                              circles.push({ x, y, total: p.total });
                              if (prevX !== null && prevY !== null) lineSegments.push(`${prevX},${prevY} ${x},${y}`);
                              prevX = x; prevY = y;
                            });
                            return (
                              <Svg width={chartW} height={chartH + 10}>
                                {lineSegments.map((pts, idx) => (
                                  <Polyline key={idx} points={pts} fill="none" stroke={catColor} strokeWidth="2" strokeLinecap="round" />
                                ))}
                                {circles.map((c, idx) => (
                                  <Circle key={idx} cx={c.x} cy={c.y} r={3} fill={catColor} stroke={catColor} />
                                ))}
                                {[minVal, maxVal].map((val, idx) => (
                                  <SvgText key={idx} x={chartW - 2} y={idx === 0 ? chartH - 2 : 10} fontSize={8} fill={colors.mutedForeground} textAnchor="end">{val.toFixed(0)}</SvgText>
                                ))}
                              </Svg>
                            );
                          })()}
                        </View>
                      )}
                    </View>
                  );
                })}

                <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>SCORING SPIDER — Sub-score Averages</Text>
                <View style={[s.radarCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  {(() => {
                    // Spider axes: Appearance%, Taste%, Texture% — per KCBS category (only show categories with sub-score data)
                    const axes = [
                      { label: "App", pct: (cat: CompetitionCategory) => radarData.find((r) => r.category === cat)?.appearancePct ?? null },
                      { label: "Taste", pct: (cat: CompetitionCategory) => radarData.find((r) => r.category === cat)?.tastePct ?? null },
                      { label: "Texture", pct: (cat: CompetitionCategory) => radarData.find((r) => r.category === cat)?.texturePct ?? null },
                    ];
                    const catsWithData = COMPETITION_CATEGORIES.filter((cat) => {
                      const r = radarData.find((x) => x.category === cat);
                      return r && (r.appearancePct != null || r.tastePct != null || r.texturePct != null);
                    });
                    if (catsWithData.length === 0) {
                      const fallbackCats = COMPETITION_CATEGORIES.filter((cat) => radarData.find((x) => x.category === cat)?.totalPct != null);
                      if (fallbackCats.length === 0) return <Text style={[s.radarBarLabel, { color: colors.mutedForeground, padding: 12 }]}>Log sub-scores to see spider chart data.</Text>;
                    }
                    // 3-axis spider: polygon centered at cx,cy with radius r
                    const cx = 110; const cy = 80; const r = 65;
                    const numAxes = 3;
                    const angleStep = (2 * Math.PI) / numAxes;
                    const axisAngles = Array.from({ length: numAxes }, (_, i) => -Math.PI / 2 + i * angleStep);
                    const point = (pct: number, axisIdx: number) => {
                      const a = axisAngles[axisIdx];
                      return { x: cx + (pct / 100) * r * Math.cos(a), y: cy + (pct / 100) * r * Math.sin(a) };
                    };
                    const gridPolygon = (pct: number) =>
                      axisAngles.map((a) => `${cx + (pct / 100) * r * Math.cos(a)},${cy + (pct / 100) * r * Math.sin(a)}`).join(" ");

                    return (
                      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                        <Svg width={220} height={165}>
                          {/* Grid rings */}
                          {[25, 50, 75, 100].map((pct) => (
                            <Polygon key={pct} points={gridPolygon(pct)} fill="none" stroke={colors.border} strokeWidth="0.8" />
                          ))}
                          {/* Axis lines */}
                          {axisAngles.map((a, i) => (
                            <Line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke={colors.border} strokeWidth="0.8" />
                          ))}
                          {/* Axis labels */}
                          {axisAngles.map((a, i) => {
                            const lx = cx + (r + 14) * Math.cos(a);
                            const ly = cy + (r + 14) * Math.sin(a);
                            return <SvgText key={i} x={lx} y={ly + 3} fontSize={9} fill={colors.mutedForeground} textAnchor="middle">{axes[i].label}</SvgText>;
                          })}
                          {/* One filled polygon per category */}
                          {catsWithData.map((cat) => {
                            const catColor = COMPETITION_CATEGORY_COLOR[cat];
                            const pcts = axes.map((ax) => ax.pct(cat) ?? 0);
                            const polyPts = pcts.map((pct, i) => {
                              const p = point(pct, i);
                              return `${p.x},${p.y}`;
                            }).join(" ");
                            return (
                              <Polygon key={cat} points={polyPts} fill={catColor + "33"} stroke={catColor} strokeWidth="1.5" />
                            );
                          })}
                          {/* Dots at each axis */}
                          {catsWithData.map((cat) => {
                            const catColor = COMPETITION_CATEGORY_COLOR[cat];
                            return axes.map((ax, i) => {
                              const pct = ax.pct(cat);
                              if (pct == null) return null;
                              const p = point(pct, i);
                              return <Circle key={`${cat}-${i}`} cx={p.x} cy={p.y} r={3} fill={catColor} />;
                            });
                          })}
                        </Svg>
                        {/* Legend */}
                        <View style={{ flex: 1, gap: 8, paddingLeft: 4, paddingTop: 8 }}>
                          {catsWithData.map((cat) => {
                            const catColor = COMPETITION_CATEGORY_COLOR[cat];
                            const r = radarData.find((x) => x.category === cat);
                            return (
                              <View key={cat} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: catColor }} />
                                <View>
                                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: catColor }}>
                                    {COMPETITION_CATEGORY_LABEL[cat]}
                                  </Text>
                                  {r?.appearancePct != null && (
                                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground }}>
                                      {Math.round(r.appearancePct)}% / {Math.round(r.tastePct ?? 0)}% / {Math.round(r.texturePct ?? 0)}%
                                    </Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                          {catsWithData.length === 0 && (
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Log sub-scores to see spider data.</Text>
                          )}
                        </View>
                      </View>
                    );
                  })()}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, alignItems: "flex-start" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  headerBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: { flex: 1, padding: 14, borderWidth: 1, alignItems: "center", gap: 4 },
  statNum: { fontFamily: "Inter_800ExtraBold", fontSize: 24 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 11 },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  catCard: { borderWidth: 1, padding: 14, marginBottom: 12 },
  catCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 },
  catCount: { fontFamily: "Inter_400Regular", fontSize: 12 },
  placementPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  placementPillText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  scoreLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  scoreValue: { fontFamily: "Inter_700Bold", fontSize: 14 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  subScoreRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  subScoreItem: { flex: 1, alignItems: "center" },
  subScoreLabel: { fontFamily: "Inter_500Medium", fontSize: 10, marginBottom: 2 },
  subScoreValue: { fontFamily: "Inter_700Bold", fontSize: 13 },
  trendSection: { borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  trendTitle: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.5, marginBottom: 8 },
  radarCard: { borderWidth: 1, padding: 14, marginBottom: 20 },
  radarBarLabel: { fontFamily: "Inter_500Medium", fontSize: 10, width: 30 },
});
