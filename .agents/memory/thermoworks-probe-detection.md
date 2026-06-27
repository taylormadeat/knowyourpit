---
name: ThermoWorks probe detection path
description: Why ThermoWorks Signals/RFX don't appear via LAN scan and where the real connect path lives
---

# ThermoWorks probe detection

ThermoWorks Signals & RFX are **cloud** devices. The app reads their readings
through an account link (`POST /api/thermoworks/link`), NOT over the LAN.

The local LAN adapter (`hooks/lan/thermoworksSignals.ts`, polling a `/status`
endpoint on `*-signals.local` / `rfx*.local`) is **speculative / effectively
dead** — it was built against a community spec and no shipping ThermoWorks
device actually serves it. Do not treat "the LAN adapter exists" as evidence
that LAN discovery is the supported path.

**Why:** A user reported the cook screen stuck forever on "No probe detected ·
scanning nearby devices" even though the device worked in the official
ThermoWorks app on the same Wi-Fi. Root cause: there is no LAN path to find; the
device is only reachable via the cloud account link, and the no-probe UX had no
finite/actionable terminal state.

**How to apply:** When working on probe detection, route ThermoWorks/MEATER
users to the account-link flow on the `/devices` screen. LAN/mDNS discovery is
real only for Fireboard and MEATER Block. On iOS, an empty mDNS browse
(`mdnsScanEmpty` true while `mdnsAvailable` true) is NOT a definitive
Local-Network-permission denial — it can equally mean AP isolation, a different
Wi-Fi/VLAN, or a powered-off base station. Never claim a hard permission denial
from `mdnsScanEmpty` alone.
