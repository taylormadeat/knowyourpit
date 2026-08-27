import type { ImageSourcePropType } from "react-native";

export const PARTNER_IDS = ["bigPetes", "barbecueLab"] as const;

export type PartnerId = (typeof PARTNER_IDS)[number];

type PartnerProduct = {
  name: string;
  tagline: string;
  desc: string;
  image: ImageSourcePropType;
  accent: string;
};

type PartnerDefinition = {
  id: PartnerId;
  brandName: string;
  accent: string;
  storeUrl: string;
  storeDomain: string;
  homeCta: string;
  planCta: string;
  footerNote: string;
  promoCode?: string;
  homeProductKeys: string[];
  products: Record<string, PartnerProduct>;
  categoryPairings: Record<string, string[]>;
  fallbackPairings: string[];
};

const bigPetesProducts: Record<string, PartnerProduct> = {
  steakNight: {
    name: "Steak Night",
    tagline: "For beef, brisket & burgers",
    desc: "Steak seasoning · date night just got better",
    image: require("@/assets/images/partners/bp-steak-night.png"),
    accent: "#E84820",
  },
  porken: {
    name: "PORKEN",
    tagline: "Competition pork & chicken rub",
    desc: "BBQ rub · your everyday meat rub",
    image: require("@/assets/images/partners/bp-porken.png"),
    accent: "#F97316",
  },
  sizzle: {
    name: "Sizzle",
    tagline: "Chipotle BBQ rub",
    desc: "PORKEN's sassy southwestern cousin",
    image: require("@/assets/images/partners/bp-sizzle.png"),
    accent: "#EF4444",
  },
  everydayTacos: {
    name: "Everyday Tacos",
    tagline: "Chicken, tacos & everything",
    desc: "Taco seasoning · making tacos easy",
    image: require("@/assets/images/partners/bp-everyday-tacos.png"),
    accent: "#84CC16",
  },
  cajunBlast: {
    name: "Cajun Blast",
    tagline: "Bold Cajun heat",
    desc: "Cajun seasoning · blast your food with flavor",
    image: require("@/assets/images/partners/bp-cajun-blast.png"),
    accent: "#EF4444",
  },
  highTide: {
    name: "High Tide",
    tagline: "For seafood",
    desc: "A fisherman's delight · seafood seasoning",
    image: require("@/assets/images/partners/bp-high-tide.png"),
    accent: "#22D3EE",
  },
};

const barbecueLabProducts: Record<string, PartnerProduct> = {
  essentialEquation: {
    name: "The Essential Equation",
    tagline: "Salt, pepper & garlic",
    desc: "A classic flavor punch for steak, brisket & anything.",
    image: require("@/assets/images/partners/bbl-essential-equation.jpg"),
    accent: "#18A7DE",
  },
  featheredFormula: {
    name: "The Feathered Formula",
    tagline: "For chicken & turkey",
    desc: "A savory, herb-forward blend for poultry on the grill.",
    image: require("@/assets/images/partners/bbl-feathered-formula.jpg"),
    accent: "#49A950",
  },
  porkProtocol: {
    name: "The Pork Protocol",
    tagline: "For pork & ribs",
    desc: "A bold BBQ blend with garlic, onion & paprika.",
    image: require("@/assets/images/partners/bbl-pork-protocol.jpg"),
    accent: "#3B87D7",
  },
  hotFeatheredFormula: {
    name: "Hot Feathered Formula",
    tagline: "For poultry with heat",
    desc: "All the flavor of Feathered Formula with a fiery kick.",
    image: require("@/assets/images/partners/bbl-hot-feathered-formula.jpg"),
    accent: "#D95046",
  },
};

export const PARTNERS: Record<PartnerId, PartnerDefinition> = {
  bigPetes: {
    id: "bigPetes",
    brandName: "Big Pete's Seasoning",
    accent: "#E84820",
    storeUrl: "https://bigpetesseasoning.com/store",
    storeDomain: "bigpetesseasoning.com",
    homeCta: "Use code KYP15 for 15% off →",
    planCta: "Shop Big Pete's →",
    footerNote: "15% off · bigpetesseasoning.com",
    promoCode: "KYP15",
    homeProductKeys: ["steakNight", "porken", "cajunBlast", "everydayTacos"],
    products: bigPetesProducts,
    categoryPairings: {
      seafood: ["highTide", "cajunBlast"],
      beef: ["steakNight", "sizzle", "cajunBlast"],
      pork: ["porken", "cajunBlast", "sizzle"],
      poultry: ["porken", "everydayTacos", "sizzle"],
      lamb: ["cajunBlast", "sizzle"],
      game: ["cajunBlast", "sizzle"],
    },
    fallbackPairings: ["sizzle", "everydayTacos", "cajunBlast"],
  },
  barbecueLab: {
    id: "barbecueLab",
    brandName: "The Barbecue Lab",
    accent: "#F97316",
    storeUrl: "https://shop.thebarbecuelab.com/",
    storeDomain: "shop.thebarbecuelab.com",
    homeCta: "Explore seasonings →",
    planCta: "Shop The Barbecue Lab →",
    footerNote: "Tried. Tested. Tasty. · shop.thebarbecuelab.com",
    homeProductKeys: [
      "essentialEquation",
      "featheredFormula",
      "porkProtocol",
      "hotFeatheredFormula",
    ],
    products: barbecueLabProducts,
    categoryPairings: {
      seafood: ["essentialEquation"],
      beef: ["essentialEquation"],
      pork: ["porkProtocol", "essentialEquation"],
      poultry: ["featheredFormula", "hotFeatheredFormula"],
      lamb: ["essentialEquation"],
      game: ["essentialEquation"],
    },
    fallbackPairings: ["essentialEquation", "porkProtocol", "featheredFormula"],
  },
};

export function isPartnerId(value: unknown): value is PartnerId {
  return typeof value === "string" && PARTNER_IDS.includes(value as PartnerId);
}

export function getPartnerDefinition(partnerId: PartnerId): PartnerDefinition {
  return PARTNERS[partnerId];
}

function categoryKey(category: string): string | null {
  const normalized = category.toLowerCase();
  if (normalized === "seafood" || normalized.includes("seafood") || normalized.includes("fish")) {
    return "seafood";
  }
  if (normalized === "beef") return "beef";
  if (normalized === "pork") return "pork";
  if (normalized === "poultry") return "poultry";
  if (normalized === "lamb & goat" || normalized.includes("lamb") || normalized.includes("goat")) {
    return "lamb";
  }
  if (normalized === "game" || normalized.includes("game") || normalized.includes("venison")) {
    return "game";
  }
  return null;
}

function nameKey(name: string): string | null {
  const normalized = name.toLowerCase();
  if (normalized.includes("steak") || normalized.includes("brisket") || normalized.includes("beef") || normalized.includes("chuck") || normalized.includes("burger")) {
    return "beef";
  }
  if (normalized.includes("pork") || normalized.includes("bacon") || normalized.includes("ham") || normalized.includes("sausage")) {
    return "pork";
  }
  if (normalized.includes("chicken") || normalized.includes("turkey") || normalized.includes("poultry")) {
    return "poultry";
  }
  if (normalized.includes("salmon") || normalized.includes("fish") || normalized.includes("shrimp") || normalized.includes("lobster") || normalized.includes("seafood")) {
    return "seafood";
  }
  return null;
}

function productsForKeys(partner: PartnerDefinition, keys: string[]): PartnerProduct[] {
  return keys
    .map(key => partner.products[key])
    .filter((product): product is PartnerProduct => Boolean(product));
}

export function getHomeProducts(partnerId: PartnerId): PartnerProduct[] {
  const partner = getPartnerDefinition(partnerId);
  return productsForKeys(partner, partner.homeProductKeys);
}

export function getPartnerPairings(
  partnerId: PartnerId,
  category: string,
  name: string,
): PartnerProduct[] {
  const partner = getPartnerDefinition(partnerId);
  const key = categoryKey(category) ?? nameKey(name);
  return productsForKeys(
    partner,
    key ? (partner.categoryPairings[key] ?? partner.fallbackPairings) : partner.fallbackPairings,
  );
}