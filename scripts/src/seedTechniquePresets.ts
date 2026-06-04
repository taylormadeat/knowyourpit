import { db, techniquePresetsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

type PresetRow = {
  cutName: string;
  label: string;
  cookMethod?: string;
  wrapFinish?: string;
  spritzFrequency?: string;
  injection?: string;
  cookTempF?: number;
  targetTempF?: number;
  sortOrder: number;
};

const PRESETS: PresetRow[] = [
  // ── Baby Back Ribs ───────────────────────────────────────────────────────
  { cutName: "Baby Back Ribs", label: "3-2-1 Method", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 0 },
  { cutName: "Baby Back Ribs", label: "2-2-1 Method", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every 30 min", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 1 },
  { cutName: "Baby Back Ribs", label: "No Wrap", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 2 },
  { cutName: "Baby Back Ribs", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 200, sortOrder: 3 },
  { cutName: "Baby Back Ribs", label: "Competition Style", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every 30 min", injection: "Injected", cookTempF: 250, targetTempF: 200, sortOrder: 4 },

  // ── Spare Ribs (St. Louis) ───────────────────────────────────────────────
  { cutName: "Spare Ribs (St. Louis)", label: "3-2-1 Method", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 0 },
  { cutName: "Spare Ribs (St. Louis)", label: "No Wrap", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 1 },
  { cutName: "Spare Ribs (St. Louis)", label: "Competition Style", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every 30 min", injection: "Injected", cookTempF: 250, targetTempF: 200, sortOrder: 2 },
  { cutName: "Spare Ribs (St. Louis)", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 200, sortOrder: 3 },

  // ── Spare Ribs (Full) ───────────────────────────────────────────────────
  { cutName: "Spare Ribs (Full)", label: "3-2-1 Method", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 0 },
  { cutName: "Spare Ribs (Full)", label: "No Wrap", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 1 },

  // ── Beef Short Ribs (Plate) ──────────────────────────────────────────────
  { cutName: "Beef Short Ribs (Plate)", label: "Texas Style (No Wrap)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 0 },
  { cutName: "Beef Short Ribs (Plate)", label: "Braised Finish", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "Once at Stall", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 1 },
  { cutName: "Beef Short Ribs (Plate)", label: "Competition Wrap", cookMethod: "Low & Slow", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "Every Hour", injection: "Injected", cookTempF: 275, targetTempF: 205, sortOrder: 2 },

  // ── Beef Short Ribs (Chuck) ──────────────────────────────────────────────
  { cutName: "Beef Short Ribs (Chuck)", label: "Texas Style (No Wrap)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 203, sortOrder: 0 },
  { cutName: "Beef Short Ribs (Chuck)", label: "Braised Finish", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 203, sortOrder: 1 },

  // ── Beef Back Ribs ───────────────────────────────────────────────────────
  { cutName: "Beef Back Ribs", label: "Texas Style (No Wrap)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 0 },
  { cutName: "Beef Back Ribs", label: "Foil Wrap", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 1 },

  // ── Brisket (Whole Packer) ───────────────────────────────────────────────
  { cutName: "Brisket (Whole Packer)", label: "Texas Style (No Wrap)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 203, sortOrder: 0 },
  { cutName: "Brisket (Whole Packer)", label: "Butcher Paper Wrap", cookMethod: "Low & Slow", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 203, sortOrder: 1 },
  { cutName: "Brisket (Whole Packer)", label: "Texas Crutch (Foil Wrap)", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 203, sortOrder: 2 },
  { cutName: "Brisket (Whole Packer)", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 203, sortOrder: 3 },
  { cutName: "Brisket (Whole Packer)", label: "Overnight Low & Slow", cookMethod: "Low & Slow", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 200, targetTempF: 203, sortOrder: 4 },
  { cutName: "Brisket (Whole Packer)", label: "Competition Style", cookMethod: "Low & Slow", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "Once at Stall", injection: "Injected", cookTempF: 250, targetTempF: 203, sortOrder: 5 },

  // ── Brisket (Flat) ───────────────────────────────────────────────────────
  { cutName: "Brisket (Flat)", label: "Butcher Paper Wrap", cookMethod: "Low & Slow", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 0 },
  { cutName: "Brisket (Flat)", label: "Texas Crutch (Foil Wrap)", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 1 },
  { cutName: "Brisket (Flat)", label: "Texas Style (No Wrap)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 2 },

  // ── Brisket (Point) ──────────────────────────────────────────────────────
  { cutName: "Brisket (Point)", label: "Texas Style", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 205, sortOrder: 0 },
  { cutName: "Brisket (Point)", label: "Burnt Ends", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 1 },

  // ── Burnt Ends ────────────────────────────────────────────────────────────
  { cutName: "Burnt Ends", label: "Classic Burnt Ends", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 0 },

  // ── Pastrami ─────────────────────────────────────────────────────────────
  { cutName: "Pastrami", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 203, sortOrder: 0 },
  { cutName: "Pastrami", label: "Hot & Fast Finish", cookMethod: "Hot & Fast", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 300, targetTempF: 203, sortOrder: 1 },

  // ── Chuck Roast ──────────────────────────────────────────────────────────
  { cutName: "Chuck Roast", label: "Texas Style (No Wrap)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 205, sortOrder: 0 },
  { cutName: "Chuck Roast", label: "Texas Crutch", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 205, sortOrder: 1 },
  { cutName: "Chuck Roast", label: "Braised Finish", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 2 },

  // ── Beef Cheeks ───────────────────────────────────────────────────────────
  { cutName: "Beef Cheeks", label: "Braised Finish", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 0 },

  // ── Tri-Tip ──────────────────────────────────────────────────────────────
  { cutName: "Tri-Tip", label: "Santa Maria Style", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 135, sortOrder: 0 },
  { cutName: "Tri-Tip", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 130, sortOrder: 1 },
  { cutName: "Tri-Tip", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 130, sortOrder: 2 },

  // ── Prime Rib (Bone-In) ───────────────────────────────────────────────────
  { cutName: "Prime Rib (Bone-In)", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 130, sortOrder: 0 },
  { cutName: "Prime Rib (Bone-In)", label: "Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 130, sortOrder: 1 },
  { cutName: "Prime Rib (Bone-In)", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 130, sortOrder: 2 },

  // ── Standing Rib Roast ────────────────────────────────────────────────────
  { cutName: "Standing Rib Roast", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 130, sortOrder: 0 },
  { cutName: "Standing Rib Roast", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 130, sortOrder: 1 },

  // ── Ribeye Steak ─────────────────────────────────────────────────────────
  { cutName: "Ribeye Steak", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 130, sortOrder: 0 },
  { cutName: "Ribeye Steak", label: "Hot & Fast (Direct Sear)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 450, targetTempF: 130, sortOrder: 1 },

  // ── Tomahawk Steak ────────────────────────────────────────────────────────
  { cutName: "Tomahawk Steak", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 130, sortOrder: 0 },
  { cutName: "Tomahawk Steak", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 450, targetTempF: 130, sortOrder: 1 },

  // ── Strip Steak (NY Strip) ────────────────────────────────────────────────
  { cutName: "Strip Steak (NY Strip)", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 130, sortOrder: 0 },
  { cutName: "Strip Steak (NY Strip)", label: "Hot & Fast (Direct Sear)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 450, targetTempF: 130, sortOrder: 1 },

  // ── Picanha (Top Sirloin Cap) ─────────────────────────────────────────────
  { cutName: "Picanha (Top Sirloin Cap)", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 135, sortOrder: 0 },
  { cutName: "Picanha (Top Sirloin Cap)", label: "Brazilian Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 450, targetTempF: 135, sortOrder: 1 },
  { cutName: "Picanha (Top Sirloin Cap)", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 135, sortOrder: 2 },

  // ── Flank Steak ───────────────────────────────────────────────────────────
  { cutName: "Flank Steak", label: "Hot & Fast (Direct Sear)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 135, sortOrder: 0 },
  { cutName: "Flank Steak", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 135, sortOrder: 1 },

  // ── Skirt Steak ───────────────────────────────────────────────────────────
  { cutName: "Skirt Steak", label: "Hot & Fast (Direct Sear)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 450, targetTempF: 130, sortOrder: 0 },

  // ── Sirloin Steak ─────────────────────────────────────────────────────────
  { cutName: "Sirloin Steak", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 135, sortOrder: 0 },
  { cutName: "Sirloin Steak", label: "Hot & Fast", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 135, sortOrder: 1 },

  // ── Chuck Eye Steak ───────────────────────────────────────────────────────
  { cutName: "Chuck Eye Steak", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 130, sortOrder: 0 },
  { cutName: "Chuck Eye Steak", label: "Hot & Fast", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 450, targetTempF: 130, sortOrder: 1 },

  // ── Burger Patties ────────────────────────────────────────────────────────
  { cutName: "Burger Patties", label: "Hot & Fast (Direct)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 160, sortOrder: 0 },
  { cutName: "Burger Patties", label: "Smash Style (High Heat)", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 450, targetTempF: 160, sortOrder: 1 },

  // ── Pork Shoulder / Boston Butt ──────────────────────────────────────────
  { cutName: "Pork Shoulder / Boston Butt", label: "Low & Slow (No Wrap)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 203, sortOrder: 0 },
  { cutName: "Pork Shoulder / Boston Butt", label: "Texas Crutch (Foil Wrap)", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 203, sortOrder: 1 },
  { cutName: "Pork Shoulder / Boston Butt", label: "Butcher Paper Wrap", cookMethod: "Low & Slow", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 203, sortOrder: 2 },
  { cutName: "Pork Shoulder / Boston Butt", label: "Overnight Low & Slow", cookMethod: "Low & Slow", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 200, targetTempF: 203, sortOrder: 3 },
  { cutName: "Pork Shoulder / Boston Butt", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 203, sortOrder: 4 },
  { cutName: "Pork Shoulder / Boston Butt", label: "Competition Style", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every 30 min", injection: "Injected", cookTempF: 250, targetTempF: 203, sortOrder: 5 },

  // ── Picnic Shoulder ───────────────────────────────────────────────────────
  { cutName: "Picnic Shoulder", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 203, sortOrder: 0 },
  { cutName: "Picnic Shoulder", label: "No Wrap", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 203, sortOrder: 1 },

  // ── Pulled Pork (Competition) ─────────────────────────────────────────────
  { cutName: "Pulled Pork (Competition)", label: "Competition (Injected, Foil)", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every 30 min", injection: "Injected", cookTempF: 250, targetTempF: 205, sortOrder: 0 },
  { cutName: "Pulled Pork (Competition)", label: "No Wrap", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 205, sortOrder: 1 },
  { cutName: "Pulled Pork (Competition)", label: "Butcher Paper", cookMethod: "Low & Slow", wrapFinish: "Butcher Paper at Stall", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 205, sortOrder: 2 },

  // ── Pork Belly ────────────────────────────────────────────────────────────
  { cutName: "Pork Belly", label: "Low & Slow (Sliced)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 200, sortOrder: 0 },
  { cutName: "Pork Belly", label: "Burnt Ends Style", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 1 },
  { cutName: "Pork Belly", label: "Hot & Fast (Crispy Skin)", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 200, sortOrder: 2 },

  // ── Pork Belly Burnt Ends ─────────────────────────────────────────────────
  { cutName: "Pork Belly Burnt Ends", label: "Classic Burnt Ends", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 0 },

  // ── Pork Tenderloin ───────────────────────────────────────────────────────
  { cutName: "Pork Tenderloin", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 145, sortOrder: 0 },
  { cutName: "Pork Tenderloin", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 145, sortOrder: 1 },
  { cutName: "Pork Tenderloin", label: "Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 145, sortOrder: 2 },

  // ── Pork Chops (Thick) ────────────────────────────────────────────────────
  { cutName: "Pork Chops (Thick)", label: "Hot & Fast (Direct)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 145, sortOrder: 0 },
  { cutName: "Pork Chops (Thick)", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 145, sortOrder: 1 },

  // ── Pork Chops (Thin) ─────────────────────────────────────────────────────
  { cutName: "Pork Chops (Thin)", label: "Hot & Fast (Direct)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 450, targetTempF: 145, sortOrder: 0 },

  // ── Country Style Ribs ────────────────────────────────────────────────────
  { cutName: "Country Style Ribs", label: "Low & Slow Sauced", cookMethod: "Low & Slow", wrapFinish: "Sauced and Returned to Smoker", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 0 },
  { cutName: "Country Style Ribs", label: "Texas Crutch", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 1 },

  // ── Pork Loin (Boneless) ──────────────────────────────────────────────────
  { cutName: "Pork Loin (Boneless)", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 275, targetTempF: 145, sortOrder: 0 },
  { cutName: "Pork Loin (Boneless)", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 145, sortOrder: 1 },
  { cutName: "Pork Loin (Boneless)", label: "Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 145, sortOrder: 2 },

  // ── Pork Loin (Bone-In) ───────────────────────────────────────────────────
  { cutName: "Pork Loin (Bone-In)", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 250, targetTempF: 145, sortOrder: 0 },
  { cutName: "Pork Loin (Bone-In)", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 145, sortOrder: 1 },

  // ── Pork Steaks ───────────────────────────────────────────────────────────
  { cutName: "Pork Steaks", label: "Low & Slow Sauced", cookMethod: "Low & Slow", wrapFinish: "Sauced and Returned to Smoker", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 275, targetTempF: 195, sortOrder: 0 },
  { cutName: "Pork Steaks", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 195, sortOrder: 1 },

  // ── Ham (Cured/Twice-Smoked) ──────────────────────────────────────────────
  { cutName: "Ham (Cured/Twice-Smoked)", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 275, targetTempF: 140, sortOrder: 0 },
  { cutName: "Ham (Cured/Twice-Smoked)", label: "Foil Boat Finish", cookMethod: "Low & Slow", wrapFinish: "Foil Boat", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 275, targetTempF: 140, sortOrder: 1 },

  // ── Bratwurst ─────────────────────────────────────────────────────────────
  { cutName: "Bratwurst", label: "Indirect then Sear", cookMethod: "Indirect Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 300, targetTempF: 160, sortOrder: 0 },
  { cutName: "Bratwurst", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 160, sortOrder: 1 },

  // ── Italian Sausage ───────────────────────────────────────────────────────
  { cutName: "Italian Sausage", label: "Indirect then Sear", cookMethod: "Indirect Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 300, targetTempF: 160, sortOrder: 0 },
  { cutName: "Italian Sausage", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 160, sortOrder: 1 },

  // ── Smoked Sausage Links ──────────────────────────────────────────────────
  { cutName: "Smoked Sausage Links", label: "Low & Slow Indirect", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 160, sortOrder: 0 },
  { cutName: "Smoked Sausage Links", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 300, targetTempF: 160, sortOrder: 1 },

  // ── Whole Chicken ─────────────────────────────────────────────────────────
  { cutName: "Whole Chicken", label: "Spatchcock (Hot & Fast)", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 375, targetTempF: 165, sortOrder: 0 },
  { cutName: "Whole Chicken", label: "Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 165, sortOrder: 1 },
  { cutName: "Whole Chicken", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 225, targetTempF: 165, sortOrder: 2 },

  // ── Spatchcock Chicken ────────────────────────────────────────────────────
  { cutName: "Spatchcock Chicken", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 375, targetTempF: 165, sortOrder: 0 },
  { cutName: "Spatchcock Chicken", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 165, sortOrder: 1 },

  // ── Chicken Thighs (Bone-In) ──────────────────────────────────────────────
  { cutName: "Chicken Thighs (Bone-In)", label: "Hot & Fast (Crispy Skin)", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 175, sortOrder: 0 },
  { cutName: "Chicken Thighs (Bone-In)", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 275, targetTempF: 175, sortOrder: 1 },
  { cutName: "Chicken Thighs (Bone-In)", label: "Competition (Sauced)", cookMethod: "Hot & Fast", wrapFinish: "Sauced and Returned to Smoker", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 175, sortOrder: 2 },

  // ── Chicken Thighs (Boneless) ─────────────────────────────────────────────
  { cutName: "Chicken Thighs (Boneless)", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 375, targetTempF: 170, sortOrder: 0 },
  { cutName: "Chicken Thighs (Boneless)", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 170, sortOrder: 1 },

  // ── Chicken Wings ─────────────────────────────────────────────────────────
  { cutName: "Chicken Wings", label: "Hot & Fast (Crispy)", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 175, sortOrder: 0 },
  { cutName: "Chicken Wings", label: "Low & Slow then High Heat", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 175, sortOrder: 1 },

  // ── Smoked Wings (Low & Slow) ─────────────────────────────────────────────
  { cutName: "Smoked Wings (Low & Slow)", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 175, sortOrder: 0 },

  // ── Chicken Breast (Boneless) ─────────────────────────────────────────────
  { cutName: "Chicken Breast (Boneless)", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 165, sortOrder: 0 },
  { cutName: "Chicken Breast (Boneless)", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 165, sortOrder: 1 },
  { cutName: "Chicken Breast (Boneless)", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 250, targetTempF: 165, sortOrder: 2 },

  // ── Chicken Breast (Bone-In) ──────────────────────────────────────────────
  { cutName: "Chicken Breast (Bone-In)", label: "Indirect Heat", cookMethod: "Indirect Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 300, targetTempF: 165, sortOrder: 0 },
  { cutName: "Chicken Breast (Bone-In)", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 375, targetTempF: 165, sortOrder: 1 },

  // ── Chicken Leg Quarters ──────────────────────────────────────────────────
  { cutName: "Chicken Leg Quarters", label: "Indirect Heat", cookMethod: "Indirect Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 175, sortOrder: 0 },
  { cutName: "Chicken Leg Quarters", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 175, sortOrder: 1 },

  // ── Chicken Drumsticks ────────────────────────────────────────────────────
  { cutName: "Chicken Drumsticks", label: "Indirect Heat", cookMethod: "Indirect Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 175, sortOrder: 0 },
  { cutName: "Chicken Drumsticks", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 175, sortOrder: 1 },

  // ── Whole Turkey ──────────────────────────────────────────────────────────
  { cutName: "Whole Turkey", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 325, targetTempF: 165, sortOrder: 0 },
  { cutName: "Whole Turkey", label: "Spatchcock (Hot & Fast)", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 165, sortOrder: 1 },
  { cutName: "Whole Turkey", label: "Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 165, sortOrder: 2 },

  // ── Spatchcock Turkey ─────────────────────────────────────────────────────
  { cutName: "Spatchcock Turkey", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 165, sortOrder: 0 },
  { cutName: "Spatchcock Turkey", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 275, targetTempF: 165, sortOrder: 1 },

  // ── Turkey Breast ─────────────────────────────────────────────────────────
  { cutName: "Turkey Breast", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 325, targetTempF: 165, sortOrder: 0 },
  { cutName: "Turkey Breast", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 375, targetTempF: 165, sortOrder: 1 },
  { cutName: "Turkey Breast", label: "Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 165, sortOrder: 2 },

  // ── Turkey Legs ───────────────────────────────────────────────────────────
  { cutName: "Turkey Legs", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every 2 Hours", injection: "Not Injected", cookTempF: 275, targetTempF: 175, sortOrder: 0 },

  // ── Duck Breast ───────────────────────────────────────────────────────────
  { cutName: "Duck Breast", label: "Low & Slow (Fat Render)", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 300, targetTempF: 135, sortOrder: 0 },
  { cutName: "Duck Breast", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 135, sortOrder: 1 },

  // ── Leg of Lamb (Bone-In) ─────────────────────────────────────────────────
  { cutName: "Leg of Lamb (Bone-In)", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 275, targetTempF: 145, sortOrder: 0 },
  { cutName: "Leg of Lamb (Bone-In)", label: "Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 145, sortOrder: 1 },
  { cutName: "Leg of Lamb (Bone-In)", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 145, sortOrder: 2 },

  // ── Leg of Lamb (Boneless) ────────────────────────────────────────────────
  { cutName: "Leg of Lamb (Boneless)", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 145, sortOrder: 0 },
  { cutName: "Leg of Lamb (Boneless)", label: "Rotisserie", cookMethod: "Rotisserie", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 325, targetTempF: 145, sortOrder: 1 },

  // ── Rack of Lamb ──────────────────────────────────────────────────────────
  { cutName: "Rack of Lamb", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 135, sortOrder: 0 },
  { cutName: "Rack of Lamb", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 135, sortOrder: 1 },

  // ── Lamb Shoulder ─────────────────────────────────────────────────────────
  { cutName: "Lamb Shoulder", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 0 },
  { cutName: "Lamb Shoulder", label: "Braised Finish", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 200, sortOrder: 1 },

  // ── Lamb Chops ────────────────────────────────────────────────────────────
  { cutName: "Lamb Chops", label: "Hot & Fast (Direct)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 135, sortOrder: 0 },
  { cutName: "Lamb Chops", label: "Reverse Sear", cookMethod: "Reverse Sear", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 250, targetTempF: 135, sortOrder: 1 },

  // ── Lamb Ribs ─────────────────────────────────────────────────────────────
  { cutName: "Lamb Ribs", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 0 },
  { cutName: "Lamb Ribs", label: "Foil Wrap", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 1 },

  // ── Lamb Shank ────────────────────────────────────────────────────────────
  { cutName: "Lamb Shank", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 0 },
  { cutName: "Lamb Shank", label: "Braised Finish", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 205, sortOrder: 1 },

  // ── Pulled Lamb ───────────────────────────────────────────────────────────
  { cutName: "Pulled Lamb", label: "Low & Slow (Foil Wrap)", cookMethod: "Low & Slow", wrapFinish: "Foil at Stall (Texas Crutch)", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 205, sortOrder: 0 },
  { cutName: "Pulled Lamb", label: "No Wrap", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 205, sortOrder: 1 },

  // ── Goat Shoulder ─────────────────────────────────────────────────────────
  { cutName: "Goat Shoulder", label: "Low & Slow", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "Every Hour", injection: "Not Injected", cookTempF: 250, targetTempF: 200, sortOrder: 0 },
  { cutName: "Goat Shoulder", label: "Braised Finish", cookMethod: "Low & Slow", wrapFinish: "Braised in Foil with Liquid", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 275, targetTempF: 200, sortOrder: 1 },

  // ── Salmon Fillet ─────────────────────────────────────────────────────────
  { cutName: "Salmon Fillet", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 145, sortOrder: 0 },
  { cutName: "Salmon Fillet", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 145, sortOrder: 1 },
  { cutName: "Salmon Fillet", label: "Cedar Plank", cookMethod: "Indirect Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 350, targetTempF: 145, sortOrder: 2 },

  // ── Whole Salmon ──────────────────────────────────────────────────────────
  { cutName: "Whole Salmon", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 145, sortOrder: 0 },
  { cutName: "Whole Salmon", label: "Hot & Fast", cookMethod: "Hot & Fast", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 375, targetTempF: 145, sortOrder: 1 },

  // ── Trout (Whole) ─────────────────────────────────────────────────────────
  { cutName: "Trout (Whole)", label: "Low & Slow Smoke", cookMethod: "Low & Slow", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 225, targetTempF: 145, sortOrder: 0 },
  { cutName: "Trout (Whole)", label: "Hot & Fast (Direct)", cookMethod: "Direct Heat", wrapFinish: "No Wrap", spritzFrequency: "No Spritz", injection: "Not Injected", cookTempF: 400, targetTempF: 145, sortOrder: 1 },
];

async function seed() {
  console.log(`Seeding ${PRESETS.length} technique presets…`);

  await db.execute(sql`TRUNCATE TABLE technique_presets RESTART IDENTITY`);

  const BATCH = 50;
  for (let i = 0; i < PRESETS.length; i += BATCH) {
    const batch = PRESETS.slice(i, i + BATCH);
    await db.insert(techniquePresetsTable).values(batch);
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
