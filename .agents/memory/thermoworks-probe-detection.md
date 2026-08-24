---
name: ThermoWorks probe detection path
description: Why ThermoWorks Signals/RFX don't appear via LAN scan and where the real connect path lives
---

# ThermoWorks probe detection

ThermoWorks Signals & RFX are **cloud** devices. The local LAN adapter
(`hooks/lan/thermoworksSignals.ts`, polling a `/status` endpoint on
`*-signals.local` / `rfx*.local`) is **speculative / effectively dead** — it
was built against a community spec and no shipping ThermoWorks device actually
serves it. Do not treat "the LAN adapter exists" as evidence that LAN discovery
is the supported path.

RFX Gateway does advertise over BLE for ThermoWorks' initial app setup, often
with only the local name `rfx gateway` and no service UUIDs. That BLE connection
transfers 2.4 GHz Wi-Fi credentials; it is not a temperature stream. RFX MEAT
is added to the gateway in the ThermoWorks app and reports through ThermoWorks
Cloud. knowyourpit has no validated BLE GATT reading path or current
account-link flow, so a detected gateway needs setup guidance rather than a
pairing action.

**Why:** A physical iPhone scan showed an RFX gateway in raw diagnostics but
not the selectable list because only generic BLE temperature adapters were
registered. Treating the gateway as a direct probe would still yield no
readings and falsely imply that local pairing had integrated it. ThermoWorks'
supported setup uses its app and a 2.4 GHz Wi-Fi network, while knowyourpit
needs a future cloud account integration to ingest readings.

**How to apply:** Recognize RFX GATEWAY narrowly by its advertised name so the
device picker can offer official setup guidance, but do not expose it as a
temperature probe or invent a GATT decoder. Live RFX readings require a
ThermoWorks account-link/cloud integration. LAN/mDNS discovery remains real
only for Fireboard and MEATER Block. On iOS, an empty mDNS browse
(`mdnsScanEmpty` true while `mdnsAvailable` true) is NOT a definitive
Local-Network-permission denial — it can equally mean AP isolation, a different
Wi-Fi/VLAN, or a powered-off base station. Never claim a hard permission denial
from `mdnsScanEmpty` alone.
