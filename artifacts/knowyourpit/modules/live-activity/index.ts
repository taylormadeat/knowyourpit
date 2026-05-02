import { NativeModule, requireNativeModule, EventEmitter } from "expo-modules-core";
import { Platform } from "react-native";

export interface CookActivityState {
  currentTempF: number | null;
  targetTempF: number | null;
  cookTempF: number | null;
  meatLabel: string;
  startedAtEpochSec: number;
  status: "active" | "completed" | "cancelled";
}

export interface StartLiveActivityResult {
  activityId: string;
}

interface LiveActivityNativeModule {
  isSupported(): boolean;
  start(state: CookActivityState): Promise<StartLiveActivityResult | null>;
  update(activityId: string, state: CookActivityState): Promise<void>;
  end(activityId: string): Promise<void>;
  endAll(): Promise<void>;
}

export interface LiveActivityPushTokenEvent {
  activityId: string;
  pushToken: string;
}

type LiveActivityEvents = {
  onPushTokenUpdate: LiveActivityPushTokenEvent;
};

let nativeMod: LiveActivityNativeModule | null = null;
let emitter: EventEmitter<LiveActivityEvents> | null = null;

if (Platform.OS === "ios") {
  try {
    nativeMod = requireNativeModule<LiveActivityNativeModule>("LiveActivity");
    emitter = new EventEmitter<LiveActivityEvents>(
      nativeMod as unknown as NativeModule<LiveActivityEvents>
    );
  } catch {
    // Not available in Expo Go; isSupported() returns false and bridge is a no-op
  }
}

export const LiveActivity = {
  isSupported: (): boolean => nativeMod?.isSupported() ?? false,

  start: (state: CookActivityState): Promise<StartLiveActivityResult | null> =>
    nativeMod?.start(state) ?? Promise.resolve(null),

  update: (activityId: string, state: CookActivityState): Promise<void> =>
    nativeMod?.update(activityId, state) ?? Promise.resolve(),

  end: (activityId: string): Promise<void> =>
    nativeMod?.end(activityId) ?? Promise.resolve(),

  endAll: (): Promise<void> => nativeMod?.endAll() ?? Promise.resolve(),

  addPushTokenListener(
    handler: (event: LiveActivityPushTokenEvent) => void
  ): { remove: () => void } {
    if (!emitter) return { remove: () => {} };
    const sub = emitter.addListener("onPushTokenUpdate", handler);
    return { remove: () => sub.remove() };
  },
};
