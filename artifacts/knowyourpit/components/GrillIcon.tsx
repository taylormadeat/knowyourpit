import React from "react";
import Svg, { Path, Rect, Line, Ellipse } from "react-native-svg";

interface GrillIconProps {
  color: string;
  size?: number;
}

export function GrillIcon({ color, size = 24 }: GrillIconProps) {
  const scale = size / 24;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Flame */}
      <Path
        d="M12 1.5C11.2 3.2 9.8 4.5 10.2 6.2C10.5 7.5 11.5 7.2 12 7C12.5 7.2 13.5 7.5 13.8 6.2C14.2 4.5 12.8 3.2 12 1.5Z"
        fill={color}
        opacity={0.85}
      />
      {/* Grate bar */}
      <Rect x="3" y="9" width="18" height="2" rx="0.8" fill={color} />
      {/* Grate slats */}
      <Line x1="7" y1="9" x2="7" y2="11" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <Line x1="10" y1="9" x2="10" y2="11" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <Line x1="14" y1="9" x2="14" y2="11" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <Line x1="17" y1="9" x2="17" y2="11" stroke={color} strokeWidth="1" strokeLinecap="round" />
      {/* Bowl (kettle body) */}
      <Path
        d="M3 11 Q3 19.5 12 19.5 Q21 19.5 21 11"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Legs */}
      <Line x1="7.5" y1="19" x2="5.5" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="12" y1="19.5" x2="12" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="16.5" y1="19" x2="18.5" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}
