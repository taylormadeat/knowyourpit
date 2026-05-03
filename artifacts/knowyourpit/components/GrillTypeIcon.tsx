import React from "react";
import Svg, { Path, Rect, G } from "react-native-svg";
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
  if (t.includes("bullet")) return "cabinet";
  if (t.includes("kettle")) return "kettle";
  if (t.includes("griddle") || t.includes("flat top")) return "griddle";
  if (t.includes("cabinet") || t.includes("electric")) return "cabinet";
  if (t.includes("gas")) return "gas";
  if (t.includes("charcoal")) return "kettle";
  if (t.includes("combo")) return "pellet";
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

  // Filled silhouettes; accent details use fillOpacity for visual depth on
  // the orange gradient backgrounds where the icon is rendered.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === "pellet" && (
        <G fill={color}>
          {/* hopper (back) */}
          <Path d="M15 7 L20 7 L21 16 L15 16 Z" />
          {/* main barrel */}
          <Rect x="2.5" y="10" width="14" height="7.5" rx="1.5" />
          {/* legs */}
          <Rect x="4" y="17.5" width="1.5" height="3" />
          <Rect x="13" y="17.5" width="1.5" height="3" />
          {/* smokestack on lid */}
          <Rect x="6" y="6.5" width="1.5" height="4" />
          <Rect x="5.3" y="5.7" width="2.9" height="1" />
        </G>
      )}

      {kind === "kamado" && (
        <G fill={color}>
          {/* egg body */}
          <Path d="M12 3 C16.5 3 18.5 7.5 18.5 12 C18.5 17 15.5 19.5 12 19.5 C8.5 19.5 5.5 17 5.5 12 C5.5 7.5 7.5 3 12 3 Z" />
          {/* hinge band cutout (darker stripe via opacity) */}
          <Rect x="5.5" y="11.5" width="13" height="1" fillOpacity={0.35} />
          {/* top vent */}
          <Rect x="10.5" y="1" width="3" height="2.3" />
          {/* stand legs */}
          <Rect x="8" y="19.5" width="1.6" height="3" />
          <Rect x="14.4" y="19.5" width="1.6" height="3" />
        </G>
      )}

      {kind === "offset" && (
        <G fill={color}>
          {/* main cook chamber */}
          <Rect x="6" y="9.5" width="13" height="8" rx="2" />
          {/* side firebox */}
          <Rect x="1.5" y="11.5" width="5" height="5" rx="0.5" />
          {/* smokestack */}
          <Rect x="17.5" y="4.5" width="1.7" height="5" />
          <Rect x="16.7" y="3.7" width="3.3" height="1.1" />
          {/* legs */}
          <Rect x="8" y="17.5" width="1.5" height="3" />
          <Rect x="15.5" y="17.5" width="1.5" height="3" />
          {/* firebox door (accent) */}
          <Rect x="2.7" y="13" width="2.6" height="2.5" fillOpacity={0.35} />
        </G>
      )}

      {kind === "drum" && (
        <G fill={color}>
          {/* vertical cylinder */}
          <Rect x="5.5" y="2.5" width="13" height="18.5" rx="1.5" />
          {/* lid band accent */}
          <Rect x="5.5" y="6.5" width="13" height="0.8" fillOpacity={0.35} />
          {/* mid band accent */}
          <Rect x="5.5" y="14" width="13" height="0.8" fillOpacity={0.35} />
          {/* feet */}
          <Rect x="7.5" y="21" width="1.5" height="1.5" />
          <Rect x="15" y="21" width="1.5" height="1.5" />
        </G>
      )}

      {kind === "kettle" && (
        <G fill={color}>
          {/* lid dome */}
          <Path d="M3 12 C3 7.5 7 5 12 5 C17 5 21 7.5 21 12 Z" />
          {/* bowl bottom */}
          <Path d="M3 12 C3 16 7 18.5 12 18.5 C17 18.5 21 16 21 12 Z" />
          {/* lid handle on top */}
          <Rect x="11.25" y="3.5" width="1.5" height="2" />
          {/* lid/bowl seam (accent) */}
          <Rect x="3" y="11.6" width="18" height="0.8" fillOpacity={0.35} />
          {/* 3 legs */}
          <Path d="M6 18 L4.5 22.5 L6 22.5 L7.3 18.6 Z" />
          <Rect x="11.25" y="18.5" width="1.5" height="4" />
          <Path d="M18 18 L19.5 22.5 L18 22.5 L16.7 18.6 Z" />
        </G>
      )}

      {kind === "gas" && (
        <G fill={color}>
          {/* cookbox lid */}
          <Path d="M3 6.5 C3 5.5 4 4.5 5 4.5 H19 C20 4.5 21 5.5 21 6.5 V10 H3 Z" />
          {/* main body */}
          <Rect x="3" y="10" width="18" height="6" />
          {/* control panel band (accent) */}
          <Rect x="3" y="13.2" width="18" height="2.8" fillOpacity={0.35} />
          {/* knobs */}
          <Rect x="6.5" y="14" width="1.5" height="1.2" rx="0.4" />
          <Rect x="11.25" y="14" width="1.5" height="1.2" rx="0.4" />
          <Rect x="16" y="14" width="1.5" height="1.2" rx="0.4" />
          {/* legs */}
          <Rect x="4.5" y="16" width="1.5" height="5" />
          <Rect x="18" y="16" width="1.5" height="5" />
        </G>
      )}

      {kind === "griddle" && (
        <G fill={color}>
          {/* flat top surface */}
          <Rect x="2.5" y="10.5" width="19" height="4" rx="0.5" />
          {/* grease channel accent */}
          <Rect x="2.5" y="13" width="19" height="1" fillOpacity={0.35} />
          {/* heat waves */}
          <Path d="M6 8.5 C6.5 7 7.5 7 8 8.5 Z" />
          <Path d="M11 8.5 C11.5 7 12.5 7 13 8.5 Z" />
          <Path d="M16 8.5 C16.5 7 17.5 7 18 8.5 Z" />
          {/* legs */}
          <Rect x="4.5" y="14.5" width="1.5" height="5" />
          <Rect x="18" y="14.5" width="1.5" height="5" />
        </G>
      )}

      {kind === "cabinet" && (
        <G fill={color}>
          {/* tall box */}
          <Rect x="4.5" y="2.5" width="15" height="18.5" rx="1.5" />
          {/* shelf lines as accents */}
          <Rect x="4.5" y="8" width="15" height="0.8" fillOpacity={0.35} />
          <Rect x="4.5" y="14" width="15" height="0.8" fillOpacity={0.35} />
          {/* door handle */}
          <Rect x="16" y="11" width="1.2" height="3" rx="0.3" fillOpacity={0.55} />
          {/* feet */}
          <Rect x="5" y="21" width="2" height="1.5" />
          <Rect x="17" y="21" width="2" height="1.5" />
        </G>
      )}
    </Svg>
  );
}
