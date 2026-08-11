/**
 * React Native autolinking configuration.
 *
 * react-native-zeroconf (mDNS/Bonjour discovery) is excluded from iOS native
 * autolinking because:
 *
 *   1. Adding it as a native pod invalidates the CocoaPods cache and triggers a
 *      fresh `pod install`.  The fresh install pulls in RevenueCat 5.55.3 →
 *      AppCheckCore, which fails the EAS pod-install phase.
 *
 *   2. The LAN /status adapter (used for ThermoWorks probe polling) is no
 *      longer functional; Zeroconf discovery falls back to null gracefully in
 *      hooks/lan/zeroconf.ts when the native module is unavailable.
 *
 * The package still ships in the JS bundle so the import doesn't throw; it
 * just won't have a native backing on iOS builds until the AppCheckCore /
 * CocoaPods conflict is resolved on a Mac.
 */
module.exports = {
  dependencies: {
    'react-native-zeroconf': {
      platforms: {
        ios: null,
      },
    },
  },
};
