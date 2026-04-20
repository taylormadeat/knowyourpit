export interface MeatCut {
  name: string;
  category: string;
  targetTempF: number;
  cookTempF: number;
  minsPerLb: number;
  restMins: number;
  notes?: string;
  cookMethod?: string;
}

export const MEAT_CATEGORIES = [
  "Beef",
  "Pork",
  "Poultry",
  "Lamb & Goat",
  "Seafood",
  "Game",
] as const;

export const MEAT_CUTS: MeatCut[] = [
  // ── BEEF ──────────────────────────────────────────────────────────
  { category: "Beef", name: "Brisket (Whole Packer)", targetTempF: 203, cookTempF: 225, minsPerLb: 75, restMins: 60, cookMethod: "Low & Slow", notes: "Probe should slide like butter" },
  { category: "Beef", name: "Brisket (Flat)", targetTempF: 200, cookTempF: 225, minsPerLb: 65, restMins: 45, cookMethod: "Low & Slow" },
  { category: "Beef", name: "Beef Short Ribs (Plate)", targetTempF: 205, cookTempF: 275, minsPerLb: 55, restMins: 30, cookMethod: "Low & Slow" },
  { category: "Beef", name: "Chuck Roast", targetTempF: 205, cookTempF: 250, minsPerLb: 60, restMins: 30, cookMethod: "Low & Slow" },
  { category: "Beef", name: "Tri-Tip", targetTempF: 135, cookTempF: 250, minsPerLb: 30, restMins: 15, cookMethod: "Reverse Sear", notes: "Sear at end over high heat" },
  { category: "Beef", name: "Ribeye Steak", targetTempF: 130, cookTempF: 225, minsPerLb: 20, restMins: 10, cookMethod: "Reverse Sear" },
  { category: "Beef", name: "Strip Steak (NY Strip)", targetTempF: 130, cookTempF: 225, minsPerLb: 18, restMins: 10, cookMethod: "Reverse Sear" },
  { category: "Beef", name: "Tenderloin (Whole)", targetTempF: 130, cookTempF: 225, minsPerLb: 20, restMins: 15, cookMethod: "Indirect" },
  { category: "Beef", name: "Flank Steak", targetTempF: 135, cookTempF: 400, minsPerLb: 10, restMins: 10, cookMethod: "Direct Heat" },
  { category: "Beef", name: "Skirt Steak", targetTempF: 130, cookTempF: 450, minsPerLb: 8, restMins: 5, cookMethod: "Direct Heat" },
  { category: "Beef", name: "Burger Patties", targetTempF: 160, cookTempF: 400, minsPerLb: 12, restMins: 3, cookMethod: "Direct Heat" },
  { category: "Beef", name: "Beef Back Ribs", targetTempF: 200, cookTempF: 250, minsPerLb: 50, restMins: 20, cookMethod: "Low & Slow" },
  { category: "Beef", name: "Oxtail", targetTempF: 210, cookTempF: 275, minsPerLb: 90, restMins: 20, cookMethod: "Low & Slow", notes: "Collagen-rich; cook until probe tender and meat pulls freely from bone" },
  { category: "Beef", name: "Prime Rib (Bone-In)", targetTempF: 130, cookTempF: 250, minsPerLb: 20, restMins: 30, cookMethod: "Indirect", notes: "Rest 30+ min before carving" },

  // ── PORK ──────────────────────────────────────────────────────────
  { category: "Pork", name: "Pork Shoulder / Boston Butt", targetTempF: 203, cookTempF: 225, minsPerLb: 90, restMins: 60, cookMethod: "Low & Slow", notes: "Wrap in butcher paper at 165°F" },
  { category: "Pork", name: "Baby Back Ribs", targetTempF: 200, cookTempF: 225, minsPerLb: 45, restMins: 15, cookMethod: "Low & Slow", notes: "3-2-1 method recommended" },
  { category: "Pork", name: "Spare Ribs (St. Louis)", targetTempF: 200, cookTempF: 225, minsPerLb: 50, restMins: 15, cookMethod: "Low & Slow", notes: "3-2-1 or 2-2-1 method" },
  { category: "Pork", name: "Country Style Ribs", targetTempF: 200, cookTempF: 250, minsPerLb: 50, restMins: 10, cookMethod: "Low & Slow" },
  { category: "Pork", name: "Pork Belly", targetTempF: 200, cookTempF: 225, minsPerLb: 60, restMins: 20, cookMethod: "Low & Slow" },
  { category: "Pork", name: "Pork Loin (Bone-In)", targetTempF: 145, cookTempF: 250, minsPerLb: 25, restMins: 15, cookMethod: "Indirect" },
  { category: "Pork", name: "Pork Tenderloin", targetTempF: 145, cookTempF: 350, minsPerLb: 20, restMins: 10, cookMethod: "Indirect" },
  { category: "Pork", name: "Pulled Pork (Competition)", targetTempF: 205, cookTempF: 250, minsPerLb: 90, restMins: 60, cookMethod: "Low & Slow" },
  { category: "Pork", name: "Ham (Uncured)", targetTempF: 160, cookTempF: 250, minsPerLb: 20, restMins: 20, cookMethod: "Indirect" },
  { category: "Pork", name: "Pork Chops (Thick)", targetTempF: 145, cookTempF: 350, minsPerLb: 15, restMins: 5, cookMethod: "Direct Heat" },

  // ── POULTRY ───────────────────────────────────────────────────────
  { category: "Poultry", name: "Whole Chicken", targetTempF: 165, cookTempF: 325, minsPerLb: 22, restMins: 15, cookMethod: "Indirect" },
  { category: "Poultry", name: "Spatchcock Chicken", targetTempF: 165, cookTempF: 375, minsPerLb: 15, restMins: 10, cookMethod: "Indirect", notes: "Backbone removed for even cooking" },
  { category: "Poultry", name: "Chicken Thighs (Bone-In)", targetTempF: 175, cookTempF: 325, minsPerLb: 18, restMins: 5, cookMethod: "Indirect", notes: "Pull at 175°F for best texture" },
  { category: "Poultry", name: "Chicken Wings", targetTempF: 175, cookTempF: 400, minsPerLb: 20, restMins: 5, cookMethod: "Direct Heat" },
  { category: "Poultry", name: "Chicken Breast (Bone-In)", targetTempF: 165, cookTempF: 300, minsPerLb: 25, restMins: 5, cookMethod: "Indirect" },
  { category: "Poultry", name: "Whole Turkey", targetTempF: 165, cookTempF: 325, minsPerLb: 15, restMins: 30, cookMethod: "Indirect", notes: "Brine overnight for best results" },
  { category: "Poultry", name: "Turkey Breast", targetTempF: 165, cookTempF: 325, minsPerLb: 20, restMins: 20, cookMethod: "Indirect" },
  { category: "Poultry", name: "Duck Breast", targetTempF: 135, cookTempF: 300, minsPerLb: 20, restMins: 10, cookMethod: "Indirect" },
  { category: "Poultry", name: "Cornish Hen", targetTempF: 165, cookTempF: 325, minsPerLb: 22, restMins: 10, cookMethod: "Indirect" },

  // ── LAMB & GOAT ───────────────────────────────────────────────────
  { category: "Lamb & Goat", name: "Leg of Lamb", targetTempF: 145, cookTempF: 275, minsPerLb: 30, restMins: 20, cookMethod: "Indirect" },
  { category: "Lamb & Goat", name: "Lamb Shoulder", targetTempF: 200, cookTempF: 250, minsPerLb: 60, restMins: 30, cookMethod: "Low & Slow" },
  { category: "Lamb & Goat", name: "Rack of Lamb", targetTempF: 135, cookTempF: 250, minsPerLb: 20, restMins: 10, cookMethod: "Reverse Sear" },
  { category: "Lamb & Goat", name: "Lamb Ribs", targetTempF: 200, cookTempF: 250, minsPerLb: 45, restMins: 15, cookMethod: "Low & Slow" },
  { category: "Lamb & Goat", name: "Lamb Chops", targetTempF: 135, cookTempF: 400, minsPerLb: 12, restMins: 5, cookMethod: "Direct Heat" },
  { category: "Lamb & Goat", name: "Whole Goat", targetTempF: 170, cookTempF: 250, minsPerLb: 50, restMins: 30, cookMethod: "Low & Slow" },

  // ── SEAFOOD ───────────────────────────────────────────────────────
  { category: "Seafood", name: "Salmon Fillet", targetTempF: 145, cookTempF: 275, minsPerLb: 20, restMins: 5, cookMethod: "Indirect" },
  { category: "Seafood", name: "Whole Salmon", targetTempF: 145, cookTempF: 275, minsPerLb: 15, restMins: 5, cookMethod: "Indirect" },
  { category: "Seafood", name: "Swordfish Steak", targetTempF: 145, cookTempF: 400, minsPerLb: 10, restMins: 3, cookMethod: "Direct Heat" },
  { category: "Seafood", name: "Tuna Steak", targetTempF: 125, cookTempF: 450, minsPerLb: 8, restMins: 3, cookMethod: "Direct Heat" },
  { category: "Seafood", name: "Shrimp (Shell-On)", targetTempF: 145, cookTempF: 400, minsPerLb: 6, restMins: 0, cookMethod: "Direct Heat" },
  { category: "Seafood", name: "Lobster Tail", targetTempF: 140, cookTempF: 350, minsPerLb: 10, restMins: 3, cookMethod: "Direct Heat" },
  { category: "Seafood", name: "Whole Fish", targetTempF: 145, cookTempF: 350, minsPerLb: 15, restMins: 5, cookMethod: "Indirect" },

  // ── GAME ──────────────────────────────────────────────────────────
  { category: "Game", name: "Venison Roast", targetTempF: 145, cookTempF: 275, minsPerLb: 40, restMins: 20, cookMethod: "Low & Slow" },
  { category: "Game", name: "Bison Brisket", targetTempF: 200, cookTempF: 225, minsPerLb: 70, restMins: 60, cookMethod: "Low & Slow" },
  { category: "Game", name: "Wild Boar Shoulder", targetTempF: 200, cookTempF: 250, minsPerLb: 80, restMins: 45, cookMethod: "Low & Slow" },
  { category: "Game", name: "Elk Roast", targetTempF: 145, cookTempF: 275, minsPerLb: 35, restMins: 20, cookMethod: "Low & Slow" },
  { category: "Game", name: "Rabbit", targetTempF: 160, cookTempF: 300, minsPerLb: 25, restMins: 10, cookMethod: "Indirect" },
  { category: "Game", name: "Duck (Wild)", targetTempF: 165, cookTempF: 325, minsPerLb: 20, restMins: 10, cookMethod: "Indirect" },
];

export const MEAT_CUTS_BY_CATEGORY = MEAT_CATEGORIES.reduce<Record<string, MeatCut[]>>(
  (acc, cat) => {
    acc[cat] = MEAT_CUTS.filter((c) => c.category === cat);
    return acc;
  },
  {} as Record<string, MeatCut[]>
);
