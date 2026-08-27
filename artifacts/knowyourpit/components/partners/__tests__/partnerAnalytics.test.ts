import {
  partnerImpressionEvent,
  partnerShopEvents,
} from "../partnerAnalytics";

describe("partner analytics", () => {
  it("identifies the active brand on card impressions", () => {
    expect(
      partnerImpressionEvent({
        partnerId: "barbecueLab",
        surface: "plan",
        planMode: "single",
      }),
    ).toEqual({
      event: "partner_card_impression",
      properties: {
        partnerId: "barbecueLab",
        surface: "plan",
        planMode: "single",
      },
    });
  });

  it("records Barbecue Lab shop taps through the shared event", () => {
    expect(
      partnerShopEvents({
        partnerId: "barbecueLab",
        surface: "home",
      }),
    ).toEqual([
      {
        event: "partner_shop_tapped",
        properties: {
          partnerId: "barbecueLab",
          surface: "home",
        },
      },
    ]);
  });

  it("keeps the legacy Big Pete's plan event unchanged", () => {
    expect(
      partnerShopEvents({
        partnerId: "bigPetes",
        surface: "plan",
        planMode: "multi",
        cutCategory: "Beef,Pork",
      }),
    ).toEqual([
      {
        event: "partner_shop_tapped",
        properties: {
          partnerId: "bigPetes",
          surface: "plan",
          planMode: "multi",
          cutCategory: "Beef,Pork",
        },
      },
      {
        event: "big_petes_shop_tapped",
        properties: {
          planMode: "multi",
          cutCategory: "Beef,Pork",
        },
      },
    ]);
  });
});