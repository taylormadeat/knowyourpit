---
name: OTA update on Replit
description: Workaround for eas update failing on Replit due to hermesc 0.12.0 not supporting private class fields and OOM when exporting both platforms at once.
---

# OTA Update on Replit — Required Workaround

`eas update` fails directly on Replit for two reasons:

1. **hermesc 0.12.0 (Linux)** — The Linux hermesc binary bundled with react-native 0.81.5 is Hermes 0.12.0 and does not support private class fields (`#x`, `#y`, etc.) used in `react-native/src/private/webapis/geometry/DOMRectReadOnly.js`. macOS EAS cloud builds use a newer hermesc that supports them. Babel's `hermes-stable` transform profile assumes Hermes handles these natively so it skips them.

2. **OOM when exporting both platforms** — Exporting Android + iOS together (each ~6.5 MB JS bundle) causes an OOM kill at ~7.9 GB available RAM. Always export one platform at a time.

## Correct flow for `eas update` on Replit

```bash
# 1. Export iOS (no hermesc compilation)
cd artifacts/knowyourpit
npx expo export --output-dir dist --no-bytecode --platform ios --source-maps --dump-assetmap --max-workers 1

# 2. Upload to EAS
EAS_NO_VCS=1 eas update --skip-bundler --input-dir dist --platform ios \
  --channel production --message "..." --non-interactive

# 3. Repeat for Android in a separate step (same --no-bytecode pattern)
```

**Why:** `--no-bytecode` bypasses hermesc entirely; `--skip-bundler` tells eas update to upload the pre-built bundle instead of re-running expo export.

## babel-preset-expo

Must be in `artifacts/knowyourpit/package.json` devDependencies (was missing; added). Without it, `expo export` fails with "Cannot find module 'babel-preset-expo'".

## Non-interactive mode: --message is required (confirmed 2026-08-16)

`eas update` requires `--message` in non-interactive environments (Replit/CI). Without it: _"--channel and --message are required when updating in non-interactive mode unless --auto is specified"_. The `ota-update.sh` script now auto-generates a UTC timestamp message when the caller omits `--message`. End-to-end iOS staging update confirmed: export ~40 s, upload instant, update appeared in EAS dashboard immediately.
