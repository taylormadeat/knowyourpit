import type { MeatCut } from "@/constants/meatCuts";

export interface MeatPrepGuide {
  steps: string[];
  /** Tip for smoke / indirect cooking (the default). */
  tip: string;
  /** Alternate tip when cooking method is direct heat / grilling. Omit if the base tip already applies. */
  directHeatTip?: string;
}

export const PREP_GUIDE_MAP: Record<string, MeatPrepGuide> = {
  // ── Beef ──────────────────────────────────────────────────────────────
  brisket: {
    steps: [
      "Trim fat cap to ¼ inch — too thick insulates, too thin dries out.",
      "Remove hard fat deposits near the point-flat seam.",
      "Apply rub: equal parts coarse salt and black pepper. Add garlic powder if desired.",
      "Wrap tightly in plastic wrap, rest in fridge overnight (up to 24h).",
      "Remove from fridge 1 hour before cooking for more even bark formation.",
    ],
    tip: "Grain direction matters for slicing. Cut against the grain after resting.",
    directHeatTip: "Whole brisket is not a good candidate for direct grilling — the connective tissue needs low-and-slow heat to break down. Instead, slice the flat thinly against the grain and grill over medium-high heat 2–3 min per side, or cube the point for burnt-end style bites over direct heat. Pull at 160°F and rest 5 minutes.",
  },
  beef_ribs: {
    steps: [
      "Leave the membrane on — it helps hold the meat to the bone during the long cook.",
      "Trim excess fat and silver skin from the top side.",
      "Apply a heavy coat of coarse salt and black pepper (no-wrap style) or add garlic powder and paprika.",
      "Let the rub sit uncovered in the fridge for at least 4 hours, ideally overnight.",
      "Remove from fridge 30 minutes before cooking.",
    ],
    tip: "Beef ribs need more time and higher ambient temps than pork ribs — 275°F and patience are your best tools.",
    directHeatTip: "For direct-heat beef ribs, flanken-cut (cross-cut) or thin-cut short ribs work best. Grill over high heat 4–5 min per side, then move to indirect to finish. Pull when the meat pulls back from the bone and registers 160°F+.",
  },
  chuck_roast: {
    steps: [
      "Trim hard fat pockets but leave a thin layer on top.",
      "Season generously with coarse salt, pepper, garlic powder, and onion powder.",
      "Optional: inject with beef broth and Worcestershire for added moisture.",
      "Let rest in the fridge uncovered overnight to dry-brine.",
      "Remove from fridge 45 minutes before cooking.",
    ],
    tip: "Chuck roast is very forgiving — cook it like a brisket and pull it when probe tender at 205°F.",
    directHeatTip: "Whole chuck roast needs low-and-slow heat to tenderize — direct grilling won't get it there. Slice into 1-inch steaks or cube it for kebabs. Grill over medium-high heat 5–6 min per side and pull at 145°F for steaks. Rest 5–8 minutes; chuck has great marbling and stays juicy when cooked this way.",
  },
  prime_rib: {
    steps: [
      "Dry-brine the night before: rub with kosher salt (½ tsp per lb) all over.",
      "Let sit uncovered in the fridge overnight to draw out moisture and reabsorb.",
      "Tie the roast between the bones for even shape and consistent cooking.",
      "Apply a paste of butter, garlic, rosemary, and thyme before cooking.",
      "Bring to room temperature for 1–2 hours before cooking.",
    ],
    tip: "Rest at least 30 minutes before carving — internal temp will rise another 5–10°F.",
  },
  burger: {
    steps: [
      "Use 80/20 ground beef — the fat is what makes it juicy.",
      "Form patties gently; overworking the meat makes burgers tough.",
      "Make a slight indent in the center of each patty to prevent puffing.",
      "Season both sides with salt and pepper just before cooking — not ahead of time.",
    ],
    tip: "Keep the patties cold until they hit the grill — warm fat melts before you get a good sear.",
  },
  oxtail: {
    steps: [
      "Rinse oxtail pieces and pat completely dry.",
      "Season with salt, pepper, garlic, and your preferred spices.",
      "Optional: sear in a hot cast iron first for a deeper bark before transferring to the smoker.",
      "Arrange in a single layer with space for airflow.",
    ],
    tip: "Oxtail is done when the meat is nearly falling off the bone and a probe slides through with zero resistance — usually 210°F+.",
    directHeatTip: "Oxtail needs moist slow heat to break down — direct grilling alone won't get there. Braise first until tender (210°F+), then finish over high direct heat 3–4 min per side for a charred crust. It's worth the extra step.",
  },
  steak: {
    steps: [
      "Salt generously on both sides 1 hour before cooking or dry-brine in the fridge for up to 24h.",
      "Pat completely dry just before cooking — surface moisture is the enemy of a crust.",
      "Let come to room temperature for 30 minutes.",
    ],
    tip: "Reverse sear: smoke to 115°F internal, then sear in a screaming hot cast iron for the perfect crust.",
    directHeatTip: "Two-zone setup: sear over high heat 60–90 sec per side, then finish on the cool side. Rest 5–8 min before cutting — never skip the rest.",
  },
  tenderloin_beef: {
    steps: [
      "Trim the silver skin — it doesn't render and will tighten during cooking.",
      "Fold the thin tail end under and tie the roast for even thickness.",
      "Dry-brine with kosher salt 24h ahead for best results.",
      "Apply a compound butter or herb paste right before going on the grill.",
    ],
    tip: "Tenderloin has very little fat — don't overcook it. Pull at 120–125°F for medium-rare.",
  },
  flank_skirt: {
    steps: [
      "Score lightly in a crosshatch pattern for better marinade penetration.",
      "Marinate 4–8 hours in an acid-based marinade (citrus or vinegar, soy, oil, garlic).",
      "Pat dry before cooking — marinade on the surface steams instead of sears.",
      "Cook hot and fast over direct heat.",
    ],
    tip: "Always slice against the grain and on a bias — these muscles have long fibers that make or break texture.",
  },

  // ── Pork ──────────────────────────────────────────────────────────────
  pork_shoulder: {
    steps: [
      "Leave the fat cap on — it bastes the meat during the long cook.",
      "Score the fat cap in a cross-hatch pattern for better rub penetration.",
      "Apply yellow mustard as binder, then generous BBQ rub all over.",
      "Optional: inject with apple juice, butter, and rub mixture.",
      "Rest uncovered overnight in the fridge for better bark.",
    ],
    tip: "At 160°F the stall hits. Wrap in butcher paper to power through.",
    directHeatTip: "For direct-heat pork, slice the shoulder into 1-inch steaks or cube it for skewers — a whole shoulder needs low-and-slow heat. Grill over medium-high, 5–6 min per side, and pull at 145°F. Rest 5 minutes before serving.",
  },
  ribs: {
    steps: [
      "Remove the membrane from the bone side using a paper towel for grip.",
      "Trim off any dangly bits of meat or excess fat.",
      "Apply thin coat of mustard, then generously coat with rub.",
      "Let sit 30–60 minutes before cooking, or overnight in the fridge.",
    ],
    tip: "3-2-1 method (3h smoke, 2h wrapped, 1h unwrapped) works great for baby backs.",
    directHeatTip: "For direct-heat ribs, country-style or thin-cut spare ribs work best. Medium heat, lid down, flip every 5–7 minutes. Move to a cooler zone if they're charring before they're cooked through. Pull when they bend easily and hit 190°F+.",
  },
  pork_belly: {
    steps: [
      "Score the fat side in a cross-hatch pattern.",
      "Rub with salt, brown sugar, and paprika all over.",
      "Refrigerate uncovered overnight to dry-brine.",
      "Bring to room temperature 30 minutes before cooking.",
    ],
    tip: "Low and slow at 225°F, then blast with high heat at the end for a crackling crust.",
    directHeatTip: "High heat on the fat side first to render and blister; flip to finish. Watch for fat flare-ups and move to a cooler zone as needed.",
  },
  pork_loin: {
    steps: [
      "Trim excess fat but leave a ¼-inch layer on top to baste during cooking.",
      "Brine for 2–4 hours: 1 tbsp salt and 1 tsp sugar per cup of water.",
      "Pat dry after brining, apply rub liberally.",
      "Let rest in the fridge uncovered for at least 1 hour before cooking.",
    ],
    tip: "Pork loin dries out easily — pull it at 140°F and let carryover heat finish the job.",
  },
  pork_tenderloin: {
    steps: [
      "Remove the silver skin — it will tighten and curl the meat during cooking.",
      "Marinate 2–4 hours in a sweet-savory marinade (apple cider, garlic, herbs).",
      "Pat dry and season with rub right before cooking.",
    ],
    tip: "Pork tenderloin cooks fast — check it at 20 minutes and pull at 140°F. Rest 5 minutes before slicing.",
  },
  ham: {
    steps: [
      "Score the fat cap in a diamond pattern for glaze penetration.",
      "Apply a layer of mustard, then coat with brown sugar and spices.",
      "For added smoke flavor, skip any pre-packaged glaze and make your own.",
      "Let sit at room temperature for 30 minutes before cooking.",
    ],
    tip: "Glaze in the last 30–45 minutes of cooking so sugars caramelize without burning.",
    directHeatTip: "Whole hams are pre-cooked — you're really just warming and glazing. Set up a two-zone grill, place the ham on the indirect side at medium heat (325°F), and glaze every 20–30 minutes. Move briefly over direct heat at the very end to set a caramelized crust. Pull at 140°F internal.",
  },
  pork_chops: {
    steps: [
      "Brine for 30–60 minutes in salt water (1 tbsp salt per cup of water).",
      "Pat completely dry after brining.",
      "Season with salt, pepper, garlic powder, and smoked paprika.",
      "Bring to room temperature 20 minutes before cooking.",
    ],
    tip: "Thick chops do great with a reverse sear — bring to 130°F indirect, then sear over high heat for the crust.",
    directHeatTip: "Direct heat is ideal for pork chops: sear over high heat 3–4 min per side, then move to a cooler zone if they need more time. Pull at 140°F and rest 5 minutes — carryover heat finishes the job.",
  },

  // ── Poultry ───────────────────────────────────────────────────────────
  chicken: {
    steps: [
      "Brine in salt water (1 cup salt per gallon) for 4–12 hours.",
      "Pat completely dry with paper towels — key for crispy skin.",
      "Separate skin from breast and rub butter and seasoning directly on the meat.",
      "Apply oil or mayo on outside, then season liberally.",
    ],
    tip: "Spatchcock for faster, more even cooking and better bark all around.",
    directHeatTip: "Two-zone setup: start skin-side down over medium-high heat, render the skin, then move to indirect to cook through. Flip back to direct for 2 min to crisp. Pull at 165°F.",
  },
  chicken_wings: {
    steps: [
      "Pat wings completely dry — this is the #1 step for crispy skin.",
      "Season with baking powder (1 tsp per lb) + salt + spices. The baking powder is the crisp secret.",
      "Let sit uncovered in the fridge for at least 1 hour, ideally overnight.",
      "Bring to room temperature 20 minutes before cooking.",
    ],
    tip: "Finish wings at 400°F+ (or blast under a broiler) to set the crispy skin — smoke alone won't do it.",
    directHeatTip: "Medium heat, turn every 5–7 minutes for even browning. Move to indirect if they're browning faster than cooking through. Sauce in the last 5 minutes only — earlier and the sugar burns.",
  },
  turkey: {
    steps: [
      "Brine overnight in salt water (1 cup salt per gallon of water).",
      "Pat completely dry, including inside the cavity.",
      "Loosen breast skin and rub butter + herbs directly on the meat.",
      "Let air-dry uncovered in the fridge for 8–24h for crispier skin.",
    ],
    tip: "Tuck wings under the bird to prevent burning during the long cook.",
    directHeatTip: "Spatchcock the turkey for even direct-heat cooking — remove the backbone and flatten it. Set up a two-zone grill at 375–400°F. Start skin-side down over indirect heat, then move over direct heat in the final 10–15 minutes to crisp the skin. Pull the breast at 160°F and thighs at 175°F. Rest 15–20 minutes before carving.",
  },
  duck: {
    steps: [
      "Score the skin in a crosshatch pattern — duck fat is thick and needs to render.",
      "Dry-brine with salt for 12–24 hours uncovered in the fridge.",
      "Pat dry before cooking — rendered fat will baste the meat.",
      "For wild duck, a brine of 1 cup salt + ½ cup brown sugar per gallon works well.",
    ],
    tip: "Duck breast is meant to be medium (135°F) — cook it well done and it turns to shoe leather.",
    directHeatTip: "Duck breast grills beautifully: score the skin, start skin-side down over medium heat to render the fat (8–10 min), then flip to direct high heat for 2–3 min to finish. Watch for fat flare-ups and keep the lid nearby. Pull at 130–135°F for medium. Duck legs need longer — move to indirect heat after searing and cook to 175°F.",
  },

  // ── Lamb & Goat ───────────────────────────────────────────────────────
  lamb: {
    steps: [
      "Trim excess fat but leave some for flavor and moisture.",
      "Score the fat cap to help rendered fat baste the meat.",
      "Marinate with garlic, rosemary, olive oil, and lemon zest overnight.",
      "Bring to room temperature 30 minutes before cooking.",
    ],
    tip: "Lamb loves smoke from cherry or apple wood — avoid mesquite, it overpowers.",
    directHeatTip: "Lamb grills brilliantly over direct heat — leg steaks or chops over medium-high heat 3–5 min per side depending on thickness. Two-zone setup lets you finish thicker cuts without charring. Pull leg at 135°F for medium-rare, chops at 130–135°F. Rest 5 minutes — lamb tightens fast if you cut it too soon.",
  },
  rack_of_lamb: {
    steps: [
      "French the bones by scraping them clean — looks great and prevents burning.",
      "Trim excess fat on the top to about ¼ inch.",
      "Apply a paste of Dijon mustard, garlic, rosemary, and breadcrumbs.",
      "Let sit at room temperature for 30 minutes before cooking.",
    ],
    tip: "Rack of lamb is best at medium-rare (130–135°F). It's a quick cook — don't walk away.",
  },
  goat: {
    steps: [
      "Marinate overnight in a mixture of olive oil, garlic, lemon, oregano, and cumin.",
      "Score deep into the meat in several places to allow marinade penetration.",
      "Pat lightly dry before cooking to encourage browning.",
      "Bring to room temperature for 30–45 minutes before cooking.",
    ],
    tip: "Goat is leaner than lamb — low and slow at 250°F keeps it moist. Baste regularly.",
    directHeatTip: "Goat grills best as chops or kebabs. Marinate well (garlic, lemon, herbs, oil), then grill over medium-high heat 4–5 min per side. Baste frequently to keep it moist. Pull at 160°F and rest 5 minutes.",
  },

  // ── Seafood ───────────────────────────────────────────────────────────
  salmon: {
    steps: [
      "Remove pin bones with tweezers — run your fingers along the fillet to find them.",
      "Dry brine with salt for 1–4 hours in the fridge — this forms the pellicle.",
      "Rinse, pat dry, let air-dry 30 minutes for a sticky surface that holds smoke.",
      "Apply light rub or glaze just before cooking.",
    ],
    tip: "Pull at 130°F for moist fish — white albumin squeezing out means it's overcooked.",
    directHeatTip: "Oil the grates generously and preheat well — salmon sticks to a cold or dirty grate. Grill skin-side down over medium-high heat for most of the cook (4–6 min for a 1-inch fillet), then flip once for 1–2 min. A fish spatula makes flipping easier. Pull at 125–130°F and let carryover finish it. Glaze in the last 2 minutes only.",
  },
  fish_steak: {
    steps: [
      "Pat fish steak completely dry on both sides.",
      "Brush lightly with oil to prevent sticking.",
      "Season simply with salt, pepper, and lemon zest — let the fish flavor shine.",
      "Use a fish spatula and make sure grates are very clean and oiled.",
    ],
    tip: "Fish steaks cook fast over direct heat. They're done when the flesh flakes and the center is just opaque.",
  },
  shrimp: {
    steps: [
      "Keep shells on for extra flavor and protection from the heat.",
      "Butterfly the shrimp by cutting along the back through the shell — helps them cook more evenly.",
      "Toss in oil, garlic, salt, and your preferred seasoning.",
      "Thread on skewers to make flipping easier.",
    ],
    tip: "Shrimp are done the second they turn pink and curl into a C shape — overcooked shrimp curl into a tight O.",
  },
  lobster: {
    steps: [
      "Use kitchen shears to cut the shell down the center of the tail.",
      "Gently pull the meat up and rest it on top of the shell (piggyback method).",
      "Brush with butter, garlic, and paprika.",
      "Keep it cold until right before it hits the grill.",
    ],
    tip: "Lobster is done at 140°F. The meat should be just opaque and pull away from the shell cleanly.",
  },
  whole_fish: {
    steps: [
      "Score the fish 3–4 times on each side, cutting down to the bone for even cooking.",
      "Stuff the cavity with fresh herbs, lemon slices, and garlic.",
      "Coat the outside with olive oil and season generously.",
      "Let rest in the fridge uncovered for 30 minutes after seasoning.",
    ],
    tip: "A well-oiled and clean grate is essential — whole fish sticks easily. Use a fish basket if you have one.",
  },

  // ── Game ──────────────────────────────────────────────────────────────
  venison: {
    steps: [
      "Soak in a brine of water, salt, and juniper berries for 12–24 hours to mellow gaminess.",
      "Trim silverskin and sinew — they don't break down with heat.",
      "Apply a bold rub: salt, pepper, garlic, smoked paprika, and a touch of juniper.",
      "Bring to room temperature 30 minutes before cooking.",
    ],
    tip: "Venison is very lean — it dries out fast. Cook to 145°F and no further. Wrap to rest.",
    directHeatTip: "Venison steaks and chops are excellent on the grill — hot and fast is the right approach. Two-zone setup: sear over high heat 2–3 min per side for a crust, then move to indirect only if they need more time. Pull at 130–135°F for medium-rare; venison dries out quickly past 145°F. Rest 5 minutes tented in foil — the rest is important for lean game.",
  },
  game_roast: {
    steps: [
      "Trim silverskin and excess sinew — it won't render like fat.",
      "Brine 12–24 hours in salt water with aromatics (bay, juniper, thyme) to tame gaminess.",
      "Apply a bold rub and marinate overnight after brining.",
      "Bring to room temperature 30–45 minutes before cooking.",
    ],
    tip: "Game roasts are lean — baste frequently and consider wrapping to retain moisture during the long cook.",
    directHeatTip: "For direct-heat game, slice into steaks or chops — roasts need low-and-slow. Grill over medium heat, 4–5 min per side, and pull at 145°F for venison or 160°F for wild boar. Rest 5 minutes; lean game dries out fast if you skip the rest.",
  },
  rabbit: {
    steps: [
      "If whole, cut into pieces at the joints for more even cooking.",
      "Brine in salt water (1 tbsp per cup) for 2–4 hours — rabbit dries out quickly.",
      "Pat dry, apply seasoning of salt, pepper, thyme, and garlic.",
      "Brush with butter or olive oil right before cooking.",
    ],
    tip: "Rabbit is done at 160°F — treat the saddle (loin) like a pork loin and the legs like chicken thighs.",
  },
};

export function getMeatPrep(cut: MeatCut | null): MeatPrepGuide | null {
  if (!cut) return null;
  const name = cut.name.toLowerCase();
  const category = cut.category.toLowerCase();

  // ── Beef ──
  if (name.includes("brisket")) return PREP_GUIDE_MAP.brisket;
  if (name.includes("prime rib")) return PREP_GUIDE_MAP.prime_rib;
  if (name.includes("chuck")) return PREP_GUIDE_MAP.chuck_roast;
  if (name.includes("oxtail")) return PREP_GUIDE_MAP.oxtail;
  if (name.includes("burger") || name.includes("patty") || name.includes("patties")) return PREP_GUIDE_MAP.burger;
  if (name.includes("flank") || name.includes("skirt")) return PREP_GUIDE_MAP.flank_skirt;
  if (name.includes("tenderloin") && category === "beef") return PREP_GUIDE_MAP.tenderloin_beef;
  if (name.includes("short rib") || name.includes("back rib")) return PREP_GUIDE_MAP.beef_ribs;
  if (name.includes("steak") || name.includes("tri-tip") || name.includes("ribeye") || name.includes("strip")) return PREP_GUIDE_MAP.steak;

  // ── Pork ──
  if (name.includes("belly")) return PREP_GUIDE_MAP.pork_belly;
  if (name.includes("wing")) return PREP_GUIDE_MAP.chicken_wings;
  if (name.includes("rib") && category === "pork") return PREP_GUIDE_MAP.ribs;
  if (name.includes("shoulder") || name.includes("butt") || name.includes("pulled")) return PREP_GUIDE_MAP.pork_shoulder;
  if (name.includes("tenderloin") && category === "pork") return PREP_GUIDE_MAP.pork_tenderloin;
  if (name.includes("loin")) return PREP_GUIDE_MAP.pork_loin;
  if (name.includes("ham")) return PREP_GUIDE_MAP.ham;
  if (name.includes("chop")) return PREP_GUIDE_MAP.pork_chops;

  // ── Poultry ──
  if (name.includes("turkey")) return PREP_GUIDE_MAP.turkey;
  if (name.includes("duck")) return PREP_GUIDE_MAP.duck;
  if (name.includes("wing")) return PREP_GUIDE_MAP.chicken_wings;
  if (name.includes("chicken") || name.includes("cornish") || category === "poultry") return PREP_GUIDE_MAP.chicken;

  // ── Lamb & Goat ──
  if (name.includes("rack of lamb")) return PREP_GUIDE_MAP.rack_of_lamb;
  if (name.includes("goat")) return PREP_GUIDE_MAP.goat;
  if (category === "lamb & goat" || name.includes("lamb")) return PREP_GUIDE_MAP.lamb;

  // ── Seafood ──
  if (name.includes("salmon")) return PREP_GUIDE_MAP.salmon;
  if (name.includes("shrimp")) return PREP_GUIDE_MAP.shrimp;
  if (name.includes("lobster")) return PREP_GUIDE_MAP.lobster;
  if (name.includes("whole fish") || name.includes("whole ")) return PREP_GUIDE_MAP.whole_fish;
  if (name.includes("swordfish") || name.includes("tuna")) return PREP_GUIDE_MAP.fish_steak;
  if (category === "seafood") return PREP_GUIDE_MAP.fish_steak;

  // ── Game ──
  if (name.includes("bison") && name.includes("brisket")) return PREP_GUIDE_MAP.brisket;
  if (name.includes("wild boar") && (name.includes("shoulder") || name.includes("butt"))) return PREP_GUIDE_MAP.pork_shoulder;
  if (name.includes("venison")) return PREP_GUIDE_MAP.venison;
  if (name.includes("rabbit")) return PREP_GUIDE_MAP.rabbit;
  if (name.includes("duck")) return PREP_GUIDE_MAP.duck;
  if (category === "game") return PREP_GUIDE_MAP.game_roast;

  return null;
}
