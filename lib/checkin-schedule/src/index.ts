/**
 * @workspace/checkin-schedule
 *
 * Single source of truth for check-in phase definitions and schedule
 * generation logic.  Imported by both the API server (cookCheckins.ts)
 * and the mobile app (constants/checkinKnowledge.ts re-exports from here).
 *
 * No React / React Native / Node.js-specific APIs are used so this package
 * is safe to import in any environment.
 */

export type CheckinStatusFlag = "all_good" | "running_behind" | "flare_up" | "low_fuel";

export interface CheckinPhase {
  key: string;
  label: string;
  anchorPercent: number;
  expectedInternalTempRange: [number, number] | null;
  visualCues: string[];
  prepForNext: string;
  coachingTemplate: string;
  isVisualMilestone?: boolean;
}

export interface MeatCheckinSchedule {
  meatType: string;
  phases: CheckinPhase[];
}

export const CHECKIN_SCHEDULES: MeatCheckinSchedule[] = [
  {
    meatType: "brisket",
    phases: [
      {
        key: "brisket_early",
        label: "Early Smoke",
        anchorPercent: 0.15,
        expectedInternalTempRange: [120, 145],
        visualCues: [
          "Smoke should be thin and blue — avoid thick white smoke",
          "Bark starting to form on the surface",
          "Fat cap beginning to render and pull back slightly",
        ],
        prepForNext: "Prepare your spritz/mop (apple cider vinegar + water or your mop sauce) for the next few hours",
        coachingTemplate:
          "Early smoke phase for brisket. Check for clean blue smoke and early bark development.",
        isVisualMilestone: true,
      },
      {
        key: "brisket_bark_lock",
        label: "Bark Lock",
        anchorPercent: 0.30,
        expectedInternalTempRange: [145, 160],
        visualCues: [
          "Bark forming dark reddish-brown crust — firm and dry to the touch",
          "Fat cap showing deep render lines and pulling back",
          "Smoke ring visible when a corner is sliced open",
        ],
        prepForNext: "Start spritzing or mopping every 45–60 min if bark is getting too dark; hold off if it still needs development",
        coachingTemplate:
          "Bark lock check for brisket. This is the window to lock in bark before the stall — manage moisture carefully.",
        isVisualMilestone: true,
      },
      {
        key: "brisket_stall_entry",
        label: "Stall Entry",
        anchorPercent: 0.45,
        expectedInternalTempRange: [150, 165],
        visualCues: [
          "Bark should be dark mahogany and firm to touch",
          "Fat cap well-rendered with cracks forming",
          "Surface dry and crusty — no more glistening",
        ],
        prepForNext: "Decide on wrap: foil for faster finish, butcher paper for crispier bark",
        coachingTemplate:
          "Approaching or entering the stall — this is normal. Bark should be set before wrapping.",
        isVisualMilestone: true,
      },
      {
        key: "brisket_wrap_decision",
        label: "Wrap Decision",
        anchorPercent: 0.55,
        expectedInternalTempRange: [160, 175],
        visualCues: [
          "Bark is fully locked — dark, firm, and not sticky",
          "Flat side should show good smoke ring in a test poke",
          "Thermometer should meet noticeable resistance",
        ],
        prepForNext:
          "Get your butcher paper or foil ready. Have tallow or a pat of butter for the wrap if using foil",
        coachingTemplate: "Wrap decision point for brisket. Evaluate bark before wrapping.",
        isVisualMilestone: true,
      },
      {
        key: "brisket_finishing",
        label: "Finishing",
        anchorPercent: 0.78,
        expectedInternalTempRange: [185, 200],
        visualCues: [
          "Probe should push through with reduced resistance",
          "Flat and point both feeling soft",
          "Juices pooling inside wrap (if wrapped)",
        ],
        prepForNext:
          "Prepare your hot-hold cooler or oven (170°F) for resting. Get towels ready to wrap the brisket",
        coachingTemplate:
          "Brisket finishing phase. Start probe-testing frequently. Target probe-tender feel, not just temperature.",
      },
      {
        key: "brisket_probe_tender",
        label: "Probe Tender Check",
        anchorPercent: 0.90,
        expectedInternalTempRange: [198, 210],
        visualCues: [
          "Probe slides in like warm butter with zero resistance",
          "Flat jiggles when the rack is shaken",
          "Point feels very soft when pressed through the wrap",
        ],
        prepForNext:
          "Set up your rest station — towel-wrap in a cooler for 1–2 hours minimum",
        coachingTemplate:
          "Final probe-tender check for brisket. Don't pull by temperature alone — pull when the probe slides in like warm butter.",
      },
      {
        key: "brisket_rest",
        label: "Rest & Hold",
        anchorPercent: 0.97,
        expectedInternalTempRange: [155, 175],
        visualCues: [
          "Brisket wrapped and resting in cooler or oven at 170°F",
          "Internal temp should be holding above 155°F after 1 hour",
          "Juices redistributing — check wrap is tight to retain heat",
        ],
        prepForNext:
          "Prepare your slicing board, serrated knife, and serving vessel. Begin slicing only when internal is still above 145°F",
        coachingTemplate:
          "Rest check for brisket. A proper 1–2 hour rest is non-negotiable for juice retention — slice too early and you'll lose everything.",
        isVisualMilestone: true,
      },
    ],
  },
  {
    meatType: "ribs",
    phases: [
      {
        key: "ribs_3h_mark",
        label: "3-Hour Check",
        anchorPercent: 0.3,
        expectedInternalTempRange: [155, 175],
        visualCues: [
          "Bark developing nicely — dark reddish-brown",
          "Meat starting to pull back from bone tips (~¼ inch)",
          "Surface dry and firm, not tacky",
        ],
        prepForNext:
          "Prepare your wrap ingredients: brown sugar, honey, and butter for the 2-hour braise",
        coachingTemplate:
          "3-hour check for ribs. Assess bark development and decide on wrap timing.",
        isVisualMilestone: true,
      },
      {
        key: "ribs_wrap",
        label: "Wrap & Braise",
        anchorPercent: 0.5,
        expectedInternalTempRange: [170, 190],
        visualCues: [
          "Bones pulling back ~¼ inch from the bone end",
          "Bark fully set — will survive the braise",
          "Color deep mahogany across the rack",
        ],
        prepForNext:
          "Layer your foil with brown sugar, honey, and butter. Flip the ribs meat-side down in the wrap",
        coachingTemplate:
          "Rib wrap phase. Good bark lock-in before braising is key — don't rush this step.",
      },
      {
        key: "ribs_unwrap",
        label: "Unwrap & Sauce",
        anchorPercent: 0.8,
        expectedInternalTempRange: [190, 200],
        visualCues: [
          "Rack bends significantly when held from one end",
          "Meat is very tender when pressed",
          "Juices run clear in the foil",
        ],
        prepForNext: "Prepare your glaze — thin layer, sauce set with 15 minutes of heat",
        coachingTemplate:
          "Unwrap and sauce phase for ribs. Apply thin glaze and let it set.",
        isVisualMilestone: true,
      },
    ],
  },
  {
    meatType: "pork shoulder",
    phases: [
      {
        key: "pork_bark_lock",
        label: "Bark Lock",
        anchorPercent: 0.25,
        expectedInternalTempRange: [145, 165],
        visualCues: [
          "Outer bark forming — dark reddish-brown crust",
          "Fat rendering and dripping",
          "Smoke ring forming around the edges",
        ],
        prepForNext: "Prepare spritz or mop (apple cider vinegar + juice, or your mop sauce) for the stall phase",
        coachingTemplate:
          "Bark development check for pork shoulder. Bark should be forming well before the stall.",
        isVisualMilestone: true,
      },
      {
        key: "pork_stall",
        label: "Stall Zone",
        anchorPercent: 0.45,
        expectedInternalTempRange: [155, 175],
        visualCues: [
          "Temperature plateaued — this is normal and can last 2–4 hours",
          "Bark should be solid and dark",
          "Moisture evaporating from the surface",
        ],
        prepForNext:
          "Decide if you want to wrap to speed through the stall. Have foil or butcher paper ready",
        coachingTemplate:
          "Pork shoulder stall zone — the stall is evaporative cooling, not a problem.",
      },
      {
        key: "pork_money_muscle",
        label: "Money Muscle Check",
        anchorPercent: 0.8,
        expectedInternalTempRange: [185, 195],
        visualCues: [
          "Money muscle (front cylinder) pulling away from the bone",
          "Shoulder feeling soft when pressed through the foil",
          "Bone wiggling slightly when twisted",
        ],
        prepForNext:
          "Prepare rest station. The money muscle finishes before the rest — pull slightly early if slicing",
        coachingTemplate:
          "Money muscle check for pork shoulder — it finishes earlier than the rest of the shoulder.",
        isVisualMilestone: true,
      },
      {
        key: "pork_pull_ready",
        label: "Pull Ready",
        anchorPercent: 0.9,
        expectedInternalTempRange: [200, 210],
        visualCues: [
          "Bone comes out clean with a gentle twist",
          "Probe slides in with no resistance anywhere",
          "Meat falls apart with light pressure",
        ],
        prepForNext:
          "Set up your pulling station with gloves. Have foil pans and finishing sauce ready",
        coachingTemplate:
          "Pork shoulder pull-ready check. The bone should twist free cleanly.",
      },
    ],
  },
  {
    meatType: "chicken",
    phases: [
      {
        key: "chicken_140",
        label: "Grill Check",
        anchorPercent: 0.35,
        expectedInternalTempRange: [130, 145],
        visualCues: [
          "Skin starting to render and tighten",
          "Color turning golden yellow",
          "Juices beginning to run from the cavity",
        ],
        prepForNext: "Prepare your glaze for the final basting — apply when skin is firm",
        coachingTemplate:
          "Chicken mid-cook check. Skin rendering is key — avoid low temps that make skin rubbery.",
        isVisualMilestone: true,
      },
      {
        key: "chicken_155",
        label: "Skin Check",
        anchorPercent: 0.65,
        expectedInternalTempRange: [150, 162],
        visualCues: [
          "Skin should be deep golden to light mahogany",
          "Fat rendered and skin tight, not wobbly",
          "Juices running clear when thigh is pierced",
        ],
        prepForNext:
          "Apply first glaze coat now. One more application at pull for best sheen",
        coachingTemplate:
          "Chicken skin check — bite-through skin comes from rendering the fat cap under the skin.",
        isVisualMilestone: true,
      },
      {
        key: "chicken_pull",
        label: "Pull Check",
        anchorPercent: 0.85,
        expectedInternalTempRange: [170, 185],
        visualCues: [
          "Skin is deep mahogany and firm",
          "Juices running completely clear",
          "Joints flexible but not falling apart",
        ],
        prepForNext: "Apply final glaze and rest 5–10 minutes before serving",
        coachingTemplate:
          "Chicken approaching pull temperature. Pull at 175–180°F in the thickest thigh meat.",
      },
    ],
  },
  {
    meatType: "generic",
    phases: [
      {
        key: "generic_early",
        label: "Early Cook Check",
        anchorPercent: 0.25,
        expectedInternalTempRange: null,
        visualCues: [
          "Smoke quality: aim for thin, blue smoke",
          "Surface color developing evenly",
          "No hot spots or flare-ups",
        ],
        prepForNext: "Verify your grill temperature is stable at target",
        coachingTemplate:
          "Early cook check-in. Verify smoke quality and even heat distribution.",
        isVisualMilestone: true,
      },
      {
        key: "generic_mid",
        label: "Mid-Cook Check",
        anchorPercent: 0.5,
        expectedInternalTempRange: null,
        visualCues: [
          "Bark developing — surface color and texture",
          "Fat rendering and dripping properly",
          "Internal temp tracking with expected pace",
        ],
        prepForNext:
          "Evaluate if a wrap is needed to speed the cook or protect the bark",
        coachingTemplate: "Mid-cook check-in. Assess bark and decide on next steps.",
        isVisualMilestone: true,
      },
      {
        key: "generic_finishing",
        label: "Finishing Check",
        anchorPercent: 0.8,
        expectedInternalTempRange: null,
        visualCues: [
          "Probe resistance decreasing",
          "Surface color fully developed",
          "Preparing for the rest",
        ],
        prepForNext: "Set up rest station and have foil or butcher paper ready",
        coachingTemplate:
          "Finishing phase check-in. Start probe-testing frequently and prepare for rest.",
      },
    ],
  },
];

export function getCheckinSchedule(
  foodType: string | null | undefined,
): MeatCheckinSchedule {
  if (!foodType) return CHECKIN_SCHEDULES.find((s) => s.meatType === "generic")!;
  const lower = foodType.toLowerCase();
  if (lower.includes("brisket"))
    return CHECKIN_SCHEDULES.find((s) => s.meatType === "brisket")!;
  if (lower.includes("rib"))
    return CHECKIN_SCHEDULES.find((s) => s.meatType === "ribs")!;
  if (
    lower.includes("pork") ||
    lower.includes("butt") ||
    lower.includes("shoulder")
  )
    return CHECKIN_SCHEDULES.find((s) => s.meatType === "pork shoulder")!;
  if (lower.includes("chicken") || lower.includes("poultry"))
    return CHECKIN_SCHEDULES.find((s) => s.meatType === "chicken")!;
  return CHECKIN_SCHEDULES.find((s) => s.meatType === "generic")!;
}

export interface ScheduledCheckin {
  id: string;
  phaseKey: string;
  phaseLabel: string;
  scheduledAt: number;
  phase: CheckinPhase;
}

export interface CheckinSequenceAnchor {
  meatOnAt?: string | null;
  estimatedFinishAt?: string | null;
  wrapAtMinutes?: number | null;
  wrapTempF?: number | null;
}

/**
 * Compute the first-check-in offset (ms after meatOn) for a cook.
 *
 * Heavier cuts take longer to reach cooking temperature, so the first
 * meaningful check-in is pushed out a few minutes.
 *
 *   < 5 lbs  → 10 min  (chicken thighs, small roasts)
 *   5–12 lbs → 15 min  (standard brisket flat, pork butt)
 *  12–18 lbs → 20 min  (full packer brisket, large shoulders)
 *   > 18 lbs → 25 min  (competition-weight packer or whole hog sections)
 */
function firstCheckinOffsetMs(weightLbs: number | null | undefined): number {
  if (weightLbs == null) return 15 * 60 * 1000;
  if (weightLbs < 5) return 10 * 60 * 1000;
  if (weightLbs < 12) return 15 * 60 * 1000;
  if (weightLbs < 18) return 20 * 60 * 1000;
  return 25 * 60 * 1000;
}

/**
 * Generate the check-in schedule for a cook.
 *
 * When `sequenceAnchor` is supplied the function derives check-in times from
 * the AI-plan milestones (meatOn → wrap → pullOff) so notifications fire at
 * the exact moments the generated plan calls for attention.  When no anchor
 * is provided it falls back to percentage-of-total-duration positioning.
 *
 * `weightLbs` adjusts the first check-in offset so heavier cuts are not
 * interrupted before they have had a chance to develop bark or rise above
 * the initial stall zone.
 */
export function generateCheckinSchedule(
  foodType: string | null | undefined,
  meatOnAtMs: number,
  estimatedFinishAtMs: number,
  sequenceAnchor?: CheckinSequenceAnchor | null,
  weightLbs?: number | null,
): ScheduledCheckin[] {
  const meatSchedule = getCheckinSchedule(foodType);
  const totalDuration = estimatedFinishAtMs - meatOnAtMs;
  if (totalDuration <= 0) return [];

  const phases = meatSchedule.phases;

  if (sequenceAnchor?.wrapAtMinutes != null && sequenceAnchor.wrapAtMinutes > 0) {
    const wrapAtMs = meatOnAtMs + sequenceAnchor.wrapAtMinutes * 60 * 1000;

    /**
     * Fraction of total cook time that elapses before wrapping, clamped so
     * there is always a meaningful post-wrap window for active-cook phases.
     */
    const wrapFraction = Math.min(0.90, (wrapAtMs - meatOnAtMs) / totalDuration);

    /**
     * Phases with anchorPercent >= this threshold are post-cook rest/hold
     * phases that fire after estimatedFinishAt.
     */
    const POST_COOK_THRESHOLD = 0.95;

    /**
     * End of the active-cook scheduling window — leave 20 min before finish
     * so the last active phase does not collide with pull time.
     */
    const activeFinishMs = estimatedFinishAtMs - 20 * 60 * 1000;

    /**
     * First active-cook phase by anchorPercent — used to apply the
     * weight-based minimum offset floor.
     */
    const firstActivePhase = phases.find(
      (p) => p.anchorPercent < POST_COOK_THRESHOLD,
    );

    // Post-cook phase counter for spacing multiple rest phases apart.
    let postCookCount = 0;

    return phases
      .map((phase, idx) => {
        let scheduledAt: number;

        if (phase.anchorPercent >= POST_COOK_THRESHOLD) {
          // Post-cook rest/hold phase: fire at least 1 h after finish, each
          // successive rest phase pushed 60 min further.
          postCookCount += 1;
          scheduledAt = estimatedFinishAtMs + postCookCount * 60 * 60 * 1000;
        } else if (phase.anchorPercent < wrapFraction) {
          // Pre-wrap active phase: map this phase's anchorPercent proportionally
          // within [0, wrapFraction] → [meatOnAtMs, wrapAtMs].
          //
          // Example: ribs "3-Hour Check" anchorPercent=0.30, wrapFraction=0.60
          //   → fires at 50% of the pre-wrap window, i.e. 1.5 h into a 5 h cook.
          const preWrapPos = phase.anchorPercent / wrapFraction;
          const rawMs = meatOnAtMs + preWrapPos * (wrapAtMs - meatOnAtMs);

          // Apply weight-based minimum floor only to the very first check-in so
          // lighter cuts don't get checked before the bark has had time to form.
          scheduledAt =
            phase === firstActivePhase
              ? Math.max(rawMs, meatOnAtMs + firstCheckinOffsetMs(weightLbs))
              : rawMs;
        } else {
          // Post-wrap active phase: map this phase's anchorPercent proportionally
          // within [wrapFraction, POST_COOK_THRESHOLD] → [wrapAtMs, activeFinishMs].
          //
          // Example: ribs "Unwrap & Sauce" anchorPercent=0.80, wrapFraction=0.60
          //   → postWrapPos = (0.80-0.60)/(0.95-0.60) ≈ 0.57
          //   → fires at 57% of the post-wrap window.
          const postWrapRange = POST_COOK_THRESHOLD - wrapFraction;
          const postWrapPos = (phase.anchorPercent - wrapFraction) / postWrapRange;
          scheduledAt = wrapAtMs + postWrapPos * (activeFinishMs - wrapAtMs);
        }

        return {
          id: `${phase.key}_${idx}`,
          phaseKey: phase.key,
          phaseLabel: phase.label,
          scheduledAt,
          phase,
        };
      })
      .filter((sc) => sc.scheduledAt > meatOnAtMs);
  }

  return phases.map((phase, idx) => {
    const cappedPercent = Math.min(
      phase.anchorPercent,
      1 - (20 * 60 * 1000) / totalDuration,
    );
    const scheduledAt = meatOnAtMs + totalDuration * cappedPercent;
    return {
      id: `${phase.key}_${idx}`,
      phaseKey: phase.key,
      phaseLabel: phase.label,
      scheduledAt,
      phase,
    };
  });
}

/**
 * Reschedule remaining check-ins based on actual vs expected progress.
 * Returns a new list with adjusted scheduledAt times for uncompleted phases.
 */
export function rescheduleCheckins(
  scheduled: ScheduledCheckin[],
  completedPhaseKeys: Set<string>,
  actualInternalTempF: number | null,
  nowMs: number,
  estimatedFinishAtMs: number,
): ScheduledCheckin[] {
  if (actualInternalTempF == null) return scheduled;

  const nextUncompleted = scheduled.find(
    (sc) => !completedPhaseKeys.has(sc.phaseKey) && sc.scheduledAt > nowMs,
  );
  if (!nextUncompleted) return scheduled;

  const expectedRange = nextUncompleted.phase.expectedInternalTempRange;
  if (!expectedRange) return scheduled;

  const expectedMid = (expectedRange[0] + expectedRange[1]) / 2;
  const deltaF = actualInternalTempF - expectedMid;

  if (Math.abs(deltaF) < 10) return scheduled;

  const adjustFactor = Math.max(-0.25, Math.min(0.25, (deltaF / expectedMid) * 0.5));
  const remaining = estimatedFinishAtMs - nowMs;
  const shiftMs = adjustFactor * remaining;

  return scheduled.map((sc) => {
    if (completedPhaseKeys.has(sc.phaseKey) || sc.scheduledAt <= nowMs) return sc;
    const newScheduledAt = Math.max(nowMs + 5 * 60 * 1000, sc.scheduledAt - shiftMs);
    return { ...sc, scheduledAt: newScheduledAt };
  });
}

export const CHECKIN_STALL_THRESHOLD_F = 3;
export const CHECKIN_PIT_DRIFT_THRESHOLD_F = 25;
export const CHECKIN_AUTO_DISMISS_KEY = "checkin_auto_dismiss_enabled";
export const CHECKIN_NOTIF_IDS_KEY_PREFIX = "checkin_notif_ids_cook_";
