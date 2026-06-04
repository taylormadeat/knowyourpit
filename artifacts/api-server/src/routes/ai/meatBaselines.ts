export interface MeatBaseline {
  minsPerLb: number;
  cookTempF: number;
  targetTempF: number;
  restMins: number;
  wrapRec: "foil" | "butcher_paper" | "none";
  wrapAtMins?: number;
  wrapTempF?: number;
  wrapNote?: string;
}

export const MEAT_KB: Array<{ keywords: string[]; baseline: MeatBaseline }> = [
  {
    keywords: ["brisket", "whole packer"],
    baseline: { minsPerLb: 75, cookTempF: 225, targetTempF: 203, restMins: 90, wrapRec: "butcher_paper", wrapAtMins: 240, wrapTempF: 165, wrapNote: "Wrap in unwaxed butcher paper once bark is set and color is mahogany (around 165°F). Spritz with beef tallow or water before wrapping tight." },
  },
  {
    keywords: ["brisket flat"],
    baseline: { minsPerLb: 65, cookTempF: 225, targetTempF: 200, restMins: 60, wrapRec: "butcher_paper", wrapAtMins: 180, wrapTempF: 165, wrapNote: "Flats dry out faster — wrap with a splash of tallow or butter at 165°F internal. Probe should feel like warm butter through the flat at 200°F." },
  },
  {
    keywords: ["pork shoulder", "boston butt", "pork butt", "pulled pork"],
    baseline: { minsPerLb: 90, cookTempF: 225, targetTempF: 203, restMins: 60, wrapRec: "foil", wrapAtMins: 300, wrapTempF: 165, wrapNote: "Wrap tight in foil (Texas Crutch) at 165°F to push through the stall. Add 1/4 cup apple juice or cider vinegar inside the foil. Unwrap at 195°F if you want better bark." },
  },
  {
    keywords: ["baby back ribs", "back ribs"],
    baseline: { minsPerLb: 45, cookTempF: 225, targetTempF: 200, restMins: 20, wrapRec: "foil", wrapAtMins: 180, wrapNote: "3-2-1 method: 3hr unwrapped, 2hr in foil with butter+brown sugar+honey, 1hr back on grate to set glaze. Bones should pull back 1/4 inch." },
  },
  {
    keywords: ["spare ribs", "st. louis", "saint louis"],
    baseline: { minsPerLb: 50, cookTempF: 225, targetTempF: 200, restMins: 20, wrapRec: "foil", wrapAtMins: 210, wrapNote: "2-2-1 for St. Louis. Foil with butter, brown sugar, and a splash of apple juice. Bend test: ribs should crack when folded — not fall apart, not resist." },
  },
  {
    keywords: ["pork belly"],
    baseline: { minsPerLb: 60, cookTempF: 225, targetTempF: 200, restMins: 20, wrapRec: "foil", wrapAtMins: 240, wrapTempF: 165, wrapNote: "Wrap in foil at 165°F with butter and maple syrup for finishing. Internal probe should slide like butter at 200°F." },
  },
  {
    keywords: ["chuck roast"],
    baseline: { minsPerLb: 60, cookTempF: 250, targetTempF: 205, restMins: 30, wrapRec: "foil", wrapAtMins: 180, wrapTempF: 160, wrapNote: "Wrap tight in foil at 160°F with 1/4 cup beef tallow or butter. Cook to 205°F — it should be probe-tender like brisket." },
  },
  {
    keywords: ["beef short rib", "plate rib", "dinosaur rib"],
    baseline: { minsPerLb: 55, cookTempF: 275, targetTempF: 205, restMins: 30, wrapRec: "butcher_paper", wrapAtMins: 180, wrapTempF: 170, wrapNote: "Wrap in butcher paper once bark is firm and dark. Cook at 275°F — the higher temp is fine. Pull when probe reads 205°F with no resistance through the meat." },
  },
  {
    keywords: ["tri-tip"],
    baseline: { minsPerLb: 30, cookTempF: 250, targetTempF: 135, restMins: 15, wrapRec: "none", wrapNote: "No wrap needed. Reverse-sear method: smoke to 115°F, then sear 2–3 min per side over direct high heat. Rest 15 min before slicing against grain." },
  },
  {
    keywords: ["ribeye", "rib eye", "strip steak", "ny strip", "tenderloin steak"],
    baseline: { minsPerLb: 20, cookTempF: 225, targetTempF: 130, restMins: 10, wrapRec: "none", wrapNote: "Reverse-sear: smoke to 10°F below target, then sear over screaming hot grill 60–90s per side. Rest uncovered — tenting steaks causes steam and softens the crust." },
  },
  {
    keywords: ["whole chicken"],
    baseline: { minsPerLb: 22, cookTempF: 325, targetTempF: 165, restMins: 15, wrapRec: "none", wrapNote: "No wrap needed. Spatchcocking cuts 30% off cook time. Pull at 160°F breast / 170°F thigh — carryover brings it to safe temp. Rest loosely tented." },
  },
  {
    keywords: ["spatchcock"],
    baseline: { minsPerLb: 15, cookTempF: 375, targetTempF: 165, restMins: 10, wrapRec: "none", wrapNote: "Higher temp (350–400°F) crisps the skin beautifully. No wrap needed — the flattened profile cooks evenly. Pull at 160°F breast temp." },
  },
  {
    keywords: ["chicken thigh", "chicken leg"],
    baseline: { minsPerLb: 18, cookTempF: 325, targetTempF: 175, restMins: 5, wrapRec: "none", wrapNote: "No wrap. Thighs are forgiving — pull at 175–185°F for best texture. Skin-up for the entire cook; finish high-heat to crisp skin." },
  },
  {
    keywords: ["chicken wing"],
    baseline: { minsPerLb: 20, cookTempF: 400, targetTempF: 175, restMins: 5, wrapRec: "none", wrapNote: "High heat (375–425°F) is key for crispy wings. No wrap. Sauce in the last 10 minutes to caramelize without burning." },
  },
  {
    keywords: ["turkey breast"],
    baseline: { minsPerLb: 20, cookTempF: 325, targetTempF: 165, restMins: 20, wrapRec: "foil", wrapAtMins: 120, wrapTempF: 145, wrapNote: "Tent in foil once skin is golden (around 145°F internal) to prevent over-browning. Rest 20 min covered to redistribute juices." },
  },
  {
    keywords: ["whole turkey"],
    baseline: { minsPerLb: 15, cookTempF: 325, targetTempF: 165, restMins: 30, wrapRec: "foil", wrapAtMins: 150, wrapTempF: 145, wrapNote: "Tent breast with foil once it hits 145°F to avoid overcooking while dark meat catches up. Rest 30+ min before carving." },
  },
  {
    keywords: ["salmon"],
    baseline: { minsPerLb: 20, cookTempF: 275, targetTempF: 145, restMins: 5, wrapRec: "none", wrapNote: "No wrap. Smoke salmon skin-side down on cedar plank or oiled grate. Pull at 140°F — carryover brings to 145°F. Finish is when it flakes easily at the thickest point." },
  },
  {
    keywords: ["cod"],
    baseline: { minsPerLb: 18, cookTempF: 275, targetTempF: 145, restMins: 3, wrapRec: "none", wrapNote: "No wrap. Cod is lean and delicate — oil grates well or use a cedar plank. Pull at 140°F; carryover brings to 145°F. Done when it flakes easily and is opaque throughout." },
  },
  {
    keywords: ["pork tenderloin"],
    baseline: { minsPerLb: 20, cookTempF: 350, targetTempF: 145, restMins: 10, wrapRec: "none", wrapNote: "No wrap needed. Tenderloin cooks fast — watch temp carefully. Pull at 140°F, rest 10 min. Slice into medallions." },
  },
  {
    keywords: ["pork loin"],
    baseline: { minsPerLb: 25, cookTempF: 250, targetTempF: 145, restMins: 15, wrapRec: "foil", wrapAtMins: 90, wrapTempF: 130, wrapNote: "Tent in foil at 130°F to keep moist. Pork loin is lean and dries quickly — don't overcook. Pull at 145°F internal." },
  },
  {
    keywords: ["lamb leg", "leg of lamb"],
    baseline: { minsPerLb: 30, cookTempF: 275, targetTempF: 145, restMins: 20, wrapRec: "foil", wrapAtMins: 120, wrapTempF: 130, wrapNote: "Tent foil at 130°F internal to rest and equalize. Rest 20 min loosely tented before carving." },
  },
  {
    keywords: ["lamb shoulder"],
    baseline: { minsPerLb: 60, cookTempF: 250, targetTempF: 200, restMins: 30, wrapRec: "foil", wrapAtMins: 180, wrapTempF: 165, wrapNote: "Lamb shoulder needs the full low-and-slow treatment like pork. Wrap tight in foil at 165°F with rosemary, garlic, and a splash of red wine or stock." },
  },
  {
    keywords: ["venison", "deer"],
    baseline: { minsPerLb: 40, cookTempF: 275, targetTempF: 145, restMins: 20, wrapRec: "foil", wrapAtMins: 120, wrapTempF: 130, wrapNote: "Venison dries out fast — wrap in foil at 130°F with butter to retain moisture. Very lean meat, pull early and rest well." },
  },
  {
    keywords: ["bison"],
    baseline: { minsPerLb: 70, cookTempF: 225, targetTempF: 200, restMins: 60, wrapRec: "butcher_paper", wrapAtMins: 240, wrapTempF: 165, wrapNote: "Bison brisket behaves like beef brisket but is leaner. Wrap in butcher paper at 165°F. May probe-tender slightly earlier than beef — start checking at 195°F." },
  },
  {
    keywords: ["red snapper", "snapper"],
    baseline: { minsPerLb: 12, cookTempF: 350, targetTempF: 145, restMins: 3, wrapRec: "none", wrapNote: "No wrap. Grill skin-side down on oiled grates or a cedar plank. Score the skin to prevent curling. Pull at 140°F — carryover brings it to 145°F. Done when flesh is opaque and flakes easily." },
  },
  {
    keywords: ["catfish"],
    baseline: { minsPerLb: 20, cookTempF: 275, targetTempF: 145, restMins: 5, wrapRec: "none", wrapNote: "No wrap. Catfish takes smoke exceptionally well — hickory or pecan are classic pairings. Cook indirect at 275°F skin-side down. Pull at 140°F internal; carryover finishes it. Done when it flakes easily at the thickest point." },
  },
  {
    keywords: ["striped bass", "striper"],
    baseline: { minsPerLb: 12, cookTempF: 350, targetTempF: 145, restMins: 3, wrapRec: "none", wrapNote: "No wrap. Striped bass has firm flesh that holds up well on the grate. Score the skin before cooking to prevent curling. Cook skin-side down indirect. Pull at 140°F; rest 3 min before serving." },
  },
  {
    keywords: ["tilapia"],
    baseline: { minsPerLb: 8, cookTempF: 375, targetTempF: 145, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Tilapia is thin and delicate — use a well-oiled grill basket or foil packet to prevent it from flaking apart. Cook over direct medium-high heat. Pull as soon as it flakes easily and turns opaque; it cooks fast." },
  },

  // ── VEGETABLES ────────────────────────────────────────────────────
  // targetTempF: 0 = time-based / visual doneness
  {
    keywords: ["corn on the cob", "corn"],
    baseline: { minsPerLb: 20, cookTempF: 400, targetTempF: 0, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Husks on: rotate every 5 min for 15 min. Husked & oiled: 10 min on high, turning often. Done when kernels are bright yellow and grill marks appear — no internal temp." },
  },
  {
    keywords: ["bell pepper", "sweet pepper"],
    baseline: { minsPerLb: 16, cookTempF: 400, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Halved and oiled directly on grates. Done when skin blisters black and flesh is fully tender — about 8 min per side over high heat." },
  },
  {
    keywords: ["portobello", "mushroom"],
    baseline: { minsPerLb: 18, cookTempF: 375, targetTempF: 0, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Gill-side up with olive oil and garlic. Done when cap is deeply caramelized and liquid has evaporated — about 6–8 min per side." },
  },
  {
    keywords: ["asparagus"],
    baseline: { minsPerLb: 12, cookTempF: 450, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Oil well and season. Done when spears are bright green with charred tips and tender when pierced — 4–6 min over screaming hot grates." },
  },
  {
    keywords: ["sweet potato"],
    baseline: { minsPerLb: 60, cookTempF: 375, targetTempF: 0, restMins: 5, wrapRec: "none", wrapNote: "No wrap (or foil-wrap for soft-skin finish). Done when a skewer slides through with no resistance — 45–60 min indirect at 375°F." },
  },
  {
    keywords: ["zucchini", "squash"],
    baseline: { minsPerLb: 14, cookTempF: 400, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Halved lengthwise, oiled. Done when cut face has golden grill marks and flesh is just tender — about 4–5 min per side." },
  },
  {
    keywords: ["onion"],
    baseline: { minsPerLb: 30, cookTempF: 375, targetTempF: 0, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Halved through the root, oiled. Done when layers are caramelized and tender — 20–30 min indirect, then 5 min direct for char." },
  },
  {
    keywords: ["eggplant"],
    baseline: { minsPerLb: 20, cookTempF: 375, targetTempF: 0, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Sliced 1/2\" thick, oiled. Done when grill marks appear and flesh is soft and creamy when pressed — about 8–10 min per side." },
  },
  {
    keywords: ["jalapeño", "jalapeno"],
    baseline: { minsPerLb: 30, cookTempF: 300, targetTempF: 0, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Stuffed peppers indirect at 300°F. Done when peppers are blistered and filling is bubbly and lightly browned — about 25–30 min." },
  },
  {
    keywords: ["beet"],
    baseline: { minsPerLb: 60, cookTempF: 350, targetTempF: 0, restMins: 5, wrapRec: "foil", wrapAtMins: 0, wrapNote: "Wrap in foil with olive oil and herbs from the start. Done when a skewer slides through with no resistance — 45–75 min depending on size." },
  },
  {
    keywords: ["brussels sprout"],
    baseline: { minsPerLb: 20, cookTempF: 400, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Halved and oiled on skewers or grill basket. Done when cut face is deeply charred and outer leaves are crispy — about 10–12 min over high heat." },
  },
  {
    keywords: ["cauliflower"],
    baseline: { minsPerLb: 45, cookTempF: 350, targetTempF: 0, restMins: 5, wrapRec: "none", wrapNote: "No wrap. Oil and season the whole head. Done when a skewer slides through the core and outer florets are caramelized — 40–60 min indirect." },
  },
  {
    keywords: ["romaine", "lettuce"],
    baseline: { minsPerLb: 6, cookTempF: 450, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Brushed with oil on screaming hot grates. Done when grill marks appear and outer leaves are just wilted — 2–3 min per side. Serve immediately." },
  },
  {
    keywords: ["tomato"],
    baseline: { minsPerLb: 90, cookTempF: 225, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Halved cut-side up in the smoker. Done when skin blisters and flesh collapses into a jammy consistency — 1.5–2 hr low & slow." },
  },
  {
    keywords: ["potato"],
    baseline: { minsPerLb: 70, cookTempF: 375, targetTempF: 0, restMins: 3, wrapRec: "foil", wrapAtMins: 0, wrapNote: "Wrap in foil from the start. Done when a fork slides into the center with no resistance — 60–75 min indirect at 375°F." },
  },

  // ── FRUIT ─────────────────────────────────────────────────────────
  {
    keywords: ["peach"],
    baseline: { minsPerLb: 10, cookTempF: 400, targetTempF: 0, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Pit removed, cut-side down on oiled grates. Done when grill marks are caramelized and fruit gives slightly when pressed — about 4–5 min per side." },
  },
  {
    keywords: ["pineapple"],
    baseline: { minsPerLb: 12, cookTempF: 400, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Sliced 3/4\" thick. Done when edges caramelize and char marks appear — about 3–4 min per side. Brush with honey for extra lacquer." },
  },
  {
    keywords: ["watermelon"],
    baseline: { minsPerLb: 6, cookTempF: 450, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. High heat, dry grates. Done when deep grill marks appear and flesh just starts to soften — 2–3 min per side. Serve immediately." },
  },
  {
    keywords: ["mango"],
    baseline: { minsPerLb: 10, cookTempF: 400, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Scored crosshatch, flesh-side down. Done when caramelized and golden — about 4–5 min flesh-side, then 2 min skin-side." },
  },
  {
    keywords: ["avocado"],
    baseline: { minsPerLb: 8, cookTempF: 400, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Flesh-side down on oiled grates. Done when grill marks set and flesh is warm and slightly softened — 3–4 min flesh-side only." },
  },
  {
    keywords: ["banana", "plantain"],
    baseline: { minsPerLb: 14, cookTempF: 350, targetTempF: 0, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Unpeeled on the grate. Done when peel is fully black and interior is caramelized and soft — 5–7 min per side." },
  },
  {
    keywords: ["fig"],
    baseline: { minsPerLb: 10, cookTempF: 400, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Halved, flesh-side down. Done when grill marks are caramelized and flesh is jammy — about 3–4 min flesh-side only." },
  },
  {
    keywords: ["pear"],
    baseline: { minsPerLb: 14, cookTempF: 375, targetTempF: 0, restMins: 2, wrapRec: "none", wrapNote: "No wrap. Halved, cored, flesh-side down. Done when grill marks appear and flesh is tender when pierced — 5–6 min flesh-side, 2–3 min skin-side." },
  },
  {
    keywords: ["citrus", "lemon", "lime", "orange"],
    baseline: { minsPerLb: 8, cookTempF: 450, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Cut-side down on screaming hot dry grates. Done when flesh is caramelized and deeply charred — about 3–4 min. Squeeze over finished proteins or salads." },
  },
  {
    keywords: ["strawberr"],
    baseline: { minsPerLb: 8, cookTempF: 400, targetTempF: 0, restMins: 0, wrapRec: "none", wrapNote: "No wrap. Skewered and lightly oiled. Done when skin chars slightly and berries are warm and juicy — about 3–4 min per side." },
  },
];

export function getMeatBaseline(foodType: string): MeatBaseline | null {
  const lower = foodType.toLowerCase();
  for (const entry of MEAT_KB) {
    if (entry.keywords.some(k => lower.includes(k))) {
      return entry.baseline;
    }
  }
  return null;
}
