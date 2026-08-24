import {
  ADAPTER_LABELS,
  detectAdapter,
  GATT_ADAPTERS,
  RFX_ADAPTER,
  RFX_DEVICE_GUIDANCE,
  RFX_SETUP_URL,
} from "../adapters";

describe("ThermoWorks RFX gateway discovery", () => {
  it.each([
    { name: "RFX Gateway" },
    { localName: "ThermoWorks RFX Gateway" },
    { name: "rfx" },
  ])("recognises an RFX gateway from its advertised name", (device) => {
    expect(detectAdapter(device)).toBe(RFX_ADAPTER);
  });

  it("keeps generic ThermoWorks and unrelated BLE devices unknown", () => {
    expect(detectAdapter({ name: "ThermoWorks Signals" })).toBeNull();
    expect(detectAdapter({ name: "Kitchen Sensor" })).toBeNull();
  });

  it("labels RFX accurately and gives the cloud setup next step without a GATT pairing path", () => {
    expect(ADAPTER_LABELS[RFX_ADAPTER]).toBe("ThermoWorks RFX");
    expect(GATT_ADAPTERS).not.toContain(RFX_ADAPTER);
    expect(RFX_DEVICE_GUIDANCE.body).toContain("Bluetooth discovery cannot connect RFX temperatures");
    expect(RFX_DEVICE_GUIDANCE.body).toContain("2.4 GHz Wi-Fi");
    expect(RFX_SETUP_URL).toMatch(/^https:\/\/help\.thermoworks\.com\//);
    expect(RFX_DEVICE_GUIDANCE.actionLabel).toBe("View RFX setup guide");
  });
});