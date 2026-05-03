import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import { relCountdown } from "./utils";
import type { SequenceData } from "./types";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
}

function fmtTime(ms: number | null): string {
  if (ms == null) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function FrozenTimeline({ c, colors, cookStatus, nowMs }: Props) {
  const [expanded, setExpanded] = useState(true);
  const fromFrozen = !!c?.fromFrozen;
  if (!fromFrozen) return null;

  const seq = (c.sequenceData as SequenceData | null | undefined) ?? null;
  const frozen = seq?.frozen ?? null;
  const thawStartMs = frozen?.thawStartAt ? new Date(frozen.thawStartAt).getTime() : null;
  const thawEndMs = frozen?.thawEndAt ? new Date(frozen.thawEndAt).getTime() : null;
  const preheatMs = c?.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
  const cookMs = preheatMs != null && c?.preheatMinutes != null
    ? preheatMs + c.preheatMinutes * 60_000
    : preheatMs;
  const pullMs = c?.plannedEndAt && c?.restMinutes != null
    ? new Date(c.plannedEndAt).getTime() - c.restMinutes * 60_000
    : c?.plannedEndAt
      ? new Date(c.plannedEndAt).getTime()
      : null;
  const serveMs = c?.plannedEndAt ? new Date(c.plannedEndAt).getTime() : null;

  const method: "fridge" | "cold_water" | null =
    (c?.thawMethod as "fridge" | "cold_water" | null | undefined) ??
    frozen?.method ??
    null;
  const methodLabel =
    method === "cold_water" ? "Cold-water thaw" : method === "fridge" ? "Fridge thaw" : "Thaw";

  const rows: Array<{
    key: string;
    color: string;
    label: string;
    time: number | null;
    sub?: string | null;
  }> = [
    {
      key: "thaw_start",
      color: "#3B82F6",
      label: `Move to ${method === "cold_water" ? "cold water" : "fridge"}`,
      time: thawStartMs,
      sub: methodLabel,
    },
    {
      key: "thaw_end",
      color: "#06B6D4",
      label: "Thawed — start tempering",
      time: thawEndMs,
      sub: "~90 min temper before grill",
    },
    {
      key: "preheat",
      color: "#f59e0b",
      label: "Light grill / preheat",
      time: preheatMs,
      sub: c?.preheatMinutes ? `${c.preheatMinutes} min preheat` : null,
    },
    {
      key: "meat_on",
      color: "#EB6C2B",
      label: "Meat on",
      time: cookMs,
      sub: null,
    },
    {
      key: "pull",
      color: "#22c55e",
      label: "Pull off",
      time: pullMs,
      sub: c?.restMinutes ? `${c.restMinutes} min rest` : null,
    },
    {
      key: "serve",
      color: "#6366f1",
      label: "Ready to serve",
      time: serveMs,
      sub: null,
    },
  ];

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          overflow: "hidden",
        },
      ]}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={[
          s.seqScheduleHeader,
          { borderBottomWidth: expanded ? 1 : 0, borderBottomColor: colors.border },
        ]}
      >
        <LinearGradient colors={["#3B82F6", "#06B6D4"]} style={s.seqScheduleIcon}>
          <Feather name="cloud-snow" size={14} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.seqScheduleTitle, { color: colors.foreground }]}>
            Frozen-to-Table Timeline
          </Text>
          <Text style={[s.seqScheduleSub, { color: colors.mutedForeground }]}>
            {methodLabel}
            {thawStartMs != null ? ` · starts ${fmtTime(thawStartMs)}` : ""}
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {expanded && (
        <View style={{ padding: 12 }}>
          {rows.map((r, i) => {
            const isDone =
              r.time != null && (cookStatus === "active" || cookStatus === "completed") && r.time < nowMs;
            const isLast = i === rows.length - 1;
            return (
              <View
                key={r.key}
                style={[s.seqTlRow, isDone && s.seqTlDoneRow, { marginBottom: isLast ? 0 : 8 }]}
              >
                <View style={[s.seqTlDot, { backgroundColor: r.color, opacity: isDone ? 0.45 : 1 }]} />
                {isLast ? (
                  <View style={[s.seqTlConnector, { borderColor: "transparent" }]} />
                ) : (
                  <View style={s.seqTlConnector} />
                )}
                <View style={{ flex: 1 }}>
                  <View style={s.seqTlLabelRow}>
                    <Text
                      style={[
                        s.seqTlLabel,
                        { color: colors.mutedForeground },
                        isDone && s.seqTlDoneLabel,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.seqTlTime,
                      {
                        color: isDone ? colors.mutedForeground : colors.foreground,
                        opacity: isDone ? 0.55 : 1,
                      },
                    ]}
                  >
                    {r.time != null ? fmtTime(r.time) : "—"}
                    {r.time != null && cookStatus !== "completed" && cookStatus !== "cancelled" && !isDone && (
                      <Text style={[s.seqTlMeta, { color: r.color }]}>
                        {" "}· {relCountdown(r.time, nowMs)}
                      </Text>
                    )}
                    {r.sub ? (
                      <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                        {" "}· {r.sub}
                      </Text>
                    ) : null}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
