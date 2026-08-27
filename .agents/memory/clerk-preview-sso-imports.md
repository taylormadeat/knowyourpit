---
name: Clerk preview SSO imports
description: Replit Expo Go preview limitation affecting Clerk Expo 3 browser-based SSO.
---

In Replit's no-dev Expo Go preview, Clerk Expo 3's browser SSO hook can report
that `expo-auth-session` and `expo-web-browser` are missing even when both
packages are installed and compatible.

**Why:** The legacy hook loads those dependencies through runtime dynamic
imports. The preview's lazy Metro bundle resolution can fail at that point and
the hook collapses the underlying load error into a misleading missing-package
message.

**How to apply:** Keep Clerk's normal SSO flow for development-client and
release builds. For the explicit Replit preview flag only, use an equivalent
flow that relies on the statically bundled browser module. Re-evaluate this
workaround before upgrading Clerk Expo, since newer releases use synchronous
module loading for this hook.