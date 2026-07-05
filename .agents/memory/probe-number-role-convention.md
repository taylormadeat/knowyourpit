---
name: Temperature reading probe role convention
description: How to determine whether a temperature_readings row is the meat probe or the pit/ambient probe
---

# Probe role convention

`temperature_readings.probeNumber` is the authoritative signal for probe role,
set uniformly by the single upload path (`useLiveReadings.ts`) across every
source (MEATER, ThermoWorks, Inkbird, BLE, LAN):

- `probeNumber = 0` → meat / internal probe
- `probeNumber = 1` → pit / ambient probe

**Why:** An earlier server-side implementation classified rows by matching
`probeName` against pit-sounding strings (`isPitProbe` heuristic, originally
written for AI-coaching summaries). That heuristic is unreliable for
resolving "current" live readings per role and was rejected in code review.
`probeAssignments.meatProbes[].id` / `pitProbeId` (client-side cook config)
are opaque client identifiers — they do NOT map to any column on
`temperature_readings` and must not be joined against.

**How to apply:** When a server route needs the latest reading for a specific
role (e.g. dashboard "current meat/pit temp"), query
`WHERE cookId = ? AND probeNumber = 1 ORDER BY recordedAt DESC LIMIT 1` for
pit, and `WHERE cookId = ? AND probeNumber != 1 ORDER BY recordedAt DESC LIMIT 1`
for meat (not `probeNumber = 0`) — the generic `/temperature/upload` endpoint
accepts arbitrary probeNumbers from the client (future multi-meat-probe
support, CSV imports), so matching "anything that isn't the pit probe" is
what actually captures a second/third meat probe instead of silently
dropping it. Do not use `probeName` string matching and do not cap a single
combined query to some fixed row count and then filter client-side (misses
readings if the capped window doesn't include a recent row for that role).
