import React from "react";
import { View, Text, Pressable } from "react-native";
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
    liveGraphProbes, liveReadings, cardWidth, elapsedMs, remainingMs, estimatedFinishMs,
    setAlertSheetVisible, setAlertMode, activeCookAlerts, nowMs,
    targetTempF, cookTempF, nextSpritzMs, onViewDetails,
  } = p;

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
            {meaterLinked === true && meaterProbes.length > 0
              ? "Live probe · auto-updating every 15s"
              : meaterLinked === true
              ? "MEATER linked · no active probe detected"
              : "Timer running · link MEATER for live temps"}
          </Text>
        </View>
        <View style={[s.connectedBadgeSmall, { backgroundColor: "#FF6B2B18" }]}>
          <View style={[s.liveIndicator, { backgroundColor: "#FF6B2B" }]} />
          <Text style={[s.liveText, { color: "#FF6B2B" }]}>LIVE</Text>
        </View>
      </View>

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

      {meaterLinked === true && meaterProbes.length > 0 && liveReadings.length < 2 && (
        <View style={[s.liveGraphWrap, { borderTopColor: colors.border }]}>
          <Text style={[s.meaterPlaceholderText, { color: colors.mutedForeground, textAlign: "left" }]}>
            📡 Collecting readings — chart will appear shortly
          </Text>
        </View>
      )}

      {meaterLinked === true && meaterProbes.map((probe, i) => (
        <View key={probe.deviceId + i} style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12 }]}>
          <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
            {probe.deviceName}{probe.cookName ? ` · ${probe.cookName}` : ""}
          </Text>
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
        </View>
      ))}

      {thermoworksLinked === true && thermoworksProbes.map((probe, i) => (
        <View
          key={`tw-${probe.deviceId}-${probe.channelNumber}-${i}`}
          style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12 }]}
        >
          <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
            {probe.deviceName}
            {probe.channelLabel ? ` · ${probe.channelLabel}` : ` · Ch ${probe.channelNumber}`}
            {"  ·  ThermoWorks"}
          </Text>
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
        </View>
      ))}

      {meaterLinked !== true && thermoworksLinked !== true && (
        <View style={[s.meaterPlaceholder, { borderTopColor: colors.border }]}>
          <Feather name="thermometer" size={20} color={colors.mutedForeground} />
          <Text style={[s.meaterPlaceholderText, { color: colors.mutedForeground }]}>
            Link MEATER or ThermoWorks in Profile to see live probe data here.
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
