import { detectAdapter } from "../index";

describe("BLE adapter detection", () => {
  it("recognizes an RFX Gateway from its local name even without service UUIDs", () => {
    expect(
      detectAdapter({
        name: null,
        localName: "rfx gateway",
        serviceUUIDs: [],
        manufacturerData: "EwA0X0U7KIg=",
      }),
    ).toBe("thermoworks_rfx");
  });

  it("does not classify an unrelated device containing rfx in its name", () => {
    expect(detectAdapter({ name: "RFX Remote", localName: null })).toBeNull();
  });
});