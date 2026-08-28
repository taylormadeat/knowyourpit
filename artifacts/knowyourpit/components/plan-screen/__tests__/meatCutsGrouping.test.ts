import { getGroupedCuts, MEAT_CUTS_BY_CATEGORY } from "@/constants/meatCuts";

describe("poultry cut grouping", () => {
  it("groups birds by type with chicken first", () => {
    const groups = getGroupedCuts("Poultry");
    const groupNames = groups.map((group) => group.title);

    expect(groupNames).toEqual(["Chicken", "Turkey", "Duck", "Other Birds"]);
    expect(groupNames).not.toContain("Whole Birds");
    expect(groups[0].cuts.map((cut) => cut.name)).toEqual([
      "Beer Can Chicken",
      "Chicken Breast (Bone-In)",
      "Chicken Breast (Boneless)",
      "Chicken Drumsticks",
      "Chicken Leg Quarters",
      "Chicken Thighs (Bone-In)",
      "Chicken Thighs (Boneless)",
      "Chicken Wings",
      "Smoked Wings (Low & Slow)",
      "Spatchcock Chicken",
      "Whole Chicken",
    ]);
  });

  it("keeps each bird type in its matching section", () => {
    const groups = getGroupedCuts("Poultry");
    const groupByName = new Map(
      groups.flatMap((group) => group.cuts.map((cut) => [cut.name, group.title] as const)),
    );

    expect(groupByName.get("Whole Turkey")).toBe("Turkey");
    expect(groupByName.get("Turkey Legs")).toBe("Turkey");
    expect(groupByName.get("Duck Breast")).toBe("Duck");
    expect(groupByName.get("Whole Duck")).toBe("Duck");
    expect(groupByName.get("Cornish Hen")).toBe("Other Birds");
    expect(groupByName.get("Quail")).toBe("Other Birds");
    expect(groupByName.get("Pheasant")).toBe("Other Birds");
    expect(groupByName.get("Goose")).toBe("Other Birds");

    expect(
      groups.reduce((count, group) => count + group.cuts.length, 0),
    ).toBe(MEAT_CUTS_BY_CATEGORY.Poultry.length);
  });
});