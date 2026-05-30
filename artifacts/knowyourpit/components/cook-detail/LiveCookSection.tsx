import React from "react";
import { View, Text, Pressable, ActivityIndicator, Animated, TextInput } from "react-native";
import type { InkbirdProbeReading } from "@/hooks/useInkbirdBLE";
import type { BleDevice, ReconnectBanner } from "@/contexts/BleProbeContext";
import type { LanProbeReading } from "@/hooks/useLanProbes";
import { Feather } from "@expo/vector-icons";
import { s } from "./styles";
import { TempGraph, ProbeTimeSeries } from "@/components/TempGraph";
import { weatherDescription, weatherIcon } from "@/hooks/useAmbientWeather";
import { fmtElapsed, getOutdoorTempEffect } from "./utils";
import { CookProgressBar } from "./CookProgressBar";

function fmtCountdown(diffMs: number): string {
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
  selectedMeatProbeId?: string | null;
  selectedPitProbeId?: string | null;
  onSelectMeatProbe?: (probeId: string | null) => void;
  onSelectPitProbe?: (probeId: string | null) => void;
  probeLabels?: Record<string, string>;
  onSetProbeLabel?: (probeKey: string, label: string) => void;
  otherCookAssignments?: Record<string, string>;
  inkbirdScanning?: boolean;
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
  onViewDetails?: () => void;
  isMeatOn?: boolean;
  pitMasterResult?: any;
  pitMasterAnalyzing?: boolean;
  renderDecisions?: (decisions: any[]) => React.ReactNode;
  onCheckIn?: () => void;
  onCheckInNext?: () => void;
  onOpenChat?: () => void;
  lastAnalyzedAtMs?: number | null;
  lastCheckinInternalTempF?: number | null;
  onRefresh?: () => void;
  activeProbeName?: string | null;
  activePitProbeName?: string;
  currentInternalTempF?: number | null;
  currentPitTempF?: number | null;
  nextCheckinMs?: number | null;
  nextCheckinLabel?: string | null;
  upcomingCheckins?: Array<{ id: string; scheduledAt: number; phaseLabel: string }>;
  onCheckInPhase?: (sc: any) => void;
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
    selectedMeatProbeId, selectedPitProbeId,
    onSelectMeatProbe, onSelectPitProbe,
    probeLabels = {}, onSetProbeLabel,
    otherCookAssignments = {}, inkbirdScanning = false,
    liveGraphProbes, liveReadings, cardWidth, elapsedMs, remainingMs, estimatedFinishMs,
    setAlertSheetVisible, setAlertMode, activeCookAlerts, nowMs,
    targetTempF, cookTempF, nextSpritzMs, onViewDetails,
    isMeatOn, pitMasterResult, pitMasterAnalyzing,
    renderDecisions, onCheckIn, onCheckInNext, onOpenChat, lastAnalyzedAtMs, lastCheckinInternalTempF, onRefresh, activeProbeName,
    currentInternalTempF, currentPitTempF,
    nextCheckinMs, nextCheckinLabel, upcomingCheckins = [], onCheckInPhase,
  } = p;

  // Local state for inline label editing
  const [editingLabelKey, setEditingLabelKey] = React.useState<string | null>(null);
  const [labelDraft, setLabelDraft] = React.useState("");

  const [phaseNarrativeExpanded, setPhaseNarrativeExpanded] = React.useState(false);
  const [timelineExpanded, setTimelineExpanded] = React.useState(true);

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
  const noneSelected = tempMode === "probe" && hasAnyProbe && selectedMeatProbeId == null && selectedPitProbeId == null;

  if (c.status !== "active") return null;

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
              : hasAnyProbe && (selectedMeatProbeId != null || selectedPitProbeId != null)
              ? `Tracking ${activeProbeName ?? "selected probe"} · auto-updating every 15s`
              : hasAnyProbe
              ? "Tap a probe below to assign roles for this cook"
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
              Spritz/Mop in {fmtSpritzCountdown(diffMs)}
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

      {/* ── Live probe temp readout — shown when a probe is connected and readings are available ── */}
      {tempMode === "probe" && (currentInternalTempF != null || currentPitTempF != null) && (
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          {currentInternalTempF != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#FF6B2B15", borderWidth: 1, borderColor: "#FF6B2B40" }}>
              <Feather name="thermometer" size={13} color="#FF6B2B" />
              <View>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#FF6B2B" }}>{Math.round(currentInternalTempF)}°F</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#FF6B2B99" }}>Internal</Text>
              </View>
            </View>
          )}
          {currentPitTempF != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#3b82f615", borderWidth: 1, borderColor: "#3b82f640" }}>
              <Feather name="wind" size={13} color="#3b82f6" />
              <View>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#3b82f6" }}>{Math.round(currentPitTempF)}°F</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#3b82f699" }}>Pit</Text>
              </View>
            </View>
          )}
        </View>
      )}

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
      {tempMode === "probe" && selectedMeatProbeId != null && liveReadings.length < 2 && (
        <View style={[s.liveGraphWrap, { borderTopColor: colors.border }]}>
          <Text style={[s.meaterPlaceholderText, { color: colors.mutedForeground, textAlign: "left" }]}>
            📡 Collecting readings — chart will appear shortly
          </Text>
        </View>
      )}

      {/* Searching indicator — BLE probe assigned but not yet in range */}
      {tempMode === "probe" && inkbirdScanning && (() => {
        const meatMissing = selectedMeatProbeId?.startsWith("ble_") &&
          !inkbirdProbes.find((p) => `ble_${p.deviceId}_${p.probeIndex}` === selectedMeatProbeId);
        const pitMissing = selectedPitProbeId?.startsWith("ble_") &&
          !inkbirdProbes.find((p) => `ble_${p.deviceId}_${p.probeIndex}` === selectedPitProbeId);
        if (!meatMissing && !pitMissing) return null;
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: "#3b82f612", borderWidth: 1, borderColor: "#3b82f630" }}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#3b82f6", flex: 1 }}>
              Searching for probe… Bring it within range.
            </Text>
          </View>
        );
      })()}

      {/* MEATER rows — ambient auto-provides pit; user can assign Meat or Pit role */}
      {tempMode === "probe" && meaterLinked === true && meaterProbes.map((probe: any, i: number) => {
        const probeKey = probe.deviceId;
        const isMeat = selectedMeatProbeId === probeKey;
        const isPit = selectedPitProbeId === probeKey;
        const otherCook = otherCookAssignments[probeKey];
        const lockedByOther = !!otherCook && !isMeat && !isPit;
        const isEditing = editingLabelKey === probeKey;
        return (
          <View
            key={probe.deviceId + i}
            style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12,
              ...(isMeat ? { borderWidth: 1.5, borderColor: "#FF6B2B60", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#FF6B2B08" } :
                  isPit  ? { borderWidth: 1.5, borderColor: "#3b82f660", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#3b82f608" } : {}),
            }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                {isEditing ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput value={labelDraft} onChangeText={setLabelDraft} placeholder={probe.deviceName} placeholderTextColor={colors.mutedForeground}
                      style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 2 }}
                      autoFocus returnKeyType="done"
                      onSubmitEditing={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }} />
                    <Pressable hitSlop={8} onPress={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }}><Feather name="check" size={14} color="#22c55e" /></Pressable>
                    <Pressable hitSlop={8} onPress={() => setEditingLabelKey(null)}><Feather name="x" size={14} color={colors.mutedForeground} /></Pressable>
                  </View>
                ) : (
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                    {probeLabels[probeKey] ?? probe.deviceName}{probe.cookName ? ` · ${probe.cookName}` : ""}
                  </Text>
                )}
              </View>
              {!isEditing && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pressable hitSlop={8} onPress={() => { setEditingLabelKey(probeKey); setLabelDraft(probeLabels[probeKey] ?? ""); }}>
                    <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                  </Pressable>
                  {lockedByOther ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.mutedForeground + "15" }}>
                      <Feather name="lock" size={9} color={colors.mutedForeground} />
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Used by {otherCook}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {otherCook && (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground }}>⚠ {otherCook}</Text>
                      )}
                      <Pressable onPress={() => onSelectMeatProbe?.(isMeat ? null : probeKey)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: isMeat ? "#FF6B2B20" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isMeat ? "#FF6B2B60" : "transparent" }}>
                        <Feather name="thermometer" size={11} color={isMeat ? "#FF6B2B" : colors.mutedForeground} />
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isMeat ? "#FF6B2B" : colors.mutedForeground }}>Meat</Text>
                        {isMeat && <Feather name="check" size={10} color="#FF6B2B" />}
                      </Pressable>
                      <Pressable onPress={() => onSelectPitProbe?.(isPit ? null : probeKey)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: isPit ? "#3b82f620" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isPit ? "#3b82f660" : "transparent" }}>
                        <Feather name="wind" size={11} color={isPit ? "#3b82f6" : colors.mutedForeground} />
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isPit ? "#3b82f6" : colors.mutedForeground }}>Pit</Text>
                        {isPit && <Feather name="check" size={10} color="#3b82f6" />}
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={s.meaterTempsRow}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#FF6B2B" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{probe.internalTempF != null ? `${probe.internalTempF}°F` : "—"}</Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Internal</Text>
                </View>
              </View>
              <View style={s.meaterTempChip}>
                <Feather name="wind" size={14} color="#3b82f6" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{probe.ambientTempF != null ? `${probe.ambientTempF}°F` : "—"}</Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Ambient</Text>
                </View>
              </View>
              {(probe.targetMinTempF != null || probe.targetMaxTempF != null) && (
                <View style={s.meaterTempChip}>
                  <Feather name="target" size={14} color="#22c55e" />
                  <View>
                    <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{probe.targetMinTempF}–{probe.targetMaxTempF}°F</Text>
                    <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Target</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {/* ThermoWorks rows — each channel can be assigned Meat or Pit */}
      {tempMode === "probe" && thermoworksLinked === true && thermoworksProbes.map((probe: any, i: number) => {
        const probeKey = `tw_${probe.deviceId}_${probe.channelNumber}`;
        const isMeat = selectedMeatProbeId === probeKey;
        const isPit = selectedPitProbeId === probeKey;
        const otherCook = otherCookAssignments[probeKey];
        const lockedByOther = !!otherCook && !isMeat && !isPit;
        const isEditing = editingLabelKey === probeKey;
        return (
          <View
            key={`tw-${probe.deviceId}-${probe.channelNumber}-${i}`}
            style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12,
              ...(isMeat ? { borderWidth: 1.5, borderColor: "#FF6B2B60", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#FF6B2B08" } :
                  isPit  ? { borderWidth: 1.5, borderColor: "#3b82f660", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#3b82f608" } : {}),
            }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                {isEditing ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput value={labelDraft} onChangeText={setLabelDraft} placeholder={probe.channelLabel ?? `Ch ${probe.channelNumber}`} placeholderTextColor={colors.mutedForeground}
                      style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 2 }}
                      autoFocus returnKeyType="done"
                      onSubmitEditing={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }} />
                    <Pressable hitSlop={8} onPress={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }}><Feather name="check" size={14} color="#22c55e" /></Pressable>
                    <Pressable hitSlop={8} onPress={() => setEditingLabelKey(null)}><Feather name="x" size={14} color={colors.mutedForeground} /></Pressable>
                  </View>
                ) : (
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                    {probeLabels[probeKey] ?? (probe.channelLabel ? `${probe.deviceName} · ${probe.channelLabel}` : `${probe.deviceName} · Ch ${probe.channelNumber}`)}
                    {!probeLabels[probeKey] ? "  ·  ThermoWorks" : ""}
                  </Text>
                )}
              </View>
              {!isEditing && (
                <Pressable hitSlop={8} onPress={() => { setEditingLabelKey(probeKey); setLabelDraft(probeLabels[probeKey] ?? ""); }}>
                  <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
            <View style={[s.meaterTempsRow, { marginBottom: 8 }]}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#B22222" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{probe.tempF != null ? `${probe.tempF}°F` : "—"}</Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Temperature</Text>
                </View>
              </View>
            </View>
            {lockedByOther ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.mutedForeground + "12", alignSelf: "flex-start" }}>
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>Used by {otherCook}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                {otherCook && (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground }}>⚠ {otherCook}</Text>
                )}
                <Pressable onPress={() => onSelectMeatProbe?.(isMeat ? null : probeKey)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: isMeat ? "#FF6B2B20" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isMeat ? "#FF6B2B60" : "transparent" }}>
                  <Feather name="thermometer" size={11} color={isMeat ? "#FF6B2B" : colors.mutedForeground} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isMeat ? "#FF6B2B" : colors.mutedForeground }}>Meat</Text>
                  {isMeat && <Feather name="check" size={10} color="#FF6B2B" />}
                </Pressable>
                <Pressable onPress={() => onSelectPitProbe?.(isPit ? null : probeKey)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: isPit ? "#3b82f620" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isPit ? "#3b82f660" : "transparent" }}>
                  <Feather name="wind" size={11} color={isPit ? "#3b82f6" : colors.mutedForeground} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isPit ? "#3b82f6" : colors.mutedForeground }}>Pit</Text>
                  {isPit && <Feather name="check" size={10} color="#3b82f6" />}
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {/* Inkbird BLE rows — each channel can be assigned Meat or Pit */}
      {tempMode === "probe" && inkbirdProbes.map((probe, i) => {
        const probeKey = `ble_${probe.deviceId}_${probe.probeIndex}`;
        const isMeat = selectedMeatProbeId === probeKey;
        const isPit = selectedPitProbeId === probeKey;
        const otherCook = otherCookAssignments[probeKey];
        const lockedByOther = !!otherCook && !isMeat && !isPit;
        const isEditing = editingLabelKey === probeKey;
        return (
          <View
            key={`ble-${probe.deviceId}-${probe.probeIndex}-${i}`}
            style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12,
              ...(isMeat ? { borderWidth: 1.5, borderColor: "#FF6B2B60", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#FF6B2B08" } :
                  isPit  ? { borderWidth: 1.5, borderColor: "#3b82f660", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#3b82f608" } : {}),
            }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
                <Feather name="bluetooth" size={11} color="#3B82F6" />
                {isEditing ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <TextInput value={labelDraft} onChangeText={setLabelDraft} placeholder={`${probe.deviceName} Ch ${probe.probeIndex + 1}`} placeholderTextColor={colors.mutedForeground}
                      style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 2 }}
                      autoFocus returnKeyType="done"
                      onSubmitEditing={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }} />
                    <Pressable hitSlop={8} onPress={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }}><Feather name="check" size={14} color="#22c55e" /></Pressable>
                    <Pressable hitSlop={8} onPress={() => setEditingLabelKey(null)}><Feather name="x" size={14} color={colors.mutedForeground} /></Pressable>
                  </View>
                ) : (
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0, flex: 1 }]} numberOfLines={1}>
                    {probeLabels[probeKey] ?? `${probe.deviceName}  ·  Ch ${probe.probeIndex + 1}  ·  Inkbird`}
                  </Text>
                )}
              </View>
              {!isEditing && (
                <Pressable hitSlop={8} onPress={() => { setEditingLabelKey(probeKey); setLabelDraft(probeLabels[probeKey] ?? ""); }} style={{ paddingLeft: 8 }}>
                  <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
            <View style={[s.meaterTempsRow, { marginBottom: 8 }]}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#3B82F6" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{probe.tempF != null ? `${Math.round(probe.tempF)}°F` : "—"}</Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Temperature</Text>
                </View>
              </View>
            </View>
            {lockedByOther ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.mutedForeground + "12", alignSelf: "flex-start" }}>
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>Used by {otherCook}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                {otherCook && (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground }}>⚠ {otherCook}</Text>
                )}
                <Pressable onPress={() => onSelectMeatProbe?.(isMeat ? null : probeKey)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: isMeat ? "#FF6B2B20" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isMeat ? "#FF6B2B60" : "transparent" }}>
                  <Feather name="thermometer" size={11} color={isMeat ? "#FF6B2B" : colors.mutedForeground} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isMeat ? "#FF6B2B" : colors.mutedForeground }}>Meat</Text>
                  {isMeat && <Feather name="check" size={10} color="#FF6B2B" />}
                </Pressable>
                <Pressable onPress={() => onSelectPitProbe?.(isPit ? null : probeKey)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: isPit ? "#3b82f620" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isPit ? "#3b82f660" : "transparent" }}>
                  <Feather name="wind" size={11} color={isPit ? "#3b82f6" : colors.mutedForeground} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isPit ? "#3b82f6" : colors.mutedForeground }}>Pit</Text>
                  {isPit && <Feather name="check" size={10} color="#3b82f6" />}
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {/* BLE context device rows — ambient bundled; user can assign Meat or Pit role */}
      {tempMode === "probe" && bleContextDevices.map((device, i) => {
        const probeKey = `bleCtx_${device.id}`;
        const isMeat = selectedMeatProbeId === probeKey;
        const isPit = selectedPitProbeId === probeKey;
        const otherCook = otherCookAssignments[probeKey];
        const lockedByOther = !!otherCook && !isMeat && !isPit;
        const isEditing = editingLabelKey === probeKey;
        const hasAmbient = device.ambientTempF != null;
        return (
          <View
            key={`bleCtx-${device.id}-${i}`}
            style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12,
              ...(isMeat ? { borderWidth: 1.5, borderColor: "#FF6B2B60", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#FF6B2B08" } :
                  isPit  ? { borderWidth: 1.5, borderColor: "#3b82f660", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#3b82f608" } : {}),
            }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, flexWrap: "wrap" }}>
                <Feather name="bluetooth" size={11} color="#3B82F6" />
                {isEditing ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <TextInput value={labelDraft} onChangeText={setLabelDraft} placeholder={device.name} placeholderTextColor={colors.mutedForeground}
                      style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 2 }}
                      autoFocus returnKeyType="done"
                      onSubmitEditing={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }} />
                    <Pressable hitSlop={8} onPress={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }}><Feather name="check" size={14} color="#22c55e" /></Pressable>
                    <Pressable hitSlop={8} onPress={() => setEditingLabelKey(null)}><Feather name="x" size={14} color={colors.mutedForeground} /></Pressable>
                  </View>
                ) : (
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>{probeLabels[probeKey] ?? device.name}</Text>
                )}
                {device.batteryPct != null && !isEditing && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 99, backgroundColor: device.batteryPct > 50 ? "#22c55e20" : device.batteryPct > 20 ? "#EAB30820" : "#ef444420" }}>
                    <Feather name="battery" size={9} color={device.batteryPct > 50 ? "#22c55e" : device.batteryPct > 20 ? "#EAB308" : "#ef4444"} />
                    <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: device.batteryPct > 50 ? "#22c55e" : device.batteryPct > 20 ? "#EAB308" : "#ef4444" }}>{device.batteryPct}%</Text>
                  </View>
                )}
              </View>
              {!isEditing && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pressable hitSlop={8} onPress={() => { setEditingLabelKey(probeKey); setLabelDraft(probeLabels[probeKey] ?? ""); }}>
                    <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                  </Pressable>
                  {lockedByOther ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.mutedForeground + "15" }}>
                      <Feather name="lock" size={9} color={colors.mutedForeground} />
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Used by {otherCook}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {otherCook && (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground }}>⚠ {otherCook}</Text>
                      )}
                      <Pressable onPress={() => onSelectMeatProbe?.(isMeat ? null : probeKey)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: isMeat ? "#FF6B2B20" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isMeat ? "#FF6B2B60" : "transparent" }}>
                        <Feather name="thermometer" size={11} color={isMeat ? "#FF6B2B" : colors.mutedForeground} />
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isMeat ? "#FF6B2B" : colors.mutedForeground }}>Meat</Text>
                        {isMeat && <Feather name="check" size={10} color="#FF6B2B" />}
                      </Pressable>
                      <Pressable onPress={() => onSelectPitProbe?.(isPit ? null : probeKey)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: isPit ? "#3b82f620" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isPit ? "#3b82f660" : "transparent" }}>
                        <Feather name="wind" size={11} color={isPit ? "#3b82f6" : colors.mutedForeground} />
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isPit ? "#3b82f6" : colors.mutedForeground }}>Pit</Text>
                        {isPit && <Feather name="check" size={10} color="#3b82f6" />}
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={s.meaterTempsRow}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#FF6B2B" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{device.probeTempF != null ? `${device.probeTempF}°F` : "—"}</Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Internal</Text>
                </View>
              </View>
              {hasAmbient && (
                <View style={s.meaterTempChip}>
                  <Feather name="wind" size={14} color="#3b82f6" />
                  <View>
                    <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{device.ambientTempF}°F</Text>
                    <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Ambient / Pit</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {noneSelected && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: "#FF6B2B08", borderWidth: 1, borderColor: "#FF6B2B25" }}>
          <Feather name="info" size={13} color="#FF6B2B" />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, flex: 1 }}>
            Assign a probe role above — tap Meat for internal temp, Pit for grill temp.
          </Text>
        </View>
      )}

      {/* LAN probe rows (Fireboard, MEATER Block, ThermoWorks Signals) — user assigns Meat or Pit */}
      {tempMode === "probe" && lanProbes.map((probe, i) => {
        const probeKey = `lan_${probe.deviceId}`;
        const isMeat = selectedMeatProbeId === probeKey;
        const isPit = selectedPitProbeId === probeKey;
        const otherCook = otherCookAssignments[probeKey];
        const lockedByOther = !!otherCook && !isMeat && !isPit;
        const isEditing = editingLabelKey === probeKey;
        return (
          <View
            key={`lan-${probe.deviceId}-${i}`}
            style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12,
              ...(isMeat ? { borderWidth: 1.5, borderColor: "#FF6B2B60", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#FF6B2B08" } :
                  isPit  ? { borderWidth: 1.5, borderColor: "#3b82f660", borderRadius: 10, marginHorizontal: 8, marginTop: 6, backgroundColor: "#3b82f608" } : {}),
            }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
                <Feather name="wifi" size={11} color="#0EA5E9" />
                {isEditing ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <TextInput value={labelDraft} onChangeText={setLabelDraft} placeholder={probe.channelLabel ?? probe.deviceName} placeholderTextColor={colors.mutedForeground}
                      style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 2 }}
                      autoFocus returnKeyType="done"
                      onSubmitEditing={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }} />
                    <Pressable hitSlop={8} onPress={() => { onSetProbeLabel?.(probeKey, labelDraft); setEditingLabelKey(null); }}><Feather name="check" size={14} color="#22c55e" /></Pressable>
                    <Pressable hitSlop={8} onPress={() => setEditingLabelKey(null)}><Feather name="x" size={14} color={colors.mutedForeground} /></Pressable>
                  </View>
                ) : (
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                    {probeLabels[probeKey] ?? `${probe.deviceName} · ${probe.channelLabel}`}
                  </Text>
                )}
              </View>
              {!isEditing && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pressable hitSlop={8} onPress={() => { setEditingLabelKey(probeKey); setLabelDraft(probeLabels[probeKey] ?? ""); }}>
                    <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                  </Pressable>
                  {lockedByOther ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.mutedForeground + "15" }}>
                      <Feather name="lock" size={9} color={colors.mutedForeground} />
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Used by {otherCook}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {otherCook && (
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground }}>⚠ {otherCook}</Text>
                      )}
                      <Pressable onPress={() => onSelectMeatProbe?.(isMeat ? null : probeKey)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: isMeat ? "#FF6B2B20" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isMeat ? "#FF6B2B60" : "transparent" }}>
                        <Feather name="thermometer" size={11} color={isMeat ? "#FF6B2B" : colors.mutedForeground} />
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isMeat ? "#FF6B2B" : colors.mutedForeground }}>Meat</Text>
                        {isMeat && <Feather name="check" size={10} color="#FF6B2B" />}
                      </Pressable>
                      <Pressable onPress={() => onSelectPitProbe?.(isPit ? null : probeKey)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: isPit ? "#3b82f620" : colors.mutedForeground + "12", borderWidth: 1, borderColor: isPit ? "#3b82f660" : "transparent" }}>
                        <Feather name="wind" size={11} color={isPit ? "#3b82f6" : colors.mutedForeground} />
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isPit ? "#3b82f6" : colors.mutedForeground }}>Pit</Text>
                        {isPit && <Feather name="check" size={10} color="#3b82f6" />}
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={s.meaterTempsRow}>
              <View style={s.meaterTempChip}>
                <Feather name="thermometer" size={14} color="#0EA5E9" />
                <View>
                  <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{probe.probeTempF}°F</Text>
                  <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Internal</Text>
                </View>
              </View>
              {probe.ambientTempF != null && (
                <View style={s.meaterTempChip}>
                  <Feather name="wind" size={14} color="#3b82f6" />
                  <View>
                    <Text style={[s.meaterTempValue, { color: colors.foreground }]}>{probe.ambientTempF}°F</Text>
                    <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Ambient / Pit</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
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

            </View>
          ) : pitMasterAnalyzing ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                Analyzing your cook…
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, paddingVertical: 4 }}>
              Log your first check-in to get live coaching.
            </Text>
          )}

          {/* ── Hub action row ─────────────────────────────────── */}
          {(lastCheckinInternalTempF != null || lastAnalyzedAtMs != null) && (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
              {lastAnalyzedAtMs != null
                ? `Last check-in ${fmtLastChecked(lastAnalyzedAtMs, nowMs ?? Date.now())}${lastCheckinInternalTempF != null ? ` · ${Math.round(lastCheckinInternalTempF)}°F` : ""}`
                : lastCheckinInternalTempF != null
                ? `Last: ${Math.round(lastCheckinInternalTempF)}°F`
                : ""}
            </Text>
          )}
          {nextCheckinMs != null && nextCheckinLabel != null && (() => {
            const now = nowMs ?? Date.now();
            const diffMs = nextCheckinMs - now;
            const mins = Math.floor(diffMs / 60000);
            const timeLabel = mins <= 5 ? "Soon" : `in ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`}`;
            const hasMore = upcomingCheckins.length > 0;
            return (
              <View style={{ marginTop: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Pressable
                    onPress={onCheckInNext}
                    disabled={!onCheckInNext}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    {({ pressed }) => (
                      <Text style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 11,
                        color: pressed ? "#FF6B2B" : colors.mutedForeground,
                        textDecorationLine: onCheckInNext ? "underline" : "none",
                        textDecorationColor: colors.mutedForeground,
                      }}>
                        {`Next: ${nextCheckinLabel} · ${timeLabel}`}
                      </Text>
                    )}
                  </Pressable>
                  {hasMore && (
                    <Pressable
                      onPress={() => setTimelineExpanded((v) => !v)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Feather
                        name={timelineExpanded ? "chevron-up" : "chevron-down"}
                        size={11}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  )}
                </View>
                {hasMore && timelineExpanded && (
                  <View style={{ marginTop: 5, paddingLeft: 2 }}>
                    {upcomingCheckins.map((sc, i) => {
                      const diff = sc.scheduledAt - now;
                      const isLast = i === upcomingCheckins.length - 1;
                      return (
                        <View key={sc.id} style={{ flexDirection: "row", alignItems: "stretch" }}>
                          <View style={{ alignItems: "center", width: 14 }}>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.mutedForeground + "50", marginTop: 3 }} />
                            {!isLast && (
                              <View style={{ flex: 1, width: 1, backgroundColor: colors.mutedForeground + "25", marginTop: 2 }} />
                            )}
                          </View>
                          <Pressable
                            onPress={() => onCheckInPhase?.(sc)}
                            disabled={!onCheckInPhase}
                            style={({ pressed }) => ({
                              flex: 1,
                              paddingBottom: isLast ? 0 : 7,
                              opacity: pressed ? 0.6 : 1,
                            })}
                          >
                            {({ pressed }) => (
                              <Text style={{
                                fontFamily: "Inter_400Regular",
                                fontSize: 11,
                                color: pressed ? colors.foreground : colors.mutedForeground,
                                textDecorationLine: onCheckInPhase ? "underline" : "none",
                                textDecorationColor: colors.mutedForeground + "80",
                              }}>
                                {`${sc.phaseLabel} · ${fmtCountdown(diff)}`}
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={onCheckIn}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row" as const,
                alignItems: "center" as const,
                justifyContent: "center" as const,
                gap: 6,
                paddingVertical: 9,
                borderRadius: 8,
                backgroundColor: "#FF6B2B",
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Feather name="thermometer" size={13} color="#fff" />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" }}>Check In</Text>
            </Pressable>
            <Pressable
              onPress={onOpenChat}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row" as const,
                alignItems: "center" as const,
                justifyContent: "center" as const,
                gap: 6,
                paddingVertical: 9,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Feather name="message-circle" size={13} color={colors.mutedForeground} />
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.foreground }}>Chat</Text>
            </Pressable>
          </View>
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
