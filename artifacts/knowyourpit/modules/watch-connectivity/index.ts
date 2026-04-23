import { NativeModule, requireNativeModule, EventEmitter } from "expo-modules-core";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// JS-facing API for the WatchConnectivity native module.
// All methods are no-ops on Android and web.
// ---------------------------------------------------------------------------

interface WatchContextUpdateEvent {
  context: Record<string, unknown>;
}

interface WatchMessageEvent {
  message: Record<string, unknown>;
}

let mod: any = null;
let emitter: EventEmitter<any> | null = null;

if (Platform.OS === "ios") {
  try {
    mod = requireNativeModule("WatchConnectivity");
    emitter = new EventEmitter(mod as NativeModule<any>);
  } catch {
    // Module not available (Expo Go / web / Android)
  }
}

export const WatchConnectivity = {
  isSupported(): boolean {
    return mod?.isSupported() ?? false;
  },

  isReachable(): boolean {
    return mod?.isReachable() ?? false;
  },

  async updateApplicationContext(context: Record<string, unknown>): Promise<void> {
    await mod?.updateApplicationContext(context);
  },

  async sendMessage(message: Record<string, unknown>): Promise<void> {
    await mod?.sendMessage(message);
  },

  addContextUpdateListener(
    handler: (event: WatchContextUpdateEvent) => void
  ): { remove: () => void } {
    if (!emitter) return { remove: () => {} };
    const sub = emitter.addListener("onWatchContextUpdate", handler);
    return { remove: () => sub.remove() };
  },

  addMessageListener(
    handler: (event: WatchMessageEvent) => void
  ): { remove: () => void } {
    if (!emitter) return { remove: () => {} };
    const sub = emitter.addListener("onWatchMessage", handler);
    return { remove: () => sub.remove() };
  },
};
