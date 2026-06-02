export type SizeMode = "weight" | "count" | "racks";

export interface MeatCut {
  name: string;
  category: string;
  targetTempF: number;
  cookTempF: number;
  minsPerLb: number;
  restMins: number;
  notes?: string;
  cookMethod?: string;
  /**
   * Average weight of a single piece in lbs (USDA / industry reference).
   * Populated on every built-in cut; absent on custom cuts created by users.
   */
  avgPieceWeightLbs?: number;
  /** Which size-input mode to default to when this cut is first selected. */
  defaultSizeMode?: SizeMode;
  /**
   * True for cuts where each piece cooks independently and additional pieces
   * do not extend cook time (e.g. steaks, chops, sausage, individual chicken
   * pieces, fish fillets). False for large single-mass cuts where total weight
   * drives cook time (e.g. brisket, pork butt, whole chicken, turkey).
   */
  isIndividualCook?: boolean;
  /** Average weight of one full rack in lbs — only set for rib cuts. */
  avgRackWeightLbs?: number;
}

/**
 * All built-in cuts must carry the sizing metadata fields.
 * Using this intersection in the MEAT_CUTS array gives a compile-time
 * error if any entry is missing `avgPieceWeightLbs`, `defaultSizeMode`,
 * or `isIndividualCook`. Custom cuts (from the DB) use plain `MeatCut`
 * which keeps those fields optional.
 */
export type BuiltinMeatCut = MeatCut & Required<Pick<MeatCut, "avgPieceWeightLbs" | "defaultSizeMode" | "isIndividualCook">>;

export const MEAT_CATEGORIES = [
  "Beef",
  "Pork",
  "Poultry",
  "Lamb & Goat",
  "Seafood",
  "Game",
] as const;

export const MEAT_CUTS: BuiltinMeatCut[] = [
  // ── BEEF ──────────────────────────────────────────────────────────
  { category: "Beef", name: "Brisket (Whole Packer)", targetTempF: 203, cookTempF: 225, minsPerLb: 75, restMins: 60, cookMethod: "Low & Slow", notes: "Probe should slide like butter", avgPieceWeightLbs: 14, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Brisket (Flat)", targetTempF: 200, cookTempF: 225, minsPerLb: 65, restMins: 45, cookMethod: "Low & Slow", avgPieceWeightLbs: 6, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Brisket (Point)", targetTempF: 205, cookTempF: 250, minsPerLb: 70, restMins: 30, cookMethod: "Low & Slow", notes: "Great for burnt ends", avgPieceWeightLbs: 6, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Burnt Ends", targetTempF: 205, cookTempF: 275, minsPerLb: 30, restMins: 10, cookMethod: "Low & Slow", notes: "Cubed point, tossed in sauce, returned to smoker", avgPieceWeightLbs: 3, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Beef Short Ribs (Plate)", targetTempF: 205, cookTempF: 275, minsPerLb: 55, restMins: 30, cookMethod: "Low & Slow", avgPieceWeightLbs: 3.5, defaultSizeMode: "racks", isIndividualCook: false, avgRackWeightLbs: 3.5 },
  { category: "Beef", name: "Beef Short Ribs (Chuck)", targetTempF: 203, cookTempF: 250, minsPerLb: 50, restMins: 20, cookMethod: "Low & Slow", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Chuck Roast", targetTempF: 205, cookTempF: 250, minsPerLb: 60, restMins: 30, cookMethod: "Low & Slow", avgPieceWeightLbs: 4, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Chuck Eye Steak", targetTempF: 130, cookTempF: 250, minsPerLb: 22, restMins: 10, cookMethod: "Reverse Sear", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Tri-Tip", targetTempF: 135, cookTempF: 250, minsPerLb: 30, restMins: 15, cookMethod: "Reverse Sear", notes: "Sear at end over high heat", avgPieceWeightLbs: 2.5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Picanha (Top Sirloin Cap)", targetTempF: 135, cookTempF: 275, minsPerLb: 25, restMins: 10, cookMethod: "Reverse Sear", notes: "Score the fat cap; Brazilian classic", avgPieceWeightLbs: 2.5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Ribeye Steak", targetTempF: 130, cookTempF: 225, minsPerLb: 20, restMins: 10, cookMethod: "Reverse Sear", avgPieceWeightLbs: 1.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Tomahawk Steak", targetTempF: 130, cookTempF: 250, minsPerLb: 22, restMins: 15, cookMethod: "Reverse Sear", notes: "Long bone-in ribeye; impressive presentation", avgPieceWeightLbs: 2.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Cowboy Ribeye", targetTempF: 130, cookTempF: 250, minsPerLb: 22, restMins: 12, cookMethod: "Reverse Sear", avgPieceWeightLbs: 2, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Strip Steak (NY Strip)", targetTempF: 130, cookTempF: 225, minsPerLb: 18, restMins: 10, cookMethod: "Reverse Sear", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Filet Mignon", targetTempF: 130, cookTempF: 225, minsPerLb: 18, restMins: 8, cookMethod: "Reverse Sear", avgPieceWeightLbs: 0.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Tenderloin (Whole)", targetTempF: 130, cookTempF: 225, minsPerLb: 20, restMins: 15, cookMethod: "Indirect", avgPieceWeightLbs: 5.5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Hanger Steak", targetTempF: 130, cookTempF: 450, minsPerLb: 10, restMins: 8, cookMethod: "Direct Heat", notes: "Trim center silver skin; slice across the grain", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Flat Iron Steak", targetTempF: 130, cookTempF: 450, minsPerLb: 10, restMins: 8, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Flank Steak", targetTempF: 135, cookTempF: 400, minsPerLb: 10, restMins: 10, cookMethod: "Direct Heat", avgPieceWeightLbs: 1.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Skirt Steak", targetTempF: 130, cookTempF: 450, minsPerLb: 8, restMins: 5, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Denver Steak", targetTempF: 130, cookTempF: 400, minsPerLb: 12, restMins: 8, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Sirloin Steak", targetTempF: 135, cookTempF: 400, minsPerLb: 12, restMins: 8, cookMethod: "Direct Heat", avgPieceWeightLbs: 1, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Burger Patties", targetTempF: 160, cookTempF: 400, minsPerLb: 12, restMins: 3, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.33, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Smashburger", targetTempF: 160, cookTempF: 500, minsPerLb: 6, restMins: 2, cookMethod: "Direct Heat", notes: "Smash thin on screaming-hot griddle/plate", avgPieceWeightLbs: 0.125, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Beef Back Ribs", targetTempF: 200, cookTempF: 250, minsPerLb: 50, restMins: 20, cookMethod: "Low & Slow", avgPieceWeightLbs: 3.5, defaultSizeMode: "racks", isIndividualCook: false, avgRackWeightLbs: 3.5 },
  { category: "Beef", name: "Beef Cheeks", targetTempF: 205, cookTempF: 275, minsPerLb: 90, restMins: 20, cookMethod: "Low & Slow", notes: "Wrap with broth or tallow once bark sets; pull when probe-tender", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Oxtail", targetTempF: 210, cookTempF: 275, minsPerLb: 90, restMins: 20, cookMethod: "Low & Slow", notes: "Collagen-rich; cook until probe tender and meat pulls freely from bone", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Beef Shank (Osso Buco)", targetTempF: 205, cookTempF: 275, minsPerLb: 80, restMins: 20, cookMethod: "Low & Slow", notes: "Braise after smoke for fall-apart texture", avgPieceWeightLbs: 1, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Beef", name: "Prime Rib (Bone-In)", targetTempF: 130, cookTempF: 250, minsPerLb: 20, restMins: 30, cookMethod: "Indirect", notes: "Rest 30+ min before carving", avgPieceWeightLbs: 10, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Standing Rib Roast", targetTempF: 130, cookTempF: 275, minsPerLb: 22, restMins: 30, cookMethod: "Reverse Sear", avgPieceWeightLbs: 10, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Beef Jerky", targetTempF: 160, cookTempF: 175, minsPerLb: 240, restMins: 0, cookMethod: "Low & Slow", notes: "Slice 1/4\" thick across the grain; smoke until pliable but dry", avgPieceWeightLbs: 1, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Beef", name: "Pastrami", targetTempF: 203, cookTempF: 250, minsPerLb: 75, restMins: 30, cookMethod: "Low & Slow", notes: "Cured corned beef; steam to finish for classic deli texture", avgPieceWeightLbs: 5, defaultSizeMode: "weight", isIndividualCook: false },

  // ── PORK ──────────────────────────────────────────────────────────
  { category: "Pork", name: "Pork Shoulder / Boston Butt", targetTempF: 203, cookTempF: 225, minsPerLb: 90, restMins: 60, cookMethod: "Low & Slow", notes: "Wrap in butcher paper at 165°F", avgPieceWeightLbs: 10, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Picnic Shoulder", targetTempF: 203, cookTempF: 250, minsPerLb: 80, restMins: 45, cookMethod: "Low & Slow", notes: "Skin-on, lower & fattier than Boston butt", avgPieceWeightLbs: 8, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Baby Back Ribs", targetTempF: 200, cookTempF: 225, minsPerLb: 45, restMins: 15, cookMethod: "Low & Slow", notes: "3-2-1 method recommended", avgPieceWeightLbs: 2.25, defaultSizeMode: "racks", isIndividualCook: false, avgRackWeightLbs: 2.25 },
  { category: "Pork", name: "Spare Ribs (St. Louis)", targetTempF: 200, cookTempF: 225, minsPerLb: 50, restMins: 15, cookMethod: "Low & Slow", notes: "3-2-1 or 2-2-1 method", avgPieceWeightLbs: 3, defaultSizeMode: "racks", isIndividualCook: false, avgRackWeightLbs: 3 },
  { category: "Pork", name: "Spare Ribs (Full)", targetTempF: 200, cookTempF: 225, minsPerLb: 55, restMins: 15, cookMethod: "Low & Slow", avgPieceWeightLbs: 3.5, defaultSizeMode: "racks", isIndividualCook: false, avgRackWeightLbs: 3.5 },
  { category: "Pork", name: "Country Style Ribs", targetTempF: 200, cookTempF: 250, minsPerLb: 50, restMins: 10, cookMethod: "Low & Slow", avgPieceWeightLbs: 0.4, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Pork Belly", targetTempF: 200, cookTempF: 225, minsPerLb: 60, restMins: 20, cookMethod: "Low & Slow", avgPieceWeightLbs: 7, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Pork Belly Burnt Ends", targetTempF: 205, cookTempF: 275, minsPerLb: 45, restMins: 10, cookMethod: "Low & Slow", notes: "Cube, smoke, sauce, and braise back to candy texture", avgPieceWeightLbs: 3, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Pork Loin (Bone-In)", targetTempF: 145, cookTempF: 250, minsPerLb: 25, restMins: 15, cookMethod: "Indirect", avgPieceWeightLbs: 6, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Pork Loin (Boneless)", targetTempF: 145, cookTempF: 275, minsPerLb: 22, restMins: 15, cookMethod: "Indirect", avgPieceWeightLbs: 4, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Pork Tenderloin", targetTempF: 145, cookTempF: 350, minsPerLb: 20, restMins: 10, cookMethod: "Indirect", avgPieceWeightLbs: 1, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Pork Steaks", targetTempF: 195, cookTempF: 275, minsPerLb: 35, restMins: 10, cookMethod: "Low & Slow", notes: "Cut from the shoulder; St. Louis classic, sauce at the end", avgPieceWeightLbs: 1, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Pulled Pork (Competition)", targetTempF: 205, cookTempF: 250, minsPerLb: 90, restMins: 60, cookMethod: "Low & Slow", avgPieceWeightLbs: 10, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Ham (Uncured Fresh)", targetTempF: 160, cookTempF: 250, minsPerLb: 20, restMins: 20, cookMethod: "Indirect", avgPieceWeightLbs: 10, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Ham (Cured/Twice-Smoked)", targetTempF: 140, cookTempF: 275, minsPerLb: 15, restMins: 15, cookMethod: "Indirect", notes: "Already cooked; warm through and glaze", avgPieceWeightLbs: 10, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Pork Chops (Thick)", targetTempF: 145, cookTempF: 350, minsPerLb: 15, restMins: 5, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Pork Chops (Thin)", targetTempF: 145, cookTempF: 450, minsPerLb: 10, restMins: 3, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.33, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Smoked Sausage Links", targetTempF: 160, cookTempF: 225, minsPerLb: 60, restMins: 5, cookMethod: "Indirect", notes: "Cook to 160°F internal; do not pierce casings", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Bratwurst", targetTempF: 160, cookTempF: 300, minsPerLb: 25, restMins: 5, cookMethod: "Indirect", notes: "Beer bath optional after smoke", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Italian Sausage", targetTempF: 160, cookTempF: 300, minsPerLb: 25, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Andouille", targetTempF: 160, cookTempF: 225, minsPerLb: 60, restMins: 5, cookMethod: "Low & Slow", notes: "Cajun-style; pecan or hickory smoke pairs well", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Hot Links", targetTempF: 160, cookTempF: 250, minsPerLb: 45, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 0.2, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Bacon (Slab)", targetTempF: 150, cookTempF: 200, minsPerLb: 90, restMins: 0, cookMethod: "Low & Slow", notes: "Cure 7 days first; cold-smoke or low-smoke to 150°F", avgPieceWeightLbs: 4, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Pork Shank", targetTempF: 205, cookTempF: 275, minsPerLb: 70, restMins: 20, cookMethod: "Low & Slow", avgPieceWeightLbs: 2, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Pork", name: "Pork Jowl", targetTempF: 200, cookTempF: 225, minsPerLb: 70, restMins: 15, cookMethod: "Low & Slow", notes: "Like a richer pork belly; slice for guanciale-style bites", avgPieceWeightLbs: 3, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Pork", name: "Whole Hog (Suckling)", targetTempF: 195, cookTempF: 250, minsPerLb: 75, restMins: 45, cookMethod: "Low & Slow", notes: "Long, even cook with frequent basting", avgPieceWeightLbs: 30, defaultSizeMode: "weight", isIndividualCook: false },

  // ── POULTRY ───────────────────────────────────────────────────────
  { category: "Poultry", name: "Whole Chicken", targetTempF: 165, cookTempF: 325, minsPerLb: 22, restMins: 15, cookMethod: "Indirect", avgPieceWeightLbs: 4, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Poultry", name: "Spatchcock Chicken", targetTempF: 165, cookTempF: 375, minsPerLb: 15, restMins: 10, cookMethod: "Indirect", notes: "Backbone removed for even cooking", avgPieceWeightLbs: 4, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Poultry", name: "Beer Can Chicken", targetTempF: 165, cookTempF: 350, minsPerLb: 20, restMins: 10, cookMethod: "Indirect", avgPieceWeightLbs: 4, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Poultry", name: "Chicken Thighs (Bone-In)", targetTempF: 175, cookTempF: 325, minsPerLb: 18, restMins: 5, cookMethod: "Indirect", notes: "Pull at 175°F for best texture", avgPieceWeightLbs: 0.4, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Chicken Thighs (Boneless)", targetTempF: 170, cookTempF: 375, minsPerLb: 12, restMins: 5, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Chicken Leg Quarters", targetTempF: 175, cookTempF: 325, minsPerLb: 22, restMins: 5, cookMethod: "Indirect", notes: "Forgiving, flavorful, and great for crowds", avgPieceWeightLbs: 0.6, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Chicken Drumsticks", targetTempF: 175, cookTempF: 325, minsPerLb: 25, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Chicken Wings", targetTempF: 175, cookTempF: 400, minsPerLb: 20, restMins: 5, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.125, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Smoked Wings (Low & Slow)", targetTempF: 175, cookTempF: 250, minsPerLb: 60, restMins: 5, cookMethod: "Low & Slow", notes: "Finish hot for crispy skin", avgPieceWeightLbs: 0.125, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Chicken Breast (Bone-In)", targetTempF: 165, cookTempF: 300, minsPerLb: 25, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 0.6, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Chicken Breast (Boneless)", targetTempF: 165, cookTempF: 350, minsPerLb: 18, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 0.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Whole Turkey", targetTempF: 165, cookTempF: 325, minsPerLb: 15, restMins: 30, cookMethod: "Indirect", notes: "Brine overnight for best results", avgPieceWeightLbs: 15, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Poultry", name: "Spatchcock Turkey", targetTempF: 165, cookTempF: 350, minsPerLb: 12, restMins: 25, cookMethod: "Indirect", avgPieceWeightLbs: 15, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Poultry", name: "Turkey Breast", targetTempF: 165, cookTempF: 325, minsPerLb: 20, restMins: 20, cookMethod: "Indirect", avgPieceWeightLbs: 6, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Poultry", name: "Turkey Legs", targetTempF: 175, cookTempF: 275, minsPerLb: 35, restMins: 10, cookMethod: "Indirect", notes: "State-fair style; brine for that pink, hammy color", avgPieceWeightLbs: 1, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Turkey Thighs", targetTempF: 175, cookTempF: 300, minsPerLb: 30, restMins: 10, cookMethod: "Indirect", avgPieceWeightLbs: 1, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Turkey Wings", targetTempF: 175, cookTempF: 325, minsPerLb: 30, restMins: 10, cookMethod: "Indirect", avgPieceWeightLbs: 0.6, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Duck Breast", targetTempF: 135, cookTempF: 300, minsPerLb: 20, restMins: 10, cookMethod: "Indirect", notes: "Score skin in a crosshatch and render fat low first", avgPieceWeightLbs: 0.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Whole Duck", targetTempF: 165, cookTempF: 325, minsPerLb: 22, restMins: 15, cookMethod: "Indirect", avgPieceWeightLbs: 4.5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Poultry", name: "Cornish Hen", targetTempF: 165, cookTempF: 325, minsPerLb: 22, restMins: 10, cookMethod: "Indirect", avgPieceWeightLbs: 1.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Quail", targetTempF: 165, cookTempF: 350, minsPerLb: 20, restMins: 5, cookMethod: "Indirect", notes: "Tiny, fast cook — wrap with bacon to keep moist", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Poultry", name: "Pheasant", targetTempF: 165, cookTempF: 325, minsPerLb: 25, restMins: 10, cookMethod: "Indirect", notes: "Lean — brine and bard the breast with bacon", avgPieceWeightLbs: 2.5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Poultry", name: "Goose", targetTempF: 165, cookTempF: 325, minsPerLb: 20, restMins: 20, cookMethod: "Indirect", notes: "Render skin slowly; very fatty bird", avgPieceWeightLbs: 10, defaultSizeMode: "weight", isIndividualCook: false },

  // ── LAMB & GOAT ───────────────────────────────────────────────────
  { category: "Lamb & Goat", name: "Leg of Lamb (Bone-In)", targetTempF: 145, cookTempF: 275, minsPerLb: 30, restMins: 20, cookMethod: "Indirect", avgPieceWeightLbs: 7, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Lamb & Goat", name: "Leg of Lamb (Boneless)", targetTempF: 145, cookTempF: 275, minsPerLb: 25, restMins: 15, cookMethod: "Indirect", avgPieceWeightLbs: 5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Lamb & Goat", name: "Lamb Shoulder", targetTempF: 200, cookTempF: 250, minsPerLb: 60, restMins: 30, cookMethod: "Low & Slow", avgPieceWeightLbs: 6, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Lamb & Goat", name: "Pulled Lamb", targetTempF: 205, cookTempF: 250, minsPerLb: 70, restMins: 45, cookMethod: "Low & Slow", notes: "Treat like pulled pork; wrap once bark sets", avgPieceWeightLbs: 6, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Lamb & Goat", name: "Rack of Lamb", targetTempF: 135, cookTempF: 250, minsPerLb: 20, restMins: 10, cookMethod: "Reverse Sear", avgPieceWeightLbs: 1.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Lamb & Goat", name: "Lamb Ribs", targetTempF: 200, cookTempF: 250, minsPerLb: 45, restMins: 15, cookMethod: "Low & Slow", avgPieceWeightLbs: 2.25, defaultSizeMode: "racks", isIndividualCook: false, avgRackWeightLbs: 2.25 },
  { category: "Lamb & Goat", name: "Lamb Chops", targetTempF: 135, cookTempF: 400, minsPerLb: 12, restMins: 5, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Lamb & Goat", name: "Lamb Loin Chops", targetTempF: 135, cookTempF: 400, minsPerLb: 12, restMins: 5, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Lamb & Goat", name: "Lamb Shank", targetTempF: 205, cookTempF: 275, minsPerLb: 75, restMins: 20, cookMethod: "Low & Slow", avgPieceWeightLbs: 0.875, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Lamb & Goat", name: "Lamb Sausage / Merguez", targetTempF: 160, cookTempF: 300, minsPerLb: 25, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 0.2, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Lamb & Goat", name: "Whole Goat (Cabrito)", targetTempF: 170, cookTempF: 250, minsPerLb: 50, restMins: 30, cookMethod: "Low & Slow", avgPieceWeightLbs: 20, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Lamb & Goat", name: "Goat Shoulder", targetTempF: 200, cookTempF: 250, minsPerLb: 65, restMins: 30, cookMethod: "Low & Slow", avgPieceWeightLbs: 5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Lamb & Goat", name: "Goat Leg", targetTempF: 145, cookTempF: 275, minsPerLb: 30, restMins: 20, cookMethod: "Indirect", avgPieceWeightLbs: 5, defaultSizeMode: "weight", isIndividualCook: false },

  // ── SEAFOOD ───────────────────────────────────────────────────────
  { category: "Seafood", name: "Salmon Fillet", targetTempF: 145, cookTempF: 275, minsPerLb: 20, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 1.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Whole Salmon", targetTempF: 145, cookTempF: 275, minsPerLb: 15, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 6, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Seafood", name: "Cold-Smoked Salmon (Lox)", targetTempF: 80, cookTempF: 80, minsPerLb: 720, restMins: 0, cookMethod: "Low & Slow", notes: "Cure first; keep smoker under 80°F for true cold smoke", avgPieceWeightLbs: 3, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Seafood", name: "Trout (Whole)", targetTempF: 145, cookTempF: 225, minsPerLb: 25, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 1, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Swordfish Steak", targetTempF: 145, cookTempF: 400, minsPerLb: 10, restMins: 3, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Tuna Steak", targetTempF: 125, cookTempF: 450, minsPerLb: 8, restMins: 3, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Mahi Mahi", targetTempF: 137, cookTempF: 400, minsPerLb: 10, restMins: 3, cookMethod: "Direct Heat", notes: "Firm, mild — great with citrus & high heat", avgPieceWeightLbs: 0.6, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Cod Fillet", targetTempF: 145, cookTempF: 275, minsPerLb: 18, restMins: 3, cookMethod: "Indirect", notes: "Lean, delicate white fish — pull at 140°F and rest briefly; flakes easily when done", avgPieceWeightLbs: 0.6, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Halibut", targetTempF: 130, cookTempF: 350, minsPerLb: 12, restMins: 3, cookMethod: "Indirect", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Mackerel", targetTempF: 145, cookTempF: 225, minsPerLb: 25, restMins: 5, cookMethod: "Indirect", notes: "Oily fish — takes smoke beautifully", avgPieceWeightLbs: 0.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Shrimp (Shell-On)", targetTempF: 145, cookTempF: 400, minsPerLb: 6, restMins: 0, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.05, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Lobster Tail", targetTempF: 140, cookTempF: 350, minsPerLb: 10, restMins: 3, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Whole Lobster", targetTempF: 140, cookTempF: 400, minsPerLb: 12, restMins: 3, cookMethod: "Direct Heat", avgPieceWeightLbs: 1.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Scallops", targetTempF: 130, cookTempF: 500, minsPerLb: 4, restMins: 0, cookMethod: "Direct Heat", notes: "Pat dry; sear hot and fast for 90s/side", avgPieceWeightLbs: 0.1, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Oysters (in Shell)", targetTempF: 145, cookTempF: 450, minsPerLb: 5, restMins: 0, cookMethod: "Direct Heat", notes: "Cook over fire until shells pop open; finish with butter & garlic", avgPieceWeightLbs: 0.2, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Octopus", targetTempF: 195, cookTempF: 275, minsPerLb: 40, restMins: 10, cookMethod: "Indirect", notes: "Braise to tender first, then char on hot grates", avgPieceWeightLbs: 3, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Seafood", name: "Squid / Calamari", targetTempF: 145, cookTempF: 500, minsPerLb: 4, restMins: 0, cookMethod: "Direct Heat", notes: "Seconds per side or 60+ minutes — anything in between is rubber", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Crab Legs", targetTempF: 140, cookTempF: 350, minsPerLb: 8, restMins: 0, cookMethod: "Indirect", notes: "Already cooked; warm through and butter-baste", avgPieceWeightLbs: 0.5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Seafood", name: "Whole Fish", targetTempF: 145, cookTempF: 350, minsPerLb: 15, restMins: 5, cookMethod: "Indirect", avgPieceWeightLbs: 2, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Red Snapper", targetTempF: 145, cookTempF: 350, minsPerLb: 12, restMins: 3, cookMethod: "Indirect", notes: "Firm white fish — leave skin on for easier handling; score the skin to prevent curling", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Catfish Fillet", targetTempF: 145, cookTempF: 275, minsPerLb: 20, restMins: 5, cookMethod: "Indirect", notes: "Southern classic — takes smoke beautifully; pull when it flakes easily at the thickest point", avgPieceWeightLbs: 0.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Striped Bass", targetTempF: 145, cookTempF: 350, minsPerLb: 12, restMins: 3, cookMethod: "Indirect", notes: "Firm flesh holds up well on grates; score the skin before cooking to prevent curling", avgPieceWeightLbs: 1, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Seafood", name: "Tilapia Fillet", targetTempF: 145, cookTempF: 375, minsPerLb: 8, restMins: 2, cookMethod: "Direct Heat", notes: "Thin, delicate fillet — use foil or a grill basket to prevent sticking and flaking apart", avgPieceWeightLbs: 0.4, defaultSizeMode: "count", isIndividualCook: true },

  // ── GAME ──────────────────────────────────────────────────────────
  { category: "Game", name: "Venison Roast", targetTempF: 145, cookTempF: 275, minsPerLb: 40, restMins: 20, cookMethod: "Low & Slow", avgPieceWeightLbs: 4, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Game", name: "Venison Backstrap", targetTempF: 130, cookTempF: 250, minsPerLb: 25, restMins: 10, cookMethod: "Reverse Sear", notes: "Lean — pull early and rest covered", avgPieceWeightLbs: 1.5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Game", name: "Venison Tenderloin", targetTempF: 130, cookTempF: 250, minsPerLb: 22, restMins: 10, cookMethod: "Reverse Sear", avgPieceWeightLbs: 0.75, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Game", name: "Venison Sausage", targetTempF: 160, cookTempF: 225, minsPerLb: 60, restMins: 5, cookMethod: "Low & Slow", avgPieceWeightLbs: 0.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Game", name: "Bison Brisket", targetTempF: 200, cookTempF: 225, minsPerLb: 70, restMins: 60, cookMethod: "Low & Slow", avgPieceWeightLbs: 12, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Game", name: "Bison Ribeye", targetTempF: 130, cookTempF: 250, minsPerLb: 22, restMins: 10, cookMethod: "Reverse Sear", avgPieceWeightLbs: 1.25, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Game", name: "Bison Burger", targetTempF: 160, cookTempF: 400, minsPerLb: 12, restMins: 3, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.33, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Game", name: "Wild Boar Shoulder", targetTempF: 200, cookTempF: 250, minsPerLb: 80, restMins: 45, cookMethod: "Low & Slow", avgPieceWeightLbs: 8, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Game", name: "Wild Boar Ribs", targetTempF: 200, cookTempF: 250, minsPerLb: 55, restMins: 15, cookMethod: "Low & Slow", avgPieceWeightLbs: 2.5, defaultSizeMode: "racks", isIndividualCook: false, avgRackWeightLbs: 2.5 },
  { category: "Game", name: "Elk Roast", targetTempF: 145, cookTempF: 275, minsPerLb: 35, restMins: 20, cookMethod: "Low & Slow", avgPieceWeightLbs: 4, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Game", name: "Elk Steak", targetTempF: 130, cookTempF: 400, minsPerLb: 14, restMins: 8, cookMethod: "Direct Heat", avgPieceWeightLbs: 0.6, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Game", name: "Rabbit", targetTempF: 160, cookTempF: 300, minsPerLb: 25, restMins: 10, cookMethod: "Indirect", avgPieceWeightLbs: 2.5, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Game", name: "Duck (Wild)", targetTempF: 165, cookTempF: 325, minsPerLb: 20, restMins: 10, cookMethod: "Indirect", avgPieceWeightLbs: 2, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Game", name: "Wild Turkey", targetTempF: 165, cookTempF: 325, minsPerLb: 18, restMins: 20, cookMethod: "Indirect", notes: "Leaner than farmed birds — brine and bard", avgPieceWeightLbs: 10, defaultSizeMode: "weight", isIndividualCook: false },
  { category: "Game", name: "Alligator", targetTempF: 160, cookTempF: 275, minsPerLb: 30, restMins: 10, cookMethod: "Indirect", notes: "Tail meat is mild and chicken-like; Cajun rub works great", avgPieceWeightLbs: 1.5, defaultSizeMode: "count", isIndividualCook: true },
  { category: "Game", name: "Wild Hog Loin", targetTempF: 145, cookTempF: 275, minsPerLb: 25, restMins: 10, cookMethod: "Indirect", avgPieceWeightLbs: 1.5, defaultSizeMode: "weight", isIndividualCook: false },
];

export const MEAT_CUTS_BY_CATEGORY = MEAT_CATEGORIES.reduce<Record<string, MeatCut[]>>(
  (acc, cat) => {
    acc[cat] = MEAT_CUTS.filter((c) => c.category === cat);
    return acc;
  },
  {} as Record<string, MeatCut[]>
);
