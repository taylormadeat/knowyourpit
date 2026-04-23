import {
  NativeModule,
  requireNativeModule,
  EventEmitter,
} from "expo-modules-core";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Native module interface — mirrors WatchConnectivityModule.swift exports
// ---------------------------------------------------------------------------

interface WatchConnectivityNativeModule {
  isSupported(): boolean;
  isReachable(): boolean;
  updateApplicationContext(context: Record<string, unknown>): Promise<void>;
  sendMessage(message: Record<string, unknown>): Promise<void>;
}

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

export interface WatchContextUpdateEvent {
  context: Record<string, unknown>;
}

export interface WatchMessageEvent {
  message: Record<string, unknown>;
}

type WatchModuleEvents = {
  onWatchContextUpdate: WatchContextUpdateEvent;
  onWatchMessage: WatchMessageEvent;
};

// ---------------------------------------------------------------------------
// Module resolution — only available on iOS with a custom dev client / EAS build
// ---------------------------------------------------------------------------

let nativeMod: WatchConnectivityNativeModule | null = null;
let emitter: EventEmitter<WatchModuleEvents> | null = null;

if (Platform.OS === "ios") {
  try {
    nativeMod = requireNativeModule<WatchConnectivityNativeModule>(
      "WatchConnectivity"
    );
    emitter = new EventEmitter<WatchModuleEvents>(
      nativeMod as unknown as NativeModule<WatchModuleEvents>
    );
  } catch {
    // Not available in Expo Go or on Android/web — bridge will no-op
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const WatchConnectivity = {
  isSupported(): boolean {
    return nativeMod?.isSupported() ?? false;
  },

  isReachable(): boolean {
    return nativeMod?.isReachable() ?? false;
  },

  async updateApplicationContext(
    context: Record<string, unknown>
  ): Promise<void> {
    await nativeMod?.updateApplicationContext(context);
  },

  async sendMessage(message: Record<string, unknown>): Promise<void> {
    await nativeMod?.sendMessage(message);
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
