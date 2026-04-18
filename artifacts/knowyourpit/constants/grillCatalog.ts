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
        ],
      },
      {
        brand: "Pit Boss",
        models: [
          { name: "340", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "340 sq in", features: ["Flame broiler", "8-in-1 cooking", "LED digital readout"] },
          { name: "700FB", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "700 sq in", features: ["Flame broiler lever", "8-in-1 cooking", "Dial-in digital control"] },
          { name: "820 Deluxe", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "820 sq in", features: ["Flame broiler", "Porcelain-coated grates", "Digital control board"] },
          { name: "Austin XL", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1000 sq in", features: ["Flame broiler", "Large hopper", "PID controller"] },
          { name: "Pro Series 1100", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "1100 sq in", features: ["Flame broiler", "Meat probe", "Porcelain-coated grates"] },
          { name: "Navigator 850G", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 500°F", cookingSurface: "850 sq in", features: ["PID controller", "Slide-plate flame broiler", "Wifi capable"] },
          { name: "Platinum Lockhart", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 420°F", cookingSurface: "2136 sq in", features: ["Combo smoker/grill", "Upper smoke cabinet", "Dual zone cooking"] },
        ],
      },
      {
        brand: "Green Mountain Grills",
        models: [
          { name: "Davy Crockett", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "219 sq in", features: ["Portable/foldable legs", "WiFi enabled", "USB charging port"], notes: "Peak portable pellet grill" },
          { name: "Jim Bowie", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "658 sq in", features: ["WiFi", "Open-box grease tray", "Meat probe"] },
          { name: "Jim Bowie Prime+", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "658 sq in", features: ["WiFi", "PID controller", "Rotisserie ready"] },
          { name: "Peak", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "469 sq in", features: ["WiFi enabled", "Thermal sensor", "Modular design"] },
          { name: "Ledge Prime+", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 550°F", cookingSurface: "762 sq in", features: ["WiFi", "PID controller", "Stainless steel"] },
        ],
      },
      {
        brand: "Camp Chef",
        models: [
          { name: "SmokePro 24", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "429 sq in", features: ["Smart Smoke technology", "Ash cleanout system", "Dial-in temp control"] },
          { name: "Woodwind 24", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "811 sq in", features: ["SideKick ready", "WIFI & Bluetooth", "Smoke Control™ 0-10"] },
          { name: "Woodwind 36", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "1236 sq in", features: ["SideKick ready", "WIFI & Bluetooth", "Smoke levels 1-10"] },
          { name: "Woodwind Pro 36", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "1236 sq in", features: ["Smoke Box", "Propane SideKick", "WiFi+BT", "PID controller"] },
          { name: "Pursuit 20", type: "Pellet Grill", fuelType: "Pellets", tempRange: "160°F – 500°F", cookingSurface: "361 sq in", features: ["Portable", "Ash cleanout", "WiFi+BT"] },
        ],
      },
      {
        brand: "Weber",
        models: [
          { name: "SmokeFire EX4", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 600°F", cookingSurface: "672 sq in", features: ["Weber Connect", "Flavorizer bars", "Sear Zone"] },
          { name: "SmokeFire EX6", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 600°F", cookingSurface: "1008 sq in", features: ["Weber Connect", "Flavorizer bars", "6 meat probes"] },
          { name: "SmokeFire STEALTH EX4", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 600°F", cookingSurface: "672 sq in", features: ["Matte black finish", "Weber Connect", "Sear station"] },
          { name: "SmokeFire EPX4", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 600°F", cookingSurface: "672 sq in", features: ["Weber Connect", "DC fan system", "CRAFTED accessory ready"] },
        ],
      },
      {
        brand: "Rec Tec (RecTeq)",
        models: [
          { name: "RT-300 Patio Legend", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 500°F", cookingSurface: "300 sq in", features: ["Smart grill technology", "WiFi", "Stainless steel"] },
          { name: "RT-590 Stampede", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 500°F", cookingSurface: "592 sq in", features: ["Smart grill technology", "WiFi", "304 stainless grates"] },
          { name: "RT-700 Flagship", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 500°F", cookingSurface: "702 sq in", features: ["Smart grill technology", "WiFi", "Stainless steel bull horn handles"] },
          { name: "RT-1250 Backyard Beast", type: "Pellet Grill", fuelType: "Pellets", tempRange: "200°F – 500°F", cookingSurface: "1254 sq in", features: ["Smart grill technology", "WiFi", "Largest RecTeq pellet grill"] },
        ],
      },
      {
        brand: "Yoder Smokers",
        models: [
          { name: "YS480S", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 600°F", cookingSurface: "480 sq in", features: ["Heavy-gauge steel", "Competition-grade", "ACS controller"] },
          { name: "YS640S", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 600°F", cookingSurface: "640 sq in", features: ["Heavy-gauge steel", "ACS controller", "Direct flame insert"] },
          { name: "YS1500S", type: "Pellet Grill", fuelType: "Pellets", tempRange: "150°F – 600°F", cookingSurface: "1500 sq in", features: ["Competition grade", "ACS controller", "High-performance fans"] },
        ],
      },
      {
        brand: "Louisiana Grills",
        models: [
          { name: "Founders Legacy 800", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "800 sq in", features: ["Flame broiler", "Digital control", "10 lb hopper"] },
          { name: "Champions Edition 7.0", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "1313 sq in", features: ["Flame broiler", "WiFi", "Stainless steel"] },
          { name: "Black Label 1000", type: "Pellet Grill", fuelType: "Pellets", tempRange: "180°F – 600°F", cookingSurface: "1061 sq in", features: ["Flame broiler", "WiFi enabled", "PID controller"] },
        ],
      },
      {
        brand: "Spider Grills",
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
    ],
  },

  {
    category: "Kamado / Ceramic",
    icon: "circle",
    brands: [
      {
        brand: "Big Green Egg",
        models: [
          { name: "Mini", type: "Kamado", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "79 sq in", features: ["Ultra-portable", "Ceramic insulation", "Lifetime warranty on ceramics"] },
          { name: "MiniMax", type: "Kamado", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "133 sq in", features: ["Portable with handles", "Full accessories range", "Stainless steel grate"] },
          { name: "Small", type: "Kamado", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "133 sq in", features: ["Compact backyard size", "Full system", "Lifetime ceramics warranty"] },
          { name: "Medium", type: "Kamado", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "177 sq in", features: ["Nest optional", "EGGspander compatible", "Dual-function metal top"] },
          { name: "Large", type: "Kamado", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "262 sq in", features: ["Most popular size", "EGGspander compatible", "Wide temp range"], notes: "The benchmark kamado — handles everything" },
          { name: "XL", type: "Kamado", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "452 sq in", features: ["Feeds large crowds", "EGGspander compatible", "Dual-function metal top"] },
          { name: "2XL", type: "Kamado", fuelType: "Charcoal", tempRange: "250°F – 750°F", cookingSurface: "672 sq in", features: ["Restaurant-scale", "Holds 20 racks of ribs", "Competition proven"] },
        ],
      },
      {
        brand: "Kamado Joe",
        models: [
          { name: "Joe Jr.", type: "Kamado", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "148 sq in", features: ["Portable", "Air Lift hinge", "Cast iron grate"] },
          { name: "Classic I", type: "Kamado", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["Air Lift hinge", "Divide & Conquer rack", "Ash drawer"] },
          { name: "Classic II", type: "Kamado", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["Slide-out ash drawer", "Air Lift hinge", "Divide & Conquer"] },
          { name: "Classic III", type: "Kamado", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["SloRoller hyperbolic insert", "Air Lift hinge", "3-tier Divide & Conquer"] },
          { name: "Big Joe I", type: "Kamado", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "406 sq in", features: ["18\" cooking surface", "Air Lift hinge", "Divide & Conquer"] },
          { name: "Big Joe II", type: "Kamado", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "452 sq in", features: ["Slide-out ash drawer", "Kontrol Tower top vent", "Air Lift hinge"] },
          { name: "Big Joe III", type: "Kamado", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "452 sq in", features: ["SloRoller hyperbolic insert", "Air Lift hinge", "3-tier D&C"] },
          { name: "Konnected Joe", type: "Kamado", fuelType: "Charcoal", tempRange: "225°F – 750°F", cookingSurface: "256 sq in", features: ["Wifi + Bluetooth", "Auto fan control", "App connected"], notes: "World's first WiFi-enabled kamado" },
        ],
      },
      {
        brand: "Primo",
        models: [
          { name: "Oval Junior", type: "Kamado", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "210 sq in", features: ["Oval shape", "Multi-level cooking", "Made in USA"] },
          { name: "Oval 200", type: "Kamado", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "200 sq in", features: ["Oval shape", "Split grate", "US-made ceramics"] },
          { name: "Oval XL 400", type: "Kamado", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "400 sq in", features: ["Oval shape two-zone cooking", "Split grate", "Made in USA"] },
          { name: "Oval XXL 680", type: "Kamado", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "680 sq in", features: ["Largest Primo", "Four-section grate", "Made in USA"] },
          { name: "Round", type: "Kamado", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "300 sq in", features: ["Traditional round", "Multi-level", "Lifetime ceramic warranty"] },
        ],
      },
      {
        brand: "Char-Griller",
        models: [
          { name: "Akorn Jr.", type: "Kamado", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "153 sq in", features: ["Triple-wall steel", "Portable", "Foldable legs"] },
          { name: "Akorn 6520", type: "Kamado", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "314 sq in", features: ["Triple-wall steel", "Locking lid", "EZ ash-dump"] },
          { name: "Akorn Auto-Kamado", type: "Kamado", fuelType: "Charcoal", tempRange: "200°F – 700°F", cookingSurface: "314 sq in", features: ["Auto temperature control", "Fan controller", "WiFi"] },
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
        models: [
          { name: "Highland 879 sq in", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "879 sq in", features: ["Multiple dampers", "Side firebox", "Charcoal basket included"] },
          { name: "Longhorn 1060 sq in", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1060 sq in", features: ["Heavy-gauge steel", "Side firebox", "Cool-touch handles"] },
          { name: "Rider 900", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "900 sq in", features: ["Slide-and-Grill tech", "Pre-seasoned grates", "Patented fuel access"] },
          { name: "Bandera", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "619 sq in", features: ["Vertical barrel style", "5 cooking grates", "Side firebox"] },
          { name: "Judge", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "900 sq in", features: ["Competition grade", "Heavy steel", "Multiple dampers"] },
        ],
      },
      {
        brand: "Yoder Smokers",
        models: [
          { name: "Wichita", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "630 sq in", features: ["1/4\" steel", "Competition proven", "Removable shelves"], notes: "Classic American competition smoker" },
          { name: "Loaded Wichita", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1030 sq in", features: ["1/4\" steel", "Charcoal chute", "Competition proven"] },
          { name: "Kingman", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1600 sq in", features: ["1/4\" steel", "Larger capacity", "Slide-out grates"] },
          { name: "Cheyenne", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "370 sq in", features: ["Compact offset", "Heavy-duty", "Rust-resistant paint"] },
        ],
      },
      {
        brand: "Lang BBQ Smokers",
        models: [
          { name: "36\" Original", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "576 sq in", features: ["Reverse flow design", "Drip pan drain", "Charcoal basket"] },
          { name: "48\" Original", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "864 sq in", features: ["Reverse flow", "Adjustable grates", "Stainless hardware"] },
          { name: "60\" Patio", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "1170 sq in", features: ["Reverse flow", "Optional warming box", "Wagon wheels"] },
          { name: "84\" Original Deluxe", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "1800 sq in", features: ["Reverse flow", "Built-in thermometers", "Large capacity"] },
        ],
      },
      {
        brand: "Old Country BBQ Pits",
        models: [
          { name: "Pecos", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "751 sq in", features: ["1/4\" steel", "Competition grade", "Charcoal basket"] },
          { name: "Wrangler", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1122 sq in", features: ["Heavy steel", "Reverse flow baffles", "Large firebox"] },
          { name: "Brazos", type: "Offset Smoker", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1369 sq in", features: ["1/4\" thick steel", "Largest in lineup", "Hinged lid"] },
        ],
      },
      {
        brand: "Horizon Smokers",
        models: [
          { name: "16\" Classic", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "452 sq in", features: ["3/16\" steel", "Handcrafted in Oklahoma", "Lifetime warranty"] },
          { name: "20\" Classic", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "710 sq in", features: ["3/16\" steel", "Handcrafted", "Competition quality"] },
          { name: "Marshal", type: "Offset Smoker", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "900 sq in", features: ["Heavy-duty steel", "Baffled firebox", "Handmade"] },
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
        models: [
          { name: "Original Kettle 18\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "240 sq in", features: ["Rust-resistant bowl", "One-touch cleaning", "Hinged cooking grate"] },
          { name: "Original Kettle 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["Rust-resistant bowl", "One-touch cleaning", "Premium size"], notes: "The world's most iconic grill" },
          { name: "Performer Deluxe 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["Built-in thermometer", "Gas ignition", "Side prep table"] },
          { name: "Master-Touch 22\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "363 sq in", features: ["GBS cooking grate", "Hinged charcoal grate", "Tuck-away lid hinge"] },
          { name: "Master-Touch 26\"", type: "Kettle", fuelType: "Charcoal", tempRange: "300°F – 600°F", cookingSurface: "508 sq in", features: ["Largest kettle", "GBS grate", "Charcoal chamber"] },
          { name: "Summit Charcoal 24\"", type: "Kettle", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "452 sq in", features: ["Insulated lid", "Snap-jet ignition", "Kamado-style performance"] },
        ],
      },
      {
        brand: "Pit Barrel Cooker",
        models: [
          { name: "Pit Barrel Cooker Classic", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "225°F – 300°F", cookingSurface: "Drum", features: ["Hang hooks + grill grate", "Self-regulating airflow", "Unique UDS design"], notes: "Award-winning drum smoker/cooker" },
          { name: "Pit Barrel Junior", type: "Drum Smoker", fuelType: "Charcoal", tempRange: "225°F – 300°F", cookingSurface: "Drum (portable)", features: ["Portable size", "Hang hooks", "Same technology as Classic"] },
        ],
      },
      {
        brand: "PK Grills",
        models: [
          { name: "PK300", type: "Kettle", fuelType: "Charcoal", tempRange: "200°F – 600°F", cookingSurface: "300 sq in", features: ["Aluminum construction", "Four-point ventilation", "Direct + indirect zones"] },
          { name: "PK360", type: "Kettle", fuelType: "Charcoal", tempRange: "200°F – 600°F", cookingSurface: "360 sq in", features: ["Aluminum construction", "GrillGrates included", "Hinged lid"] },
          { name: "Original PK", type: "Kettle", fuelType: "Charcoal", tempRange: "200°F – 600°F", cookingSurface: "250 sq in", features: ["Cast aluminum", "Four-vent system", "Durable for decades"] },
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
        models: [
          { name: "30\" Bluetooth Smoker", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "730 sq in", features: ["Bluetooth control", "4 chrome-coated racks", "Patented side wood chip loader"] },
          { name: "40\" Bluetooth Smoker", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "970 sq in", features: ["Bluetooth", "Side wood chip loader", "Integrated thermostat"] },
          { name: "Gravity Series 560", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "560 sq in", features: ["Gravity-fed charcoal", "Digital charcoal controller", "Fan-forced convection"] },
          { name: "Gravity Series 800", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "800 sq in", features: ["Gravity-fed charcoal", "WiFi+BT", "Digital controller"] },
          { name: "Gravity Series 1050", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "1050 sq in", features: ["Largest Gravity", "WiFi+BT", "Charcoal hopper with chute"] },
          { name: "Gravity Series XT 1050", type: "Cabinet Smoker", fuelType: "Charcoal", tempRange: "225°F – 700°F", cookingSurface: "1050 sq in", features: ["WiFi+BT", "Digital controller", "Folding front shelf"] },
        ],
      },
      {
        brand: "Smokin-It",
        models: [
          { name: "Model 1", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "224 sq in", features: ["Stainless steel", "Fully insulated", "Made in USA"] },
          { name: "Model 2", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "448 sq in", features: ["Stainless steel", "Insulated", "Made in USA"] },
          { name: "Model 3", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "672 sq in", features: ["Stainless steel", "Insulated", "Heavy-duty casters"] },
        ],
      },
      {
        brand: "Bradley Smoker",
        models: [
          { name: "Original 4-Rack", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 320°F", cookingSurface: "516 sq in", features: ["Automatic bisquette feeder", "4 racks", "Cold smoke capable"] },
          { name: "Digital 4-Rack", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 320°F", cookingSurface: "516 sq in", features: ["Digital timer", "Automatic bisquette feeder", "Precise temp control"] },
          { name: "Digital 6-Rack", type: "Cabinet Smoker", fuelType: "Electric", tempRange: "100°F – 320°F", cookingSurface: "858 sq in", features: ["6 racks", "Digital controls", "Smoke generator"] },
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
        models: [
          { name: "Spirit II E-210", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "360 sq in", features: ["2 burners", "iGrill 3 compatible", "GBS cooking grate"] },
          { name: "Spirit II E-310", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "529 sq in", features: ["3 burners", "Side burner", "GBS grate"] },
          { name: "Genesis II E-310", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "646 sq in", features: ["3 burners", "GBS grate", "Snap-jet ignition"] },
          { name: "Genesis II E-410", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "646 sq in", features: ["4 burners", "Side burner", "GBS grate"] },
          { name: "Genesis II S-435", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "646 sq in", features: ["4 burners", "Sear station", "Stainless steel lid"] },
          { name: "Summit S-470", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "580 sq in", features: ["4 burners + sear", "Built-in smoker box", "Side burner"] },
          { name: "Summit S-670", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "769 sq in", features: ["6 burners", "Infrared rotisserie", "Smoker box"] },
        ],
      },
      {
        brand: "Napoleon",
        models: [
          { name: "Rogue SE 425", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 600°F", cookingSurface: "425 sq in", features: ["Accu-Probe thermometer", "Iconic wave grates", "JETFIRE ignition"] },
          { name: "Prestige 500", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 650°F", cookingSurface: "760 sq in", features: ["4 burners", "NIGHT LIGHT grill grates", "Rear infrared"] },
          { name: "Prestige Pro 500", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "760 sq in", features: ["4 burners", "Infrared side + rear", "Stainless steel"] },
          { name: "Phantom P500", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 700°F", cookingSurface: "760 sq in", features: ["Matte black", "4 burners", "Infrared rear burner"] },
        ],
      },
      {
        brand: "Char-Broil",
        models: [
          { name: "Performance 4-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "425 sq in", features: ["4 burners", "Porcelain-coated grates", "Side burner"] },
          { name: "Signature Series 4-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "550 sq in", features: ["4 burners", "TRU-Infrared", "Side burner"] },
          { name: "Commercial 6-Burner", type: "Gas Grill", fuelType: "Gas", tempRange: "300°F – 550°F", cookingSurface: "750 sq in", features: ["6 burners", "Stainless lid", "Side burner"] },
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
        models: [
          { name: "BBQ42", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "672 sq in", features: ["True reverse flow", "Slide-out charcoal tray", "Grease drain"] },
          { name: "SQ36", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "900 sq in", features: ["Square box reverse flow", "Charcoal pan", "Competition grade"] },
          { name: "TS250", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 300°F", cookingSurface: "2500 sq in", features: ["Trailer mounted", "True reverse flow", "Massive capacity"] },
        ],
      },
      {
        brand: "Char-Griller",
        models: [
          { name: "Grand Champ XD", type: "Reverse Flow", fuelType: "Wood/Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1260 sq in", features: ["Reverse flow baffle", "Barrel design", "Side firebox"] },
          { name: "Smokin' Pro 1224", type: "Offset Smoker", fuelType: "Charcoal", tempRange: "200°F – 350°F", cookingSurface: "1260 sq in", features: ["Side firebox", "Adjustable dampers", "Charcoal tray"] },
        ],
      },
      {
        brand: "Lone Star Grillz",
        models: [
          { name: "20\" x 42\"", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "840 sq in", features: ["1/4\" steel", "True reverse flow", "Custom-built to order"] },
          { name: "24\" x 48\"", type: "Reverse Flow", fuelType: "Wood", tempRange: "200°F – 350°F", cookingSurface: "1152 sq in", features: ["1/4\" steel", "True reverse flow", "Large capacity"] },
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
        models: [
          { name: "30\" Digital Electric", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "730 sq in", features: ["Digital controls", "Patented side chip loader", "Blue LED display"] },
          { name: "40\" Digital Electric", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "970 sq in", features: ["Digital panel", "Side chip loader", "Remote control"] },
        ],
      },
      {
        brand: "Char-Broil",
        models: [
          { name: "Deluxe Digital Electric", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "725 sq in", features: ["Digital panel", "4 chrome grates", "Insulated double-wall"] },
          { name: "Analog Electric Smoker", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 275°F", cookingSurface: "544 sq in", features: ["Analog dial controls", "3 chrome grates", "Water pan included"] },
        ],
      },
      {
        brand: "Smokin Tex",
        models: [
          { name: "Pro 1400", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "504 sq in", features: ["Stainless construction", "Fully insulated", "Restaurant quality"] },
          { name: "Pro 1500", type: "Electric Smoker", fuelType: "Electric", tempRange: "100°F – 250°F", cookingSurface: "700 sq in", features: ["Stainless", "Insulated", "Commercial-grade"] },
        ],
      },
    ],
  },
];
