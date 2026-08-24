/**
 * ThermoWorks RFX Gateway discovery.
 *
 * RFX gateways advertise over BLE, but their thermometer readings are
 * delivered through the ThermoWorks account/cloud service rather than a
 * supported BLE GATT characteristic. We identify the advertisement so the
 * app can give the user the correct next step without offering a pairing
 * action that cannot work.
 */

import {
  isRfxGatewayDevice,
  RFX_GATEWAY_ADAPTER,
} from "./rfxGateway";

export const RFX_ADAPTER = RFX_GATEWAY_ADAPTER;
export const RFX_SETUP_URL =
  "https://help.thermoworks.com/knowledge-base/setup-thermoworks-rfx-gateway-and-rfx-meat/";

export const RFX_DEVICE_GUIDANCE = {
  title: "RFX uses ThermoWorks cloud",
  body:
    "Bluetooth discovery cannot connect RFX temperatures to knowyourpit. Use the ThermoWorks app to add the gateway to your account, then connect it to a 2.4 GHz Wi-Fi network. RFX account linking is not available in knowyourpit yet.",
  actionLabel: "View RFX setup guide",
} as const;

/**
 * RFX Gateway names observed in iOS BLE scans. Keep this deliberately
 * conservative: a generic ThermoWorks name is not enough to identify an RFX
 * gateway and must remain an unknown BLE device.
 */
export const isThermoWorksRfxDevice = isRfxGatewayDevice;