/**
 * Returns 3–4 suggested PitMaster questions tailored to the cook's food type
 * and cooking method.  Exported as a pure utility so it can be unit-tested
 * independently of the CookModals React component.
 */
export function getCookSuggestions(
  foodType: string | null | undefined,
  cookingMethod?: string | null,
): string[] {
  const lower = (foodType ?? "").toLowerCase();
  const method = (cookingMethod ?? "").toLowerCase();
  const isDirect =
    method.includes("direct") ||
    method.includes("sear") ||
    method.includes("griddle");

  // ── Direct-heat / grilling prompts ──────────────────────────────────────
  if (isDirect) {
    if (
      lower.includes("steak") ||
      lower.includes("ribeye") ||
      lower.includes("strip") ||
      lower.includes("tri-tip") ||
      lower.includes("tri tip")
    ) {
      return [
        "What internal temp should I target?",
        "When should I flip it?",
        "How long should I rest it?",
        "How do I get a better crust?",
      ];
    }
    if (lower.includes("burger") || lower.includes("patty")) {
      return [
        "When do I flip?",
        "How do I know when it's done?",
        "How do I prevent flare-ups?",
        "Should I smash it?",
      ];
    }
    if (
      lower.includes("chicken") ||
      lower.includes("wing") ||
      lower.includes("turkey")
    ) {
      return [
        "How do I get crispier skin?",
        "Is my temp on track?",
        "How do I prevent burning?",
        "Should I use two zones?",
      ];
    }
    if (
      lower.includes("salmon") ||
      lower.includes("fish") ||
      lower.includes("shrimp")
    ) {
      return [
        "How do I stop it sticking to the grates?",
        "What temp should I pull it?",
        "How do I know when it's done?",
        "Should I use a fish basket?",
      ];
    }
    if (lower.includes("pork") || lower.includes("chop")) {
      return [
        "What temp should I pull pork chops?",
        "Should I use two-zone heat?",
        "How do I prevent drying out?",
        "How long should I rest it?",
      ];
    }
    return [
      "What internal temp should I target?",
      "When should I flip it?",
      "How do I prevent flare-ups?",
      "How long should I rest it?",
    ];
  }

  // ── Smoke / indirect prompts ─────────────────────────────────────────────
  if (lower.includes("brisket")) {
    return [
      "Am I in the stall?",
      "Should I wrap now?",
      "How's my bark looking?",
      "When should I pull it off?",
    ];
  }
  if (
    lower.includes("rib") ||
    lower.includes("spare") ||
    lower.includes("baby back")
  ) {
    return [
      "Is it time to wrap the ribs?",
      "How do I know when they're done?",
      "What does good bark look like?",
      "My color looks off — what's going on?",
    ];
  }
  if (
    lower.includes("pork") ||
    lower.includes("butt") ||
    lower.includes("shoulder") ||
    lower.includes("pulled")
  ) {
    return [
      "Am I in the stall?",
      "When should I wrap?",
      "How do I know it's ready to pull?",
      "How do I get a better bark?",
    ];
  }
  if (
    lower.includes("chicken") ||
    lower.includes("wing") ||
    lower.includes("turkey")
  ) {
    return [
      "How do I get crispier skin?",
      "Is my temp on track?",
      "How do I know when it's fully cooked?",
      "Should I be spritzing?",
    ];
  }
  if (lower.includes("salmon") || lower.includes("fish")) {
    return [
      "What temp should I pull the salmon?",
      "How do I know when it's done?",
      "Should I brine it first?",
      "What wood pairs best?",
    ];
  }
  if (
    lower.includes("tri tip") ||
    lower.includes("tri-tip") ||
    lower.includes("steak")
  ) {
    return [
      "What internal temp should I target?",
      "Should I reverse sear?",
      "How long should I rest it?",
      "How do I get a better crust?",
    ];
  }
  return [
    "Temp stalled — now what?",
    "Am I on track with timing?",
    "Is it time to wrap?",
    "How do I get better bark?",
  ];
}
