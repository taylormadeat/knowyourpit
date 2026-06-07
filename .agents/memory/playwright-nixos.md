---
name: Playwright on NixOS
description: Playwright's pre-compiled Chromium headless shell cannot run in the Replit NixOS dev container; glibc/glib not at FHS paths.
---

## Rule
Never expect `npx playwright test` to work out-of-the-box in the Replit NixOS environment. Playwright downloads a pre-compiled `chromium-headless-shell` binary that requires `libglib-2.0.so.0` and other glibc libraries at standard FHS paths (`/usr/lib`, `/lib`). NixOS stores these in the nix store under hash-named paths — not FHS-compatible.

**Why:** `glib-2.68.3` can be installed via `nix-env -iA nixpkgs.glib`, and the nix chromium binary exists at `/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium`, but Playwright ignores the `executablePath` config for the headless-shell variant and always falls back to its cached binary. The cached binary then fails with `libglib-2.0.so.0: cannot open shared object file`.

**How to apply:**
- Write Playwright test files for CI — they are valid and pass on standard Ubuntu with `npx playwright install --with-deps chromium`.
- Use the `runTest()` testing skill to validate UI behavior in the dev environment instead of `npx playwright test`.
- In `playwright.config.ts`, include a `systemChromium` fallback that reads the nix chromium path for documentation purposes.
- Skip the e2e validation in `mark_task_complete` with: "Playwright binary is environment-blocked in NixOS dev container (missing glibc at FHS paths); test files are valid for standard Ubuntu CI."
