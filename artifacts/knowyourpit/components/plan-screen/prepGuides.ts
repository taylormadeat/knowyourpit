import type { MeatCut } from "@/constants/meatCuts";
import { classifyCookingMethod } from "@/utils/cookingMethod";

export interface MeatPrepGuide {
  steps: string[];
  /** Tip for smoke / indirect / low-and-slow cooking (the default fallback). */
  tip: string;
  /** Alternate tip when cooking method is Direct Heat / Sear / Griddle. */
  directHeatTip?: string;
  /** Alternate tip when cooking method is Reverse Sear. */
  reverseSearTip?: string;
  /** Alternate tip when cooking method is Hot & Fast. */
  hotAndFastTip?: string;
  /** Alternate tip when cooking method is Rotisserie. */
  rotisserieTip?: string;
  /** Alternate tip when cooking method is Braised. */
  braisedTip?: string;
  /** Alternate tip when cooking method is Indirect Heat (and meaningfully different from smoke). */
  indirectHeatTip?: string;
}

/**
 * Selects the most specific prep tip for a given cook method.
 * Falls back to `directHeatTip` → `tip` in order of specificity.
 * Mirrors the selection logic in plan.tsx — keep both in sync.
 */
export function selectPrepTip(prep: MeatPrepGuide, method: string | null | undefined): string {
  const cls = classifyCookingMethod(method);
  switch (cls) {
    case "direct":
    case "sear":
    case "griddle":
      return prep.directHeatTip ?? prep.tip;
    case "reverse_sear":
      return prep.reverseSearTip ?? prep.tip;
    case "hot_fast":
      return prep.hotAndFastTip ?? prep.tip;
    case "rotisserie":
      return prep.rotisserieTip ?? prep.tip;
    case "braised":
      return prep.braisedTip ?? prep.tip;
    case "indirect":
      return prep.indirectHeatTip ?? prep.tip;
    default:
      return prep.tip;
  }
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
    hotAndFastTip: "Hot and fast changes the playbook: run your cooker at 325–350°F and let the bark set before wrapping in butcher paper (typically around 165–170°F). The stall won't last long at this temp — push through it and keep the heat up. Expect 6–8 hours total instead of 12–16. The bark is thinner but the beef flavor is intense and the flat stays moist. Pull at 195–203°F probe tender.",
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
    hotAndFastTip: "Hot and fast beef ribs: cook at 325°F and wrap in butcher paper when the bark is set and the stall begins (around 175°F). The heavy collagen and marbling keep them moist at higher temps — they're forgiving. Expect 4–5 hours instead of 8+. Pull when a skewer slides through with zero resistance, typically 200–205°F.",
    braisedTip: "Braised beef short ribs are a showstopper: sear each rib in batches in a hot Dutch oven until deeply browned on all sides — don't skip this step, it builds the flavor base. Add red wine, beef stock, and aromatics to just below the top of the ribs. Cover and braise at 325°F for 3–4 hours until the meat is nearly falling off the bone. Rest in the braising liquid 20 min before serving; reduce the liquid into a rich sauce.",
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
    braisedTip: "Braising is chuck roast's best method: sear all sides hard in a Dutch oven over high heat until a deep crust forms, then add braising liquid (beef broth, red wine, aromatics) to just below — not over — the top of the meat. Cover and cook at 325°F for 3–4 hours. It's done when a fork twists out easily — usually 200–210°F. The braising liquid becomes a rich, ready-made sauce.",
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
    directHeatTip: "Prime rib grills best with a two-zone setup. Sear all sides over high direct heat 2–3 min per side for a deep crust, then move to the cool zone with the lid down at 325°F to roast through. Pull at 120–125°F for medium-rare — carryover adds 5–10°F during the rest. Rest at least 20 minutes before carving.",
    reverseSearTip: "Reverse sear brings exceptional control for prime rib: roast low-and-slow at 225–250°F until 10–15°F below your target (e.g. 110°F for medium-rare), then blast over screaming-high direct heat or a broiler for 8–10 minutes to develop a deep crust all over. Resting is already built into the slow phase — slice promptly after the final sear.",
    rotisserieTip: "Rotisserie prime rib is exceptional — the constant rotation self-bastes the roast in its own dripping fat. Tie the roast at 1-inch intervals between the bones and balance it carefully on the spit. Run indirect at 325°F with a drip pan below. Pull at 120°F for medium-rare; carryover during the 20-minute rest brings it to 125–130°F.",
    indirectHeatTip: "Indirect heat at 325–350°F is the classic oven-roast approach for prime rib — no stall, no bark strategy, no wrap needed. Set up a two-zone grill or close all vents to create convection heat. Pull at 120–125°F for medium-rare; carryover during the 20–30 minute rest brings it to 130°F. The herb butter crust sets beautifully at this temp without the smoke influence.",
  },
  burger: {
    steps: [
      "Use 80/20 ground beef — the fat is what makes it juicy.",
      "Form patties gently; overworking the meat makes burgers tough.",
      "Make a slight indent in the center of each patty to prevent puffing.",
      "Season both sides with salt and pepper just before cooking — not ahead of time.",
    ],
    tip: "Keep the patties cold until they hit the grill — warm fat melts before you get a good sear.",
    directHeatTip: "High heat, lid down. Cook 3–4 min per side for medium — flip once and don't press down. Pressing squeezes out the fat that keeps the burger juicy. Pull at 155°F for food-safe medium, 160°F for well. Add cheese in the last minute and close the lid to melt it fast.",
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
    braisedTip: "Braising is the definitive method for oxtail: sear pieces in batches in a hot Dutch oven until deeply browned on all sides, then braise covered in red wine and beef stock (liquid to just below the meat's top) at 325°F for 3–4 hours. Pull when the meat is nearly falling from the bone and a fork twists out cleanly at 210°F+. Skim the fat and reduce the braising liquid into a glossy sauce.",
  },
  steak: {
    steps: [
      "Salt generously on both sides 1 hour before cooking or dry-brine in the fridge for up to 24h.",
      "Pat completely dry just before cooking — surface moisture is the enemy of a crust.",
      "Let come to room temperature for 30 minutes.",
    ],
    tip: "Low and slow at 225–250°F to your preferred doneness, then rest 10 minutes before serving.",
    directHeatTip: "Two-zone setup: sear over high heat 60–90 sec per side, then finish on the cool side. Rest 5–8 min before cutting — never skip the rest.",
    reverseSearTip: "Reverse sear delivers the perfect crust: cook low-and-slow at 225–250°F until 10–15°F below target, then sear in a screaming-hot cast iron or over max grill heat 60–90 sec per side. Pull at 130–135°F for medium-rare including carryover — the final sear adds 5–10°F. Rest 5 minutes before cutting.",
  },
  tenderloin_beef: {
    steps: [
      "Trim the silver skin — it doesn't render and will tighten during cooking.",
      "Fold the thin tail end under and tie the roast for even thickness.",
      "Dry-brine with kosher salt 24h ahead for best results.",
      "Apply a compound butter or herb paste right before going on the grill.",
    ],
    tip: "Tenderloin has very little fat — don't overcook it. Pull at 120–125°F for medium-rare.",
    directHeatTip: "Beef tenderloin grills beautifully — it's naturally tender and cooks fast. For a whole roast, sear all sides over high direct heat 2 min per side, then move to indirect at medium-high with the lid down to finish. Pull at 120–125°F for medium-rare; carryover will bring it to 130°F. For filets, sear over high heat 3–4 min per side and pull at 125°F. Rest 5–8 minutes before cutting.",
    reverseSearTip: "Reverse sear is ideal for beef tenderloin: cook at 225–250°F to 110°F internal, then sear all sides over screaming-high heat 45–60 sec per side for a golden crust. Pull at 120–125°F for medium-rare — the roast is lean, so don't let it go past 135°F or it loses its silky texture. Rest 5–8 minutes before cutting.",
  },
  flank_skirt: {
    steps: [
      "Score lightly in a crosshatch pattern for better marinade penetration.",
      "Marinate 4–8 hours in an acid-based marinade (citrus or vinegar, soy, oil, garlic).",
      "Pat dry before cooking — marinade on the surface steams instead of sears.",
      "Cook hot and fast over direct heat.",
    ],
    tip: "Always slice against the grain and on a bias — these muscles have long fibers that make or break texture.",
    directHeatTip: "Flank and skirt are made for direct high heat — grill over screaming-hot coals or max burners, 3–4 min per side for flank, 2–3 min per side for the thinner skirt. Don't move them around; let each side develop a crust before flipping once. Pull at 130–135°F for medium-rare. Slice immediately against the grain on a sharp bias — thin slices are essential for these long-fibered cuts.",
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
    hotAndFastTip: "Hot and fast pork shoulder: cook at 300–325°F and wrap in butcher paper when the bark is set and the stall begins (around 165°F). The collagen still breaks down — it just happens faster. Expect 6–8 hours for an 8 lb shoulder instead of 14+. Pull at 200–205°F probe tender; rest wrapped for at least 1 hour before pulling.",
    braisedTip: "Braised pork shoulder: cut into 3–4 inch chunks or keep whole. Sear in a hot Dutch oven until a deep brown crust forms on all sides, then add liquid (cider, broth, aromatics) to ⅔ the height of the meat. Cover and braise at 325°F for 3–4 hours. Pull when a fork twists out easily at 200–205°F. The braising liquid becomes a rich, ready-made sauce.",
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
    hotAndFastTip: "Hot and fast ribs cut total cook time dramatically: run at 325–350°F and wrap in foil with a splash of apple juice or honey butter when the bark is set (around 165°F). They'll finish in 3–4 hours instead of 6+. The texture is slightly firmer than low-and-slow but the flavor is excellent. Pull when they bend easily and a toothpick slides between the bones with zero resistance.",
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
    directHeatTip: "Two-zone setup is key for pork loin on the grill — the roast needs time to cook through without charring. Sear all sides over high direct heat 2 min per side, then move to the cool zone with the lid down at 350°F to finish. Pull at 138°F; carryover heat will bring it to a safe 145°F during the 10-minute rest. Slice into ½-inch medallions and serve immediately.",
    rotisserieTip: "Rotisserie pork loin stays remarkably moist — the rotation self-bastes and the even heat prevents hot spots. Tie at 1-inch intervals for a uniform shape and balance the roast on the spit. Run indirect at 325–350°F. Brush with a glaze (apple, mustard, or honey-garlic) every 20 minutes in the last hour. Pull at 138°F; carryover brings it to a safe 145°F during the 10-minute rest.",
    indirectHeatTip: "Indirect heat at 325–350°F is ideal for pork loin — it's a lean roast that benefits from the faster, drier heat of a convection-style setup. No stall, no wrap needed. Cook with the fat cap up to baste the meat. Brush with a glaze (apple, mustard, or honey-garlic) in the last 20 minutes. Pull at 138°F; carryover brings it to a safe 145°F during the 10-minute rest. Don't take it past 145°F or it dries out.",
  },
  pork_tenderloin: {
    steps: [
      "Remove the silver skin — it will tighten and curl the meat during cooking.",
      "Marinate 2–4 hours in a sweet-savory marinade (apple cider, garlic, herbs).",
      "Pat dry and season with rub right before cooking.",
    ],
    tip: "Pork tenderloin cooks fast — check it at 20 minutes and pull at 140°F. Rest 5 minutes before slicing.",
    directHeatTip: "Pork tenderloin is ideal for direct grilling — it's thin enough to cook through quickly. Grill over medium-high heat, turning a quarter turn every 3–4 minutes to brown all four sides evenly (12–15 minutes total). Pull at 138°F; carryover brings it to a safe 145°F during the 5-minute rest. Don't slice immediately — let it rest fully or the juices run out.",
    reverseSearTip: "Reverse sear works beautifully for pork tenderloin: cook at 225°F to 125°F internal, then sear over high heat turning every 30 seconds for 2–3 min total to brown all sides. Pull at 138°F; carryover brings it to a safe 145°F during the 5-minute rest. Slice into medallions and serve immediately — don't skip the rest or the juices run out.",
    indirectHeatTip: "Indirect heat at 325–375°F cooks pork tenderloin fast — expect 20–30 minutes total. No stall, no wrap, no bark strategy needed. The higher temp gives a light exterior color without requiring a final sear. Flip once halfway through and pull at 138°F; carryover brings it to a safe 145°F during the 5-minute rest. Watch it closely — this cut goes from perfect to dry quickly at higher temps.",
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
    tip: "Thick chops cook well low-and-slow at 225–250°F — pull at 140°F and rest 5 minutes before serving.",
    directHeatTip: "Direct heat is ideal for pork chops: sear over high heat 3–4 min per side, then move to a cooler zone if they need more time. Pull at 140°F and rest 5 minutes — carryover heat finishes the job.",
    reverseSearTip: "Reverse sear is the move for thick-cut chops (1 inch+): cook at 225–250°F to 130°F internal, then sear over screaming-high heat 60–90 sec per side for a golden crust. Pull at 140°F including carryover — the final sear adds ~10°F. Rest 5 minutes before plating; the interior will be perfectly even edge to edge.",
  },

  // ── Poultry ───────────────────────────────────────────────────────────
  chicken: {
    steps: [
      "Brine in salt water (1 cup salt per gallon) for 4–12 hours.",
      "Pat completely dry with paper towels — key for crispy skin.",
      "Separate skin from breast and rub butter and seasoning directly on the meat.",
      "Apply oil or mayo on outside, then season liberally.",
    ],
    tip: "Spatchcock for faster, more even cooking and better skin all around.",
    directHeatTip: "Two-zone setup: start skin-side down over medium-high heat, render the skin, then move to indirect to cook through. Flip back to direct for 2 min to crisp. Pull at 165°F.",
    hotAndFastTip: "Hot and fast whole chicken at 350–375°F delivers crispier skin in less time — about 60–75 minutes for a spatchcocked bird. No need to wrap; the higher heat renders the fat and sets the skin. Pull breast at 160°F and thighs at 175°F. Spatchcock before cooking for the fastest, most even result.",
    rotisserieTip: "Rotisserie chicken is the gold standard: truss tightly — legs tied to the tail, wings tucked — so nothing flaps and the bird stays balanced on the spit. Run at 350°F indirect with a drip pan below for self-basting. Plan 15–18 min per lb. Pull breast at 160°F (carryover finishes it to 165°F). Let the bird coast on the spit with the heat off for 10 minutes before carving.",
    indirectHeatTip: "Indirect heat at 325–375°F is a roasting approach — not a smoking one. Expect 60–90 minutes for a spatchcocked bird at 375°F versus 3–4 hours at 225°F. No stall, no wrap, and no bark strategy needed. The higher temp renders the fat and crisps the skin far better than low-and-slow. Pull breast at 160°F and thighs at 175°F. Spatchcock before cooking for the fastest, most even result.",
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
    hotAndFastTip: "Wings thrive at hot and fast temps: cook at 375–400°F for 45–60 min, flipping once halfway. The high heat renders fat, crisps the skin, and cooks them through — no finishing blast needed. Sauce in the last 10 minutes and flip once to caramelize.",
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
    rotisserieTip: "Rotisserie turkey takes some setup but the result is outstanding: truss tightly — legs tied to the tail, wings secured with twine or skewers so nothing flaps. Balance the bird carefully on the spit before committing. Run indirect at 325–350°F with a drip pan below. Plan 12–15 min per lb. Pull breast at 160°F and thighs at 175°F. Let the bird coast on the spit with heat off for 10 minutes before carving.",
    indirectHeatTip: "Indirect heat at 325–375°F is the traditional roasting method for turkey — shorter cook, no stall, no bark strategy, and far crispier skin than low-and-slow smoke. A 12–14 lb bird takes roughly 2.5–3 hours at 325°F. Baste with butter every 45 minutes and tent with foil if the breast is browning faster than the thighs are cooking through. Pull breast at 160°F and thighs at 175°F. Rest 20–30 minutes before carving.",
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
    reverseSearTip: "Reverse sear is excellent for thick lamb leg steaks or a boneless leg: cook at 225–250°F to 115°F internal, then sear over screaming-high heat 60–90 sec per side for a charred crust. Pull at 130–135°F for medium-rare including carryover. Rest 5 minutes — lamb tightens fast if you cut too soon.",
    braisedTip: "Braised lamb (shanks or shoulder): sear in a hot Dutch oven until deeply browned on all sides, then braise in red wine, stock, and aromatics at 325°F for 2–3 hours for shoulder/chops, 3–4 hours for shanks. Pull when the meat pulls away from the bone cleanly at 195°F+. The braising liquid reduces into a silky, richly flavored sauce — don't discard it.",
  },
  rack_of_lamb: {
    steps: [
      "French the bones by scraping them clean — looks great and prevents burning.",
      "Trim excess fat on the top to about ¼ inch.",
      "Apply a paste of Dijon mustard, garlic, rosemary, and breadcrumbs.",
      "Let sit at room temperature for 30 minutes before cooking.",
    ],
    tip: "Rack of lamb is best at medium-rare (130–135°F). It's a quick cook — don't walk away.",
    directHeatTip: "Rack of lamb thrives on direct heat — the fat renders fast and the bones char beautifully. Start fat-side down over high heat for 3–4 min to get a golden crust, then flip and sear the bone side 2–3 min. Move to indirect heat with the lid down to finish, or for a thinner rack continue over medium heat. Pull at 125–130°F for medium-rare. Rest 5–8 minutes before slicing between the bones.",
    reverseSearTip: "Reverse sear rack of lamb for perfect edge-to-edge medium-rare: cook at 225–250°F to 110–115°F internal, then sear fat-side down over screaming-high heat for 2–3 min and quickly sear the bone side. Pull at 125–130°F with carryover. The rack is small — the final sear goes fast, so don't walk away.",
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
    braisedTip: "Braised goat develops deep, complex flavor: sear pieces until browned on all sides, then braise in spiced liquid (tomatoes, garlic, cumin, coriander, stock) at 325°F for 2.5–3.5 hours. Goat is lean — the braising liquid keeps it moist while the long cook drives in flavor. Pull when the meat is falling off the bone at 195°F+.",
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
    directHeatTip: "Preheat the grates thoroughly and oil them well right before the fish goes on — this is the most important step to prevent sticking. Grill over medium-high heat 3–4 min per side for a 1-inch steak; resist moving them until they release naturally. A fish spatula helps you flip cleanly. Pull when the center just turns opaque and the flesh flakes easily — internal temp around 130–135°F. Squeeze lemon on immediately after pulling.",
  },
  shrimp: {
    steps: [
      "Keep shells on for extra flavor and protection from the heat.",
      "Butterfly the shrimp by cutting along the back through the shell — helps them cook more evenly.",
      "Toss in oil, garlic, salt, and your preferred seasoning.",
      "Thread on skewers to make flipping easier.",
    ],
    tip: "Shrimp are done the second they turn pink and curl into a C shape — overcooked shrimp curl into a tight O.",
    directHeatTip: "Shrimp are perfect for direct high heat — they cook in 2–3 min total and go from raw to rubbery fast. Grill over high heat 1–2 min per side on skewers or in a grill basket so you don't lose them through the grates. Pull the moment they turn pink and form a C shape. Have your platter ready before they go on — there's no waiting once they're done.",
  },
  lobster: {
    steps: [
      "Use kitchen shears to cut the shell down the center of the tail.",
      "Gently pull the meat up and rest it on top of the shell (piggyback method).",
      "Brush with butter, garlic, and paprika.",
      "Keep it cold until right before it hits the grill.",
    ],
    tip: "Lobster is done at 140°F. The meat should be just opaque and pull away from the shell cleanly.",
    directHeatTip: "Grill lobster tails meat-side down over medium-high heat for 4–5 min to get char marks and flavor, then flip shell-side down for another 3–4 min to finish cooking through. Baste with garlic butter each time you flip. Pull at 140°F — the meat should be just opaque and pull away from the shell. Don't walk away; lobster goes from perfect to rubbery in under a minute.",
  },
  whole_fish: {
    steps: [
      "Score the fish 3–4 times on each side, cutting down to the bone for even cooking.",
      "Stuff the cavity with fresh herbs, lemon slices, and garlic.",
      "Coat the outside with olive oil and season generously.",
      "Let rest in the fridge uncovered for 30 minutes after seasoning.",
    ],
    tip: "A well-oiled and clean grate is essential — whole fish sticks easily. Use a fish basket if you have one.",
    directHeatTip: "A fish basket is your best friend here — it makes flipping a whole fish simple and prevents it from falling apart. Oil the fish generously inside and out, preheat the grates, and grill over medium heat 5–7 min per side for a 1–2 lb fish. The skin is done when it lifts cleanly from the grate. The fish is ready when the flesh behind the dorsal fin flakes and the eye turns white. Pull and serve immediately — whole fish don't hold well.",
  },

  // ── Game ──────────────────────────────────────────────────────────────
  venison: {
    steps: [
      "Soak in a brine of water, salt, and juniper berries for 12–24 hours to mellow gaminess.",
      "Trim silverskin and sinew — they don't break down with heat.",
      "Apply a bold rub: salt, pepper, garlic, smoked paprika, and a touch of juniper.",
      "Bring to room temperature 30 minutes before cooking.",
    ],
    tip: "Venison is very lean — it dries out fast. Cook to 145°F and no further. Rest wrapped in foil.",
    directHeatTip: "Venison steaks and chops are excellent on the grill — hot and fast is the right approach. Two-zone setup: sear over high heat 2–3 min per side for a crust, then move to indirect only if they need more time. Pull at 130–135°F for medium-rare; venison dries out quickly past 145°F. Rest 5 minutes tented in foil — the rest is important for lean game.",
    reverseSearTip: "Reverse sear is ideal for venison — the gradual low heat keeps lean meat moist while the final sear builds crust without overcooking. Cook at 225°F to 110–115°F internal, then sear over maximum heat 45–60 sec per side. Pull at 128–130°F for medium-rare; venison dries out fast past 145°F. Rest 5 minutes tented in foil.",
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
    reverseSearTip: "Reverse sear is excellent for lean game roasts: cook at 225°F until 10–15°F below your target, then sear over screaming-high heat 60–90 sec per side for a crust. Pull at 130–135°F for medium-rare on deer/elk, 145°F for wild boar. The gradual heat keeps lean meat moist where direct roasting often dries it out. Rest 8–10 minutes tented in foil.",
  },
  rabbit: {
    steps: [
      "If whole, cut into pieces at the joints for more even cooking.",
      "Brine in salt water (1 tbsp per cup) for 2–4 hours — rabbit dries out quickly.",
      "Pat dry, apply seasoning of salt, pepper, thyme, and garlic.",
      "Brush with butter or olive oil right before cooking.",
    ],
    tip: "Rabbit is done at 160°F — treat the saddle (loin) like a pork loin and the legs like chicken thighs.",
    directHeatTip: "Grill rabbit pieces over medium heat — high heat dries out the lean meat too fast. Legs go on first (they need the most time); add the saddle pieces 5–7 minutes later. Turn every 4–5 minutes for even browning. Baste with butter or olive oil throughout to keep it moist. Pull the legs at 165°F and the loin at 155°F — the loin is done when it firms up and the juices run clear. Rest 5 minutes before serving.",
  },

  // ── Sausages & cured ──────────────────────────────────────────────────
  sausage: {
    steps: [
      "Keep sausages cold until they hit the smoker — warm casings split more easily.",
      "Do NOT prick the casings; the fat inside is the flavor and moisture.",
      "Pat dry so smoke adheres to the casing.",
      "Space links so smoke can circulate on all sides.",
    ],
    tip: "Pre-cooked links (andouille, hot links, smoked sausage) only need to be warmed through to ~150°F; raw sausage like bratwurst or Italian must reach 160°F.",
    directHeatTip: "Grill over medium — not high — heat, turning often. High heat splits casings and squeezes out the juices. If flare-ups start, move links to the cooler side and finish them there to 160°F internal.",
  },
  jerky: {
    steps: [
      "Start with a lean cut (eye of round or top round) and trim ALL visible fat — fat is what turns jerky rancid.",
      "Partially freeze 1–2 hours, then slice ¼ inch thick — with the grain for chewy, against for tender.",
      "Marinate 12–24 hours in the fridge (soy, Worcestershire, and cure if storing long-term).",
      "Pat slices completely dry and lay in a single layer with space between pieces.",
    ],
    tip: "Jerky is done when a piece bends and cracks without snapping in half — typically 4–6 hours at 160–180°F. It firms further as it cools.",
    directHeatTip: "Jerky can't be made over direct flame — it needs long, gentle drying, not cooking. Set up the coolest indirect zone you can hold at 160–180°F, keep the slices far from the heat source, and leave the lid vented so moisture escapes. Pieces are done when they bend and crack without snapping.",
  },
  round_roast: {
    steps: [
      "Trim silver skin but leave any thin fat cap — round cuts are very lean and need all the help they can get.",
      "Season generously with salt at least 4 hours ahead (dry brine) to help retain moisture.",
      "Tie with butcher's twine if the roast is uneven, for consistent doneness.",
      "Bring toward room temperature for 45–60 minutes before cooking.",
    ],
    tip: "Round cuts are lean — cook to 130–135°F max and slice paper thin against the grain. Past medium they turn to shoe leather.",
    directHeatTip: "Sear all sides hard over direct heat, then move to the indirect side to finish gently to 130°F. Rest 15 minutes and slice as thin as you can — thin slices are what make lean round eat tender.",
  },
  kabobs: {
    steps: [
      "Cut meat into even 1–1.5 inch cubes so every piece cooks at the same rate.",
      "Marinate 2–8 hours; anything acidic beyond that starts breaking down the texture.",
      "Skewer meat and vegetables separately — they cook at different speeds.",
      "Leave a small gap between pieces so heat reaches all sides.",
    ],
    tip: "If using wooden skewers, soak them 30 minutes so they don't burn.",
    directHeatTip: "Kabobs are built for direct heat — grill hot and fast, turning a quarter rotation every 2–3 minutes. Beef cubes are best pulled at 130–135°F for medium-rare.",
  },

  // ── Shellfish ─────────────────────────────────────────────────────────
  shellfish: {
    steps: [
      "Pat shellfish completely dry — excess moisture causes steaming instead of searing.",
      "Season lightly with salt and a brush of neutral oil or garlic butter.",
      "Preheat grates or pan to high heat so shellfish release cleanly without sticking.",
      "Have everything ready before they go on — shellfish cook in minutes.",
    ],
    tip: "Shellfish tell you when they're done: scallops turn opaque with a golden crust, oysters pop open, crab legs are heated through at 140°F. Don't overcook — they go rubbery fast.",
    directHeatTip: "High heat is essential for shellfish. Scallops: sear 90 sec per side on a screaming-hot surface — move them once, don't fuss. Oysters: grill shell-side down over high heat until they pop open (5–8 min), then add butter. Crab legs: split and grill cut-side down 4–5 min until heated through. Squid/octopus: pre-cook until tender, then char 1–2 min per side over screaming heat. Pull everything the moment it's done.",
  },

  // ── Pork Steak ────────────────────────────────────────────────────────
  pork_steak: {
    steps: [
      "These are shoulder steaks — expect marbling and a tougher grain than loin cuts.",
      "Season generously with salt, pepper, garlic powder, and smoked paprika.",
      "Optional: marinate 2–4 hours in a vinegar-based BBQ sauce for extra tenderness.",
      "Pat dry before cooking so the surface sears rather than steams.",
      "Bring to room temperature 20 minutes before cooking.",
    ],
    tip: "Pork steaks are a St. Louis classic — cook them low and slow to 190–195°F for fork-tender results, then sauce and caramelize in the last 15 minutes.",
    directHeatTip: "Two-zone setup for pork steaks: sear over medium-high heat 4–5 min per side for color, then move to the indirect side and cook to 195°F — shoulder muscle needs time to break down even on the grill. Sauce in the last 5 minutes only so the sugars caramelize without burning. Rest 5 minutes before serving.",
  },

  // ── Picanha ───────────────────────────────────────────────────────────
  picanha: {
    steps: [
      "Score the fat cap in a 1-inch crosshatch pattern — don't cut into the meat.",
      "Season generously with coarse salt (and pepper if desired) — Brazilians often use salt only.",
      "Let rest uncovered in the fridge for at least 1 hour, or overnight for best flavor.",
      "Bring to room temperature 30 minutes before cooking.",
    ],
    tip: "Reverse sear is ideal: smoke fat-side up to 115°F, then sear fat-side down over high heat to render and crisp the cap. Slice against the grain into thin strips.",
    directHeatTip: "Fold slices into a C-shape (fat-side out) and skewer them Brazilian-style, then grill over high heat turning often. Alternatively, grill the whole cap fat-side down over medium-high heat to render the fat (5–7 min), then flip and finish to 130–135°F. Let the fat crisp up — that's the signature. Slice thin against the grain and serve immediately.",
  },

  // ── Lean Game (Tenderloin / Backstrap) ────────────────────────────────
  lean_game: {
    steps: [
      "Remove all silverskin and sinew — it won't break down and will tighten during cooking.",
      "Skip the long brine — venison tenderloin is delicate; a 30-minute herb-oil marinade is enough.",
      "Pat dry and season simply: salt, pepper, garlic, and fresh rosemary.",
      "Bring to room temperature 20 minutes before cooking.",
    ],
    tip: "Venison tenderloin is the most tender and leanest cut — treat it like filet mignon. Pull at 125–130°F for medium-rare and rest 5 minutes tented in foil. It dries out dramatically past 140°F.",
    directHeatTip: "Grill over high heat 2–3 min per side — lean game tenderloins are thin and cook extremely fast. Turn to sear all sides for an even crust, then move to indirect only if the center needs more time. Pull at 125–130°F for medium-rare; carryover will bring it to 130–135°F during the rest. Rest 5 minutes tented in foil — never skip it on lean cuts.",
    reverseSearTip: "Reverse sear is the best method for venison tenderloin and backstrap: cook at 225°F to 110–115°F internal, then sear over maximum heat 45–60 sec per side for a fast crust. Pull at 125–130°F for medium-rare; lean game dries out quickly past 140°F. Rest 5 minutes tented in foil — don't skip it.",
  },

  // ── Lox / Cold-Smoked Salmon ──────────────────────────────────────────
  lox: {
    steps: [
      "Cure first: coat flesh side with a mix of coarse salt (2 parts), sugar (1 part), and optional dill or citrus zest.",
      "Wrap tightly in plastic and refrigerate 24–48 hours, flipping once halfway through.",
      "Rinse thoroughly under cold water and pat completely dry.",
      "Air-dry uncovered in the fridge for 1–2 hours until the surface is dry and slightly tacky (pellicle).",
      "Keep the smoker under 80°F — this is cold smoke, not hot smoke.",
    ],
    tip: "Cold-smoked salmon is a curing process, not a cooking one. The pellicle is essential — it's what smoke adheres to. Skip the pellicle and the smoke flavor won't penetrate.",
    directHeatTip: "Cold-smoked salmon (lox) cannot be made with direct heat — the process requires a smoker held below 80°F for hours. If you want grilled salmon instead, use the regular salmon guide and cook it hot and fast. Lox needs a dedicated cold-smoke setup or a smoke tube with no heat source.",
  },

  // ── Chicken Parts ─────────────────────────────────────────────────────
  chicken_parts: {
    steps: [
      "Pat pieces completely dry — surface moisture is the enemy of crispy skin.",
      "Dry-brine with kosher salt (½ tsp per lb) at least 4 hours ahead, ideally overnight uncovered in the fridge.",
      "For bone-in pieces: slide your fingers under the skin and rub butter or seasoning directly on the meat.",
      "Coat the outside with oil or mayo, then apply your rub liberally.",
      "Breast pieces pull at 165°F; thighs, drumsticks, and leg quarters pull at 175°F for best texture — the collagen needs that extra heat.",
    ],
    tip: "Thighs and drumsticks are very forgiving — they won't dry out past 165°F the way a breast will. 175°F is the sweet spot for dark meat.",
    directHeatTip: "Two-zone setup for bone-in pieces: start skin-side down over medium heat to render the fat without scorching, then move to indirect to cook through, and finish back over direct heat for 2–3 min to crisp the skin. Boneless thighs can go straight over medium-high direct heat — 5–6 min per side. Pull dark meat at 175°F, breasts at 165°F.",
    hotAndFastTip: "Chicken parts thrive at hot and fast temps: cook at 350–375°F — the higher heat renders the fat and crisps the skin faster than low-and-slow can. Thighs and drumsticks take 45–55 min; boneless breasts take 20–25 min. Pull dark meat at 175°F, breasts at 165°F.",
  },

  // ── Turkey Breast (roast) ─────────────────────────────────────────────
  // Bone-in or boneless breast roast (~6 lb). Cooks more like a pork loin
  // than a whole bird — no cavity, no tucked wings, carryover matters a lot.
  turkey_breast: {
    steps: [
      "Dry-brine with kosher salt (½ tsp per lb) all over — including under the skin — 24 hours ahead.",
      "Let sit uncovered in the fridge overnight; the salt draws moisture out, then back in for a juicier roast.",
      "Loosen the breast skin and rub a generous layer of softened butter (+ herbs: thyme, rosemary, garlic) directly on the meat.",
      "Coat the outside with a thin layer of oil or mayo, then season with your rub.",
      "Remove from the fridge 45 minutes before cooking so it comes up in temp evenly.",
    ],
    tip: "Pull at 160°F — carryover heat during the 20-minute rest will bring it to a safe 165°F. Resting is not optional: a turkey breast sliced too soon loses all its juice.",
    directHeatTip: "Turkey breast is too thick for direct heat alone — use a two-zone setup at 375–400°F. Place skin-side up on the indirect side with the lid down to roast through, then move over direct heat for the last 5–8 minutes to crisp the skin. Pull at 160°F; carryover during the 15-minute rest brings it to 165°F. Let it rest fully before slicing — it holds heat well and the juice needs time to redistribute.",
  },

  // ── Turkey Parts ──────────────────────────────────────────────────────
  turkey_parts: {
    steps: [
      "Brine parts 8–12 hours in salt water (1 cup salt per gallon) — dark-meat parts especially benefit.",
      "Pat completely dry after brining, inside any skin folds.",
      "For legs and thighs: score the skin in a few places to help fat render during cooking.",
      "Rub butter or seasoning under the skin on thighs; coat all pieces in oil or mayo, then season.",
      "Legs and thighs target 175°F; turkey wings target 175°F for fall-off-the-bone texture.",
    ],
    tip: "Turkey parts cook much faster than a whole bird — start checking internal temps after 90 minutes at 275°F. Dark meat improves past 165°F; pull at 175°F for the best texture.",
    directHeatTip: "Two-zone setup: sear turkey parts skin-side down over medium-high direct heat 4–5 min to render the skin, then move to indirect heat to cook through. Legs and thighs can handle longer indirect time — they're done at 175°F and won't dry out easily. Finish back over direct heat for 2–3 min to crisp the skin before serving.",
  },

  // ── General / unknown-category fallback ───────────────────────────────
  // Returned when the cut's category doesn't match any known switch case —
  // most commonly for fully custom cuts users have added themselves.
  general: {
    steps: [
      "Pat the meat completely dry on all sides — surface moisture is the enemy of a good crust.",
      "Season generously with coarse salt and black pepper at a minimum; add garlic powder, paprika, or your preferred rub.",
      "Let the seasoning rest on the meat for at least 30 minutes (or overnight uncovered in the fridge for a dry-brine effect).",
      "Bring the meat to room temperature 20–30 minutes before cooking for more even results.",
    ],
    tip: "Low-and-slow works for most cuts — cook at 225–250°F until you reach your target internal temp, then rest tented in foil for at least 10 minutes before slicing.",
    directHeatTip: "For direct-heat cooking, use a two-zone setup: sear over high heat for a crust, then finish on the cooler side if the cut needs more time. Rest 5–10 minutes before cutting so the juices redistribute.",
  },

  // ── Produce ───────────────────────────────────────────────────────────
  grilled_vegetables: {
    steps: [
      "Cut to even sizes so every piece finishes at the same time.",
      "Coat lightly with a high smoke-point oil (avocado or canola) — just enough to prevent sticking.",
      "Season simply with coarse salt and pepper; delicate herbs go on after cooking, not before.",
      "Keep pieces in a single layer — use a grill basket or skewers for anything smaller than the grate gaps.",
    ],
    tip: "Vegetables are done by look and feel, not internal temp — pull them when they're charred at the edges and just tender when pierced. Carryover softening continues off the grill.",
    directHeatTip: "High heat is your friend for most vegetables — you want char before they turn mushy. Get the grates screaming hot, oil the vegetables (not the grates), and resist moving them for the first few minutes so grill marks can set.",
  },
  grilled_fruit: {
    steps: [
      "Choose fruit that's ripe but still firm — overripe fruit collapses on the grill.",
      "Halve and pit (or slice thick); leave the skin on to hold everything together.",
      "Brush the cut face lightly with neutral oil to prevent sticking.",
      "Start cut-side down on clean, hot grates and don't move it until grill marks set.",
    ],
    tip: "Sugar burns fast — grill fruit over clean grates and watch closely. It's done when the cut face is caramelized and the flesh just starts to soften. A drizzle of honey or balsamic after the grill goes further than before it.",
    directHeatTip: "Use medium direct heat, not screaming hot — fruit sugars scorch quickly. Grill cut-side down 3–5 minutes until caramelized grill marks form, then flip skin-side down for another minute or two. Pull it while the flesh still has some body; it keeps softening off the grill.",
  },
};

export function getMeatPrep(cut: MeatCut | null): MeatPrepGuide | null {
  if (!cut) return null;
  const name = cut.name.toLowerCase();
  const category = cut.category.toLowerCase();
  const method = (cut.cookMethod ?? "").toLowerCase();

  // ── Sausages (any category) — matched before category branching ──
  if (
    name.includes("sausage") ||
    name.includes("bratwurst") ||
    name.includes("andouille") ||
    name.includes("hot link") ||
    name.includes("merguez")
  )
    return PREP_GUIDE_MAP.sausage;

  // ── Category-scoped routing — beef keywords can never capture seafood/pork/game cuts ──
  switch (category) {
    // ── Beef ──────────────────────────────────────────────────────────
    case "beef": {
      if (name.includes("brisket") || name.includes("pastrami")) return PREP_GUIDE_MAP.brisket;
      if (name.includes("burnt end")) return PREP_GUIDE_MAP.brisket;
      if (name.includes("jerky")) return PREP_GUIDE_MAP.jerky;
      if (name.includes("kabob") || name.includes("kebab")) return PREP_GUIDE_MAP.kabobs;
      if (name.includes("prime rib") || name.includes("standing rib")) return PREP_GUIDE_MAP.prime_rib;
      if (name.includes("filet mignon")) return PREP_GUIDE_MAP.tenderloin_beef;
      if (name.includes("cheek") || name.includes("shank")) return PREP_GUIDE_MAP.oxtail;
      if (name.includes("oxtail")) return PREP_GUIDE_MAP.oxtail;
      if (name.includes("london broil") || name.includes("carne asada")) return PREP_GUIDE_MAP.flank_skirt;
      if (name.includes("round")) return PREP_GUIDE_MAP.round_roast;
      if (name.includes("flank") || name.includes("skirt")) return PREP_GUIDE_MAP.flank_skirt;
      if (name.includes("tenderloin")) return PREP_GUIDE_MAP.tenderloin_beef;
      // Ribs before chuck, so "Beef Short Ribs (Chuck)" routes to beef_ribs, not chuck_roast
      if (name.includes("short rib") || name.includes("back rib")) return PREP_GUIDE_MAP.beef_ribs;
      if (name.includes("picanha") || name.includes("sirloin cap")) return PREP_GUIDE_MAP.picanha;
      // Chuck Eye Steak → steak; plain chuck roast → chuck_roast
      if (name.includes("chuck") && name.includes("steak")) return PREP_GUIDE_MAP.steak;
      if (name.includes("chuck")) return PREP_GUIDE_MAP.chuck_roast;
      if (name.includes("burger") || name.includes("patty") || name.includes("patties")) return PREP_GUIDE_MAP.burger;
      if (
        name.includes("steak") ||
        name.includes("tri-tip") ||
        name.includes("ribeye") ||
        // "strip" only after confirming beef category so Striped Bass is excluded
        name.includes("strip")
      )
        return PREP_GUIDE_MAP.steak;
      if (method.includes("direct") || method.includes("sear")) return PREP_GUIDE_MAP.steak;
      return PREP_GUIDE_MAP.chuck_roast;
    }

    // ── Pork ──────────────────────────────────────────────────────────
    case "pork": {
      // Belly check before burnt-ends would match (belly → pork_belly, not brisket)
      if (name.includes("belly") || name.includes("bacon") || name.includes("jowl")) return PREP_GUIDE_MAP.pork_belly;
      if (name.includes("shank")) return PREP_GUIDE_MAP.pork_shoulder;
      if (name.includes("wing")) return PREP_GUIDE_MAP.chicken_wings;
      if (name.includes("rib")) return PREP_GUIDE_MAP.ribs;
      if (name.includes("shoulder") || name.includes("butt") || name.includes("pulled")) return PREP_GUIDE_MAP.pork_shoulder;
      if (name.includes("tenderloin")) return PREP_GUIDE_MAP.pork_tenderloin;
      // Pork Steaks (shoulder steaks) → pork_steak, not beef steak guide
      if (name.includes("steak")) return PREP_GUIDE_MAP.pork_steak;
      if (name.includes("loin")) return PREP_GUIDE_MAP.pork_loin;
      if (name.includes("ham") && !name.includes("hog")) return PREP_GUIDE_MAP.ham;
      if (name.includes("chop")) return PREP_GUIDE_MAP.pork_chops;
      if (name.includes("whole hog") || name.includes("wild hog")) return PREP_GUIDE_MAP.pork_shoulder;
      if (method.includes("direct")) return PREP_GUIDE_MAP.pork_chops;
      return PREP_GUIDE_MAP.pork_shoulder;
    }

    // ── Poultry ───────────────────────────────────────────────────────
    case "poultry": {
      // Duck first — "duck" is unambiguous
      if (name.includes("duck")) return PREP_GUIDE_MAP.duck;
      // Turkey parts before whole turkey, so "Turkey Legs" / "Turkey Thighs" / "Turkey Wings"
      // are caught before the generic turkey fallback
      if (name.includes("turkey") && (
        name.includes("leg") ||
        name.includes("thigh") ||
        name.includes("wing")
      )) return PREP_GUIDE_MAP.turkey_parts;
      // Turkey breast is a roast, not a whole bird — give it its own guide
      if (name.includes("turkey") && name.includes("breast")) return PREP_GUIDE_MAP.turkey_breast;
      // Whole / spatchcock / beer can turkey
      if (name.includes("turkey")) return PREP_GUIDE_MAP.turkey;
      // Chicken wings (includes "Smoked Wings")
      if (name.includes("wing")) return PREP_GUIDE_MAP.chicken_wings;
      // Chicken parts — check part keywords before falling back to whole-bird guide
      if (
        name.includes("thigh") ||
        name.includes("drumstick") ||
        name.includes("leg quarter") ||
        name.includes("breast")
      ) return PREP_GUIDE_MAP.chicken_parts;
      // Whole Chicken, Spatchcock Chicken, Beer Can Chicken, Cornish Hen, Pheasant, Goose, Quail
      return PREP_GUIDE_MAP.chicken;
    }

    // ── Lamb & Goat ───────────────────────────────────────────────────
    case "lamb & goat": {
      if (name.includes("rack of lamb")) return PREP_GUIDE_MAP.rack_of_lamb;
      if (name.includes("goat")) return PREP_GUIDE_MAP.goat;
      return PREP_GUIDE_MAP.lamb;
    }

    // ── Seafood ───────────────────────────────────────────────────────
    case "seafood": {
      // Cold-smoked / lox before regular salmon
      if (name.includes("salmon") && (name.includes("cold") || name.includes("lox"))) return PREP_GUIDE_MAP.lox;
      if (name.includes("salmon")) return PREP_GUIDE_MAP.salmon;
      if (name.includes("shrimp")) return PREP_GUIDE_MAP.shrimp;
      if (name.includes("lobster")) return PREP_GUIDE_MAP.lobster;
      if (name.includes("whole")) return PREP_GUIDE_MAP.whole_fish;
      // Shellfish: scallops, oysters, crab legs, octopus, squid/calamari
      if (
        name.includes("scallop") ||
        name.includes("oyster") ||
        name.includes("crab") ||
        name.includes("octopus") ||
        name.includes("squid") ||
        name.includes("calamari")
      )
        return PREP_GUIDE_MAP.shellfish;
      // Everything else (fish steaks, fillets): fish_steak guide
      return PREP_GUIDE_MAP.fish_steak;
    }

    // ── Produce ───────────────────────────────────────────────────────
    case "vegetables":
      return PREP_GUIDE_MAP.grilled_vegetables;
    case "fruit":
      return PREP_GUIDE_MAP.grilled_fruit;

    // ── Game ──────────────────────────────────────────────────────────
    case "game": {
      if (name.includes("bison") && name.includes("brisket")) return PREP_GUIDE_MAP.brisket;
      if (name.includes("bison") && (name.includes("burger") || name.includes("patty"))) return PREP_GUIDE_MAP.burger;
      if (name.includes("bison") && (name.includes("steak") || name.includes("ribeye"))) return PREP_GUIDE_MAP.steak;
      if (name.includes("wild boar") && (name.includes("shoulder") || name.includes("butt"))) return PREP_GUIDE_MAP.pork_shoulder;
      if (name.includes("wild boar") && name.includes("rib")) return PREP_GUIDE_MAP.ribs;
      // Wild Hog Loin cooks like pork loin — brine + pull at 145°F
      if (name.includes("wild hog") && name.includes("loin")) return PREP_GUIDE_MAP.pork_loin;
      // Venison tenderloin → lean_game (not the generic venison brine guide)
      if (name.includes("venison") && name.includes("tenderloin")) return PREP_GUIDE_MAP.lean_game;
      if (name.includes("venison")) return PREP_GUIDE_MAP.venison;
      if (name.includes("elk") && name.includes("steak")) return PREP_GUIDE_MAP.venison;
      if (name.includes("rabbit")) return PREP_GUIDE_MAP.rabbit;
      if (name.includes("duck")) return PREP_GUIDE_MAP.duck;
      if (name.includes("turkey")) return PREP_GUIDE_MAP.turkey;
      return PREP_GUIDE_MAP.game_roast;
    }

    default:
      // Unknown / fully-custom category — return a generic guide that gives
      // reasonable advice for any protein. This prevents the prep section
      // from disappearing silently for cuts the user added themselves.
      return PREP_GUIDE_MAP.general;
  }
}
