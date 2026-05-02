export const KCBS_CATEGORIES = ["chicken", "ribs", "pork", "brisket"] as const;
export type KcbsCategory = (typeof KCBS_CATEGORIES)[number];

export const KCBS_CATEGORY_LABEL: Record<KcbsCategory, string> = {
  chicken: "Chicken",
  ribs: "Ribs",
  pork: "Pork",
  brisket: "Brisket",
};

export const KCBS_CATEGORY_COLOR: Record<KcbsCategory, string> = {
  chicken: "#F59E0B",
  ribs: "#EF4444",
  pork: "#EC4899",
  brisket: "#8B5CF6",
};

export const KCBS_CATEGORY_FOOD_TYPE: Record<KcbsCategory, string> = {
  chicken: "Chicken Thighs (Bone-In)",
  ribs: "Spare Ribs (St. Louis)",
  pork: "Pork Shoulder / Boston Butt",
  brisket: "Brisket (Whole Packer)",
};

export const KCBS_CATEGORY_DEFAULT_WEIGHT_LBS: Record<KcbsCategory, number> = {
  chicken: 4,
  ribs: 4,
  pork: 9,
  brisket: 14,
};

export interface KcbsTurnInDefault {
  hour: number;
  minute: number;
}

export const KCBS_DEFAULT_TURN_INS: Record<KcbsCategory, KcbsTurnInDefault> = {
  chicken: { hour: 12, minute: 0 },
  ribs: { hour: 12, minute: 30 },
  pork: { hour: 13, minute: 0 },
  brisket: { hour: 13, minute: 30 },
};

export const BOX_PACK_LEAD_MINUTES = 15;

export interface CategoryJudgingTip {
  appearance: string;
  taste: string;
  texture: string;
  dq: string;
}

export const KCBS_JUDGING_TIPS: Record<KcbsCategory, CategoryJudgingTip> = {
  chicken: {
    appearance: "Bite-through skin is everything. Render fat under the skin or flip-and-render. Uniform mahogany color, glossy finish from a sweet glaze brushed on in the last 10–15 minutes.",
    taste: "Layered flavor: salt + sweet + heat. Brine 4–6 hours, season after pat-dry, finish with a thin glaze. Avoid harsh smoke — chicken takes smoke fast.",
    texture: "Tender but not mushy. Pull at 175–180°F internal in the thigh. Resting too long makes skin chewy.",
    dq: "Pulled or shredded chicken is a DQ. Marked or branded boxes are a DQ. Garnish only parsley/curly parsley/green leaf lettuce/kale/cilantro — anything else is a DQ.",
  },
  ribs: {
    appearance: "Even mahogany bark. Light glaze for shine, NOT heavy sauce. Six uniform bones cut clean between ribs, meat side up, all facing the same direction.",
    taste: "Sweet-forward profile wins. Layer rub + spritz + wrap with brown sugar/honey/butter. Sauce thin and consistent.",
    texture: "Bite-through. The judge should pull a clean half-moon bite — meat releases without tearing the whole rib off the bone. Pull-back of ~1/4 inch from the bone end.",
    dq: "Boneless ribs (other than country-style) are a DQ. Pulled rib meat is a DQ. Fall-off-the-bone is OVERCOOKED, not a winner.",
  },
  pork: {
    appearance: "Three presentations: money muscle medallions (sliced ¼\" thick, fanned), chunks (1.5\" cubes), and pulled. All three should glisten with a light glaze.",
    taste: "Pork shoulder is forgiving — focus on bark seasoning + injection (apple juice + phosphate or commercial). Sweet/savory balance, finishing glaze for sheen.",
    texture: "Money muscle slices firm, not falling apart. Chunks tender enough to bite cleanly but hold shape. Pulled should have visible bark mixed in, never dry.",
    dq: "Whole hog and other primal cuts other than Boston butt/picnic are not allowed. Pulled-only entries score lower for variety.",
  },
  brisket: {
    appearance: "Pencil-thick slices (¼\") shingled, perfect smoke ring, glossy bark. Burnt ends as cubes ½–¾\", glazed and caramelized. NO chopped brisket.",
    taste: "Beefy + salt + pepper foundation (Texas dalmatian rub). Wrap in butcher paper to retain bark. Burnt ends should be sweet/savory glazed.",
    texture: "The pull test: a slice held at one end should bend without breaking, then tear with gentle pull. Probes like warm butter at 203°F-ish. Rest 1–2 hours hot-held.",
    dq: "Sliced brisket must come from the flat, not the point (point goes to burnt ends). Chopped brisket is a DQ. Marked boxes are a DQ.",
  },
};

export const KCBS_BOX_PACKING_REMINDERS: string[] = [
  "Garnish base only: parsley, curly parsley, green leaf lettuce, kale, or cilantro. NO endive, NO red-tipped/orange/yellow lettuce — instant DQ.",
  "Never mark, brand, or initial the box. Six identical pieces minimum (chicken/ribs).",
  "Pack at 165°F+ to hold heat through judging. Use a hot box with a foil-wrapped warm brick if possible.",
  "Wipe sauce drips off the inside lip — judges deduct on appearance for sloppy presentation.",
];

// Per-category turn-in box checklist — surfaced as the body of the
// "Pack the turn-in box" timeline step in the competition session view so
// pitmasters get category-specific cues 15 minutes before turn-in.
export const KCBS_BOX_PACK_CATEGORY_TEXT: Record<KcbsCategory, string> = {
  chicken:
    "Box 6 uniform pieces, all same cut, glossy mahogany skin facing up. Garnish base, no sauce pools, hold ≥165°F.",
  ribs:
    "Cut 6 clean bones, meat-side up, all facing the same direction. Light glaze for sheen — no heavy sauce.",
  pork:
    "Pack three textures: money-muscle medallions fanned, 1.5\" chunks, and pulled with visible bark. Light glaze on top.",
  brisket:
    "9+ pencil-thick (¼\") slices shingled meat-side up + burnt-end cubes glazed. Slices must bend without breaking.",
};

export interface CompetitionContextOptions {
  competitionName?: string | null;
  categories: KcbsCategory[];
}

export function buildCompetitionContext(opts: CompetitionContextOptions): string {
  const lines: string[] = [];
  lines.push("=== KCBS COMPETITION MODE ===");
  if (opts.competitionName) {
    lines.push(`Competition: ${opts.competitionName}`);
  }
  lines.push(
    "This pitmaster is cooking a sanctioned KCBS BBQ competition. Each category has a strict turn-in time. Each entry is judged on Appearance (1–9), Taste (1–9), and Texture (1–9) by 6 judges; the lowest score is dropped. Coach for COMPETITION standards, not backyard.",
  );
  lines.push("");
  lines.push("Category-specific judging standards:");
  for (const cat of opts.categories) {
    const tips = KCBS_JUDGING_TIPS[cat];
    const label = KCBS_CATEGORY_LABEL[cat];
    lines.push(`- ${label.toUpperCase()}:`);
    lines.push(`  · Appearance: ${tips.appearance}`);
    lines.push(`  · Taste: ${tips.taste}`);
    lines.push(`  · Texture: ${tips.texture}`);
    lines.push(`  · DQ triggers: ${tips.dq}`);
  }
  lines.push("");
  lines.push("Box packing & timing:");
  lines.push(
    `- Add a "boxPackAt" timestamp for each item, exactly ${BOX_PACK_LEAD_MINUTES} minutes before that item's turnInAt. Slicing/portioning + box presentation MUST be done in this window.`,
  );
  for (const r of KCBS_BOX_PACKING_REMINDERS) lines.push(`- ${r}`);
  lines.push("");
  lines.push(
    "Backwards-plan EACH item independently to its own turnInAt (NOT to a shared serveAt). Build in a 30–60 minute hot-hold buffer for brisket and pork; chicken and ribs are tighter.",
  );
  return lines.join("\n");
}

export function getDefaultTurnInDate(category: KcbsCategory, baseDate: Date): Date {
  const def = KCBS_DEFAULT_TURN_INS[category];
  const d = new Date(baseDate);
  d.setHours(def.hour, def.minute, 0, 0);
  return d;
}

export const PLACEMENT_OPTIONS = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
  { value: 6, label: "6th–10th" },
  { value: 11, label: "11th–20th" },
  { value: 21, label: "Below 20th" },
  { value: 0, label: "DNP" },
] as const;

export function placementLabel(placement: number | null | undefined): string {
  if (placement == null) return "—";
  if (placement === 0) return "DNP";
  if (placement === 1) return "1st 🥇";
  if (placement === 2) return "2nd 🥈";
  if (placement === 3) return "3rd 🥉";
  if (placement <= 5) return `${placement}th`;
  if (placement <= 10) return "Top 10";
  if (placement <= 20) return "Top 20";
  return "Below 20th";
}

export function placementToScore(placement: number | null | undefined): number | null {
  if (placement == null) return null;
  if (placement === 0) return 50;
  if (placement === 1) return 100;
  if (placement === 2) return 92;
  if (placement === 3) return 85;
  if (placement <= 5) return 78;
  if (placement <= 10) return 70;
  if (placement <= 20) return 60;
  return 50;
}
