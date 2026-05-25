import React from "react";
import { View, Text, Pressable, ActivityIndicator, Animated } from "react-native";
import type { InkbirdProbeReading } from "@/hooks/useInkbirdBLE";
import type { BleDevice, ReconnectBanner } from "@/contexts/BleProbeContext";
import type { LanProbeReading } from "@/hooks/useLanProbes";
import { Feather } from "@expo/vector-icons";
import { s } from "./styles";
import { TempGraph, ProbeTimeSeries } from "@/components/TempGraph";
import { weatherDescription, weatherIcon } from "@/hooks/useAmbientWeather";
import { fmtElapsed, getOutdoorTempEffect } from "./utils";
import { COMPETITION_CATEGORY_COLOR, COMPETITION_CATEGORY_LABEL, type CompetitionCategory } from "@/constants/competitionKnowledge";
import { CookProgressBar } from "./CookProgressBar";

function fmtTurnInCountdown(diffMs: number): string {
  if (diffMs <= 0) return "now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return `in ${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `in ${d}d`;
}

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  weather: any;
  meaterLinked: boolean | null;
  meaterProbes: any[];
  thermoworksLinked: boolean | null;
  thermoworksProbes: any[];
  inkbirdProbes?: InkbirdProbeReading[];
  bleContextDevices?: BleDevice[];
  lanProbes?: LanProbeReading[];
  autoAssignBanner?: string | null;
  onDismissAutoAssignBanner?: () => void;
  reconnectBanner?: ReconnectBanner | null;
  onDismissReconnectBanner?: () => void;
  tempMode?: "probe" | "manual";
  onSetTempMode?: (mode: "probe" | "manual") => void;
  selectedProbeId?: string | null;
  onSelectProbe?: (probeId: string | null) => void;
  liveGraphProbes: ProbeTimeSeries[];
  liveReadings: any[];
  cardWidth: number;
  elapsedMs: number;
  remainingMs: number | null;
  estimatedFinishMs: number | null;
  setAlertSheetVisible: (v: boolean) => void;
  setAlertMode: (m: "temp" | "timer") => void;
  activeCookAlerts: any[];
  nowMs?: number;
  targetTempF?: number | null;
  cookTempF?: number | null;
  nextSpritzMs?: number | null;
  nextMopMs?: number | null;
  onViewDetails?: () => void;
  isMeatOn?: boolean;
  pitMasterResult?: any;
  pitMasterAnalyzing?: boolean;
  pitMasterVerdictCfg?: any;
  pitMasterAssessment?: any;
  renderDecisions?: (decisions: any[]) => React.ReactNode;
  onCheckIn?: () => void;
  lastAnalyzedAtMs?: number | null;
  onRefresh?: () => void;
  activeProbeName?: string | null;
}

function fmtLastChecked(lastAnalyzedAtMs: number, nowMs: number): string {
  const diffMs = nowMs - lastAnalyzedAtMs;
  if (diffMs < 60000) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ago`;
}

function fmtSpritzCountdown(diffMs: number): string {
  const totalMins = Math.ceil(diffMs / 60000);
  if (totalMins <= 0) return "now";
  if (totalMins < 60) return `in ${totalMins} min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

export function LiveCookSection(p: Props) {
  const {
    c, colors, weather, meaterLinked, meaterProbes, thermoworksLinked, thermoworksProbes,
    inkbirdProbes = [], bleContextDevices = [], lanProbes = [],
    autoAssignBanner, onDismissAutoAssignBanner,
    reconnectBanner, onDismissReconnectBanner,
    tempMode = "manual", onSetTempMode,
    selectedProbeId, onSelectProbe,
    liveGraphProbes, liveReadings, cardWidth, elapsedMs, remainingMs, estimatedFinishMs,
    setAlertSheetVisible, setAlertMode, activeCookAlerts, nowMs,
    targetTempF, cookTempF, nextSpritzMs, nextMopMs, onViewDetails,
    isMeatOn, pitMasterResult, pitMasterAnalyzing, pitMasterVerdictCfg, pitMasterAssessment,
    renderDecisions, onCheckIn, lastAnalyzedAtMs, onRefresh, activeProbeName,
  } = p;

  const [phaseNarrativeExpanded, setPhaseNarrativeExpanded] = React.useState(false);
  const [assessmentExpanded, setAssessmentExpanded] = React.useState(false);

  const flashAnim = React.useRef(new Animated.Value(0)).current;
  const prevLastAnalyzedAtMs = React.useRef<number | null>(null);
  const hasHydrated = React.useRef(false);
  React.useEffect(() => {
    if (lastAnalyzedAtMs == null) return;
    if (prevLastAnalyzedAtMs.current === lastAnalyzedAtMs) return;
    const isFirstSeed = !hasHydrated.current;
    prevLastAnalyzedAtMs.current = lastAnalyzedAtMs;
    hasHydrated.current = true;
    if (isFirstSeed) return;
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, [lastAnalyzedAtMs, flashAnim]);

  const hasAnyProbe = (meaterLinked === true && meaterProbes.length > 0) ||
    (thermoworksLinked === true && thermoworksProbes.length > 0) ||
    inkbirdProbes.length > 0 ||
    bleContextDevices.length > 0 ||
    lanProbes.length > 0;
  const noneSelected = tempMode === "probe" && hasAnyProbe && selectedProbeId == null;

  if (c.status !== "active") return null;

  const turnInBadge = (() => {
    if (!c.isCompetition || !c.turnInAt) return null;
    const turnInMs = new Date(c.turnInAt).getTime();
    const now = nowMs ?? Date.now();
    const diffMs = turnInMs - now;
    const cat = (c.competitionCategory ?? null) as CompetitionCategory | null;
    const catColor = cat ? COMPETITION_CATEGORY_COLOR[cat] : "#EAB308";
    const catLabel = cat ? COMPETITION_CATEGORY_LABEL[cat] : "Competition";
    const isUrgent = diffMs > 0 && diffMs <= 30 * 60 * 1000;
    const isPast = diffMs <= 0;
    const accent = isUrgent || isPast ? "#ef4444" : catColor;
    const text = isPast ? "Turn-in passed" : `Turn-in ${fmtTurnInCountdown(diffMs)}`;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginHorizontal: 14,
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          backgroundColor: accent + "18",
          borderWidth: 1,
          borderColor: accent + "55",
        }}
      >
        <Feather name="award" size={14} color={accent} />
        <Text style={{ color: accent, fontFamily: "Inter_700Bold", fontSize: 13 }}>
          {catLabel.toUpperCase()} · {text}
        </Text>
      </View>
    );
  })();

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: "#FF6B2B40", borderRadius: colors.radius }]}>
      <View style={[s.logHeader, { padding: 14 }]}>
        <View style={[s.logIconWrap, { backgroundColor: "#FF6B2B" }]}>
          <Feather name="activity" size={15} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.logTitle, { color: colors.foreground }]}>Live Cook</Text>
          <Text style={[s.logSub, { color: colors.mutedForeground }]}>
            {tempMode === "manual"
              ? "Manual entry · log temps during check-in"
              : hasAnyProbe && selectedProbeId != null
              ? `Tracking ${activeProbeName ?? "selected probe"} · auto-updating every 15s`
              : hasAnyProbe
              ? "Tap a probe below to track it for this cook"
              : "No probe detected · scanning nearby devices"}
          </Text>
        </View>
        <View style={[s.connectedBadgeSmall, { backgroundColor: "#FF6B2B18" }]}>
          <View style={[s.liveIndicator, { backgroundColor: "#FF6B2B" }]} />
          <Text style={[s.liveText, { color: "#FF6B2B" }]}>LIVE</Text>
        </View>
      </View>

      {/* Auto-assign banner — shown when a single probe was auto-selected */}
      {autoAssignBanner != null && (
        <Pressable
          onPress={onDismissAutoAssignBanner}
          style={{
            flexDirection: "row", alignItems: "center", gap: 8,
            marginHorizontal: 14, marginTop: 4, marginBottom: 2,
            padding: 10, borderRadius: 8,
            backgroundColor: "#3B82F618", borderWidth: 1, borderColor: "#3B82F640",
          }}
        >
          <Feather name="zap" size={13} color="#3B82F6" />
          <Text style={{ flex: 1, fontFamily: "Inter_500Medium", fontSize: 12, color: "#3B82F6" }}>
            {autoAssignBanner}
          </Text>
          <Feather name="x" size={13} color="#3B82F6" />
        </Pressable>
      )}

      {/* BLE Reconnect Banner */}
      {reconnectBanner != null && (
        <Pressable
          onPress={onDismissReconnectBanner}
          style={{
            flexDirection: "row", alignItems: "center", gap: 8,
            marginHorizontal: 14, marginTop: 4, marginBottom: 2,
            padding: 10, borderRadius: 8,
            backgroundColor: "#22c55e18", borderWidth: 1, borderColor: "#22c55e40",
          }}
        >
          <Feather name="bluetooth" size={13} color="#22c55e" />
          <Text style={{ flex: 1, fontFamily: "Inter_500Medium", fontSize: 12, color: "#22c55e" }}>
            {reconnectBanner.deviceName} reconnected
          </Text>
          <Feather name="x" size={13} color="#22c55e" />
        </Pressable>
      )}

      {turnInBadge}

      {nextSpritzMs != null && (() => {
        const now = nowMs ?? Date.now();
        const diffMs = nextSpritzMs - now;
        const accent = "#0EA5E9";
        return (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginHorizontal: 14,
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              backgroundColor: accent + "18",
              borderWidth: 1,
              borderColor: accent + "55",
            }}
          >
            <Feather name="cloud-rain" size={14} color={accent} />
            <Text style={{ color: accent, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              Next spritz {fmtSpritzCountdown(diffMs)}
            </Text>
          </View>
        );
      })()}

      {nextMopMs != null && (() => {
        const now = nowMs ?? Date.now();
        const diffMs = nextMopMs - now;
        const isUrgent = diffMs > 0 && diffMs <= 5 * 60 * 1000;
        const accent = isUrgent ? "#F97316" : "#92400E";
        return (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginHorizontal: 14,
              marginTop: 6,
              padding: 10,
              borderRadius: 8,
              backgroundColor: accent + "18",
              borderWidth: 1,
              borderColor: accent + "55",
            }}
          >
            <Feather name="droplet" size={14} color={accent} />
            <Text style={{ color: accent, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              Next mop {fmtSpritzCountdown(diffMs)}
            </Text>
          </View>
        );
      })()}

      <CookProgressBar
        startMs={c.actualStartAt ? new Date(c.actualStartAt).getTime() : 0}
        estimatedFinishMs={estimatedFinishMs}
        nowMs={nowMs ?? Date.now()}
        colors={colors}
      />

      <View style={[s.timerRow, { borderTopColor: colors.border }]}>
        <View style={[s.timerChip, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "30" }]}>
          <Feather name="clock" size={13} color={colors.primary} />
          <View>
            <Text style={[s.timerValue, { color: colors.primary }]}>
              {c.actualStartAt ? fmtElapsed(elapsedMs) : "—"}
            </Text>
            <Text style={[s.timerLabel, { color: colors.mutedForeground }]}>Elapsed</Text>
          </View>
        </View>
        {c.plannedEndAt && (
          <View style={[
            s.timerChip,
            remainingMs !== null && remainingMs < 0
              ? { backgroundColor: "#ef444418", borderColor: "#ef444430" }
              : { backgroundColor: "#22c55e18", borderColor: "#22c55e30" },
          ]}>
            <Feather
              name="flag"
              size={13}
              color={remainingMs !== null && remainingMs < 0 ? "#ef4444" : "#22c55e"}
            />
            <View>
              <Text style={[
                s.timerValue,
                { color: remainingMs !== null && remainingMs < 0 ? "#ef4444" : "#22c55e" },
              ]}>
                {remainingMs !== null
                  ? remainingMs < 0
                    ? `+${fmtElapsed(-remainingMs)} over`
                    : fmtElapsed(remainingMs)
                  : "—"}
              </Text>
              <Text style={[s.timerLabel, { color: colors.mutedForeground }]}>Until serve</Text>
            </View>
          </View>
        )}
      </View>

      {!weather.locationDenied && (weather.loading || weather.tempF != null) && (
        <View style={[s.weatherStrip, { borderTopColor: colors.border, borderBottomColor: colors.border, flexDirection: "column", alignItems: "flex-start", gap: 4 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Feather
              name={weatherIcon(weather.conditionCode) as any}
              size={14}
              color={colors.mutedForeground}
            />
            {weather.loading ? (
              <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
                Fetching outdoor temp…
              </Text>
            ) : weather.error ? (
              <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
                Outdoor temp unavailable
              </Text>
            ) : weather.tempF != null ? (
              <>
                <Text style={[s.weatherTemp, { color: colors.foreground }]}>
                  {weather.tempF}°F outdoors
                </Text>
                {weatherDescription(weather.conditionCode) && (
                  <Text style={[s.weatherCondition, { color: colors.mutedForeground }]}>
                    · {weatherDescription(weather.conditionCode)}
                  </Text>
                )}
              </>
            ) : null}
          </View>
          {getOutdoorTempEffect(weather.tempF) && (
            <Text style={[s.weatherText, { color: colors.mutedForeground, fontStyle: "italic" }]}>
              {getOutdoorTempEffect(weather.tempF)}
            </Text>
          )}
        </View>
      )}

      {liveGraphProbes.length > 0 && (
        <View style={[s.liveGraphWrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Live Temperature</Text>
          <TempGraph
            probes={liveGraphProbes}
            events={[]}
            targetTempF={c.targetTempF ?? null}
            width={cardWidth}
            height={160}
          />
        </View>
      )}

      {/* ── Temp Mode Toggle ── */}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={() => onSetTempMode?.("probe")}
          style={[
            { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
            tempMode === "probe"
              ? { backgroundColor: "#FF6B2B18", borderColor: "#FF6B2B60" }
              : { backgroundColor: "transparent", borderColor: colors.border },
          ]}
        >
          <Feather name="bluetooth" size={13} color={tempMode === "probe" ? "#FF6B2B" : colors.mutedForeground} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: tempMode === "probe" ? "#FF6B2B" : colors.mutedForeground }}>
            Connected Probe
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onSetTempMode?.("manual")}
          style={[
            { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
            tempMode === "manual"
              ? { backgroundColor: colors.primary + "18", borderColor: colors.primary + "60" }
              : { backgroundColor: "transparent", borderColor: colors.border },
          ]}
        >
          <Feather name="edit-3" size={13} color={tempMode === "manual" ? colors.primary : colors.mutedForeground} />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: tempMode === "manual" ? colors.primary : colors.mutedForeground }}>
            Manual Entry
          </Text>
        </Pressable>
      </View>

      {/* Manual Entry mode: just a short note — temps are entered during check-in */}
      {tempMode === "manual" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
          <Feather name="edit-3" size={13} color={colors.mutedForeground} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, flex: 1 }}>
            Enter probe and pit temperatures during your check-in.
          </Text>
        </View>
      )}

      {/* Connected Probe mode: show all available probe sources */}
      {tempMode === "probe" && meaterLinked === true && meaterProbes.length > 0 && selectedProbeId != null && liveReadings.length < 2 && (
        <View style={[s.liveGraphWrap, { borderTopColor: colors.border }]}>
          <Text style={[s.meaterPlaceholderText, { color: colors.mutedForeground, textAlign: "left" }]}>
            📡 Collecting readings — chart will appear shortly
          </Text>
        </View>
      )}

      {tempMode === "probe" && meaterLinked === true && meaterProbes.map((probe: any, i: number) => {
        const probeKey = probe.deviceId;
        const isSelected = selectedProbeId === probeKey;
        return (
          <Pressable
            key={probe.deviceId + i}
            onPress={() => onSelectProbe?.(isSelected ? null : probeKey)}
            style={[
              s.subSection,
              {
                borderTopColor: colors.border,
                paddingHorizontal: 14,
                paddingBottom: 12,
                borderWidth: isSelected ? 1.5 : undefined,
                borderColor: isSelected ? "#FF6B2B60" : undefined,
                borderRadius: isSelected ? 10 : undefined,
                marginHorizontal: isSelected ? 8 : undefined,
                marginTop: isSelected ? 6 : undefined,
                backgroundColor: isSelected ? "#FF6B2B08" : undefined,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                {probe.deviceName}{probe.cookName ? ` · ${probe.cookName}` : ""}
              </Text>
              {isSelected ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FF6B2B20" }}>
                  <Feather name="check" size={10} color="#FF6B2B" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FF6B2B" }}>Tracking</Text>
                </View>
              ) : (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Tap to use</Text>
              )}
            </View>
            <View style={s.meaterTempsRow}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#FF6B2B" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                    {probe.internalTempF != null ? `${probe.internalTempF}°F` : "—"}
                  </Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Internal</Text>
                </View>
              </View>
              <View style={s.meaterTempChip}>
                <Feather name="wind" size={14} color="#3b82f6" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                    {probe.ambientTempF != null ? `${probe.ambientTempF}°F` : "—"}
                  </Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Ambient</Text>
                </View>
              </View>
              {(probe.targetMinTempF != null || probe.targetMaxTempF != null) && (
                <View style={s.meaterTempChip}>
                  <Feather name="target" size={14} color="#22c55e" />
                  <View>
                    <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                      {probe.targetMinTempF}–{probe.targetMaxTempF}°F
                    </Text>
                    <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Target</Text>
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}

      {tempMode === "probe" && thermoworksLinked === true && thermoworksProbes.map((probe: any, i: number) => {
        const probeKey = `tw_${probe.deviceId}_${probe.channelNumber}`;
        const isSelected = selectedProbeId === probeKey;
        return (
          <Pressable
            key={`tw-${probe.deviceId}-${probe.channelNumber}-${i}`}
            onPress={() => onSelectProbe?.(isSelected ? null : probeKey)}
            style={[
              s.subSection,
              {
                borderTopColor: colors.border,
                paddingHorizontal: 14,
                paddingBottom: 12,
                borderWidth: isSelected ? 1.5 : undefined,
                borderColor: isSelected ? "#FF6B2B60" : undefined,
                borderRadius: isSelected ? 10 : undefined,
                marginHorizontal: isSelected ? 8 : undefined,
                marginTop: isSelected ? 6 : undefined,
                backgroundColor: isSelected ? "#FF6B2B08" : undefined,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                {probe.deviceName}
                {probe.channelLabel ? ` · ${probe.channelLabel}` : ` · Ch ${probe.channelNumber}`}
                {"  ·  ThermoWorks"}
              </Text>
              {isSelected ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FF6B2B20" }}>
                  <Feather name="check" size={10} color="#FF6B2B" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FF6B2B" }}>Tracking</Text>
                </View>
              ) : (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Tap to use</Text>
              )}
            </View>
            <View style={s.meaterTempsRow}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#B22222" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                    {probe.tempF != null ? `${probe.tempF}°F` : "—"}
                  </Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Temperature</Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}

      {/* Inkbird BLE probe rows */}
      {tempMode === "probe" && inkbirdProbes.map((probe, i) => {
        const probeKey = `ble_${probe.deviceId}_${probe.probeIndex}`;
        const isSelected = selectedProbeId === probeKey;
        return (
          <Pressable
            key={`ble-${probe.deviceId}-${probe.probeIndex}-${i}`}
            onPress={() => onSelectProbe?.(isSelected ? null : probeKey)}
            style={[
              s.subSection,
              {
                borderTopColor: colors.border,
                paddingHorizontal: 14,
                paddingBottom: 12,
                borderWidth: isSelected ? 1.5 : undefined,
                borderColor: isSelected ? "#FF6B2B60" : undefined,
                borderRadius: isSelected ? 10 : undefined,
                marginHorizontal: isSelected ? 8 : undefined,
                marginTop: isSelected ? 6 : undefined,
                backgroundColor: isSelected ? "#FF6B2B08" : undefined,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Feather name="bluetooth" size={11} color="#3B82F6" />
                <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                  {probe.deviceName}{`  ·  Ch ${probe.probeIndex + 1}  ·  Inkbird`}
                  {probe.tempF == null ? "  ·  Searching…" : ""}
                </Text>
              </View>
              {isSelected ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FF6B2B20" }}>
                  <Feather name="check" size={10} color="#FF6B2B" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FF6B2B" }}>Tracking</Text>
                </View>
              ) : (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Tap to use</Text>
              )}
            </View>
            <View style={s.meaterTempsRow}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#3B82F6" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                    {probe.tempF != null ? `${Math.round(probe.tempF)}°F` : "—"}
                  </Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Internal</Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}

      {/* BLE context device rows (MEATER via BLE, Govee, Weber iGrill) */}
      {tempMode === "probe" && bleContextDevices.map((device, i) => {
        const probeKey = `bleCtx_${device.id}`;
        const isSelected = selectedProbeId === probeKey;
        const hasAmbient = device.ambientTempF != null;
        return (
          <Pressable
            key={`bleCtx-${device.id}-${i}`}
            onPress={() => onSelectProbe?.(isSelected ? null : probeKey)}
            style={[
              s.subSection,
              {
                borderTopColor: colors.border,
                paddingHorizontal: 14,
                paddingBottom: 12,
                borderWidth: isSelected ? 1.5 : undefined,
                borderColor: isSelected ? "#FF6B2B60" : undefined,
                borderRadius: isSelected ? 10 : undefined,
                marginHorizontal: isSelected ? 8 : undefined,
                marginTop: isSelected ? 6 : undefined,
                backgroundColor: isSelected ? "#FF6B2B08" : undefined,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, flexWrap: "wrap" }}>
                <Feather name="bluetooth" size={11} color="#3B82F6" />
                <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                  {device.name}
                </Text>
                {device.batteryPct != null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 99, backgroundColor: device.batteryPct > 50 ? "#22c55e20" : device.batteryPct > 20 ? "#EAB30820" : "#ef444420" }}>
                    <Feather name="battery" size={9} color={device.batteryPct > 50 ? "#22c55e" : device.batteryPct > 20 ? "#EAB308" : "#ef4444"} />
                    <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: device.batteryPct > 50 ? "#22c55e" : device.batteryPct > 20 ? "#EAB308" : "#ef4444" }}>{device.batteryPct}%</Text>
                  </View>
                )}
              </View>
              {isSelected ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FF6B2B20" }}>
                  <Feather name="check" size={10} color="#FF6B2B" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FF6B2B" }}>Tracking</Text>
                </View>
              ) : (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Tap to use</Text>
              )}
            </View>
            {/* Dual-temp row: internal + ambient side by side */}
            <View style={s.meaterTempsRow}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#FF6B2B" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                    {device.probeTempF != null ? `${device.probeTempF}°F` : "—"}
                  </Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Internal</Text>
                </View>
              </View>
              {hasAmbient && (
                <View style={s.meaterTempChip}>
                  <Feather name="wind" size={14} color="#3b82f6" />
                  <View>
                    <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                      {device.ambientTempF}°F
                    </Text>
                    <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Ambient / Pit</Text>
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}

      {noneSelected && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: "#FF6B2B08", borderWidth: 1, borderColor: "#FF6B2B25" }}>
          <Feather name="info" size={13} color="#FF6B2B" />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, flex: 1 }}>
            Tap a probe above to assign it to this cook. Each cook tracks one probe independently.
          </Text>
        </View>
      )}

      {/* LAN probe rows (Fireboard, MEATER Block, ThermoWorks Signals) */}
      {tempMode === "probe" && lanProbes.map((probe, i) => {
        const probeKey = `lan_${probe.deviceId}`;
        const isSelected = selectedProbeId === probeKey;
        return (
          <Pressable
            key={`lan-${probe.deviceId}-${i}`}
            onPress={() => onSelectProbe?.(isSelected ? null : probeKey)}
            style={[
              s.subSection,
              {
                borderTopColor: colors.border,
                paddingHorizontal: 14,
                paddingBottom: 12,
                borderWidth: isSelected ? 1.5 : undefined,
                borderColor: isSelected ? "#FF6B2B60" : undefined,
                borderRadius: isSelected ? 10 : undefined,
                marginHorizontal: isSelected ? 8 : undefined,
                marginTop: isSelected ? 6 : undefined,
                backgroundColor: isSelected ? "#FF6B2B08" : undefined,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Feather name="wifi" size={11} color="#0EA5E9" />
                <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                  {probe.deviceName} · {probe.channelLabel}
                </Text>
              </View>
              {isSelected ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FF6B2B20" }}>
                  <Feather name="check" size={10} color="#FF6B2B" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FF6B2B" }}>Tracking</Text>
                </View>
              ) : (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Tap to use</Text>
              )}
            </View>
            <View style={s.meaterTempsRow}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#0EA5E9" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                    {probe.probeTempF}°F
                  </Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Internal</Text>
                </View>
              </View>
              {probe.ambientTempF != null && (
                <View style={s.meaterTempChip}>
                  <Feather name="wind" size={14} color="#3b82f6" />
                  <View>
                    <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                      {probe.ambientTempF}°F
                    </Text>
                    <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Ambient / Pit</Text>
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}

      {tempMode === "probe" && meaterLinked !== true && thermoworksLinked !== true && inkbirdProbes.length === 0 && bleContextDevices.length === 0 && lanProbes.length === 0 && (
        <View style={[s.meaterPlaceholder, { borderTopColor: colors.border }]}>
          <Feather name="thermometer" size={20} color={colors.mutedForeground} />
          <Text style={[s.meaterPlaceholderText, { color: colors.mutedForeground }]}>
            Bring your Inkbird probe into range, or link MEATER/ThermoWorks in Profile.
          </Text>
        </View>
      )}

      {(targetTempF != null || cookTempF != null) && (
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingBottom: 12 }}>
          {targetTempF != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#22c55e12", borderWidth: 1, borderColor: "#22c55e30" }}>
              <Feather name="thermometer" size={12} color="#22c55e" />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#22c55e" }}>{targetTempF}°F</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#22c55e99" }}>target</Text>
            </View>
          )}
          {cookTempF != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#3b82f612", borderWidth: 1, borderColor: "#3b82f630" }}>
              <Feather name="wind" size={12} color="#3b82f6" />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#3b82f6" }}>{cookTempF}°F</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#3b82f699" }}>pit</Text>
            </View>
          )}
        </View>
      )}

      {/* ── PitMaster Decision Zone ── */}
      {isMeatOn && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: -14,
                right: -14,
                top: -4,
                bottom: -4,
                backgroundColor: "#FF6B2B",
                borderRadius: 4,
                opacity: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
              }}
            />
            <Feather name="cpu" size={12} color="#FF6B2B" />
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: "#FF6B2B", textTransform: "uppercase", letterSpacing: 0.5 }}>
              PitMaster
            </Text>
            {pitMasterAnalyzing ? (
              <ActivityIndicator size="small" color="#FF6B2B" style={{ marginLeft: 4 }} />
            ) : (
              <>
                {lastAnalyzedAtMs != null && (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground, marginLeft: 2 }}>
                    · {fmtLastChecked(lastAnalyzedAtMs, nowMs ?? Date.now())}
                  </Text>
                )}
                {onRefresh != null && (
                  <Pressable
                    onPress={onRefresh}
                    hitSlop={10}
                    style={({ pressed }) => ({ marginLeft: 2, opacity: pressed ? 0.5 : 1 })}
                  >
                    <Feather name="refresh-cw" size={11} color={colors.mutedForeground} />
                  </Pressable>
                )}
              </>
            )}
          </View>

          {pitMasterResult ? (
            <View style={{ gap: 8 }}>
              {/* Decisions */}
              {(pitMasterResult.decisions?.length ?? 0) > 0 && renderDecisions &&
                renderDecisions(pitMasterResult.decisions)}

              {/* Phase prediction */}
              {pitMasterResult.phasePrediction && (() => {
                const pp = pitMasterResult.phasePrediction;
                const PHASE_COLORS: Record<string, string> = {
                  heat_up: "#3B82F6",
                  stall: "#F59E0B",
                  finishing: "#22c55e",
                  done: "#6B7280",
                };
                const PHASE_ICONS: Record<string, string> = {
                  heat_up: "thermometer",
                  stall: "clock",
                  finishing: "trending-up",
                  done: "check-circle",
                };
                const phaseColor = PHASE_COLORS[pp.phase] ?? "#6B7280";
                const phaseIcon = PHASE_ICONS[pp.phase] ?? "activity";
                const fmtTime = (mins: number) => {
                  if (mins < 60) return `~${mins}m`;
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
                };
                const hasTimingChips =
                  (pp.timeToStallMinutes != null && pp.phase === "heat_up") ||
                  (pp.stallDurationMinutes != null && pp.phase === "stall") ||
                  pp.timeToFinishMinutes != null;
                return (
                  <View style={[s.phaseCard, { backgroundColor: phaseColor + "15", borderColor: phaseColor + "40", borderRadius: colors.radius }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[s.phaseChip, { backgroundColor: phaseColor + "25", borderColor: phaseColor + "50" }]}>
                        <Feather name={phaseIcon as any} size={12} color={phaseColor} />
                        <Text style={[s.phaseChipText, { color: phaseColor }]}>{pp.phaseLabel}</Text>
                      </View>
                      {pp.narrative ? (
                        <Pressable
                          onPress={() => setPhaseNarrativeExpanded((v) => !v)}
                          style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                          hitSlop={8}
                        >
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: phaseColor }}>
                            {phaseNarrativeExpanded ? "Less" : "More"}
                          </Text>
                          <Feather name={phaseNarrativeExpanded ? "chevron-up" : "chevron-down"} size={11} color={phaseColor} />
                        </Pressable>
                      ) : null}
                    </View>
                    {phaseNarrativeExpanded && pp.narrative ? (
                      <Text style={[s.phaseNarrative, { color: colors.foreground }]}>{pp.narrative}</Text>
                    ) : null}
                    {hasTimingChips && (
                      <View style={s.phaseChips}>
                        {pp.timeToStallMinutes != null && pp.phase === "heat_up" && (
                          <View style={[s.timeChip, { backgroundColor: phaseColor + "20", borderColor: phaseColor + "40" }]}>
                            <Feather name="clock" size={11} color={phaseColor} />
                            <Text style={[s.timeChipText, { color: phaseColor }]}>Stall in {fmtTime(pp.timeToStallMinutes)}</Text>
                          </View>
                        )}
                        {pp.stallDurationMinutes != null && pp.phase === "stall" && (
                          <View style={[s.timeChip, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B40" }]}>
                            <Feather name="pause-circle" size={11} color="#F59E0B" />
                            <Text style={[s.timeChipText, { color: "#F59E0B" }]}>Stall ends in {fmtTime(pp.stallDurationMinutes)}</Text>
                          </View>
                        )}
                        {pp.timeToFinishMinutes != null && (
                          <View style={[s.timeChip, { backgroundColor: "#22c55e20", borderColor: "#22c55e40" }]}>
                            <Feather name="flag" size={11} color="#22c55e" />
                            <Text style={[s.timeChipText, { color: "#22c55e" }]}>Done in {fmtTime(pp.timeToFinishMinutes)}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Verdict banner */}
              {pitMasterVerdictCfg && pitMasterAssessment && (
                <View style={[s.verdictBanner, { backgroundColor: pitMasterVerdictCfg.color + "18", borderColor: pitMasterVerdictCfg.color + "40", borderRadius: colors.radius }]}>
                  <Feather name={pitMasterVerdictCfg.icon as any} size={20} color={pitMasterVerdictCfg.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.verdictLabel, { color: pitMasterVerdictCfg.color }]}>{pitMasterVerdictCfg.label}</Text>
                    {pitMasterAssessment.summary ? (
                      <Text style={[s.verdictSummary, { color: colors.foreground }]}>{pitMasterAssessment.summary}</Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Assessment expand/collapse */}
              {(() => {
                const wellCount = pitMasterAssessment?.whatWentWell?.length ?? 0;
                const tipCount = pitMasterAssessment?.suggestions?.length ?? 0;
                if (wellCount === 0 && tipCount === 0) return null;
                const summaryParts: string[] = [];
                if (wellCount > 0) summaryParts.push(`✓ ${wellCount} on track`);
                if (tipCount > 0) summaryParts.push(`⚠ ${tipCount} tip${tipCount > 1 ? "s" : ""}`);
                return (
                  <View style={[s.subSection, { borderColor: colors.border }]}>
                    <Pressable
                      onPress={() => setAssessmentExpanded((v) => !v)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0, flex: 1 }]}>
                        {summaryParts.join("  ·  ")}
                      </Text>
                      <Feather name={assessmentExpanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
                    </Pressable>
                    {assessmentExpanded && (
                      <>
                        {wellCount > 0 && (
                          <View style={{ marginTop: 10, gap: 4 }}>
                            <Text style={[s.subLabel, { color: "#22c55e", marginBottom: 4 }]}>Looking Good</Text>
                            {pitMasterAssessment!.whatWentWell!.map((item: string, i: number) => (
                              <View key={i} style={s.bulletRow}>
                                <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                                <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {tipCount > 0 && (
                          <View style={{ marginTop: 10, gap: 4 }}>
                            <Text style={[s.subLabel, { color: "#A855F7", marginBottom: 4 }]}>Watch Out For</Text>
                            {pitMasterAssessment!.suggestions!.map((tip: string, i: number) => (
                              <View key={i} style={s.bulletRow}>
                                <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                                <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })()}
            </View>
          ) : pitMasterAnalyzing ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                Analyzing your cook…
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={onCheckIn}
              style={({ pressed }) => ({
                flexDirection: "row" as const,
                alignItems: "center" as const,
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#FF6B2B30",
                backgroundColor: "#FF6B2B08",
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Feather name="thermometer" size={14} color="#FF6B2B" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground }}>
                  Check In with PitMaster
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>
                  Log temps and get live coaching
                </Text>
              </View>
              <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      )}

      <View style={[s.alertBtnRow, { borderTopColor: colors.border }]}>
        <Pressable
          style={[s.setAlertBtn, { backgroundColor: "#EF444412", borderColor: "#EF444430", borderRadius: colors.radius }]}
          onPress={() => { setAlertSheetVisible(true); setAlertMode("temp"); }}
        >
          <Feather name="bell"  size={14} color="#EF4444" />
          <Text style={[s.setAlertBtnText, { color: "#EF4444" }]}>Set Alert</Text>
          {activeCookAlerts.length > 0 && (
            <View style={[s.alertCountBadge, { backgroundColor: "#EF4444" }]}>
              <Text style={s.alertCountText}>{activeCookAlerts.length}</Text>
            </View>
          )}
        </Pressable>
        {onViewDetails && (
          <Pressable
            style={[s.setAlertBtn, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30", borderRadius: colors.radius }]}
            onPress={onViewDetails}
          >
            <Feather name="file-text" size={14} color={colors.primary} />
            <Text style={[s.setAlertBtnText, { color: colors.primary }]}>View full details</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
