import { NativeModule, requireNativeModule, EventEmitter } from "expo-modules-core";
import { Platform } from "react-native";

interface WatchConnectivityNativeModule {
  isSupported(): boolean;
  isReachable(): boolean;
  updateApplicationContext(context: Record<string, unknown>): Promise<void>;
  sendMessage(message: Record<string, unknown>): Promise<void>;
}

export interface WatchContextUpdateEvent {
  context: Record<string, unknown>;
}

export interface WatchMessageEvent {
  message: Record<string, unknown>;
}

type WatchEvents = {
  onWatchContextUpdate: WatchContextUpdateEvent;
  onWatchMessage: WatchMessageEvent;
};

let nativeMod: WatchConnectivityNativeModule | null = null;
let emitter: EventEmitter<WatchEvents> | null = null;

if (Platform.OS === "ios") {
  try {
    nativeMod = requireNativeModule<WatchConnectivityNativeModule>("WatchConnectivity");
    emitter = new EventEmitter<WatchEvents>(
      nativeMod as unknown as NativeModule<WatchEvents>
    );
  } catch {
    // Not available in Expo Go; isSupported() returns false and bridge is a no-op
  }
}

export const WatchConnectivity = {
  isSupported: (): boolean => nativeMod?.isSupported() ?? false,
  isReachable: (): boolean => nativeMod?.isReachable() ?? false,

  updateApplicationContext: (context: Record<string, unknown>): Promise<void> =>
    nativeMod?.updateApplicationContext(context) ?? Promise.resolve(),

  sendMessage: (message: Record<string, unknown>): Promise<void> =>
    nativeMod?.sendMessage(message) ?? Promise.resolve(),

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
