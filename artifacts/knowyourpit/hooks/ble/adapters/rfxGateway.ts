/**
 * ThermoWorks RFX Gateway discovery marker.
 *
 * The gateway advertises over BLE during initial setup, but it is not itself
 * a temperature probe. ThermoWorks uses that BLE connection to transfer
 * Wi-Fi credentials; RFX MEAT readings are then delivered through the
 * ThermoWorks cloud after the probe is added to the gateway's account.
 */

export const RFX_GATEWAY_ADAPTER = "thermoworks_rfx" as const;

function normalizedName(device: any): string {
  return String(device?.name ?? device?.localName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * RFX gateways may not advertise a service UUID, so their local name is the
 * reliable discovery signal. Keep this deliberately narrow to avoid turning
 * unrelated devices with "rfx" in their name into thermometer cards.
 */
export function isRfxGatewayDevice(device: any): boolean {
  const name = normalizedName(device);
  return (
    /^rfx(?:[ _-]+gateway)?$/.test(name) ||
    /^thermoworks(?:[ _-]+)rfx(?:[ _-]+gateway)?$/.test(name)
  );
}