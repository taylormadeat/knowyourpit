import React from "react";
import Svg, { Path, Circle, Rect, Line, G } from "react-native-svg";
import { Feather } from "@expo/vector-icons";

export type GrillIconKind =
  | "pellet"
  | "kamado"
  | "offset"
  | "drum"
  | "kettle"
  | "gas"
  | "griddle"
  | "cabinet"
  | "default";

export function classifyGrillType(type: string | null | undefined): GrillIconKind {
  if (!type) return "default";
  const t = type.toLowerCase();
  if (t.includes("pellet")) return "pellet";
  if (t.includes("kamado") || t.includes("ceramic")) return "kamado";
  if (t.includes("reverse flow") || t.includes("offset")) return "offset";
  if (t.includes("drum")) return "drum";
  if (t.includes("kettle")) return "kettle";
  if (t.includes("griddle") || t.includes("flat top")) return "griddle";
  if (t.includes("cabinet") || t.includes("electric")) return "cabinet";
  if (t.includes("gas")) return "gas";
  return "default";
}

interface Props {
  type?: string | null;
  size?: number;
  color?: string;
}

export function GrillTypeIcon({ type, size = 20, color = "#fff" }: Props) {
  const kind = classifyGrillType(type);

  if (kind === "default") {
    return <Feather name="wind" size={size} color={color} />;
  }

  const stroke = color;
  const sw = 1.5;
  const common = {
    stroke,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {kind === "pellet" && (
        <G {...common}>
          {/* main barrel */}
          <Rect x="3" y="9" width="13" height="8" rx="1.5" />
          {/* hopper on the right */}
          <Path d="M16 11 L16 16 L20 16 L20 13 Z" />
          {/* legs */}
          <Path d="M5 17 L5 19 M14 17 L14 19" />
          {/* smokestack */}
          <Path d="M17 6 L16 9" />
        </G>
      )}

      {kind === "kamado" && (
        <G {...common}>
          {/* egg body */}
          <Path d="M12 3 C16 3 18 7 18 12 C18 17 15.5 19 12 19 C8.5 19 6 17 6 12 C6 7 8 3 12 3 Z" />
          {/* hinge band */}
          <Line x1="6.5" y1="13" x2="17.5" y2="13" />
          {/* stand legs */}
          <Path d="M9 19 L9 22 M15 19 L15 22" />
          {/* top vent */}
          <Path d="M11 3 L11 1.5 L13 1.5 L13 3" />
        </G>
      )}

      {kind === "offset" && (
        <G {...common}>
          {/* main cook chamber */}
          <Rect x="6" y="9" width="13" height="8" rx="2" />
          {/* side firebox (smaller) */}
          <Rect x="2" y="11" width="5" height="5" rx="0.5" />
          {/* smokestack */}
          <Path d="M18 6 L17 9" />
          {/* legs */}
          <Path d="M9 17 L9 19 M16 17 L16 19" />
        </G>
      )}

      {kind === "drum" && (
        <G {...common}>
          {/* vertical cylinder */}
          <Rect x="6" y="3" width="12" height="18" rx="1.5" />
          {/* lid band */}
          <Line x1="6" y1="7" x2="18" y2="7" />
          {/* mid band */}
          <Line x1="6" y1="15" x2="18" y2="15" />
          {/* feet */}
          <Path d="M9 21 L9 22.5 M15 21 L15 22.5" />
        </G>
      )}

      {kind === "kettle" && (
        <G {...common}>
          {/* bowl bottom */}
          <Path d="M3 11 C3 15 7 18 12 18 C17 18 21 15 21 11" />
          {/* lid line */}
          <Path d="M3 11 C3 9.5 5 8 12 8 C19 8 21 9.5 21 11" />
          {/* 3 legs */}
          <Line x1="6" y1="17" x2="5" y2="22" />
          <Line x1="12" y1="18" x2="12" y2="22" />
          <Line x1="18" y1="17" x2="19" y2="22" />
        </G>
      )}

      {kind === "gas" && (
        <G {...common}>
          {/* cookbox */}
          <Rect x="3" y="9" width="18" height="7" rx="1.5" />
          {/* legs */}
          <Path d="M5 16 L5 20 M19 16 L19 20" />
          {/* knobs */}
          <Circle cx="8" cy="13" r="0.8" fill={stroke} />
          <Circle cx="12" cy="13" r="0.8" fill={stroke} />
          <Circle cx="16" cy="13" r="0.8" fill={stroke} />
        </G>
      )}

      {kind === "griddle" && (
        <G {...common}>
          {/* flat top surface */}
          <Rect x="3" y="11" width="18" height="3.5" rx="0.5" />
          {/* legs */}
          <Path d="M5 14.5 L5 19 M19 14.5 L19 19" />
          {/* heat waves */}
          <Path d="M7 9 C7.5 8 8.5 8 9 9 M11 9 C11.5 8 12.5 8 13 9 M15 9 C15.5 8 16.5 8 17 9" />
        </G>
      )}

      {kind === "cabinet" && (
        <G {...common}>
          {/* tall box */}
          <Rect x="5" y="3" width="14" height="18" rx="1.5" />
          {/* shelf lines */}
          <Line x1="5" y1="9" x2="19" y2="9" />
          <Line x1="5" y1="15" x2="19" y2="15" />
          {/* door handle */}
          <Circle cx="16.5" cy="6" r="0.6" fill={stroke} />
          <Circle cx="16.5" cy="12" r="0.6" fill={stroke} />
          <Circle cx="16.5" cy="18" r="0.6" fill={stroke} />
        </G>
      )}
    </Svg>
  );
}
