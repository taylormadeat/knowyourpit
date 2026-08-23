import { buildDeterministicMultiCookPlan } from "../deterministicMultiCook";
import type { MeatCut } from "@/constants/meatCuts";

const BRISKET: MeatCut = {
  name: "Brisket test",
  category: "Beef",
  targetTempF: 203,
  cookTempF: 225,
  minsPerLb: 75,
  restMins: 60,
  cookMethod: "Low & Slow",
};

const RIBS: MeatCut = {
  name: "Ribs test",
  category: "Pork",
  targetTempF: 0,
  cookTempF: 250,
  minsPerLb: 50,
  restMins: 15,
  cookMethod: "Low & Slow",
};

describe("buildDeterministicMultiCookPlan", () => {
  const serveAt = new Date("2030-07-04T18:00:00.000Z");

  it("returns a complete schedule without an AI or network dependency", () => {
    const plan = buildDeterministicMultiCookPlan(serveAt, [
      { cut: BRISKET, weightLbs: 10, grill: null, grillId: 7 },
      { cut: RIBS, weightLbs: 3, grill: null, grillId: 7 },
    ]);

    expect(plan.schedule).toHaveLength(2);
    expect(plan.schedule[0]).toMatchObject({
      foodType: "Brisket test",
      estimatedDurationMinutes: 750,
      wrapMethod: "foil",
      isSharedGrillFollowOn: false,
    });
    expect(plan.schedule[1]).toMatchObject({
      foodType: "Ribs test",
      isSharedGrillFollowOn: true,
      grillLightAt: plan.schedule[1].meatOnAt,
    });
    for (const item of plan.schedule) {
      expect(new Date(item.meatOnAt).getTime()).toBeLessThan(
        new Date(item.estimatedFinishAt).getTime(),
      );
    }
  });

  it("keeps a frozen thaw anchor and extends cook-from-frozen duration locally", () => {
    const fridgePlan = buildDeterministicMultiCookPlan(serveAt, [{
      cut: BRISKET,
      weightLbs: 10,
      grill: null,
      grillId: 1,
      isFrozen: true,
      thawMethod: "fridge",
    }]);
    const cookFrozenPlan = buildDeterministicMultiCookPlan(serveAt, [{
      cut: BRISKET,
      weightLbs: 10,
      grill: null,
      grillId: 1,
      isFrozen: true,
      thawMethod: "cook_from_frozen",
    }]);

    expect(fridgePlan.frozenSchedules[0]?.thawStartAt).toBeInstanceOf(Date);
    expect(cookFrozenPlan.schedule[0].estimatedDurationMinutes).toBe(1125);
  });
});