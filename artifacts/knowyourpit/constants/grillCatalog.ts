export interface GrillModel {
  name: string;
  type: string;
  fuelType: string;
  tempRange: string;
  cookingSurface?: string;
  features: string[];
  notes?: string;
}

export interface GrillBrand {
  brand: string;
  logoUrl?: string;
  models: GrillModel[];
}

export interface GrillCategory {
  category: string;
  icon: string;
  brands: GrillBrand[];
}

export const GRILL_CATALOG: GrillCategory[] = [
  {
    category: "Pellet Grills",
    icon: "zap",
    brands: [
      {
        brand: "Traeger",
        logoUrl: "https://logo.clearbit.com/traeger.com",
        models: [
          { name: "Ranger", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 400°F", cookingSurface: "184 sq in", features: ["Portable", "WiFIRE® enabled", "Digital arc controller"], notes: "Compact tailgate/camp pellet grill" },
          { name: "Tailgater 20", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 450°F", cookingSurface: "300 sq in", features: ["Fold-Leg design", "Portable", "Digital arc controller"] },
          { name: "Pro 22", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "572 sq in", features: ["WiFIRE® enabled", "Digital arc controller", "6-in-1 versatility"] },
          { name: "Pro 575", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "575 sq in", features: ["WiFIRE® enabled", "D2® drivetrain", "TurboTemp™"] },
          { name: "Pro 780", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "780 sq in", features: ["WiFIRE® enabled", "D2® drivetrain", "Meat probe included"] },
          { name: "Ironwood 650", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "650 sq in", features: ["Super Smoke mode", "Downdraft exhaust", "WiFIRE®"] },
          { name: "Ironwood 885", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "885 sq in", features: ["Super Smoke mode", "Downdraft exhaust", "WiFIRE®"] },
          { name: "Ironwood XL", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "924 sq in", features: ["Super Smoke mode", "Induction side burner", "WiFIRE®"] },
          { name: "Timberline 850", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "850 sq in", features: ["Triple-wall insulation", "Super Smoke mode", "Full-length door"] },
          { name: "Timberline 1300", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "1300 sq in", features: ["Triple-wall insulation", "Super Smoke mode", "Pellet sensor"] },
          { name: "Timberline (New 2022) XL", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 500°F", cookingSurface: "1320 sq in", features: ["Induction cooktop", "Pop-and-Lock accessory rail", "Touchscreen controller", "Smart Combustion™"] },
          { name: "Bronson 20", type: "Pellet Grill", fuelType: "Pellets", tempRange: "165°F – 450°F", cookingSurface: "300 sq in", features: ["Compact backyard size", "Digital arc controller", "Porcelain grill grates"] },
          { name: "Flatrock Griddle", type: "Pellet/Gas Combo", fuelType: "Gas", tempRange: "200°F – 600°F", cookingSurface: "594 sq in", features: ["3-zone griddle", "FlameLock construction", "EZ-Clean grease management"], notes: "Traeger's gas-powered flat-top griddle" },
        ],
      },
      {
        brand: "Pit Boss",
        logoUrl: "https://logo.clearbit.com/pitboss-grills.com",
        models: [
          { name: "340", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "340 sq in", features: ["Flame broiler", "8-in-1 cooking", "LED digital readout"] },
          { name: "Sportsman 500", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "500 sq in", features: ["Flame broiler", "8-in-1 cooking", "Digital control board"], notes: "Great entry-level pellet grill for beginners" },
          { name: "700FB", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "700 sq in", features: ["Flame broiler lever", "8-in-1 cooking", "Dial-in digital control"] },
          { name: "Sportsman 820", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "820 sq in", features: ["Flame broiler", "Digital control board", "Porcelain-coated grates"] },
          { name: "820 Deluxe", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "820 sq in", features: ["Flame broiler", "Porcelain-coated grates", "Digital control board"] },
          { name: "Titan 700", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "700 sq in", features: ["PID controller", "Slide-plate flame broiler", "Folding side shelf"], notes: "Updated Titan series with improved temperature control" },
          { name: "Titan 1000", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1000 sq in", features: ["PID controller", "Slide-plate flame broiler", "Large 21 lb hopper"] },
          { name: "Austin XL", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1000 sq in", features: ["Flame broiler", "Large hopper", "PID controller"] },
          { name: "Laredo 1000", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1000 sq in", features: ["WiFi + Bluetooth", "PID controller", "Slide-plate flame broiler", "Meat probe included"], notes: "Mid-range WiFi-connected workhorse with PID precision" },
          { name: "Pro Series 1100", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1100 sq in", features: ["Flame broiler", "Meat probe", "Porcelain-coated grates"] },
          { name: "Pro Series 1600", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1598 sq in", features: ["WiFi + Bluetooth", "Slide-plate flame broiler", "Vertical smoking cabinet"] },
          { name: "Navigator 850G", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "850 sq in", features: ["PID controller", "Slide-plate flame broiler", "WiFi capable"] },
          { name: "Navigator 1150G", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1150 sq in", features: ["PID controller", "Slide-plate flame broiler", "WiFi capable", "Two meat probes"] },
          { name: "Champion", type: "Vertical Charcoal Barrel Smoker", fuelType: "Charcoal", tempRange: "200°F – 400°F", cookingSurface: "688 sq in", features: ["Vertical barrel design", "5 porcelain-coated cooking grates", "Adjustable dampers", "Side access door for charcoal/wood", "Built-in thermometer"], notes: "Pit Boss's vertical charcoal barrel smoker — traditional charcoal flavor with multi-rack capacity" },
          { name: "Platinum Lockhart", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 420°F", cookingSurface: "2136 sq in", features: ["Combo smoker/grill", "Upper smoke cabinet", "Dual zone cooking"] },
          { name: "Platinum Brunswick", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1815 sq in", features: ["Direct flame insert", "Smoke cabinet", "WiFi + BT"] },
          { name: "KC Combo", type: "Pellet + Gas Combo", fuelType: "Pellets + Propane", tempRange: "180°F – 500°F", cookingSurface: "1432 sq in", features: ["3-burner gas griddle", "Pellet smoker chamber", "Slide-plate flame broiler", "Dual-zone cooking"], notes: "Best of both worlds — smoke low-and-slow while searing on gas" },
          { name: "Memphis Ultimate 4-in-1", type: "Pellet/Charcoal/Gas Combo", fuelType: "Combination", tempRange: "200°F – 600°F", cookingSurface: "1410 sq in", features: ["Pellet, charcoal, gas, & griddle in one", "PID controller", "Slide-plate flame broiler"] },
        ],
      },
      {
        brand: "Green Mountain Grills",
        logoUrl: "https://logo.clearbit.com/greenmountaingrills.com",
        models: [
          { name: "Davy Crockett", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "219 sq in", features: ["Portable/foldable legs", "WiFi enabled", "USB charging port"], notes: "Peak portable pellet grill" },
          { name: "Trek Prime+", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "219 sq in", features: ["WiFi", "Foldable legs", "Sense-Mate thermal sensor"] },
          { name: "Jim Bowie", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "658 sq in", features: ["WiFi", "Open-box grease tray", "Meat probe"] },
          { name: "Jim Bowie Prime+", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "658 sq in", features: ["WiFi", "PID controller", "Rotisserie ready"] },
          { name: "Daniel Boone Prime+", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "458 sq in", features: ["WiFi", "PID controller", "Slide-out drip pan"] },
          { name: "Peak", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "469 sq in", features: ["WiFi enabled", "Thermal sensor", "Modular design"] },
          { name: "Peak Prime Plus", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "469 sq in", features: ["PID + WiFi", "Modular accessories", "Heavy-duty stainless"] },
          { name: "Ledge Prime+", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "762 sq in", features: ["WiFi", "PID controller", "Stainless steel"] },
        ],
      },
      {
        brand: "Camp Chef",
        logoUrl: "https://logo.clearbit.com/campchef.com",
        models: [
          { name: "SmokePro 24", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "429 sq in", features: ["Smart Smoke technology", "Ash cleanout system", "Dial-in temp control"] },
          { name: "SmokePro DLX", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "570 sq in", features: ["Patented ash cleanout", "Dual probes", "Sear box compatible"] },
          { name: "SmokePro XT", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "570 sq in", features: ["Smart Smoke", "Ash cleanout", "Side shelf"] },
          { name: "Woodwind 24", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "811 sq in", features: ["SideKick ready", "WIFI & Bluetooth", "Smoke Control™ 0-10"] },
          { name: "Woodwind 36", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "1236 sq in", features: ["SideKick ready", "WIFI & Bluetooth", "Smoke levels 1-10"] },
          { name: "Woodwind Pro 24", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "811 sq in", features: ["Smoke Box", "WiFi+BT", "PID controller"] },
          { name: "Woodwind Pro 36", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "1236 sq in", features: ["Smoke Box", "Propane SideKick", "WiFi+BT", "PID controller"] },
          { name: "Pursuit 20", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "361 sq in", features: ["Portable", "Ash cleanout", "WiFi+BT"] },
          { name: "Apex 30", type: "Pellet/Gas Combo", fuelType: "Combination", tempRange: "160°F – 900°F", cookingSurface: "811 sq in", features: ["Pellet smoker + gas grill", "Glass-front flat-top griddle", "WiFi+BT"] },
        ],
      },
      {
        brand: "Weber",
        logoUrl: "https://logo.clearbit.com/weber.com",
        models: [
          { name: "SmokeFire EX4", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 600°F", cookingSurface: "672 sq in", features: ["Weber Connect", "Flavorizer bars", "Sear Zone"] },
          { name: "SmokeFire EX6", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 600°F", cookingSurface: "1008 sq in", features: ["Weber Connect", "Flavorizer bars", "6 meat probes"] },
          { name: "SmokeFire STEALTH EX4", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 600°F", cookingSurface: "672 sq in", features: ["Matte black finish", "Weber Connect", "Sear station"] },
          { name: "SmokeFire EPX4", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 600°F", cookingSurface: "672 sq in", features: ["Weber Connect", "DC fan system", "CRAFTED accessory ready"] },
          { name: "Searwood 600", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "591 sq in", features: ["Smoke Boost mode", "Weber Connect", "Sear Mode"] },
          { name: "Searwood XL 600", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "884 sq in", features: ["Larger XL hopper", "Weber Connect", "Smoke Boost"] },
        ],
      },
      {
        brand: "Rec Tec (RecTeq)",
        logoUrl: "https://logo.clearbit.com/recteq.com",
        models: [
          { name: "RT-300 Patio Legend", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 500°F", cookingSurface: "300 sq in", features: ["Smart grill technology", "WiFi", "Stainless steel"] },
          { name: "RT-340 Trailblazer", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "340 sq in", features: ["Foldable legs", "WiFi enabled", "Smart Grill controller"] },
          { name: "RT-590 Stampede", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 500°F", cookingSurface: "592 sq in", features: ["Smart grill technology", "WiFi", "304 stainless grates"] },
          { name: "RT-700 Flagship", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 500°F", cookingSurface: "702 sq in", features: ["Smart grill technology", "WiFi", "Stainless steel bull horn handles"] },
          { name: "RT-1250 Backyard Beast", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 500°F", cookingSurface: "1254 sq in", features: ["Smart grill technology", "WiFi", "Largest RecTeq pellet grill"] },
          { name: "RT-2500 BFG", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "2538 sq in", features: ["Massive cooking capacity", "Dual sear kits", "Competition-grade"], notes: "RecTeq's largest backyard cooker" },
          { name: "RT-B380 Bullseye", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 750°F", cookingSurface: "380 sq in", features: ["Open-flame searing", "WiFi", "Dual zones"], notes: "Hot pellet grill that hits real searing temps" },
        ],
      },
      {
        brand: "Yoder Smokers",
        logoUrl: "https://logo.clearbit.com/yodersmokers.com",
        models: [
          { name: "YS480S", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 600°F", cookingSurface: "480 sq in", features: ["Heavy-gauge steel", "Competition-grade", "ACS controller"] },
          { name: "YS640S", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 600°F", cookingSurface: "640 sq in", features: ["Heavy-gauge steel", "ACS controller", "Direct flame insert"] },
          { name: "YS1500S", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 600°F", cookingSurface: "1500 sq in", features: ["Competition grade", "ACS controller", "High-performance fans"] },
        ],
      },
      {
        brand: "Louisiana Grills",
        logoUrl: "https://logo.clearbit.com/louisiana-grills.com",
        models: [
          { name: "Founders Legacy 800", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "800 sq in", features: ["Flame broiler", "Digital control", "10 lb hopper"] },
          { name: "Founders 1200", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "1196 sq in", features: ["Flame broiler", "WiFi", "PID controller"] },
          { name: "Champions Edition 7.0", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "1313 sq in", features: ["Flame broiler", "WiFi", "Stainless steel"] },
          { name: "Black Label 1000", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "1061 sq in", features: ["Flame broiler", "WiFi enabled", "PID controller"] },
        ],
      },
      {
        brand: "Spider Grills",
        logoUrl: "https://logo.clearbit.com/spidergrills.com",
        models: [
          {
            name: "Huntsman",
            type: "Pellet Grill",
            fuelType: "Pellets",
            tempRange: "180°F – 500°F",
            cookingSurface: "700 sq in",
            features: ["WiFi + Bluetooth app control", "PID temperature controller", "Auto fan regulation", "Large pellet hopper", "Stainless steel grates", "Two-zone cooking"],
            notes: "Spider Grills' flagship standalone pellet smoker with full app connectivity",
          },
        ],
      },
      {
        brand: "Z Grills",
        logoUrl: "https://logo.clearbit.com/zgrills.com",
        models: [
          { name: "450B", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 450°F", cookingSurface: "459 sq in", features: ["8-in-1 cooking", "Pellet auger", "Digital controller"] },
          { name: "550B", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 450°F", cookingSurface: "553 sq in", features: ["Auto pellet auger", "Digital controller", "Foldable side shelf"] },
          { name: "700D4E", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 450°F", cookingSurface: "697 sq in", features: ["Rear access pellet door", "PID controller", "20 lb hopper"] },
          { name: "10502B Pro", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 450°F", cookingSurface: "1056 sq in", features: ["Front folding shelf", "Searing slider", "PID controller"] },
          { name: "11002B", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 450°F", cookingSurface: "1060 sq in", features: ["Slide-and-grill flame access", "PID controller", "WiFi optional"] },
        ],
      },
      {
        brand: "Memphis Grills",
        logoUrl: "https://logo.clearbit.com/memphisgrills.com",
        models: [
          { name: "Beale Street", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 650°F", cookingSurface: "562 sq in", features: ["304 stainless steel", "WiFi enabled", "Hyperbolic firepot"], notes: "Premium American-made pellet grill" },
          { name: "Pro 28", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 700°F", cookingSurface: "834 sq in", features: ["Stainless construction", "WiFi", "Open-flame mode"] },
          { name: "Elite 28", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 700°F", cookingSurface: "1109 sq in", features: ["Double-walled hood", "WiFi", "Convection pellet smoker"], notes: "Top-of-the-line built-in / cart pellet oven" },
        ],
      },
      {
        brand: "MAK Grills",
        logoUrl: "https://logo.clearbit.com/makgrills.com",
        models: [
          { name: "1 Star General", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "429 sq in", features: ["304 stainless", "Pellet Boss controller", "Made in USA"] },
          { name: "2 Star General", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "634 sq in", features: ["304 stainless", "Pellet Boss controller", "Made in USA"], notes: "Competition pellet smoker favorite" },
          { name: "4 Star General", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "1336 sq in", features: ["Massive capacity", "FlameZone slider", "Made in USA"] },
        ],
      },
      {
        brand: "Pitts & Spitts",
        logoUrl: "https://logo.clearbit.com/pittsandspitts.com",
        models: [
          { name: "Maverick 850", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "850 sq in", features: ["1/4\" stainless body", "Direct-flame insert", "Made in Texas"] },
          { name: "Maverick 1250", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "1250 sq in", features: ["304 stainless steel", "Direct-flame insert", "Lifetime warranty"] },
          { name: "Maverick 2000", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "2000 sq in", features: ["Heavy stainless", "Massive cook chamber", "Made in USA"] },
        ],
      },
      {
        brand: "Brisk-It",
        logoUrl: "https://logo.clearbit.com/brisk-it.com",
        models: [
          { name: "Origin 580", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "580 sq in", features: ["Vera AI assistant", "Built-in WiFi", "Auto cook programs"], notes: "AI-driven recipe-based pellet grill" },
          { name: "Origin 940", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "940 sq in", features: ["Vera AI", "WiFi+BT", "Slide-out drip tray"] },
          { name: "Zone 940", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "940 sq in", features: ["Open-flame Sear Zone", "Vera AI", "WiFi"] },
        ],
      },
      {
        brand: "Asmoke",
        logoUrl: "https://logo.clearbit.com/asmoke.com",
        models: [
          { name: "AS300 Portable", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "256 sq in", features: ["Battery powered", "Truly portable", "PID controller"], notes: "Battery-powered pellet grill for camping" },
          { name: "AS500 Pellet Grill", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "513 sq in", features: ["8-in-1 cooking", "App control", "Slide-and-grill"] },
        ],
      },
      {
        brand: "Cookshack",
        logoUrl: "https://logo.clearbit.com/cookshack.com",
        models: [
          { name: "PG500 Fast Eddy's", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 700°F", cookingSurface: "1232 sq in", features: ["304 stainless steel", "Direct + indirect zones", "Made in USA"], notes: "Competition workhorse pellet smoker" },
          { name: "PG1000 Fast Eddy's", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 700°F", cookingSurface: "1500 sq in", features: ["Stainless commercial-grade", "Dual cooking zones", "Heavy hopper"] },
        ],
      },
    ],
  },

  {
    category: "Kamado / Ceramic",
    icon: "circle",
    brands: [
      {
        brand: "Big Green Egg",
        logoUrl: "https://logo.clearbit.com/biggreenegg.com",
        models: [
          { name: "Mini", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "79 sq in", features: ["Ultra-portable", "Ceramic insulation", "Lifetime warranty on ceramics"] },
          { name: "MiniMax", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "133 sq in", features: ["Portable with handles", "Full accessories range", "Stainless steel grate"] },
          { name: "Small", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "133 sq in", features: ["Compact backyard size", "Full system", "Lifetime ceramics warranty"] },
          { name: "Medium", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "177 sq in", features: ["Nest optional", "EGGspander compatible", "Dual-function metal top"] },
          { name: "Large", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "262 sq in", features: ["Most popular size", "EGGspander compatible", "Wide temp range"], notes: "The benchmark kamado — handles everything" },
          { name: "XL", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "452 sq in", features: ["Feeds large crowds", "EGGspander compatible", "Dual-function metal top"] },
          { name: "2XL", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "672 sq in", features: ["Restaurant-scale", "Holds 20 racks of ribs", "Competition proven"] },
        ],
      },
      {
        brand: "Kamado Joe",
        logoUrl: "https://logo.clearbit.com/kamadojoe.com",
        models: [
          { name: "Joe Jr.", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "148 sq in", features: ["Portable", "Air Lift hinge", "Cast iron grate"] },
          { name: "Classic I", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["Air Lift hinge", "Divide & Conquer rack", "Ash drawer"] },
          { name: "Classic II", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["Slide-out ash drawer", "Air Lift hinge", "Divide & Conquer"] },
          { name: "Classic III", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["SloRoller hyperbolic insert", "Air Lift hinge", "3-tier Divide & Conquer"] },
          { name: "Classic Joe Series II Limited", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["Stainless top vent", "Premium accessories pack", "Divide & Conquer"] },
          { name: "Big Joe I", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "406 sq in", features: ["18\" cooking surface", "Air Lift hinge", "Divide & Conquer"] },
          { name: "Big Joe II", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "452 sq in", features: ["Slide-out ash drawer", "Kontrol Tower top vent", "Air Lift hinge"] },
          { name: "Big Joe III", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "452 sq in", features: ["SloRoller hyperbolic insert", "Air Lift hinge", "3-tier D&C"] },
          { name: "Konnected Joe", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["Wifi + Bluetooth", "Auto fan control", "App connected"], notes: "World's first WiFi-enabled kamado" },
          { name: "Konnected Big Joe", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "452 sq in", features: ["Auto-ignition", "WiFi+BT", "Automated fan control"] },
          { name: "Pro Joe", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "604 sq in", features: ["24\" cooking surface", "Heavy-duty cart", "Premium ceramics"], notes: "Largest Kamado Joe — built for catering scale" },
        ],
      },
      {
        brand: "Primo",
        logoUrl: "https://logo.clearbit.com/primograills.com",
        models: [
          { name: "Oval Junior", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "210 sq in", features: ["Oval shape", "Multi-level cooking", "Made in USA"] },
          { name: "Oval 200", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "200 sq in", features: ["Oval shape", "Split grate", "US-made ceramics"] },
          { name: "Oval XL 400", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "400 sq in", features: ["Oval shape two-zone cooking", "Split grate", "Made in USA"] },
          { name: "Oval XXL 680", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "680 sq in", features: ["Largest Primo", "Four-section grate", "Made in USA"] },
          { name: "Round", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "300 sq in", features: ["Traditional round", "Multi-level", "Lifetime ceramic warranty"] },
        ],
      },
      {
        brand: "Char-Griller",
        logoUrl: "https://logo.clearbit.com/chargriller.com",
        models: [
          { name: "Akorn Jr.", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "153 sq in", features: ["Triple-wall steel", "Portable", "Foldable legs"] },
          { name: "Akorn 6520", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "314 sq in", features: ["Triple-wall steel", "Locking lid", "EZ ash-dump"] },
          { name: "Akorn Auto-Kamado", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "314 sq in", features: ["Auto temperature control", "Fan controller", "WiFi"] },
          { name: "Kamander", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "447 sq in", features: ["Insulated steel construction", "8-position damper", "Cast-iron grates"] },
        ],
      },
      {
        brand: "Vision Grills",
        logoUrl: "https://logo.clearbit.com/visiongrills.com",
        models: [
          { name: "Classic B Series", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "596 sq in", features: ["Ceramic body", "Two-tier cooking surface", "Lava Stone deflectors"] },
          { name: "Pro C Series", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "596 sq in", features: ["Stainless steel hardware", "Two-tier grates", "Includes plate setter"] },
          { name: "Pro S Series", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "596 sq in", features: ["Stainless cart", "Multi-zone cooking", "Lava stone deflectors"] },
        ],
      },
      {
        brand: "Saffire",
        logoUrl: undefined,
        models: [
          { name: "Saffire 19\"", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 750°F", cookingSurface: "284 sq in", features: ["Cast iron damper top", "Patented Air Hinge", "Split top design"] },
          { name: "Saffire 23\"", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 750°F", cookingSurface: "414 sq in", features: ["Cast iron damper", "Heavy ceramics", "Split top"] },
        ],
      },
      {
        brand: "Grill Dome",
        logoUrl: undefined,
        models: [
          { name: "Infinity Small", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 750°F", cookingSurface: "176 sq in", features: ["Heavy ceramics", "Cast iron top vent", "Lifetime ceramic warranty"] },
          { name: "Infinity Large", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 750°F", cookingSurface: "318 sq in", features: ["Heavy ceramics", "Cast iron top vent", "Two-tier rack"] },
          { name: "Infinity XL", type: "Kamado / Charcoal", fuelType: "Charcoal", tempRange: "200°F – 750°F", cookingSurface: "452 sq in", features: ["Largest Grill Dome", "Heavy ceramic body", "Multi-level cooking"] },
        ],
      },
      {
        brand: "Blaze",
        logoUrl: "https://logo.clearbit.com/blazegrills.com",
        models: [
          { name: "Kamado 20\"", type: "Kamado / Ceramic", fuelType: "Charcoal", tempRange: "200°F – 750°F", cookingSurface: "365 sq in", features: ["Cast aluminum top vent", "Heavy ceramic body", "Stainless steel cart"] },
        ],
      },
      {
        brand: "Komodo Kamado",
        logoUrl: "https://logo.clearbit.com/komodokamado.com",
        models: [
          { name: "23\" Ultimate", type: "Kamado / Ceramic", fuelType: "Charcoal", tempRange: "175°F – 1000°F", cookingSurface: "415 sq in", features: ["Tile-clad ceramic body", "Premium gaskets", "Lifetime warranty"], notes: "Boutique high-end kamado" },
          { name: "32\" BB", type: "Kamado / Ceramic", fuelType: "Charcoal", tempRange: "175°F – 1000°F", cookingSurface: "804 sq in", features: ["Massive ceramic body", "Industrial hinges", "Multi-tier cooking"] },
        ],
      },
    ],
  },

  {
    category: "Offset Smokers",
    icon: "wind",
    brands: [
      {
        brand: "Oklahoma Joe's",
        logoUrl: "https://logo.clearbit.com/oklahomajoes.com",
        models: [
          { name: "Highland", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "879 sq in", features: ["Multiple dampers", "Side firebox", "Charcoal basket included"] },
          { name: "Highland Reverse Flow", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "879 sq in", features: ["Optional reverse-flow plates", "Removable smokestack", "Heavy steel"] },
          { name: "Longhorn", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1060 sq in", features: ["Heavy-gauge steel", "Side firebox", "Cool-touch handles"] },
          { name: "Longhorn Reverse Flow", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1060 sq in", features: ["Reverse flow plates", "Optional offset", "Heavy steel"] },
          { name: "Rider 900", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "900 sq in", features: ["Slide-and-Grill tech", "Pre-seasoned grates", "Patented fuel access"] },
          { name: "Rider 1200", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1200 sq in", features: ["Slide-and-Grill", "Front access fuel", "Two-zone cooking"] },
          { name: "Bandera", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "619 sq in", features: ["Vertical barrel style", "5 cooking grates", "Side firebox"] },
          { name: "Judge", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "900 sq in", features: ["Competition grade", "Heavy steel", "Multiple dampers"] },
          { name: "Bronco Pro", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "765 sq in", features: ["Drum-style chamber", "Adjustable charcoal basket", "Locking caster wheels"] },
        ],
      },
      {
        brand: "Yoder Smokers",
        logoUrl: "https://logo.clearbit.com/yodersmokers.com",
        models: [
          { name: "Wichita", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "630 sq in", features: ["1/4\" steel", "Competition proven", "Removable shelves"], notes: "Classic American competition smoker" },
          { name: "Loaded Wichita", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1030 sq in", features: ["1/4\" steel", "Charcoal chute", "Competition proven"] },
          { name: "Kingman", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1600 sq in", features: ["1/4\" steel", "Larger capacity", "Slide-out grates"] },
          { name: "Loaded Kingman", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "2160 sq in", features: ["Insulated firebox", "Charcoal chute", "Counterweight lid"] },
          { name: "Cheyenne", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "370 sq in", features: ["Compact offset", "Heavy-duty", "Rust-resistant paint"] },
          { name: "Durango 24", type: "Vertical Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "150°F – 400°F", cookingSurface: "1320 sq in", features: ["Vertical cabinet style", "Insulated", "Side firebox"] },
        ],
      },
      {
        brand: "Lang BBQ Smokers",
        logoUrl: "https://logo.clearbit.com/langbbqsmokers.com",
        models: [
          { name: "36\" Original", type: "Reverse Flow Smoker", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "576 sq in", features: ["Reverse flow design", "Drip pan drain", "Charcoal basket"] },
          { name: "48\" Original", type: "Reverse Flow Smoker", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "864 sq in", features: ["Reverse flow", "Adjustable grates", "Stainless hardware"] },
          { name: "60\" Patio", type: "Reverse Flow Smoker", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "1170 sq in", features: ["Reverse flow", "Optional warming box", "Wagon wheels"] },
          { name: "84\" Original Deluxe", type: "Reverse Flow Smoker", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "1800 sq in", features: ["Reverse flow", "Built-in thermometers", "Large capacity"] },
        ],
      },
      {
        brand: "Old Country BBQ Pits",
        logoUrl: undefined,
        models: [
          { name: "Pecos", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "751 sq in", features: ["1/4\" steel", "Competition grade", "Charcoal basket"] },
          { name: "Wrangler", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1122 sq in", features: ["Heavy steel", "Reverse flow baffles", "Large firebox"] },
          { name: "Brazos", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1369 sq in", features: ["1/4\" thick steel", "Largest in lineup", "Hinged lid"] },
          { name: "Over & Under", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1280 sq in", features: ["Stacked chambers", "Heavy steel", "Cast iron grates"] },
          { name: "Gravity Fed Pit", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "200°F – 400°F", cookingSurface: "1300 sq in", features: ["Gravity-fed charcoal", "Insulated cabinet", "Made in USA"] },
        ],
      },
      {
        brand: "Horizon Smokers",
        logoUrl: "https://logo.clearbit.com/horizonsmokers.com",
        models: [
          { name: "16\" Classic", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "452 sq in", features: ["3/16\" steel", "Handcrafted in Oklahoma", "Lifetime warranty"] },
          { name: "20\" Classic", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "710 sq in", features: ["3/16\" steel", "Handcrafted", "Competition quality"] },
          { name: "20\" RD Special", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "710 sq in", features: ["True reverse flow", "Heavy steel", "Made in USA"] },
          { name: "Marshal", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "900 sq in", features: ["Heavy-duty steel", "Baffled firebox", "Handmade"] },
        ],
      },
      {
        brand: "Workhorse Pits",
        logoUrl: "https://logo.clearbit.com/workhorsepits.com",
        models: [
          { name: "1969", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1100 sq in", features: ["1/4\" American steel", "Counterweight lid", "Competition pedigree"], notes: "Texas-style backyard offset built like a tank" },
          { name: "1975", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1500 sq in", features: ["Insulated firebox option", "Slide-out grates", "American-made"] },
        ],
      },
      {
        brand: "Mill Scale Metalworks",
        logoUrl: "https://logo.clearbit.com/millscalemetalworks.com",
        models: [
          { name: "94 Gallon Offset", type: "Offset Smoker", fuelType: "Wood", tempRange: "225°F – 325°F", cookingSurface: "1200 sq in", features: ["1/4\" carbon steel", "Texas-style stick burner", "Made in Lockhart, TX"], notes: "Renowned competition-grade Texas pit" },
          { name: "120 Gallon Offset", type: "Offset Smoker", fuelType: "Wood", tempRange: "225°F – 325°F", cookingSurface: "1700 sq in", features: ["1/4\" carbon steel", "Heavy-duty doors", "Custom-built"] },
        ],
      },
      {
        brand: "Franklin Barbecue Pits",
        logoUrl: "https://logo.clearbit.com/franklinbbq.com",
        models: [
          { name: "Backyard Pit", type: "Offset Smoker", fuelType: "Wood", tempRange: "225°F – 325°F", cookingSurface: "1300 sq in", features: ["1/4\" steel", "Designed by Aaron Franklin", "Made in Texas"], notes: "Aaron Franklin's own pit design" },
        ],
      },
      {
        brand: "Pitts & Spitts",
        logoUrl: "https://logo.clearbit.com/pittsandspitts.com",
        models: [
          { name: "20x42 Ultimate Smoker", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "840 sq in", features: ["1/4\" steel", "Heavy stainless hardware", "Made in Houston"] },
          { name: "24x48 Ultimate Smoker", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1152 sq in", features: ["1/4\" steel", "Cast iron grates", "Stainless finish"] },
        ],
      },
      {
        brand: "Char-Griller",
        logoUrl: "https://logo.clearbit.com/chargriller.com",
        models: [
          { name: "Smokin' Pro", type: "Offset Smoker", fuelType: "Charcoal/Wood", tempRange: "200°F – 350°F", cookingSurface: "830 sq in", features: ["Side firebox", "Adjustable dampers", "Cast iron grates"] },
          { name: "Texas Trio", type: "Offset Smoker", fuelType: "Combination", tempRange: "200°F – 550°F", cookingSurface: "1063 sq in", features: ["Charcoal + gas + side firebox", "3-in-1 cooker", "Cast iron grates"] },
        ],
      },
    ],
  },

  {
    category: "Drum Smokers",
    icon: "circle",
    brands: [
      {
        brand: "Pit Barrel Cooker",
        logoUrl: "https://logo.clearbit.com/pitbarrelcooker.com",
        models: [
          { name: "Pit Barrel Cooker Classic 18.5\"", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "225°F – 300°F", cookingSurface: "Drum", features: ["Hang hooks + grill grate", "Self-regulating airflow", "Unique UDS design"], notes: "Award-winning drum smoker/cooker" },
          { name: "Pit Barrel Junior 14\"", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "225°F – 300°F", cookingSurface: "Drum (portable)", features: ["Portable size", "Hang hooks", "Same technology as Classic"] },
          { name: "Pit Barrel XL 22.5\"", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "225°F – 300°F", cookingSurface: "Drum (large)", features: ["Holds 12+ slabs of ribs", "Hang hooks + grate", "Heavy-duty drum"] },
        ],
      },
      {
        brand: "Gateway Drum Smokers",
        logoUrl: "https://logo.clearbit.com/gatewaydrumsmokers.com",
        models: [
          { name: "55-G Series", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "225°F – 500°F", cookingSurface: "452 sq in", features: ["55-gallon drum", "Adjustable airflow valves", "Hinged lid"], notes: "Competition team favorite drum smoker" },
          { name: "55-G Pro", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "225°F – 500°F", cookingSurface: "452 sq in", features: ["Pro grade hardware", "Multiple grate positions", "Ash pan"] },
          { name: "30-G Plus", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "225°F – 500°F", cookingSurface: "314 sq in", features: ["30-gallon drum", "Compact backyard size", "Hinged lid"] },
        ],
      },
      {
        brand: "Big Poppa Smokers",
        logoUrl: undefined,
        models: [
          { name: "BPS Drum Smoker Kit", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "200°F – 500°F", cookingSurface: "452 sq in", features: ["DIY drum conversion kit", "Charcoal basket", "Three intake valves"], notes: "Famous DIY UDS conversion kit" },
        ],
      },
      {
        brand: "Hunsaker Smokers",
        logoUrl: undefined,
        models: [
          { name: "Vortex 55", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "200°F – 500°F", cookingSurface: "452 sq in", features: ["Patented vortex plate", "Hinged lid + handle", "Two-tier grate option"], notes: "Vortex airflow plate gives even temps" },
          { name: "Vortex 30", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "200°F – 500°F", cookingSurface: "314 sq in", features: ["Vortex plate", "Compact 30-gallon drum", "Hinged lid"] },
        ],
      },
      {
        brand: "Weber",
        logoUrl: "https://logo.clearbit.com/weber.com",
        models: [
          { name: "Smokey Mountain 14\"", type: "Bullet Smoker", fuelType: "Charcoal", tempRange: "200°F – 350°F", cookingSurface: "286 sq in", features: ["Compact bullet design", "Two cooking grates", "Water pan"] },
          { name: "Smokey Mountain 18\"", type: "Bullet Smoker", fuelType: "Charcoal", tempRange: "200°F – 350°F", cookingSurface: "481 sq in", features: ["Two cooking levels", "Water pan", "Porcelain-enameled bowl"], notes: "WSM 18 — entry to serious low & slow" },
          { name: "Smokey Mountain 22\"", type: "Bullet Smoker", fuelType: "Charcoal", tempRange: "200°F – 350°F", cookingSurface: "726 sq in", features: ["Largest WSM", "Two grates", "Water pan"], notes: "Competition-proven workhorse" },
        ],
      },
    ],
  },

  {
    category: "Kettle Grills",
    icon: "disc",
    brands: [
      {
        brand: "Weber",
        logoUrl: "https://logo.clearbit.com/weber.com",
        models: [
          { name: "Original Kettle 18\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "240 sq in", features: ["Rust-resistant bowl", "One-touch cleaning", "Hinged cooking grate"] },
          { name: "Original Kettle 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["Rust-resistant bowl", "One-touch cleaning", "Premium size"], notes: "The world's most iconic grill" },
          { name: "Performer Deluxe 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["Built-in thermometer", "Gas ignition", "Side prep table"] },
          { name: "Performer Premium 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["Tuck-away timer", "Tool hooks", "Side table"] },
          { name: "Master-Touch 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["GBS cooking grate", "Hinged charcoal grate", "Tuck-away lid hinge"] },
          { name: "Master-Touch 26\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "508 sq in", features: ["Largest kettle", "GBS grate", "Charcoal chamber"] },
          { name: "Smokey Joe 14\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 500°F", cookingSurface: "147 sq in", features: ["Portable", "Lightweight", "Lid latch for transport"] },
          { name: "Jumbo Joe 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["Portable but full-size grate", "Lid lock", "Aluminum ash catcher"] },
          { name: "Summit Charcoal 24\"", type: "Kettle / Kamado", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "452 sq in", features: ["Insulated lid", "Snap-jet ignition", "Kamado-style performance"] },
        ],
      },
      {
        brand: "Napoleon",
        logoUrl: "https://logo.clearbit.com/napoleongrills.com",
        models: [
          { name: "Pro 22 Charcoal Kettle", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["Hinged WAVE grate", "Rear hinged lid", "Charcoal tray"] },
          { name: "Charcoal Professional", type: "Kettle / Cart", fuelType: "Charcoal", tempRange: "300°F – 700°F", cookingSurface: "510 sq in", features: ["Cast-iron grates", "Adjustable charcoal tray", "Side prep tables"] },
        ],
      },
      {
        brand: "PK Grills",
        logoUrl: undefined,
        models: [
          { name: "PK300", type: "Charcoal Grill", fuelType: "Charcoal", tempRange: "200°F – 600°F", cookingSurface: "300 sq in", features: ["Aluminum construction", "Four-point ventilation", "Direct + indirect zones"] },
          { name: "PK360", type: "Charcoal Grill", fuelType: "Charcoal", tempRange: "200°F – 600°F", cookingSurface: "360 sq in", features: ["Aluminum construction", "GrillGrates included", "Hinged lid"] },
          { name: "PK Original", type: "Charcoal Grill", fuelType: "Charcoal", tempRange: "200°F – 600°F", cookingSurface: "250 sq in", features: ["Cast aluminum", "Four-vent system", "Durable for decades"] },
          { name: "PK TX", type: "Charcoal Grill", fuelType: "Charcoal", tempRange: "200°F – 600°F", cookingSurface: "310 sq in", features: ["Texas edition", "Cast aluminum", "Heavy stainless cart"] },
        ],
      },
      {
        brand: "SnS Grills",
        logoUrl: undefined,
        models: [
          { name: "Slow 'N Sear Kettle 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "363 sq in", features: ["Built-in two-zone water reservoir", "EasySpin hinged grate", "Lifetime grate warranty"], notes: "Engineered specifically for two-zone cooking" },
          { name: "Slow 'N Sear Deluxe Kettle", type: "Kettle", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "363 sq in", features: ["Premium thermometer", "All accessories included", "Two-zone design"] },
        ],
      },
      {
        brand: "Char-Broil",
        logoUrl: "https://logo.clearbit.com/charbroil.com",
        models: [
          { name: "Kettleman", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "365 sq in", features: ["Damper-free design", "TRU-Infrared cooking grates", "Heat-resistant handle"] },
          { name: "Kettleman TRU-Infrared XL", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "510 sq in", features: ["TRU-Infrared", "Larger capacity", "Hinged lid"] },
        ],
      },
    ],
  },

  {
    category: "Cabinet / Vertical Smokers",
    icon: "box",
    brands: [
      {
        brand: "Masterbuilt",
        logoUrl: "https://logo.clearbit.com/masterbuilt.com",
        models: [
          { name: "30\" Bluetooth Smoker", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "730 sq in", features: ["Bluetooth control", "4 chrome-coated racks", "Patented side wood chip loader"] },
          { name: "40\" Bluetooth Smoker", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "970 sq in", features: ["Bluetooth", "Side wood chip loader", "Integrated thermostat"] },
          { name: "Gravity Series 560", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "560 sq in", features: ["Gravity-fed charcoal", "Digital charcoal controller", "Fan-forced convection"] },
          { name: "Gravity Series 800", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "800 sq in", features: ["Gravity-fed charcoal", "WiFi+BT", "Digital controller"] },
          { name: "Gravity Series 1050", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "1050 sq in", features: ["Largest Gravity", "WiFi+BT", "Charcoal hopper with chute"] },
          { name: "Gravity Series XT 1050", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "1050 sq in", features: ["WiFi+BT", "Digital controller", "Folding front shelf"] },
          { name: "Pro Series Vertical Charcoal", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 350°F", cookingSurface: "832 sq in", features: ["Heavy-duty cooking grates", "Side wood-chip access door", "Built-in temp gauge"] },
        ],
      },
      {
        brand: "Smokin-It",
        logoUrl: "https://logo.clearbit.com/smokin-it.com",
        models: [
          { name: "Model 1", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "224 sq in", features: ["Stainless steel", "Fully insulated", "Made in USA"] },
          { name: "Model 2", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "448 sq in", features: ["Stainless steel", "Insulated", "Made in USA"] },
          { name: "Model 3", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "672 sq in", features: ["Stainless steel", "Insulated", "Heavy-duty casters"] },
          { name: "Model 4", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "1232 sq in", features: ["Restaurant-grade", "Insulated stainless", "Auber PID upgrade ready"] },
        ],
      },
      {
        brand: "Bradley Smoker",
        logoUrl: "https://logo.clearbit.com/bradleysmoker.com",
        models: [
          { name: "Original 4-Rack", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 320°F", cookingSurface: "516 sq in", features: ["Automatic bisquette feeder", "4 racks", "Cold smoke capable"] },
          { name: "Digital 4-Rack", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 320°F", cookingSurface: "516 sq in", features: ["Digital timer", "Automatic bisquette feeder", "Precise temp control"] },
          { name: "Digital 6-Rack", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 320°F", cookingSurface: "858 sq in", features: ["6 racks", "Digital controls", "Smoke generator"] },
        ],
      },
      {
        brand: "Pit Boss",
        logoUrl: "https://logo.clearbit.com/pitboss-grills.com",
        models: [
          { name: "5-Series Wood Pellet Vertical", type: "Cabinet Smoker", fuelType: "Pellets", tempRange: "150°F – 450°F", cookingSurface: "1657 sq in", features: ["5 cooking racks", "Digital control board", "Meat probe included"] },
          { name: "7-Series Wood Pellet Vertical", type: "Cabinet Smoker", fuelType: "Pellets", tempRange: "150°F – 450°F", cookingSurface: "2196 sq in", features: ["7 cooking racks", "Side stainless shelf", "Two meat probes"] },
        ],
      },
      {
        brand: "Dyna-Glo",
        logoUrl: undefined,
        models: [
          { name: "Signature Series Vertical Charcoal", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "200°F – 400°F", cookingSurface: "1382 sq in", features: ["Side door for fuel access", "5 chrome racks", "Steel construction"] },
          { name: "Wide Body LP Gas Smoker", type: "Cabinet Smoker", fuelType: "Gas", tempRange: "150°F – 450°F", cookingSurface: "1235 sq in", features: ["15,000 BTU burner", "4 cooking grates", "Porcelain-enameled steel"] },
          { name: "Vertical Offset Charcoal", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "200°F – 400°F", cookingSurface: "784 sq in", features: ["Offset firebox", "Cool-touch handles", "Steel body"] },
        ],
      },
      {
        brand: "Smoke Hollow",
        logoUrl: undefined,
        models: [
          { name: "44241G2 Propane", type: "Cabinet Smoker", fuelType: "Gas", tempRange: "150°F – 350°F", cookingSurface: "3.4 cu ft", features: ["Three doors", "20,000 BTU", "Push-button ignition"] },
          { name: "Pro Series 44\" Vertical", type: "Cabinet Smoker", fuelType: "Combination", tempRange: "150°F – 400°F", cookingSurface: "1265 sq in", features: ["Charcoal + propane", "4 cooking grates", "Heavy steel"] },
        ],
      },
      {
        brand: "Cuisinart",
        logoUrl: "https://logo.clearbit.com/cuisinart.com",
        models: [
          { name: "30\" Vertical Propane Smoker", type: "Cabinet Smoker", fuelType: "Gas", tempRange: "150°F – 400°F", cookingSurface: "784 sq in", features: ["Twist-lock door", "Steel body", "Dual probes"] },
          { name: "36\" Vertical Charcoal Smoker", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "150°F – 400°F", cookingSurface: "784 sq in", features: ["Front access charcoal door", "4 chrome grates", "Built-in thermometer"] },
        ],
      },
      {
        brand: "Cookshack",
        logoUrl: "https://logo.clearbit.com/cookshack.com",
        models: [
          { name: "Smokette SM025", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "140°F – 300°F", cookingSurface: "525 sq in", features: ["Stainless steel", "Set-and-forget", "Made in USA"], notes: "Bullet-proof restaurant-grade home smoker" },
          { name: "Smokette Elite SM025", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "140°F – 300°F", cookingSurface: "525 sq in", features: ["Digital controller", "Cold-smoke capable", "Stainless steel body"] },
          { name: "Amerique SM066", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "140°F – 300°F", cookingSurface: "780 sq in", features: ["Programmable controller", "5 cooking grates", "Made in USA"] },
        ],
      },
    ],
  },

  {
    category: "Gas Grills",
    icon: "thermometer",
    brands: [
      {
        brand: "Weber",
        logoUrl: "https://logo.clearbit.com/weber.com",
        models: [
          { name: "Spirit II E-210", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "360 sq in", features: ["2 burners", "iGrill 3 compatible", "GBS cooking grate"] },
          { name: "Spirit II E-310", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "529 sq in", features: ["3 burners", "Side burner", "GBS grate"] },
          { name: "Spirit SX-315 Smart", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "529 sq in", features: ["3 burners", "Weber Connect smart hub", "Sear station"] },
          { name: "Genesis II E-310", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "646 sq in", features: ["3 burners", "GBS grate", "Snap-jet ignition"] },
          { name: "Genesis II E-410", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "646 sq in", features: ["4 burners", "Side burner", "GBS grate"] },
          { name: "Genesis II S-435", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "646 sq in", features: ["4 burners", "Sear station", "Stainless steel lid"] },
          { name: "Genesis SX-435 Smart", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "787 sq in", features: ["4 burners + sear", "Side burner", "Weber Connect smart hub"] },
          { name: "Summit S-470", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "580 sq in", features: ["4 burners + sear", "Built-in smoker box", "Side burner"] },
          { name: "Summit S-670", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "769 sq in", features: ["6 burners", "Infrared rotisserie", "Smoker box"] },
          { name: "Q 1200 Portable", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "189 sq in", features: ["Portable", "1-pound LP", "Cast aluminum lid"] },
          { name: "Q 2200 Portable", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "280 sq in", features: ["Portable", "Single burner", "Folding side tables"] },
        ],
      },
      {
        brand: "Napoleon",
        logoUrl: "https://logo.clearbit.com/napoleongrills.com",
        models: [
          { name: "Rogue SE 425", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "425 sq in", features: ["Accu-Probe thermometer", "Iconic wave grates", "JETFIRE ignition"] },
          { name: "Rogue 525", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "760 sq in", features: ["4 burners", "Infrared side burner", "Wave grates"] },
          { name: "Prestige 500", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 650°F", cookingSurface: "760 sq in", features: ["4 burners", "NIGHT LIGHT grill grates", "Rear infrared"] },
          { name: "Prestige Pro 500", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "760 sq in", features: ["4 burners", "Infrared side + rear", "Stainless steel"] },
          { name: "Prestige Pro 825", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "1300 sq in", features: ["8 burners", "Infrared side burner", "Power side burner"] },
          { name: "Phantom P500", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "760 sq in", features: ["Matte black", "4 burners", "Infrared rear burner"] },
          { name: "TravelQ 285X", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "285 sq in", features: ["Portable", "12,000 BTU twin burners", "Folding stand"] },
        ],
      },
      {
        brand: "Char-Broil",
        logoUrl: "https://logo.clearbit.com/charbroil.com",
        models: [
          { name: "Performance 4-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "425 sq in", features: ["4 burners", "Porcelain-coated grates", "Side burner"] },
          { name: "Signature Series 4-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "550 sq in", features: ["4 burners", "TRU-Infrared", "Side burner"] },
          { name: "Performance Power Edition 5-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "650 sq in", features: ["5 burners", "Sear station", "Side burner"] },
          { name: "Commercial 6-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "750 sq in", features: ["6 burners", "Stainless lid", "Side burner"] },
        ],
      },
      {
        brand: "Bull Outdoor Products",
        logoUrl: undefined,
        models: [
          { name: "Steer 3-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "443 sq in", features: ["3 burners", "Stainless steel", "Built-in or freestanding"] },
          { name: "Angus 4-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "760 sq in", features: ["4 stainless burners", "Infrared back burner", "Heavy-duty grates"] },
          { name: "Brahma 5-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "810 sq in", features: ["5 burners", "Smoker tray", "Rear infrared"] },
          { name: "Outlaw 4-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "810 sq in", features: ["4 burners", "Built-in compatible", "Stainless construction"] },
        ],
      },
      {
        brand: "Lynx",
        logoUrl: undefined,
        models: [
          { name: "Professional 30\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "840 sq in", features: ["ProSear burner", "Ceramic briquettes", "Hot surface ignition"], notes: "Premium American-made gas grill" },
          { name: "Professional 36\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "935 sq in", features: ["3 burners", "ProSear burner", "Halogen interior light"] },
          { name: "Sedona 36\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "891 sq in", features: ["3 burners", "Ceramic briquettes", "Built-in design"] },
        ],
      },
      {
        brand: "DCS",
        logoUrl: undefined,
        models: [
          { name: "Series 9 36\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "871 sq in", features: ["3 burners", "Grease management system", "Stainless construction"], notes: "Premium built-in grill" },
          { name: "Series 9 48\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "1153 sq in", features: ["4 burners", "Rotisserie burner", "Smoker tray"] },
        ],
      },
      {
        brand: "Blaze",
        logoUrl: "https://logo.clearbit.com/blazegrills.com",
        models: [
          { name: "Premium LTE 32\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "726 sq in", features: ["4 burners", "Interior LED lights", "Lifetime warranty"] },
          { name: "Premium LTE 40\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "810 sq in", features: ["5 burners", "Stainless rod cooking grates", "Push-button ignition"] },
          { name: "Professional LUX 34\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 800°F", cookingSurface: "875 sq in", features: ["3 commercial-grade burners", "Heat-zone separators", "Lifetime warranty"] },
        ],
      },
      {
        brand: "Coyote",
        logoUrl: undefined,
        models: [
          { name: "C-Series 28\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "529 sq in", features: ["2 burners", "Ceramic radiant tray", "Stainless steel"] },
          { name: "C-Series 36\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "751 sq in", features: ["3 burners", "Infinity burners", "Built-in compatible"] },
          { name: "S-Series 36\"", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "751 sq in", features: ["3 burners", "Infrared sear", "Cast brass burners"] },
        ],
      },
      {
        brand: "Broil King",
        logoUrl: "https://logo.clearbit.com/broilkingbbq.com",
        models: [
          { name: "Regal S 490 Pro", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "625 sq in", features: ["4 stainless Dual-Tube burners", "Side burner", "Side rotisserie burner"] },
          { name: "Baron 590 Pro", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "625 sq in", features: ["5 burners", "Side burner", "Reversible cast iron grates"] },
          { name: "Imperial XL S 690 Pro", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "875 sq in", features: ["6 burners", "Rear rotisserie burner", "Heavy-duty stainless grates"] },
          { name: "Crown 410", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "440 sq in", features: ["4 burners", "Side burner", "Cast iron grates"] },
        ],
      },
      {
        brand: "Saber",
        logoUrl: undefined,
        models: [
          { name: "R50CC0317 3-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "500 sq in", features: ["Infrared cooking system", "Stainless steel grates", "Patented zone separators"] },
          { name: "Cast Black 670", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "670 sq in", features: ["4 burners", "Patented infrared system", "Cast iron grates"] },
        ],
      },
      {
        brand: "Monument",
        logoUrl: undefined,
        models: [
          { name: "Mesa 415BZ", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "545 sq in", features: ["4 burners", "Side burner", "Push-button ignition"] },
          { name: "Mesa 605BZS", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "748 sq in", features: ["6 stainless burners", "Sear burner", "Foldable side shelves"] },
        ],
      },
    ],
  },

  {
    category: "Reverse Flow Smokers",
    icon: "shuffle",
    brands: [
      {
        brand: "Meadow Creek",
        logoUrl: "https://logo.clearbit.com/meadowcreekbarbecue.com",
        models: [
          { name: "BBQ42", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "672 sq in", features: ["True reverse flow", "Slide-out charcoal tray", "Grease drain"] },
          { name: "SQ36", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "900 sq in", features: ["Square box reverse flow", "Charcoal pan", "Competition grade"] },
          { name: "TS70", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "1500 sq in", features: ["Trailer-mountable", "Reverse flow", "Heavy steel"] },
          { name: "TS250", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "2500 sq in", features: ["Trailer mounted", "True reverse flow", "Massive capacity"] },
        ],
      },
      {
        brand: "Char-Griller",
        logoUrl: "https://logo.clearbit.com/chargriller.com",
        models: [
          { name: "Grand Champ XD", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1260 sq in", features: ["Reverse flow baffle", "Barrel design", "Side firebox"] },
          { name: "Smokin' Pro 1224", type: "Offset Smoker", fuelType: "Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1260 sq in", features: ["Side firebox", "Adjustable dampers", "Charcoal tray"] },
          { name: "Competition Pro Offset", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "830 sq in", features: ["Reverse flow plates", "Side firebox", "Wagon wheels"] },
        ],
      },
      {
        brand: "Lone Star Grillz",
        logoUrl: undefined,
        models: [
          { name: "20\" x 42\"", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "840 sq in", features: ["1/4\" steel", "True reverse flow", "Custom-built to order"] },
          { name: "24\" x 48\"", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1152 sq in", features: ["1/4\" steel", "True reverse flow", "Large capacity"] },
          { name: "24\" Insulated Cabinet", type: "Cabinet Smoker", fuelType: "Wood/Charcoal", tempRange: "150°F – 400°F", cookingSurface: "1248 sq in", features: ["Insulated reverse flow cabinet", "Heavy steel", "Made in Texas"], notes: "Backyard king for set-and-forget overnight cooks" },
        ],
      },
      {
        brand: "Workhorse Pits",
        logoUrl: "https://logo.clearbit.com/workhorsepits.com",
        models: [
          { name: "1957 Reverse Flow", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1100 sq in", features: ["True reverse flow plates", "Counterweight lid", "1/4\" steel"], notes: "Reverse flow version of the 1969 stick burner" },
        ],
      },
      {
        brand: "Shirley Fabrication",
        logoUrl: undefined,
        models: [
          { name: "24\" x 50\" Patio Smoker", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1200 sq in", features: ["1/4\" American steel", "Custom Alabama-built", "Counterweight lid"], notes: "Highly regarded competition smoker" },
          { name: "32\" x 60\" Trailer Smoker", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1900 sq in", features: ["Trailer mounted", "Heavy steel build", "Hand-built"] },
        ],
      },
    ],
  },

  {
    category: "Electric Smokers",
    icon: "cpu",
    brands: [
      {
        brand: "Masterbuilt",
        logoUrl: "https://logo.clearbit.com/masterbuilt.com",
        models: [
          { name: "30\" Digital Electric", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "730 sq in", features: ["Digital controls", "Patented side chip loader", "Blue LED display"] },
          { name: "40\" Digital Electric", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "970 sq in", features: ["Digital panel", "Side chip loader", "Remote control"] },
          { name: "30\" Analog Electric", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "548 sq in", features: ["Analog dial", "3 chrome racks", "Side wood-chip access"] },
        ],
      },
      {
        brand: "Char-Broil",
        logoUrl: "https://logo.clearbit.com/charbroil.com",
        models: [
          { name: "Deluxe Digital Electric", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "725 sq in", features: ["Digital panel", "4 chrome grates", "Insulated double-wall"] },
          { name: "Analog Electric Smoker", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "544 sq in", features: ["Analog dial controls", "3 chrome grates", "Water pan included"] },
          { name: "Big Easy Smoker, Roaster & Grill", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 425°F", cookingSurface: "180 sq in", features: ["TRU-Infrared cooking", "Smoker box", "Compact"] },
        ],
      },
      {
        brand: "Smokin Tex",
        logoUrl: undefined,
        models: [
          { name: "Pro 1400", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "504 sq in", features: ["Stainless construction", "Fully insulated", "Restaurant quality"] },
          { name: "Pro 1500", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "700 sq in", features: ["Stainless", "Insulated", "Commercial-grade"] },
        ],
      },
      {
        brand: "Cuisinart",
        logoUrl: "https://logo.clearbit.com/cuisinart.com",
        models: [
          { name: "COS-330 Vertical Electric", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 400°F", cookingSurface: "548 sq in", features: ["1500W heating element", "3 chrome racks", "Wood chip + water pans"] },
          { name: "COS-244 Vertical Propane Smoker", type: "Cabinet Smoker", fuelType: "Gas", tempRange: "100°F – 400°F", cookingSurface: "784 sq in", features: ["Propane fueled", "Twist-lock door", "Steel body"] },
        ],
      },
      {
        brand: "Old Smokey",
        logoUrl: undefined,
        models: [
          { name: "Electric Smoker", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "270 sq in", features: ["Aluminized steel", "Flat-top design", "1250W element"], notes: "Classic Texas-style backyard electric smoker" },
        ],
      },
      {
        brand: "Pit Boss",
        logoUrl: "https://logo.clearbit.com/pitboss-grills.com",
        models: [
          { name: "Analog Electric Vertical Smoker", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 325°F", cookingSurface: "684 sq in", features: ["Analog dial", "Front view window", "1500W element"] },
        ],
      },
      {
        brand: "Bradley Smoker",
        logoUrl: "https://logo.clearbit.com/bradleysmoker.com",
        models: [
          { name: "P10 Professional Smoker", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 320°F", cookingSurface: "858 sq in", features: ["Industrial PID controller", "10 stainless racks", "Auto bisquette feeder"] },
        ],
      },
    ],
  },
];
