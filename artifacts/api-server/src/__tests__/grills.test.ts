import { describe, it, expect } from "vitest";
import { pickMostCookedByGrill } from "../routes/grills";

describe("pickMostCookedByGrill", () => {
  it("picks the food with the highest count per grill", () => {
    const result = pickMostCookedByGrill([
      { grillId: 1, foodType: "Brisket", n: 5 },
      { grillId: 1, foodType: "Pork Butt", n: 2 },
      { grillId: 2, foodType: "Chicken", n: 3 },
    ]);
    expect(result.get(1)?.food).toBe("Brisket");
    expect(result.get(2)?.food).toBe("Chicken");
  });

  it("breaks ties alphabetically for deterministic output", () => {
    const a = pickMostCookedByGrill([
      { grillId: 1, foodType: "Ribs", n: 4 },
      { grillId: 1, foodType: "Brisket", n: 4 },
    ]);
    const b = pickMostCookedByGrill([
      { grillId: 1, foodType: "Brisket", n: 4 },
      { grillId: 1, foodType: "Ribs", n: 4 },
    ]);
    expect(a.get(1)?.food).toBe("Brisket");
    expect(b.get(1)?.food).toBe("Brisket");
  });

  it("ignores rows with null grillId", () => {
    const result = pickMostCookedByGrill([
      { grillId: null, foodType: "Brisket", n: 9 },
      { grillId: 7, foodType: "Pork", n: 1 },
    ]);
    expect(result.has(7)).toBe(true);
    expect(result.size).toBe(1);
  });
});
