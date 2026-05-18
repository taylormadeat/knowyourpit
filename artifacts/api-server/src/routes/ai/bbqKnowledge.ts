// Static BBQ knowledge base — common factual questions answered in PitMaster's
// voice without making an AI call. Checked before routing to the model so
// zero-cost responses can be served for the most frequently asked questions.

interface KBEntry {
  patterns: RegExp[];
  answer: string;
}

const KB: KBEntry[] = [
  // ── Pull temperatures ──────────────────────────────────────────────────
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?brisket/i,
      /brisket.{0,30}(when.{0,10}done|pull.{0,10}temp|finish\s*temp|target\s*temp)/i,
      /what\s+(temp|temperature)\s+.{0,15}brisket/i,
    ],
    answer: "Pull brisket at 200–205°F — but temperature is the guardrail, not the finish line. When the probe slides through the flat with zero resistance, like pushing into soft butter, it's done. Could be 198°F, could be 207°F depending on the cut.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(pork\s*butt|pork\s*shoulder|boston\s*butt|pulled\s*pork)/i,
      /(pork\s*butt|pork\s*shoulder|boston\s*butt).{0,30}(pull|done|temp)/i,
      /what\s+temp.{0,20}(pork\s*butt|pork\s*shoulder)/i,
    ],
    answer: "Pork butt is done at 200–205°F internal, but same rule as brisket — probe tender is the real test. The bone should wiggle freely and pull clean. You can hold it at 140°F in a cooler for hours if you finish early.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(pork\s*ribs?|baby\s*back|spare\s*ribs?|st\.?\s*louis)/i,
      /(pork\s*ribs?|baby\s*back|spare\s*ribs?).{0,30}(pull|done|temp|finish)/i,
      /what\s+temp.{0,20}ribs/i,
      /\b(bend|toothpick|crack)\s*test/i,
    ],
    answer: "Ribs are done at 195–203°F internal, but use the bend test — pick them up in the middle, they should bend 45 degrees and crack the surface. Toothpick through the meat should meet no resistance. Baby backs typically cook faster than spares.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(beef\s*ribs?|dino\s*ribs?|plate\s*ribs?|short\s*ribs?)/i,
      /(beef\s*ribs?|dino\s*ribs?).{0,30}(pull|done|temp)/i,
      /what\s+temp.{0,20}beef\s*rib/i,
    ],
    answer: "Beef ribs hit done at 200–205°F — same probe-tender test as brisket. The meat should pull back from the bone and the probe goes in like butter. These take time; don't rush them.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(chicken\s*breast)/i,
      /(chicken\s*breast).{0,30}(pull|done|temp)/i,
      /what\s+temp.{0,20}chicken\s*breast/i,
    ],
    answer: "Chicken breast: pull at 160–162°F and let carryover bring it to 165°F. Go higher and you're eating cardboard. It'll keep climbing 3–5°F off the grill so pull early and rest it.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(chicken\s*thigh|chicken\s*thighs)/i,
      /(chicken\s*thigh).{0,30}(pull|done|temp)/i,
      /what\s+temp.{0,20}chicken\s*thigh/i,
    ],
    answer: "Chicken thighs: 175–185°F. Thighs are forgiving — the higher fat and connective tissue breaks down above 175°F and actually improves the texture. 165°F is food-safe but thighs are better a bit higher.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(whole\s*chicken|spatchcock|beer\s*can\s*chicken)/i,
      /what\s+temp.{0,20}whole\s*chicken/i,
    ],
    answer: "Whole chicken: thigh at 175°F, breast at 160–165°F. The thigh is your primary target since it runs cooler. If you spatchcock it, both sides get even heat and it cooks faster.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(turkey|whole\s*turkey|turkey\s*breast)/i,
      /what\s+temp.{0,20}turkey/i,
    ],
    answer: "Turkey breast: 160–162°F and let carryover finish the job. Whole bird: thigh meat at 175°F. Brine it first — a 12-hour wet brine is the single biggest factor in whether your turkey is juicy or dry.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(steak|ribeye|strip|sirloin|flank|skirt)/i,
      /what\s+temp.{0,20}steak/i,
      /steak.{0,20}(medium\s*rare|rare|medium|well\s*done).{0,20}temp/i,
    ],
    answer: "Steak temps: rare 120–125°F, medium rare 130–135°F (ideal for most cuts), medium 140–145°F, well done 160°F+. Pull 5°F below your target — carryover does the rest. Medium rare is the sweet spot for flavor and tenderness on almost any steak.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(pork\s*tenderloin|pork\s*loin|pork\s*chop)/i,
      /what\s+temp.{0,20}pork\s*(tenderloin|loin|chop)/i,
    ],
    answer: "Pork tenderloin and chops: pull at 140–145°F. Safe to eat at 145°F with a 3-minute rest per USDA. A little pink in the middle is fine — pork tenderloin especially should be pulled at 140°F for best texture.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(salmon|fish|trout|halibut)/i,
      /what\s+temp.{0,20}(salmon|fish)/i,
    ],
    answer: "Salmon and most fish: 125–130°F for medium (my preference — still moist, just opaque), 140–145°F for fully cooked through. Fish dries out fast. Watch it closely and pull when it starts to flake and loses translucency in the center.",
  },
  {
    patterns: [
      /\b(pull|done|finish|target|internal)\s*temp(erature)?\s*(for\s*)?(lamb\s*leg|rack\s*of\s*lamb|lamb\s*chop)/i,
      /what\s+temp.{0,20}lamb/i,
    ],
    answer: "Lamb: medium rare at 130–135°F, medium at 140–145°F. Lamb has great flavor at medium rare — going higher starts to lose the richness. Rest it 10 minutes before slicing.",
  },

  // ── Rest times ─────────────────────────────────────────────────────────
  {
    patterns: [
      /how\s+long\s+(to\s+rest|should\s+.{0,10}rest|do\s+you\s+rest).{0,20}brisket/i,
      /brisket.{0,20}rest\s+time/i,
      /rest\s+a\s+brisket/i,
    ],
    answer: "Brisket: minimum 1 hour, ideally 2 hours. Wrap it in butcher paper, then a towel, and tuck it in a cooler — it'll hold at temp for 4–6 hours. The rest is when the juices redistribute. Slice it too early and everything runs out on the board.",
  },
  {
    patterns: [
      /how\s+long\s+(to\s+rest|should\s+.{0,10}rest).{0,20}(pork\s*butt|pork\s*shoulder|pulled\s*pork)/i,
      /(pork\s*butt|pork\s*shoulder).{0,20}rest\s+time/i,
    ],
    answer: "Pork butt: 45–60 minutes minimum. Like brisket, it holds well in a cooler — wrap in butcher paper and a towel and it'll stay hot for 4+ hours. Pulling it too soon makes shredding harder and the texture is less even.",
  },
  {
    patterns: [
      /how\s+long\s+(to\s+rest|should\s+.{0,10}rest).{0,20}(steak|ribeye)/i,
      /steak.{0,20}rest\s+time/i,
    ],
    answer: "Steaks: 5–10 minutes. The rule of thumb is roughly 1 minute per 100°F of internal temperature. Tent loosely with foil if the air is cold. Don't overthink it — 5 minutes is usually enough.",
  },
  {
    patterns: [
      /how\s+long\s+(to\s+rest|should\s+.{0,10}rest).{0,20}(chicken|turkey)/i,
      /(chicken|turkey).{0,20}rest\s+time/i,
    ],
    answer: "Chicken: 10–15 minutes. Whole birds and large breasts benefit from resting; thighs and wings less critical. Turkey: 20–30 minutes for a whole bird. Keeps the skin from getting soggy too fast.",
  },

  // ── The stall ──────────────────────────────────────────────────────────
  {
    patterns: [
      /what\s+(is\s+)?(the\s+)?stall/i,
      /explain\s+(the\s+)?stall/i,
      /why\s+(does|is|the).{0,20}stall/i,
      /stall\s+(explained|mean|happens|occur)/i,
    ],
    answer: "The stall is when a large cut (brisket, pork butt) hits 150–175°F and the temperature stops rising for hours — sometimes 4–6 hours. It's not a problem, it's evaporative cooling. The surface moisture is evaporating and keeping the meat cool. You push through by wrapping (Texas crutch) or riding it out at a slightly higher pit temp.",
  },
  {
    patterns: [
      /how\s+(do\s+I|to)\s+(push\s+through|get\s+through|beat|overcome|break).{0,20}stall/i,
      /stall.{0,20}(push|break|beat|wrap|crutch)/i,
    ],
    answer: "Two options: wrap it (Texas crutch — foil or butcher paper around 160–170°F) to cut the evaporation and power through the stall, or ride it out and let the bark set at a slightly higher pit temp (250–275°F). Wrapping in foil is faster; butcher paper is a middle ground that preserves more bark.",
  },
  {
    patterns: [
      /how\s+long\s+(does|is).{0,10}stall/i,
      /stall.{0,20}how\s+long/i,
    ],
    answer: "The stall can last 2–6 hours depending on the size of the cut, the pit temp, and humidity. Bigger cuts stall longer. Low-and-slow at 225°F stalls longer than hot-and-fast at 275°F. If you're running low on time, wrap it.",
  },

  // ── Wrapping ───────────────────────────────────────────────────────────
  {
    patterns: [
      /\b(texas\s*crutch|foil\s*wrap|wrap\s*(in\s*)?foil).{0,20}(what|why|when|how|explain)/i,
      /(what|why|when|how)\s+(is|do\s+you|to)\s+(the\s+)?texas\s+crutch/i,
    ],
    answer: "Texas crutch: wrap the meat tightly in foil during the stall (usually 160–170°F internal), often with a splash of liquid — beef tallow for brisket, apple juice for pork. Eliminates the stall, keeps moisture in, pushes the cook faster. Trade-off: softer bark.",
  },
  {
    patterns: [
      /butcher\s*paper\s*(vs\.?\s*foil|or\s*foil)/i,
      /foil\s*vs\.?\s*butcher\s*paper/i,
      /(when|why)\s+(use|to\s+use)\s+butcher\s*paper/i,
    ],
    answer: "Butcher paper vs. foil: butcher paper is breathable — it slows the stall but still lets some moisture escape, so you get a better bark than foil. Foil is a full seal — fastest through the stall, softest bark. For brisket I prefer butcher paper. For pork butt when I need speed, foil.",
  },
  {
    patterns: [
      /when\s+(should|do\s+I|to)\s+wrap\s+(a\s+)?brisket/i,
      /wrap\s+(a\s+)?brisket\s+when/i,
    ],
    answer: "Wrap brisket when it hits 160–170°F internal or once the bark has set and you're happy with the color — usually 4–6 hours in at 225°F. Don't wrap too early or the bark never gets a chance to form. Don't wait so long the bark gets hard and the outside dries out.",
  },
  {
    patterns: [
      /when\s+(should|do\s+I|to)\s+wrap\s+(a\s+)?(pork\s*butt|pork\s*shoulder)/i,
      /wrap\s+(a\s+)?(pork\s*butt|pork\s*shoulder)\s+when/i,
    ],
    answer: "Wrap pork butt when it hits 160–165°F internal or when the bark is dark mahogany and set. Add a splash of apple juice or cider vinegar before sealing. Foil is fine for pork butt — the bark isn't as critical as brisket and you want the moisture retention for pulling.",
  },

  // ── Wood pairings ──────────────────────────────────────────────────────
  {
    patterns: [
      /\b(best|good|what)\s+(wood|woods)\s+(for\s+|to\s+use\s+(?:for|with)\s+)?(brisket|beef\s*brisket)/i,
      /(wood|smoke).{0,20}brisket/i,
      /brisket.{0,20}(wood|smoke\s*wood)/i,
    ],
    answer: "For brisket: post oak is the Texas standard — clean, medium smoke, lets the beef flavor lead. Hickory works well and is more widely available. Mix in a chunk of cherry for subtle sweetness and color. Avoid mesquite for long cooks — it gets acrid over 4+ hours.",
  },
  {
    patterns: [
      /\b(best|good|what)\s+(wood|woods)\s+(for\s+|to\s+use\s+(?:for|with)\s+)?(pork\s*ribs?|baby\s*back|spare\s*ribs?|pork\s*butt|pork\s*shoulder|pulled\s*pork)/i,
      /(wood|smoke).{0,20}(pork|ribs)/i,
    ],
    answer: "For pork: apple and cherry are the classic combo — apple gives mild, sweet smoke; cherry adds color and a slight tartness. Hickory adds punch if you want heavier smoke flavor. Pecan is excellent too — somewhere between apple and hickory. I typically do apple + cherry for ribs, hickory + apple for pork butt.",
  },
  {
    patterns: [
      /\b(best|good|what)\s+(wood|woods)\s+(for\s+|to\s+use\s+(?:for|with)\s+)?(chicken|poultry|turkey)/i,
      /(wood|smoke).{0,20}(chicken|turkey|poultry)/i,
    ],
    answer: "Chicken and turkey: apple, cherry, or pecan. Fruit woods and pecan give a lighter, sweeter smoke that doesn't overpower poultry. Hickory works in small amounts. Avoid mesquite for whole birds — too aggressive. A couple of cherry chunks is all you need.",
  },
  {
    patterns: [
      /\b(best|good|what)\s+(wood|woods)\s+(for\s+|to\s+use\s+(?:for|with)\s+)?(beef\s*ribs?|dino\s*ribs?)/i,
      /(wood|smoke).{0,20}beef\s*rib/i,
    ],
    answer: "Beef ribs: same as brisket — post oak or hickory. These are big, bold cuts and can handle heavier smoke. Post oak for a cleaner profile, hickory if you want more smoke intensity. A cherry chunk for color won't hurt.",
  },
  {
    patterns: [
      /\b(best|good|what)\s+(wood|woods)\s+(for\s+|to\s+use\s+(?:for|with)\s+)?(salmon|fish|trout)/i,
      /(wood|smoke).{0,20}(salmon|fish)/i,
    ],
    answer: "Fish: alder is traditional for salmon — mild, slightly sweet, won't overpower. Apple or cherry works well too. Avoid hickory and mesquite — they're too strong for fish and will taste harsh. Keep the smoke light; fish picks it up fast.",
  },

  // ── Bark ───────────────────────────────────────────────────────────────
  {
    patterns: [
      /what\s+is\s+(a\s+)?bark/i,
      /\bexplain\s+bark\b/i,
      /\bbark\s+(explained|meaning|is\s+what)/i,
    ],
    answer: "Bark is the dark, crusty exterior on smoked meat — formed when smoke, moisture, and rub react on the surface over time. It's a combination of the Maillard reaction and smoke compounds binding to the meat's proteins. Good bark has deep color (mahogany to near-black), firm texture, and layered flavor.",
  },
  {
    patterns: [
      /how\s+.{0,15}(better|good|improve|get\s+more).{0,10}bark/i,
      /tips?\s+for\s+bark/i,
      /bark\s+(tips?|tricks?|improve)/i,
    ],
    answer: "Better bark: start with a dry surface (unwrapped in the fridge overnight or patted dry before the cook). Apply a binder (mustard or olive oil) so the rub sticks. Use a rub with salt and sugar. Don't wrap too early — let the bark set and darken first. Adequate airflow around the meat helps. Spritzing constantly kills bark; if you spritz, do it infrequently and not in the first 2 hours.",
  },

  // ── Probe tender ───────────────────────────────────────────────────────
  {
    patterns: [
      /what\s+(does|is)\s+probe.{0,5}tender/i,
      /\bprobe\s*tender\s*(mean|explain|is|test)/i,
      /explain\s+probe\s*tender/i,
    ],
    answer: "Probe tender means the meat has no resistance when you push a thermometer probe (or a wooden skewer or cake tester) into the thickest part. It should feel like pushing into room-temperature butter — zero pushback, slides through cleanly. This is the real 'done' indicator for large collagen-heavy cuts like brisket and pork butt.",
  },

  // ── Basic timing ───────────────────────────────────────────────────────
  {
    patterns: [
      /how\s+long\s+(per\s+lb|per\s+pound|does?\s+it\s+take).{0,20}brisket/i,
      /brisket.{0,20}(minutes?\s+per\s+lb|time\s+per\s+lb|how\s+long)/i,
    ],
    answer: "Brisket baseline: 60–90 min per lb at 225°F. A 15 lb packer brisket runs 12–16 hours. At 250°F expect 45–60 min/lb. At 275°F (hot and fast), 35–45 min/lb. Your grill and the cut's fat content push the actual number either direction. Always plan for more time than you think you need.",
  },
  {
    patterns: [
      /how\s+long\s+(per\s+lb|per\s+pound|does?\s+it\s+take).{0,20}(pork\s*butt|pork\s*shoulder)/i,
      /(pork\s*butt|pork\s*shoulder).{0,20}(minutes?\s+per\s+lb|how\s+long)/i,
    ],
    answer: "Pork butt baseline: 60–90 min per lb at 225°F. An 8 lb butt runs 8–12 hours. At 250°F: 45–60 min/lb. These take their time and the stall can add hours. Plan for 10 hours on an average butt and you'll almost always have buffer.",
  },
  {
    patterns: [
      /how\s+long\s+(per\s+lb|per\s+pound|does?\s+it\s+take|to\s+cook).{0,20}(ribs|baby\s*back|spare\s*ribs?)/i,
      /(ribs|baby\s*back|spare\s*ribs?).{0,20}(how\s+long|time|hours?)/i,
    ],
    answer: "Ribs: baby backs run 4.5–5.5 hours at 225°F; spare ribs (full rack or St. Louis trim) 5–6.5 hours. The 3-2-1 method (3 hours unwrapped, 2 wrapped in foil, 1 sauced) works well for spares. 2-2-1 for baby backs. Done when probe goes through clean and the bend test passes.",
  },
  {
    patterns: [
      /how\s+long\s+(per\s+lb|per\s+pound|does?\s+it\s+take|to\s+cook).{0,20}(whole\s+chicken|spatchcock)/i,
      /(whole\s+chicken|spatchcock).{0,20}(how\s+long|time|hours?)/i,
    ],
    answer: "Whole chicken at 325–350°F: 2–3 hours depending on size. Spatchcocked (backbone removed, flattened) cooks faster and more evenly — more like 1.5–2 hours. Higher temp for chicken gives crispier skin. At 225°F it'll work but the skin comes out rubbery.",
  },

  // ── Smoke ring ─────────────────────────────────────────────────────────
  {
    patterns: [
      /what\s+is\s+(a\s+)?smoke\s*ring/i,
      /smoke\s*ring\s+(mean|explain|is|how)/i,
      /how\s+(do\s+I|to)\s+(get|achieve).{0,10}smoke\s*ring/i,
    ],
    answer: "The smoke ring is the pink layer just under the crust on smoked meat — it's nitrogen dioxide from the smoke reacting with myoglobin in the meat. It's purely cosmetic (doesn't affect flavor) but is a sign of low-and-slow cooking with real smoke. Cold meat into a smoky pit helps develop it. Don't chase the ring over the cook.",
  },

  // ── Hot and fast ───────────────────────────────────────────────────────
  {
    patterns: [
      /hot\s*(and|&)\s*fast.{0,20}(brisket|pork|ribs|method|what)/i,
      /what\s+is\s+hot.{0,5}fast/i,
      /(cook|smoke).{0,10}brisket.{0,10}(275|300|350)/i,
    ],
    answer: "Hot and fast means smoking at 275–325°F instead of the traditional 225°F. Briskets cooked hot and fast at 300°F can finish in 6–8 hours vs. 12–16. The trade-off: tighter bark development window, and you need to watch it more closely. Many competition cooks have moved to hot and fast. Wrap earlier (around 165°F) and monitor temp more frequently.",
  },

  // ── Preheat / pit temp ─────────────────────────────────────────────────
  {
    patterns: [
      /\b(cook|smoke|pit|grill).{0,10}temp(erature)?\s+(for\s+)?(brisket|pork\s*butt|pork\s*shoulder|low\s*and\s*slow)/i,
      /what\s+temp.{0,10}(to\s+)?(smoke|cook|run).{0,20}(brisket|pork\s*butt)/i,
      /low\s*(and|&)\s*slow\s+(temp|temperature)/i,
    ],
    answer: "225°F is the classic low-and-slow temperature for brisket and pork butt. 250°F cooks a bit faster with similar results. 275–300°F is hot-and-fast territory — works great with careful monitoring. The exact temp matters less than consistency — a stable pit at 240°F beats one swinging between 200 and 280.",
  },

  // ── Grill preheat ──────────────────────────────────────────────────────
  {
    patterns: [
      /how\s+long\s+(to\s+preheat|does?\s+.{0,10}preheat|should\s+.{0,10}preheat)/i,
      /(preheat|warm\s*up).{0,20}(how\s+long|time|minutes?|hours?)/i,
    ],
    answer: "Preheat time depends on the grill: offset smokers need 45–60 minutes to stabilize. Pellet grills: 15–20 minutes. Kamado/ceramic: 30–45 minutes to settle (they overshoot and take time to come down). Kettle charcoal: 20–30 minutes after the chimney is lit. The key word is 'stabilize' — you want pit temp steady at your target before the meat goes on.",
  },

  // ── Charcoal ───────────────────────────────────────────────────────────
  {
    patterns: [
      /lump.{0,10}(vs\.?|or).{0,10}briquette/i,
      /briquette.{0,10}(vs\.?|or).{0,10}lump/i,
      /what.{0,10}(charcoal|coal).{0,10}(use|better|best)/i,
    ],
    answer: "Lump charcoal burns hotter, cleaner, and produces less ash — better for high-heat searing and kamado grills. Briquettes burn more consistently and for longer — better for long low-and-slow cooks where steady temperature matters more than heat intensity. For an offset or kettle doing a 12-hour brisket, briquettes are your friend. For a steak sear, lump.",
  },
];

// Returns a pre-written PitMaster answer if the message matches a known
// factual question, or null if no confident match is found.
export function lookupKnowledge(message: string): string | null {
  for (const entry of KB) {
    if (entry.patterns.some((p) => p.test(message))) {
      return entry.answer;
    }
  }
  return null;
}
