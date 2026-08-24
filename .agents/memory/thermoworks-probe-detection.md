---
name: ThermoWorks probe detection path
description: Why ThermoWorks Signals/RFX don't appear via LAN scan and where the real connect path lives
---

# ThermoWorks probe detection

ThermoWorks Signals and RFX temperature data is cloud-backed, not a local-LAN
protocol. The speculative local `/status` adapter for `*-signals.local` /
`rfx*.local` is not a supported data path.

An RFX GATEWAY does advertise over BLE during initial setup, often with only the
local name `rfx gateway` and no service UUIDs. That BLE connection transfers
2.4 GHz Wi-Fi credentials; it is not a temperature stream. RFX MEAT is added
to the gateway in the ThermoWorks app and reports through ThermoWorks Cloud.

**Why:** A physical iPhone scan showed an RFX gateway in raw diagnostics but
not the selectable list because only generic BLE temperature adapters were
registered. Treating the gateway as a direct probe would still yield no
readings and falsely imply that local pairing had integrated it.

**How to apply:** Recognize RFX GATEWAY narrowly by its advertised name so the
device picker can offer the official setup guidance, but do not expose it as a
temperature probe or invent a GATT decoder. Live RFX readings require a
ThermoWorks account-link/cloud integration. LAN/mDNS discovery remains real
only for Fireboard and MEATER Block. On iOS, an empty mDNS browse
(`mdnsScanEmpty` true while `mdnsAvailable` true) is NOT a definitive
Local-Network-permission denial — it can equally mean AP isolation, a different
Wi-Fi/VLAN, or a powered-off base station.
