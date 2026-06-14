/**
 * Pure post-processing function that converts a raw AI JSON response into the
 * final multi-cook result shape.  Extracted here (no route/DB/AI imports) so
 * it can be unit-tested without any side-effect dependencies.
 */

type RequestItem = {
  foodType: string;
  grillName?: string | null;
  [key: string]: unknown;
};

type MultiCookResult = {
  schedule: any[];
  serveAt: string;
  summary: string;
  sharedGrillTips: string | null;
};

export function processMultiCookResult(
  raw: any,
  serveAtDate: Date,
  requestItems: RequestItem[],
): MultiCookResult {
  const normalizeWrapMethod = (m: any): "foil" | "butcher_paper" | "none" | null => {
    if (m === "foil" || m === "butcher_paper" || m === "none") return m;
    return null;
  };

  const schedule = (raw.schedule ?? [])
    .map((item: any) => {
      const wrapMethod = normalizeWrapMethod(item.wrapMethod);
      const isNoWrap = wrapMethod == null || wrapMethod === "none";
      const cookMin = typeof item.estimatedDurationMinutes === "number"
        ? item.estimatedDurationMinutes
        : 0;
      const explicitWrapAt = typeof item.wrapAtMinutes === "number" && item.wrapAtMinutes > 0
        ? Math.round(item.wrapAtMinutes)
        : null;
      const inferredWrapAt = cookMin > 0 ? Math.max(30, Math.round(cookMin * 0.55)) : null;
      const wrapAtMinutes = isNoWrap
        ? null
        : (explicitWrapAt ?? inferredWrapAt);
      const wrapTempF = isNoWrap
        ? null
        : (typeof item.wrapTempF === "number" ? Math.round(item.wrapTempF) : null);
      const wrapReason = isNoWrap
        ? null
        : (typeof item.wrapReason === "string" && item.wrapReason.trim().length > 0 ? item.wrapReason : null);

      return {
        ...item,
        wrapMethod,
        wrapAtMinutes,
        wrapTempF,
        wrapReason,
      };
    })
    .sort(
      (a: any, b: any) => new Date(a.grillLightAt).getTime() - new Date(b.grillLightAt).getTime()
    );

  // Build a lookup from foodType → grillName using the original request items.
  // Use a consume-splice pattern so duplicate food types resolve independently.
  const remainingRequestItems = [...requestItems];
  const resolvedGrillNames: string[] = [];
  for (const schedItem of schedule) {
    const normalised = (schedItem.foodType ?? "").trim().toLowerCase();
    const idx = remainingRequestItems.findIndex(
      ri => ri.foodType.trim().toLowerCase() === normalised,
    );
    const matched = idx >= 0 ? remainingRequestItems.splice(idx, 1)[0] : undefined;
    resolvedGrillNames.push(matched?.grillName ?? "");
  }

  // Mark follow-on items that share a grill with an earlier item and enforce
  // grillLightAt = meatOnAt for them (server-side enforcement, in case the AI
  // forgot or miscalculated).
  const seenGrillNames = new Set<string>();
  for (let i = 0; i < schedule.length; i++) {
    const name = resolvedGrillNames[i];
    if (name && seenGrillNames.has(name)) {
      schedule[i].isSharedGrillFollowOn = true;
      // Enforce: follow-on items have no preheat gap.
      schedule[i].grillLightAt = schedule[i].meatOnAt;
    } else {
      schedule[i].isSharedGrillFollowOn = false;
      if (name) seenGrillNames.add(name);
    }
  }

  // Enforce timestamp self-consistency: estimatedFinishAt must equal
  // meatOnAt + estimatedDurationMinutes.  The AI sometimes returns
  // inconsistent values (especially for infeasible schedules where
  // backward math would land meatOnAt in the past).
  for (const item of schedule) {
    const cookMs = (typeof item.estimatedDurationMinutes === "number" ? item.estimatedDurationMinutes : 0) * 60_000;
    const meatOnMs = new Date(item.meatOnAt).getTime();
    const aiFinishMs = new Date(item.estimatedFinishAt).getTime();
    const expectedFinishMs = meatOnMs + cookMs;
    // Recompute if gap is more than 5 minutes off
    if (Math.abs(expectedFinishMs - aiFinishMs) > 5 * 60_000) {
      item.estimatedFinishAt = new Date(expectedFinishMs).toISOString();
    }
  }

  // Compute actual serve time = max(estimatedFinishAt + restMinutes) across
  // all items.  This may differ from the requested serveAt when the schedule
  // is infeasible (longest cook can't finish in time).
  const latestReadyMs = schedule.reduce((max: number, item: any) => {
    const rest = (typeof item.restMinutes === "number" ? item.restMinutes : 0) * 60_000;
    const ready = new Date(item.estimatedFinishAt).getTime() + rest;
    return Math.max(max, ready);
  }, 0);
  const actualServeAt = latestReadyMs > 0
    ? new Date(latestReadyMs).toISOString()
    : serveAtDate.toISOString();

  const firstItem = schedule[0];
  const lastItem = schedule[schedule.length - 1];
  let deterministicSummary = "";
  if (schedule.length >= 2) {
    deterministicSummary = `Start ${firstItem.foodType} first, then ${lastItem.foodType} last.`;
  }

  const sharedGrillTips =
    typeof raw.sharedGrillTips === "string" && raw.sharedGrillTips.trim().length > 0
      ? raw.sharedGrillTips.trim()
      : null;

  return {
    schedule,
    serveAt: actualServeAt,
    summary: deterministicSummary,
    sharedGrillTips,
  };
}
