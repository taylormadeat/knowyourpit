import {
  getHomeProducts,
  getPartnerPairings,
  isPartnerId,
} from "../partnerData";

describe("featured partner catalogue", () => {
  it("recognises only supported partner identities", () => {
    expect(isPartnerId("bigPetes")).toBe(true);
    expect(isPartnerId("barbecueLab")).toBe(true);
    expect(isPartnerId("unknown-brand")).toBe(false);
  });

  it("keeps Big Pete's home catalogue available", () => {
    expect(getHomeProducts("bigPetes").map(product => product.name)).toEqual([
      "Steak Night",
      "PORKEN",
      "Cajun Blast",
      "Everyday Tacos",
    ]);
  });

  it("shows The Barbecue Lab's approved catalogue on Home", () => {
    expect(getHomeProducts("barbecueLab").map(product => product.name)).toEqual([
      "The Essential Equation",
      "The Feathered Formula",
      "The Pork Protocol",
      "Hot Feathered Formula",
    ]);
  });

  it("pairs Barbecue Lab poultry and pork blends to the right cook categories", () => {
    expect(
      getPartnerPairings("barbecueLab", "Poultry", "Whole Chicken")
        .map(product => product.name),
    ).toEqual(["The Feathered Formula", "Hot Feathered Formula"]);
    expect(
      getPartnerPairings("barbecueLab", "Pork", "Baby Back Ribs")
        .map(product => product.name),
    ).toEqual(["The Pork Protocol", "The Essential Equation"]);
  });

  it("uses the essential blend as the Barbecue Lab fallback", () => {
    expect(
      getPartnerPairings("barbecueLab", "Vegetables", "Corn on the Cob")
        .map(product => product.name),
    ).toEqual([
      "The Essential Equation",
      "The Pork Protocol",
      "The Feathered Formula",
    ]);
  });
});