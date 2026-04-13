import { AppLayout } from "@/components/layout/app-layout";
import { useCreateCook, useListGrills, useAiPredict, useGetGrillStats, getListCooksQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Flame, Clock, Utensils, CheckCircle2, Sparkles, Info, Package, BedDouble, UtensilsCrossed, Thermometer, Wind, TrendingUp, ChefHat, ChevronDown, ChevronUp, Scissors, Sprout, Syringe, TreePine, Timer } from "lucide-react";

// ── Meat categories + cuts ───────────────────────────────────────────────────
const MEAT_CATEGORIES = [
  {
    label: "🐄 Beef",
    cuts: [
      "Brisket",
      "Brisket Flat",
      "Brisket Point",
      "Chuck Roast",
      "Beef Short Ribs",
      "Beef Back Ribs",
      "Ribeye Steak",
      "NY Strip",
      "Tri-Tip",
      "Prime Rib",
    ],
  },
  {
    label: "🐷 Pork",
    cuts: [
      "Pork Butt (Shoulder)",
      "St. Louis Ribs",
      "Baby Back Ribs",
      "Spare Ribs",
      "Pork Tenderloin",
      "Pork Belly",
      "Whole Hog",
      "Ham",
    ],
  },
  {
    label: "🍗 Poultry",
    cuts: [
      "Whole Chicken",
      "Chicken Thighs",
      "Chicken Wings",
      "Chicken Quarters",
      "Turkey Breast",
      "Whole Turkey",
    ],
  },
  {
    label: "🐑 Lamb",
    cuts: [
      "Lamb Shoulder",
      "Lamb Leg",
      "Rack of Lamb",
      "Lamb Chops",
    ],
  },
  {
    label: "🐟 Seafood",
    cuts: [
      "Salmon Fillet",
      "Whole Salmon",
      "Swordfish Steak",
      "Shrimp",
    ],
  },
  {
    label: "🦌 Other",
    cuts: [
      "Venison",
      "Sausage Links",
      "Hot Dogs",
    ],
  },
] as const;

// ── Temp guide data ──────────────────────────────────────────────────────────
type CookStyle = "Low & Slow" | "Hot & Fast" | "Reverse Sear" | "Medium Heat" | "High Heat";

interface MeatTemp {
  pitTempF: number;
  targetTempF: number;
  style: CookStyle;
  note: string;
}

const MEAT_TEMPS: Record<string, MeatTemp> = {
  "Brisket":             { pitTempF: 225, targetTempF: 203, style: "Low & Slow",    note: "Cook to 203°F then rest 1–2 hrs wrapped in butcher paper or foil." },
  "Brisket Flat":        { pitTempF: 225, targetTempF: 200, style: "Low & Slow",    note: "Flat dries out faster — wrap early around 160°F internal." },
  "Brisket Point":       { pitTempF: 250, targetTempF: 210, style: "Low & Slow",    note: "Point has more fat — can run hotter and benefits from a longer cook." },
  "Chuck Roast":         { pitTempF: 250, targetTempF: 205, style: "Low & Slow",    note: "Cook to 205°F for pulled beef; rest 45 min before shredding." },
  "Beef Short Ribs":     { pitTempF: 275, targetTempF: 205, style: "Low & Slow",    note: "Cook until probe-tender (~205°F). Bark should be mahogany brown." },
  "Beef Back Ribs":      { pitTempF: 250, targetTempF: 195, style: "Low & Slow",    note: "Much of the meat is between the bones — cook until tender." },
  "Ribeye Steak":        { pitTempF: 225, targetTempF: 130, style: "Reverse Sear",  note: "Smoke to 125°F then sear over high heat. Rest 5 min before cutting." },
  "NY Strip":            { pitTempF: 225, targetTempF: 130, style: "Reverse Sear",  note: "Smoke to 125°F, sear 60 sec/side on ripping-hot grate." },
  "Tri-Tip":             { pitTempF: 225, targetTempF: 135, style: "Reverse Sear",  note: "Smoke to 115°F then sear. Slice against the grain for tenderness." },
  "Prime Rib":           { pitTempF: 225, targetTempF: 130, style: "Low & Slow",    note: "Smoke at 225°F, rest 30 min. Pull 5°F below desired final temp." },
  "Pork Butt (Shoulder)":{ pitTempF: 225, targetTempF: 203, style: "Low & Slow",    note: "Pull at 203°F or when bone wiggles freely. Rest 45–60 min." },
  "St. Louis Ribs":      { pitTempF: 225, targetTempF: 190, style: "Low & Slow",    note: "3-2-1 method (3 smoke / 2 foil / 1 sauced). Bend test for doneness." },
  "Baby Back Ribs":      { pitTempF: 225, targetTempF: 185, style: "Low & Slow",    note: "2-2-1 method works well. Done when meat pulls back 1/4\" from bone." },
  "Spare Ribs":          { pitTempF: 225, targetTempF: 190, style: "Low & Slow",    note: "Use 3-2-1. More fat than baby backs — forgiving if slightly overcooked." },
  "Pork Tenderloin":     { pitTempF: 350, targetTempF: 145, style: "Medium Heat",   note: "Cooks fast — watch carefully. Rest 5 min. Don't overcook!" },
  "Pork Belly":          { pitTempF: 250, targetTempF: 200, style: "Low & Slow",    note: "Score fat cap, cook fat-side up. Crisp skin under broiler if desired." },
  "Whole Hog":           { pitTempF: 225, targetTempF: 195, style: "Low & Slow",    note: "12–14 hrs average. Monitor shoulder and ham separately. Rest 1 hr." },
  "Ham":                 { pitTempF: 250, targetTempF: 145, style: "Low & Slow",    note: "Pre-cooked ham just needs to reach 145°F internal and absorb smoke." },
  "Whole Chicken":       { pitTempF: 350, targetTempF: 165, style: "Medium Heat",   note: "Spatchcock for faster, more even cooking. Pull breast at 160°F (carryover)." },
  "Chicken Thighs":      { pitTempF: 275, targetTempF: 185, style: "Hot & Fast",    note: "Higher target temp melts collagen for tender, juicy results." },
  "Chicken Wings":       { pitTempF: 375, targetTempF: 185, style: "High Heat",     note: "High heat crisps skin. Flip once. Sauce in last 10 min." },
  "Chicken Quarters":    { pitTempF: 300, targetTempF: 175, style: "Medium Heat",   note: "Score skin to help render fat and get better smoke penetration." },
  "Turkey Breast":       { pitTempF: 325, targetTempF: 165, style: "Medium Heat",   note: "Brine overnight for moisture. Cover with foil if browning too fast." },
  "Whole Turkey":        { pitTempF: 325, targetTempF: 165, style: "Medium Heat",   note: "Spatchcock for faster cook. Monitor thigh and breast separately." },
  "Lamb Shoulder":       { pitTempF: 250, targetTempF: 195, style: "Low & Slow",    note: "Similar to pork shoulder — cook low until pull-tender. Rosemary rub." },
  "Lamb Leg":            { pitTempF: 325, targetTempF: 145, style: "Medium Heat",   note: "Pull at 130°F for medium-rare. Rests to 145°F. Slice thin." },
  "Rack of Lamb":        { pitTempF: 225, targetTempF: 130, style: "Reverse Sear",  note: "Smoke to 120°F then sear. French the bones and tie the rack." },
  "Lamb Chops":          { pitTempF: 400, targetTempF: 145, style: "High Heat",     note: "Grill hot and fast, 3–4 min per side. Rest 5 min." },
  "Salmon Fillet":       { pitTempF: 225, targetTempF: 145, style: "Low & Slow",    note: "Smoke skin-side down on cedar plank. Done when it flakes easily." },
  "Whole Salmon":        { pitTempF: 225, targetTempF: 145, style: "Low & Slow",    note: "Stuff cavity with herbs & lemon. Smoke 2–3 hrs depending on size." },
  "Swordfish Steak":     { pitTempF: 400, targetTempF: 145, style: "High Heat",     note: "Grill 4–5 min per side. Oil grates well to prevent sticking." },
  "Shrimp":              { pitTempF: 400, targetTempF: 145, style: "High Heat",     note: "Cooks in 2–3 min. Remove from heat as soon as they curl and turn pink." },
  "Venison":             { pitTempF: 225, targetTempF: 145, style: "Low & Slow",    note: "Very lean — don't overcook. Wrap early to preserve moisture." },
  "Sausage Links":       { pitTempF: 250, targetTempF: 160, style: "Medium Heat",   note: "Avoid poking — keep juices in. Pull at 160°F for safe, juicy sausage." },
  "Hot Dogs":            { pitTempF: 350, targetTempF: 160, style: "Medium Heat",   note: "Just need to heat through and get some char — 10–15 min." },
};

// ── Meat prep guide data ─────────────────────────────────────────────────────
interface MeatPrep {
  trim: string;
  rub: string;
  injection?: string;
  wood: string;
  prepTimeMinutes: number;
  tips: string[];
}

const MEAT_PREP: Record<string, MeatPrep> = {
  "Brisket": {
    trim: "Trim fat cap to ¼\" — remove hard fat nodes entirely. Leave a thin fat layer on the flat to protect it. Trim gray meat from the underside to expose clean muscle.",
    rub: "Classic Texas rub: equal parts coarse black pepper and kosher salt (50/50). Apply heavily 30–60 min before cooking — or dry-brine uncovered in the fridge overnight for a better bark.",
    injection: "Optional but recommended: beef broth + Worcestershire + melted butter injected throughout the flat. Helps fight the stall and keeps it moist.",
    wood: "Oak is the Texas standard. Post oak is ideal. Hickory adds more punch. Cherry adds subtle sweetness. Avoid mesquite — too aggressive for a 12+ hr cook.",
    prepTimeMinutes: 30,
    tips: [
      "Cold brisket goes on the smoker — straight from the fridge helps build bark before the stall.",
      "Fat cap up or down depends on your smoker's heat source. Direct heat below → fat cap up. Direct heat from above → fat cap down.",
      "Don't trim until the day of the cook — fresh-cut meat takes smoke better.",
    ],
  },
  "Brisket Flat": {
    trim: "Remove hard fat and silver skin from the underside. Trim fat cap to ¼\" — the flat has less marbling than the point so keep more fat for moisture.",
    rub: "Salt and pepper with a light coat of yellow mustard as a binder. The flat dries out faster so a slightly more generous fat layer helps.",
    injection: "Highly recommended: beef broth + butter mixture injected in a grid pattern across the flat.",
    wood: "Oak or hickory. Light smoke only — the flat absorbs smoke more readily than the point.",
    prepTimeMinutes: 20,
    tips: [
      "Wrap in foil at 160–165°F internal to push through the stall and preserve moisture.",
      "The flat is done when a probe slides in with zero resistance, like warm butter.",
    ],
  },
  "Brisket Point": {
    trim: "Trim excess fat from the outer seam. The point is heavily marbled so you can leave more fat than on the flat.",
    rub: "Aggressive rub works well here — the fat cap handles it. Add paprika, garlic, and onion powder on top of the SPG base.",
    wood: "Oak or hickory. The point can handle heavier smoke than the flat.",
    prepTimeMinutes: 15,
    tips: [
      "Run the point hotter (250–275°F) to render the fat properly.",
      "Point makes excellent burnt ends — cube it at 200°F internal, sauce, and return to the smoker for 1–2 more hours.",
    ],
  },
  "Chuck Roast": {
    trim: "Minimal trimming needed. Remove any large hard fat deposits. Leave the fat cap mostly intact.",
    rub: "SPG (salt, pepper, garlic) or a beefy rub with smoked paprika. Apply 30–60 min before smoking.",
    injection: "Optional: beef broth + butter injection adds insurance against drying out.",
    wood: "Oak, hickory, or a mix. Cherry adds a nice color to the bark.",
    prepTimeMinutes: 15,
    tips: [
      "Often called 'poor man's brisket' — extremely forgiving at 250°F.",
      "Wrap in butcher paper at 165°F to push through the stall faster.",
      "Pull at 205°F and rest 45 min before shredding for tacos or sandwiches.",
    ],
  },
  "Beef Short Ribs": {
    trim: "Remove the silver skin membrane from the bone side — it prevents smoke penetration and stays chewy. Trim excess fat on top if thicker than ½\".",
    rub: "Heavy coat of coarse salt and black pepper. Add a thin layer of yellow mustard as a binder if the rub isn't sticking.",
    wood: "Oak or post oak. Heavy smoke works well — the thick fat cap filters the flavor.",
    prepTimeMinutes: 20,
    tips: [
      "Plate ribs (dino ribs) are typically sold as 3-bone slabs — keep them intact during the cook.",
      "No need to wrap — the high fat content keeps them moist. Bark forms beautifully.",
      "Done when internal probe reads 205°F AND slides in with zero resistance.",
    ],
  },
  "Beef Back Ribs": {
    trim: "Remove the membrane from the bone side. These are leaner than short ribs — most of the meat is between the bones.",
    rub: "SPG works well. Add garlic powder and a touch of cayenne. Apply 30 min before cooking.",
    wood: "Oak or hickory. Cherry for color.",
    prepTimeMinutes: 15,
    tips: [
      "Back ribs are what's left after prime rib is cut from the standing rib roast — the meat between bones is the key.",
      "Spritz with beef broth or apple cider vinegar every hour to keep them moist.",
    ],
  },
  "Ribeye Steak": {
    trim: "No major trimming. Pat completely dry with paper towels — crucial for a good sear. Remove if there's any hard fat around the edges.",
    rub: "Simple: kosher salt and cracked black pepper generously applied. Season at least 45 min before cooking (or overnight in the fridge uncovered).",
    wood: "Hickory or oak for the smoke phase. Brief exposure is fine.",
    prepTimeMinutes: 5,
    tips: [
      "Bring to room temp for 30 min before cooking for even doneness.",
      "Sear on ripping-hot cast iron or grill grates — not the smoker.",
      "Finish with a pat of compound butter (garlic + herbs) immediately after the sear.",
    ],
  },
  "NY Strip": {
    trim: "Pat dry. Trim any large fat deposits on the side — a thin strip is fine to leave. Score the fat cap lightly so it doesn't curl during searing.",
    rub: "Salt and pepper — keep it simple. The beef flavor is the star.",
    wood: "Oak or hickory for a very brief smoke.",
    prepTimeMinutes: 5,
    tips: [
      "Score the fat cap so the steak lays flat during the sear.",
      "Sear 60 sec per side for crust — use cast iron or a ripping-hot grill zone.",
    ],
  },
  "Tri-Tip": {
    trim: "Trim the thick fat cap to ¼\". Remove the silver skin from the lean side — it doesn't render and will be chewy.",
    rub: "Santa Maria style: garlic powder, onion powder, salt, pepper, and a pinch of cayenne. Coat well and let sit 1 hr.",
    wood: "Red oak is traditional for Santa Maria-style. Hickory or oak also work.",
    prepTimeMinutes: 15,
    tips: [
      "Slice against the grain — the grain runs in two directions so find where they meet and slice outward from the center.",
      "Reverse sear is ideal: smoke to 115°F then sear on high heat.",
    ],
  },
  "Prime Rib": {
    trim: "Trim fat cap to ½\". Leave the bones on for better flavor and presentation (or have the butcher tie them back on after removing).",
    rub: "Garlic herb crust: minced garlic, rosemary, thyme, salt, cracked pepper, and olive oil. Apply the night before for best results.",
    wood: "Oak, hickory, or pecan. Light to moderate smoke — you want to complement the beefy flavor, not overwhelm it.",
    prepTimeMinutes: 20,
    tips: [
      "Dry-brine uncovered in the fridge 24–48 hrs for better crust and moisture retention.",
      "Bone side down during the smoke — the bones act as a roasting rack.",
      "Pull 5°F below your desired final temp — carryover during rest will close the gap.",
    ],
  },
  "Pork Butt (Shoulder)": {
    trim: "Trim excess fat from the fat cap to ¼\". Remove any loose, stringy meat and hard fat nodes that won't render.",
    rub: "Generous all-over coating: brown sugar, paprika, garlic powder, onion powder, salt, pepper, and dry mustard. Apply the night before for best bark.",
    injection: "Strongly recommended: apple juice + butter + brown sugar + salt injected in a grid pattern throughout.",
    wood: "Hickory and apple is a classic combo. Cherry adds color. Pecan is mild and sweet.",
    prepTimeMinutes: 20,
    tips: [
      "Cook fat-side up so the rendering fat bastes the meat throughout the cook.",
      "The 'stall' typically hits at 155–170°F internal — this can last several hours. Wrap in foil or butcher paper to push through.",
      "Rest at least 45 min wrapped in a cooler (cooler) — it will stay hot for 4+ hours.",
    ],
  },
  "St. Louis Ribs": {
    trim: "Remove the membrane (silver skin) from the bone side — grip with a paper towel and peel in one motion. Trim any rib tips and excess flap meat so the rack lays flat.",
    rub: "Classic BBQ rub: brown sugar, paprika, salt, pepper, garlic powder, onion powder, cayenne. Apply 30–60 min before cooking.",
    wood: "Apple and hickory combo. Cherry for color. Pecan for a mild, sweet smoke.",
    prepTimeMinutes: 20,
    tips: [
      "3-2-1 method: 3 hrs unwrapped, 2 hrs foiled with a splash of apple juice + brown sugar + butter, 1 hr unwrapped with sauce.",
      "Bend test: done when the rack bends 45° and the meat cracks slightly when lifted from one end.",
      "Don't sauce until the last 30 min to avoid burning.",
    ],
  },
  "Baby Back Ribs": {
    trim: "Remove the membrane from the bone side. These racks are naturally lean — avoid overtrimming the small amount of back fat.",
    rub: "Lighter, sweeter rub than St. Louis — reduce the brown sugar slightly. Apply 20–30 min before cooking.",
    wood: "Apple or cherry. Mild wood suits the leaner meat — heavy smoke can overpower baby backs.",
    prepTimeMinutes: 15,
    tips: [
      "2-2-1 method: 2 hrs smoke, 2 hrs foiled, 1 hr sauced. Shorter than St. Louis due to the thinner profile.",
      "Done when the meat has pulled back ¼\" from the bone end.",
    ],
  },
  "Spare Ribs": {
    trim: "Remove the membrane. Trim the skirt and any hanging flap meat so the rack is uniform. Cut off the sternum cartilage for a cleaner slab.",
    rub: "Classic BBQ rub — similar to St. Louis but spare ribs have more fat so they're very forgiving. Don't be shy with the seasoning.",
    wood: "Hickory, apple, or cherry. Spare ribs handle heavier smoke well due to higher fat content.",
    prepTimeMinutes: 20,
    tips: [
      "More forgiving than baby backs — the extra fat provides a buffer against overcooking.",
      "3-2-1 method works perfectly here. Add brown sugar, butter, and honey to the foil package.",
    ],
  },
  "Pork Tenderloin": {
    trim: "Remove all silver skin — it doesn't render and stays chewy. It runs along the length of the loin. Use a sharp boning knife and slide it under the silver skin at an angle.",
    rub: "Light coat: garlic, herbs (rosemary, thyme), salt, pepper, and olive oil. Marinate 2–4 hrs for best results.",
    wood: "Apple or cherry — mild, sweet wood to avoid overpowering the delicate meat.",
    prepTimeMinutes: 15,
    tips: [
      "The most common mistake is overcooking — it cooks fast and has zero fat buffer.",
      "Rest 5 min minimum before slicing.",
      "Stuff with cheese, peppers, and herbs before cooking for an impressive presentation.",
    ],
  },
  "Pork Belly": {
    trim: "Score the fat cap in a crosshatch pattern — ¼\" deep cuts help the fat render and seasoning penetrate. Leave the skin on for crackling or remove if going for bark.",
    rub: "Salt the fat cap heavily and let it sit uncovered in the fridge 4–8 hrs. Then apply a rub with paprika, garlic, pepper, and brown sugar.",
    wood: "Apple, cherry, or pecan. Avoid very heavy smoke — the fat carries flavor aggressively.",
    prepTimeMinutes: 20,
    tips: [
      "Cook fat side up so the fat bastes the meat below.",
      "For burnt ends: cube at 200°F internal, toss in sauce + brown sugar + butter, return to smoker for 1–2 hrs.",
      "For crispy skin: finish skin-side down on a very hot grill or under a broiler after smoking.",
    ],
  },
  "Whole Hog": {
    trim: "Remove excess fat from the cavity. Score the skin in a crosshatch pattern. Remove the eyes if cooking whole for presentation.",
    rub: "Apply a full-body dry rub — salt, pepper, paprika, garlic, onion powder — inside the cavity and on the skin. Apply the night before.",
    injection: "Inject the hams and shoulders with a mixture of apple juice, butter, and salt — the largest muscle groups need the most help.",
    wood: "Hickory with oak. You'll need a lot of wood or charcoal for a 12–18 hr cook.",
    prepTimeMinutes: 60,
    tips: [
      "Monitor the shoulder and ham separately — they'll take longer than the ribs and belly.",
      "Keep the cooker between 225–250°F and be patient — this is a 12–18 hr commitment.",
      "Rest 1 hr fully wrapped before pulling and serving.",
    ],
  },
  "Ham": {
    trim: "Score the fat cap in a diamond pattern — this allows the glaze to penetrate and creates a beautiful presentation. Trim excess fat if thicker than ½\".",
    rub: "Glaze rather than dry rub: brown sugar + Dijon mustard + honey + a splash of apple cider vinegar. Apply halfway through the cook and every 30 min after.",
    wood: "Apple, cherry, or pecan — sweet woods complement ham perfectly.",
    prepTimeMinutes: 15,
    tips: [
      "Pre-cooked (cured) ham just needs to reach 145°F internal to be safe and absorb smoke.",
      "Insert cloves at each diamond intersection for a classic presentation.",
      "Let the surface dry for 30 min before applying the glaze so it sticks better.",
    ],
  },
  "Whole Chicken": {
    trim: "Pat completely dry inside and out — moisture is the enemy of crispy skin. Remove giblets from the cavity. Tuck the wing tips behind the back.",
    rub: "Butter rub under the skin for the breast meat — loosen the skin and push compound butter (garlic + herbs) directly onto the meat. Apply dry rub on the outside.",
    wood: "Apple, cherry, or pecan. Light, sweet smoke suits poultry.",
    prepTimeMinutes: 20,
    tips: [
      "Spatchcock (remove the backbone) for faster, more even cooking and crispier skin.",
      "Dry-brine in the fridge uncovered for 4–24 hrs for dramatically better skin texture.",
      "Pull breast at 160°F — it will carry over to 165°F during the 5 min rest.",
    ],
  },
  "Chicken Thighs": {
    trim: "Trim excess fat and skin from the edges — enough hangs over to prevent good rendering. Score the skin a few times to help fat render out.",
    rub: "Generous rub all over and under the skin. Brown sugar helps crisp the skin at higher temps.",
    wood: "Apple or cherry. Light smoke.",
    prepTimeMinutes: 10,
    tips: [
      "Target 185°F+ internal for truly tender, fall-off-the-bone thighs — not just 165°F safe temp.",
      "Skin-side up for most of the cook. Flip to skin-side down for the last 10 min to crisp the skin.",
      "Bone-in thighs have more flavor and are more forgiving than boneless.",
    ],
  },
  "Chicken Wings": {
    trim: "Pat completely dry. Remove the wing tips if desired. No trimming needed.",
    rub: "Light coat of oil, then apply a dry rub. Baking powder in the rub (1 tsp per lb) helps the skin crisp up at high heat.",
    wood: "Apple or cherry. Very brief smoke — wings cook fast.",
    prepTimeMinutes: 10,
    tips: [
      "Dry them in the fridge uncovered for 4–12 hrs for maximum skin crispiness.",
      "Cook at 375–400°F for crispy skin. Low-and-slow gives you rubbery skin.",
      "Sauce in the last 10 min or toss after cooking to avoid burning the sauce.",
    ],
  },
  "Chicken Quarters": {
    trim: "Pat dry. Score the skin on the thigh portion a few times for better fat rendering. Trim any excess skin hanging from the edges.",
    rub: "Rub under and over the skin. Let sit 30–60 min.",
    wood: "Apple, cherry, or pecan.",
    prepTimeMinutes: 15,
    tips: [
      "Score the skin so the rub and smoke penetrate deeper.",
      "Cook at 300°F for a good balance of smoke and crispy skin.",
      "Target 175°F in the thigh for the best texture.",
    ],
  },
  "Turkey Breast": {
    trim: "Pat dry. Trim excess fat and skin from around the edges. Leave the skin on — it protects the breast meat during the cook.",
    rub: "Butter rub under and over the skin. Herb butter (sage, thyme, rosemary, garlic) works exceptionally well on turkey.",
    injection: "Apple juice + butter + salt injected throughout the breast. Turkey breast is very lean and benefits greatly from injection.",
    wood: "Apple, cherry, or pecan. Light smoke — poultry absorbs smoke quickly.",
    prepTimeMinutes: 20,
    tips: [
      "Brine overnight (wet or dry) for dramatically better moisture retention.",
      "Cover with foil if the skin is getting too dark before internal temp is reached.",
      "Bone-in breasts have more flavor and are more forgiving than boneless.",
    ],
  },
  "Whole Turkey": {
    trim: "Remove giblets and neck from cavity. Pat completely dry inside and out. Tuck wings behind back. Tie legs together if not already trussed.",
    rub: "Compound butter under the breast skin. Dry rub on the outside. Season the cavity with salt, pepper, and fresh herbs.",
    injection: "Highly recommended: inject the breast and thighs with butter + chicken broth + herbs.",
    wood: "Apple, cherry, or pecan. Moderate smoke.",
    prepTimeMinutes: 30,
    tips: [
      "Spatchcock for significantly faster, more even cooking.",
      "Wet or dry brine for 12–24 hrs is the single biggest upgrade you can make.",
      "Monitor thigh and breast separately — breast is done at 165°F, thigh is better at 175°F.",
    ],
  },
  "Lamb Shoulder": {
    trim: "Trim excess fat to ¼\". Remove any hard fat nodes. The shoulder has good marbling — don't overtrim.",
    rub: "Mediterranean-style rub: garlic, rosemary, thyme, lemon zest, salt, and cracked pepper. Apply the night before.",
    wood: "Oak or fruit woods like apple and cherry. Lamb pairs well with subtle smoke.",
    prepTimeMinutes: 20,
    tips: [
      "Make deep slits in the meat and push garlic cloves and rosemary sprigs inside before applying the rub.",
      "Cook low and slow like pork shoulder — it becomes pull-tender at 195°F+.",
      "Rest 30–45 min before shredding.",
    ],
  },
  "Lamb Leg": {
    trim: "Trim the thick fat cap to ¼\". Score in a crosshatch pattern so the rub and smoke penetrate.",
    rub: "Herb rub: garlic, rosemary, thyme, Dijon mustard, salt, and pepper. Coat generously.",
    wood: "Oak or apple. Light smoke — you want the lamb flavor to shine.",
    prepTimeMinutes: 20,
    tips: [
      "Stud the leg with garlic cloves pushed into slits throughout the meat.",
      "Pull at 130°F for medium-rare — lamb is best served pink.",
      "Slice thin against the grain for the most tender result.",
    ],
  },
  "Rack of Lamb": {
    trim: "French the bones (scrape the bone clean for presentation). Remove excess fat from the eye of the rack but leave the fat cap for flavor.",
    rub: "Herb crust: Dijon mustard as a binder, then breadcrumbs + garlic + rosemary + thyme pressed on. Apply just before cooking.",
    wood: "Apple or cherry. Very light smoke — rack of lamb is delicate.",
    prepTimeMinutes: 20,
    tips: [
      "Tie the rack if it isn't already — keeps it compact for even cooking.",
      "Smoke to 120°F then sear on screaming-hot grates, 60–90 sec per side.",
      "Wrap the bone tips in foil to prevent charring during the sear.",
    ],
  },
  "Lamb Chops": {
    trim: "Trim excess fat to ¼\". Pat dry for a better sear.",
    rub: "Olive oil, garlic, rosemary, salt, and pepper. Marinate 30 min at room temp.",
    wood: "Not needed for this quick-cook method.",
    prepTimeMinutes: 10,
    tips: [
      "Bring to room temp before cooking for even doneness.",
      "Sear on a screaming-hot grill, 3–4 min per side for medium-rare.",
      "Don't crowd the grill — give each chop space for a proper sear.",
    ],
  },
  "Salmon Fillet": {
    trim: "Remove any pin bones (use pliers or needle-nose tweezers). Score the skin lightly so it doesn't curl.",
    rub: "Brown sugar + salt dry brine applied 30–60 min before cooking creates a pellicle (tacky surface) that smoke adheres to.",
    wood: "Alder is the classic choice. Apple or cherry also work beautifully.",
    prepTimeMinutes: 10,
    tips: [
      "The pellicle (sticky surface after dry brine) is key for smoke adherence — don't skip this step.",
      "Cook on a cedar plank for extra moisture and a woody flavor.",
      "Done when the flesh flakes easily with a fork and is opaque throughout.",
    ],
  },
  "Whole Salmon": {
    trim: "Scale if not already done. Score the skin on both sides for smoke and heat penetration. Remove the head if desired.",
    rub: "Herb mixture inside the cavity (lemon, dill, garlic, salt, pepper) and a light brown sugar brine on the outside.",
    wood: "Alder is traditional. Apple or cherry work well.",
    prepTimeMinutes: 20,
    tips: [
      "Stuff the cavity with lemon slices, fresh dill, and garlic for incredible aroma.",
      "Cook on a wire rack so smoke can circulate underneath.",
      "2–3 hrs at 225°F depending on size.",
    ],
  },
  "Swordfish Steak": {
    trim: "Pat dry. Remove the bloodline (dark red strip) if present — it has a stronger flavor.",
    rub: "Simple: olive oil, garlic, lemon zest, salt, pepper, and fresh herbs. Marinate 20–30 min.",
    wood: "Not needed — swordfish is cooked quickly at high heat.",
    prepTimeMinutes: 10,
    tips: [
      "Oil the grates heavily to prevent sticking.",
      "Don't move the steak until it releases naturally — 3–4 min per side.",
      "Swordfish dries out quickly — pull at 145°F immediately.",
    ],
  },
  "Shrimp": {
    trim: "Peel and devein if not already done. Leave tails on for presentation and a handle for eating.",
    rub: "Olive oil + garlic + paprika + salt + lemon juice. Toss and let sit 10–15 min.",
    wood: "Not needed — shrimp cooks in minutes.",
    prepTimeMinutes: 10,
    tips: [
      "Use skewers to keep shrimp from falling through the grates.",
      "They're done the moment they curl into a C-shape and turn pink — overcooking makes them rubbery.",
      "High heat only — shrimp on low-and-slow gets rubbery.",
    ],
  },
  "Venison": {
    trim: "Remove all silver skin — venison has a lot of it and it doesn't render. Remove any visible fat — venison fat has an unpleasant waxy flavor.",
    rub: "Juniper berries, rosemary, thyme, garlic, salt, pepper — classic game rub. Marinate in red wine 4–8 hrs to mellow the gamey notes.",
    wood: "Apple or cherry — mild, sweet wood complements venison.",
    prepTimeMinutes: 15,
    tips: [
      "Don't overcook — venison is very lean and dries out quickly. Medium-rare (145°F) is ideal.",
      "A marinade with an acid (wine, vinegar) helps tenderize the lean meat.",
      "Wrap early to retain moisture — venison has no fat buffer.",
    ],
  },
  "Sausage Links": {
    trim: "No trimming needed. Prick the casing once or twice to prevent blowouts during cooking — optional for natural casings.",
    rub: "No rub needed — the seasoning is already inside.",
    wood: "Hickory, apple, or cherry. Sausage takes smoke quickly.",
    prepTimeMinutes: 5,
    tips: [
      "Never poke or cut sausages during cooking — you'll lose all the juices.",
      "If using natural casing, don't prick — the casing will expand and contract naturally.",
      "Cook to 160°F internal. Link sausage benefits from a low-and-slow smoke before a quick sear to finish.",
    ],
  },
  "Hot Dogs": {
    trim: "No prep needed. Score lightly with a knife in a spiral or crosshatch pattern for better charring.",
    rub: "Not needed.",
    wood: "Any light wood for a touch of smoke — hickory or apple.",
    prepTimeMinutes: 5,
    tips: [
      "Score the skin so the hot dog expands evenly and you get grill marks in the grooves.",
      "High heat for 10–15 min, turning every few minutes.",
      "They're done when they have char marks and the skin starts to blister.",
    ],
  },
};

const STYLE_COLORS: Record<CookStyle, string> = {
  "Low & Slow":   "bg-amber-500/10 text-amber-400 border-amber-500/25",
  "Hot & Fast":   "bg-red-500/10 text-red-400 border-red-500/25",
  "Reverse Sear": "bg-purple-500/10 text-purple-400 border-purple-500/25",
  "Medium Heat":  "bg-orange-500/10 text-orange-400 border-orange-500/25",
  "High Heat":    "bg-rose-500/10 text-rose-400 border-rose-500/25",
};

// ── Constants ────────────────────────────────────────────────────────────────
const COOK_STATUSES = ["planned", "active", "completed", "cancelled"] as const;

const PREHEAT_DEFAULTS: Record<string, number> = {
  offset_smoker: 60,
  charcoal: 30,
  kamado: 45,
  pellet: 20,
  gas: 15,
  electric: 20,
  other: 30,
};

const grillTypeKey = (t: string | null | undefined) =>
  (t ?? "").toLowerCase().replace(/[\s-]+/g, "_");

const cookSchema = z.object({
  foodType: z.string().min(1, "Please select a cut of meat"),
  grillId: z.string().optional(),
  weightLbs: z.string().optional(),
  targetTempF: z.string().optional(),
  cookTempF: z.string().optional(),
  status: z.enum(COOK_STATUSES).default("planned"),
  preheatMinutes: z.string().optional(),
  desiredFinishAt: z.string().optional(),
  notes: z.string().optional(),
});

type CookFormValues = z.infer<typeof cookSchema>;

type WrapRec = {
  wrapAtMinutes: number;
  method: string;
  wrapTempF: number | null;
  reason: string;
  restMinutes: number;
};

type Prediction = {
  estimatedDurationMinutes: number;
  preheatMinutes: number;
  grillLightAt: string;
  suggestedStartAt: string;
  estimatedFinishAt: string;
  serveAt: string;
  wrap: WrapRec;
  confidence: string;
  rationale: string;
  tips: string[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + formatTime(date);
}
function fmtDuration(minutes: number) {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

const WRAP_METHOD_LABELS: Record<string, string> = {
  foil: "Aluminum Foil (Texas Crutch)",
  butcher_paper: "Butcher Paper",
  none: "No Wrap",
};

const WRAP_METHOD_COLORS: Record<string, string> = {
  foil: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  butcher_paper: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  none: "bg-muted/40 text-muted-foreground border-border",
};

interface TimelineStep {
  icon: React.ReactNode;
  label: string;
  time: Date;
  color: string;
  badge?: string;
  note?: string;
  connectorLabel?: string;
}

function CookTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="rounded-lg border bg-muted/10 overflow-hidden" data-testid="cook-timeline">
      <div className="px-4 py-2.5 border-b bg-muted/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cook Timeline</p>
      </div>
      <div className="p-4">
        {steps.map((step, i) => (
          <div key={i}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${step.color}`}>
                {step.icon}
              </div>
              <div className="flex-1 pt-0.5 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold leading-tight">{step.label}</p>
                  {step.badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${WRAP_METHOD_COLORS[step.badge] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {WRAP_METHOD_LABELS[step.badge] ?? step.badge}
                    </span>
                  )}
                </div>
                <p className="text-base font-bold mt-0.5">{formatTime(step.time)}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(step.time)}</p>
                {step.note && (
                  <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed border-l-2 border-border pl-2">{step.note}</p>
                )}
              </div>
            </div>
            {i < steps.length - 1 && step.connectorLabel && (
              <div className="flex items-start gap-3 my-0.5">
                <div className="w-9 flex justify-center shrink-0">
                  <div className="w-0.5 h-6 bg-border" />
                </div>
                <div className="flex items-center h-6">
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/60">
                    {step.connectorLabel}
                  </span>
                </div>
              </div>
            )}
            {i < steps.length - 1 && !step.connectorLabel && (
              <div className="flex gap-3 my-0.5">
                <div className="w-9 flex justify-center shrink-0">
                  <div className="w-0.5 h-4 bg-border" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function NewCook() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: grills } = useListGrills();
  const createCook = useCreateCook();
  const aiPredict = useAiPredict();

  const [prediction, setPrediction] = useState<Prediction | null>(null);

  const form = useForm<CookFormValues>({
    resolver: zodResolver(cookSchema),
    defaultValues: {
      foodType: "",
      status: "planned",
      preheatMinutes: "30",
      notes: "",
    },
  });

  const watchedGrillId = useWatch({ control: form.control, name: "grillId" });
  const watchedPreheat = useWatch({ control: form.control, name: "preheatMinutes" });
  const watchedFinish = useWatch({ control: form.control, name: "desiredFinishAt" });
  const watchedFoodType = useWatch({ control: form.control, name: "foodType" });

  // Auto-set preheat when grill changes
  useEffect(() => {
    if (!watchedGrillId) return;
    const grill = grills?.find((g) => g.id.toString() === watchedGrillId);
    if (grill?.type) {
      const def = PREHEAT_DEFAULTS[grillTypeKey(grill.type)] ?? 30;
      form.setValue("preheatMinutes", def.toString());
    }
  }, [watchedGrillId, grills, form]);

  // Auto-fill temps when meat is selected
  const handleMeatSelect = (value: string) => {
    form.setValue("foodType", value);
    const temps = MEAT_TEMPS[value];
    if (temps) {
      form.setValue("cookTempF", temps.pitTempF.toString());
      form.setValue("targetTempF", temps.targetTempF.toString());
    }
    setPrediction(null);
  };

  const [isPrepExpanded, setIsPrepExpanded] = useState(false);

  const preheatMins = parseInt(watchedPreheat || "30") || 30;
  const selectedGrill = grills?.find((g) => g.id.toString() === watchedGrillId);
  const selectedMeatGuide = watchedFoodType ? MEAT_TEMPS[watchedFoodType] ?? null : null;
  const selectedMeatPrep = watchedFoodType ? MEAT_PREP[watchedFoodType] ?? null : null;

  const selectedGrillIdNum = watchedGrillId ? parseInt(watchedGrillId) : undefined;
  const { data: grillStats } = useGetGrillStats(selectedGrillIdNum!, {
    query: { enabled: !!selectedGrillIdNum },
  });

  // Build timeline steps
  const buildTimelineSteps = (): TimelineStep[] | null => {
    if (!prediction && !watchedFinish) return null;

    let lightAt: Date, foodOnAt: Date, offGrillAt: Date, serveAt: Date;
    let wrapAt: Date | null = null;
    const wrap = prediction?.wrap;
    const cookMins = prediction?.estimatedDurationMinutes ?? 0;
    const restMins = wrap?.restMinutes ?? 0;

    if (prediction) {
      lightAt = new Date(prediction.grillLightAt);
      foodOnAt = new Date(prediction.suggestedStartAt);
      offGrillAt = new Date(prediction.estimatedFinishAt);
      serveAt = new Date(prediction.serveAt);
      if (wrap && wrap.method !== "none" && wrap.wrapAtMinutes > 0) {
        wrapAt = new Date(foodOnAt.getTime() + wrap.wrapAtMinutes * 60000);
      }
    } else if (watchedFinish) {
      const finishTime = new Date(watchedFinish);
      if (isNaN(finishTime.getTime())) return null;
      serveAt = finishTime;
      offGrillAt = serveAt;
      foodOnAt = new Date(offGrillAt.getTime() - (cookMins > 0 ? cookMins * 60000 : 0));
      lightAt = new Date(foodOnAt.getTime() - preheatMins * 60000);
    } else {
      return null;
    }

    const steps: TimelineStep[] = [];

    steps.push({
      icon: <Flame className="w-4 h-4" />,
      label: "Light the Grill",
      time: lightAt,
      color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      connectorLabel: `${fmtDuration(preheatMins)} preheat`,
    });
    steps.push({
      icon: <Utensils className="w-4 h-4" />,
      label: "Food On the Grill",
      time: foodOnAt,
      color: "bg-primary/15 text-primary border-primary/30",
      connectorLabel: wrapAt
        ? `${fmtDuration(wrap!.wrapAtMinutes)} unwrapped`
        : cookMins > 0 ? `${fmtDuration(cookMins)} cook time` : undefined,
    });

    if (wrapAt && wrap) {
      steps.push({
        icon: <Package className="w-4 h-4" />,
        label: "Wrap the Meat",
        time: wrapAt,
        color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        badge: wrap.method,
        note: wrap.reason,
        connectorLabel: `${fmtDuration(cookMins - wrap.wrapAtMinutes)} wrapped`,
      });
    }

    steps.push({
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "Off the Grill",
      time: offGrillAt,
      color: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
      connectorLabel: restMins > 0 ? `${fmtDuration(restMins)} rest` : undefined,
    });

    if (restMins > 0) {
      steps.push({
        icon: <BedDouble className="w-4 h-4" />,
        label: "Rest",
        time: offGrillAt,
        color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
        note: `Let the meat rest uncovered (or loosely tented) for ${fmtDuration(restMins)}. Don't skip this — it redistributes juices throughout the meat.`,
        connectorLabel: "",
      });
    }

    steps.push({
      icon: <UtensilsCrossed className="w-4 h-4" />,
      label: "Ready to Serve",
      time: serveAt,
      color: "bg-green-500/15 text-green-400 border-green-500/30",
    });

    return steps;
  };

  const timelineSteps = buildTimelineSteps();

  const handleGetPrediction = () => {
    const values = form.getValues();
    if (!values.foodType) {
      toast({ title: "Select a meat cut first", variant: "destructive" });
      return;
    }
    aiPredict.mutate(
      {
        data: {
          foodType: values.foodType,
          grillId: values.grillId ? parseInt(values.grillId) : undefined,
          weightLbs: values.weightLbs ? parseFloat(values.weightLbs) : undefined,
          cookTempF: values.cookTempF ? parseInt(values.cookTempF) : undefined,
          targetTempF: values.targetTempF ? parseInt(values.targetTempF) : undefined,
          desiredFinishAt: values.desiredFinishAt ? new Date(values.desiredFinishAt).toISOString() : undefined,
          preheatMinutes: parseInt(values.preheatMinutes || "30") || 30,
        },
      },
      {
        onSuccess: (data) => {
          setPrediction(data as Prediction);
          const cookH = fmtDuration(data.estimatedDurationMinutes);
          const wrapData = (data as Prediction).wrap;
          const wrapMsg = wrapData?.method !== "none" ? ` · Wrap at ${fmtDuration(wrapData.wrapAtMinutes)}` : "";
          const restMsg = wrapData?.restMinutes ? ` · ${fmtDuration(wrapData.restMinutes)} rest` : "";
          toast({ title: `AI estimate: ${cookH} cook${wrapMsg}${restMsg}` });
        },
        onError: () => toast({ title: "Prediction failed", variant: "destructive" }),
      }
    );
  };

  const onSubmit = (data: CookFormValues) => {
    const pred = prediction;
    const plannedStartAt = pred ? new Date(pred.suggestedStartAt).toISOString() : undefined;
    const plannedEndAt = pred ? new Date(pred.serveAt).toISOString()
      : data.desiredFinishAt ? new Date(data.desiredFinishAt).toISOString() : undefined;

    createCook.mutate(
      {
        data: {
          foodType: data.foodType,
          grillId: data.grillId ? parseInt(data.grillId) : undefined,
          weightLbs: data.weightLbs ? parseFloat(data.weightLbs) : undefined,
          targetTempF: data.targetTempF ? parseInt(data.targetTempF) : undefined,
          cookTempF: data.cookTempF ? parseInt(data.cookTempF) : undefined,
          status: data.status,
          preheatMinutes: parseInt(data.preheatMinutes || "30") || 30,
          plannedStartAt: plannedStartAt ?? null,
          plannedEndAt: plannedEndAt ?? null,
          wrapAtMinutes: pred?.wrap?.method !== "none" ? pred?.wrap?.wrapAtMinutes ?? null : null,
          wrapMethod: pred?.wrap?.method ?? null,
          wrapTempF: pred?.wrap?.wrapTempF ?? null,
          wrapReason: pred?.wrap?.reason ?? null,
          restMinutes: pred?.wrap?.restMinutes ?? null,
          notes: data.notes,
        },
      },
      {
        onSuccess: (newCook) => {
          queryClient.invalidateQueries({ queryKey: getListCooksQueryKey() });
          toast({ title: "Cook saved!" });
          setLocation(`/cooks/${newCook.id}`);
        },
        onError: () => toast({ title: "Failed to save cook", variant: "destructive" }),
      }
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plan a Cook</h1>
          <p className="text-muted-foreground">Full timeline including preheat, wrap, rest, and serve.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ── Session Details ─────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Session Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Meat dropdown */}
                <FormField
                  control={form.control}
                  name="foodType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What are you cooking?</FormLabel>
                      <Select onValueChange={handleMeatSelect} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-meat">
                            <SelectValue placeholder="Select a cut of meat…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-80">
                          {MEAT_CATEGORIES.map((cat) => (
                            <SelectGroup key={cat.label}>
                              <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                                {cat.label}
                              </SelectLabel>
                              {cat.cuts.map((cut) => (
                                <SelectItem key={cut} value={cut}>{cut}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Real-time temp guide card */}
                {selectedMeatGuide && watchedFoodType && (
                  <div
                    className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4"
                    data-testid="temp-guide-card"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-amber-400" />
                        <p className="text-sm font-semibold text-amber-400">Temp Guide — {watchedFoodType}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STYLE_COLORS[selectedMeatGuide.style]}`}>
                        {selectedMeatGuide.style}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-background/50 rounded-md px-3 py-2 border border-border/60">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Pit Temp</p>
                        <p className="text-xl font-bold text-orange-400">{selectedMeatGuide.pitTempF}°F</p>
                      </div>
                      <div className="bg-background/50 rounded-md px-3 py-2 border border-border/60">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">Pull Temp</p>
                        <p className="text-xl font-bold text-primary">{selectedMeatGuide.targetTempF}°F</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-amber-500/40 pl-2">
                      {selectedMeatGuide.note}
                    </p>
                  </div>
                )}

                {/* ── Expandable prep guide ──────────────────────── */}
                {selectedMeatPrep && watchedFoodType && (
                  <div className="rounded-lg border border-border overflow-hidden" data-testid="prep-guide-section">
                    <button
                      type="button"
                      onClick={() => setIsPrepExpanded((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                      data-testid="btn-toggle-prep"
                    >
                      <div className="flex items-center gap-2">
                        <ChefHat className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">How to Prep — {watchedFoodType}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          · {selectedMeatPrep.prepTimeMinutes} min prep
                        </span>
                      </div>
                      {isPrepExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                    </button>

                    {isPrepExpanded && (
                      <div className="p-4 space-y-4 border-t border-border">

                        {/* Prep time badge */}
                        <div className="flex items-center gap-2">
                          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Estimated prep time: <strong className="text-foreground">{selectedMeatPrep.prepTimeMinutes} min</strong></span>
                        </div>

                        {/* Trim */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Scissors className="w-3.5 h-3.5 text-orange-400" />
                            <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">Trimming</p>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed pl-5">{selectedMeatPrep.trim}</p>
                        </div>

                        {/* Rub / seasoning */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Sprout className="w-3.5 h-3.5 text-green-400" />
                            <p className="text-xs font-semibold uppercase tracking-wide text-green-400">Rub & Seasoning</p>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed pl-5">{selectedMeatPrep.rub}</p>
                        </div>

                        {/* Injection (optional) */}
                        {selectedMeatPrep.injection && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Syringe className="w-3.5 h-3.5 text-blue-400" />
                              <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">Injection</p>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed pl-5">{selectedMeatPrep.injection}</p>
                          </div>
                        )}

                        {/* Wood pairing */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <TreePine className="w-3.5 h-3.5 text-emerald-400" />
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Wood Pairing</p>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed pl-5">{selectedMeatPrep.wood}</p>
                        </div>

                        {/* Pro tips */}
                        {selectedMeatPrep.tips.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Info className="w-3.5 h-3.5 text-primary" />
                              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pro Tips</p>
                            </div>
                            <ul className="space-y-1.5 pl-5">
                              {selectedMeatPrep.tips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary mt-1 shrink-0 text-xs">›</span>
                                  <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="grillId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grill</FormLabel>
                        <Select
                          onValueChange={(val) => {
                            if (val === "__add_grill__") {
                              setLocation("/grills");
                            } else {
                              field.onChange(val);
                            }
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-grill">
                              <SelectValue placeholder="Select a grill" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {grills && grills.length > 0 ? (
                              grills.map((g) => (
                                <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__add_grill__" data-testid="select-add-grill">
                                <div className="flex items-center gap-2 text-primary">
                                  <Utensils className="w-4 h-4" />
                                  <span>Add a grill first</span>
                                </div>
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="planned">Planned (Future)</SelectItem>
                            <SelectItem value="active">Active (On the grill)</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Grill Insights card — shown when a grill is selected and has history */}
                {grillStats && grillStats.totalCooks > 0 && (
                  <div
                    className="rounded-lg border border-primary/20 bg-primary/5 p-4"
                    data-testid="grill-insights-card"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <ChefHat className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold text-primary">
                        {selectedGrill?.name} Insights
                      </p>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {grillStats.totalCooks} cook{grillStats.totalCooks !== 1 ? "s" : ""} on record
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {grillStats.avgPitTempF != null && (
                        <div className="bg-background/50 rounded-md px-2.5 py-2 border border-border/60">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Wind className="w-3 h-3 text-orange-400" />
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Avg Pit</p>
                          </div>
                          <p className="text-lg font-bold text-orange-400">{Math.round(grillStats.avgPitTempF)}°F</p>
                        </div>
                      )}
                      {grillStats.pitTempVarianceF != null && (
                        <div className="bg-background/50 rounded-md px-2.5 py-2 border border-border/60">
                          <div className="flex items-center gap-1 mb-0.5">
                            <TrendingUp className="w-3 h-3 text-yellow-400" />
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Temp Swing</p>
                          </div>
                          <p className="text-lg font-bold text-yellow-400">±{Math.round(grillStats.pitTempVarianceF / 2)}°F</p>
                        </div>
                      )}
                      {grillStats.avgCookDurationMinutes > 0 && (
                        <div className="bg-background/50 rounded-md px-2.5 py-2 border border-border/60">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Clock className="w-3 h-3 text-primary" />
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Avg Duration</p>
                          </div>
                          <p className="text-lg font-bold text-primary">
                            {grillStats.avgCookDurationMinutes >= 60
                              ? `${(grillStats.avgCookDurationMinutes / 60).toFixed(1)}h`
                              : `${Math.round(grillStats.avgCookDurationMinutes)}m`}
                          </p>
                        </div>
                      )}
                      {grillStats.mostCookedFood && (
                        <div className="bg-background/50 rounded-md px-2.5 py-2 border border-border/60">
                          <div className="flex items-center gap-1 mb-0.5">
                            <Flame className="w-3 h-3 text-primary" />
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Top Food</p>
                          </div>
                          <p className="text-sm font-bold truncate">{grillStats.mostCookedFood}</p>
                        </div>
                      )}
                    </div>
                    {grillStats.totalReadings > 0 && (
                      <p className="text-xs text-muted-foreground mt-2.5 border-t border-border/60 pt-2.5">
                        Based on {grillStats.totalReadings} logged temperature readings — AI estimates will factor in this grill's real-world performance.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <FormField
                    control={form.control}
                    name="weightLbs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" placeholder="e.g. 12.5" {...field} data-testid="input-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cookTempF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pit Temp (°F)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 250" {...field} data-testid="input-pit-temp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetTempF"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Meat Temp (°F)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g. 203" {...field} data-testid="input-target-temp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Cook Timing ─────────────────────────────────────── */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Cook Timing & Wrap Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="preheatMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grill Preheat Time (minutes)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="180" placeholder="30" {...field} data-testid="input-preheat" />
                        </FormControl>
                        {selectedGrill && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Auto-set for {selectedGrill.type?.toLowerCase().replace(/_/g, " ")} ({PREHEAT_DEFAULTS[grillTypeKey(selectedGrill.type)] ?? 30} min default)
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="desiredFinishAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desired Serve Time (optional)</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-finish-time" className="block" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">When you want to sit down and eat</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGetPrediction}
                    disabled={aiPredict.isPending}
                    className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                    data-testid="btn-ai-predict"
                  >
                    <Sparkles className="w-4 h-4" />
                    {aiPredict.isPending ? "Predicting…" : "Get AI Estimate"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Predicts cook time, wrap timing, and rest — all in one
                  </span>
                </div>

                {/* AI result summary */}
                {prediction && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-primary">
                          ~{fmtDuration(prediction.estimatedDurationMinutes)} active cook
                          {prediction.wrap.method !== "none" && ` · wrap at ${fmtDuration(prediction.wrap.wrapAtMinutes)}`}
                          {prediction.wrap.restMinutes > 0 && ` · ${fmtDuration(prediction.wrap.restMinutes)} rest`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{prediction.rationale}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
                        prediction.confidence === "high" ? "bg-green-500/15 text-green-400 border-green-500/30"
                          : prediction.confidence === "medium" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {prediction.confidence} confidence
                      </span>
                    </div>

                    {/* Wrap card */}
                    {prediction.wrap.method !== "none" ? (
                      <div className={`rounded-md border p-3 text-sm ${WRAP_METHOD_COLORS[prediction.wrap.method] ?? "bg-muted/30 border-border"}`}>
                        <div className="flex items-center gap-2 font-semibold mb-1">
                          <Package className="w-4 h-4" />
                          {WRAP_METHOD_LABELS[prediction.wrap.method]} at {fmtDuration(prediction.wrap.wrapAtMinutes)}
                          {prediction.wrap.wrapTempF && <span className="font-normal opacity-80">({prediction.wrap.wrapTempF}°F internal)</span>}
                        </div>
                        <p className="text-xs opacity-90 leading-relaxed">{prediction.wrap.reason}</p>
                      </div>
                    ) : (
                      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground flex items-center gap-2">
                        <Package className="w-4 h-4 shrink-0" />
                        <span>No wrap needed for this cook.</span>
                      </div>
                    )}

                    {prediction.tips.length > 0 && (
                      <ul className="space-y-1">
                        {prediction.tips.map((tip, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-primary mt-0.5 shrink-0">•</span>{tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Timeline */}
                {timelineSteps && <CookTimeline steps={timelineSteps} />}
              </CardContent>
            </Card>

            {/* ── Notes ───────────────────────────────────────────── */}
            <Card>
              <CardContent className="pt-5">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes / Prep Details</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Rub used, wood type, trim notes..."
                          className="min-h-[90px]"
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex gap-4 pb-6">
              <Button type="button" variant="outline" onClick={() => setLocation("/cooks")} className="w-full">
                Cancel
              </Button>
              <Button type="submit" disabled={createCook.isPending} className="w-full" data-testid="btn-submit-cook">
                {createCook.isPending ? "Saving…" : "Save Cook"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
