---
name: RevenueCat Expo Go preview
description: Why the Replit Expo Go preview must avoid native RevenueCat configuration when the bundle has App Store or Play Store keys.
---

The Replit native preview uses Expo Go, which cannot initialize RevenueCat with native App Store or Play Store API keys. When no RevenueCat Test Store key is supplied, configuration throws an invalid-key runtime overlay before the app can boot.

**Why:** The preview workflow intentionally sets `EXPO_PUBLIC_BROWSER_PREVIEW_MODE=true` for native Expo Go bundles too, while release and custom development builds use the platform store keys.

**How to apply:** Treat the explicit Replit preview flag as a billing-unavailable environment. Keep RevenueCat initialization enabled for custom development and release builds, and let the existing unavailable-subscriptions UI handle preview paywall states.