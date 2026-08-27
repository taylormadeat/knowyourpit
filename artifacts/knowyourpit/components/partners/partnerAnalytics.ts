import type { PartnerId } from "./partnerData";

type PartnerSurface = "home" | "plan";

type PartnerImpressionInput = {
  partnerId: PartnerId;
  surface: PartnerSurface;
  planMode?: "single" | "multi";
};

type PartnerShopInput = PartnerImpressionInput & {
  cutCategory?: string;
};

type PartnerAnalyticsEvent = {
  event: string;
  properties: Record<string, string>;
};

export function partnerImpressionEvent({
  partnerId,
  surface,
  planMode,
}: PartnerImpressionInput): PartnerAnalyticsEvent {
  return {
    event: "partner_card_impression",
    properties: {
      partnerId,
      surface,
      ...(planMode ? { planMode } : {}),
    },
  };
}

export function partnerShopEvents({
  partnerId,
  surface,
  planMode,
  cutCategory,
}: PartnerShopInput): PartnerAnalyticsEvent[] {
  const sharedProperties = {
    partnerId,
    surface,
    ...(planMode ? { planMode } : {}),
    ...(cutCategory ? { cutCategory } : {}),
  };
  const events: PartnerAnalyticsEvent[] = [
    { event: "partner_shop_tapped", properties: sharedProperties },
  ];

  // Keep Big Pete's original Plan-card event available to existing reports.
  if (partnerId === "bigPetes" && surface === "plan" && planMode && cutCategory) {
    events.push({
      event: "big_petes_shop_tapped",
      properties: { planMode, cutCategory },
    });
  }
  return events;
}