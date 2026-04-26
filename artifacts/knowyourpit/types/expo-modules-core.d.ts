declare module "expo-modules-core" {
  export class NativeModule<TEvents extends Record<string, unknown> = Record<string, unknown>> {}

  export class EventEmitter<TEvents extends Record<string, unknown>> {
    constructor(nativeModule: NativeModule<TEvents>);
    addListener<K extends keyof TEvents>(
      eventName: K,
      listener: (event: TEvents[K]) => void
    ): { remove: () => void };
    removeAllListeners(eventName: keyof TEvents): void;
  }

  export function requireNativeModule<T = unknown>(moduleName: string): T;

  export type PermissionExpiration = "never" | number;

  export enum PermissionStatus {
    GRANTED = "granted",
    UNDETERMINED = "undetermined",
    DENIED = "denied",
  }

  export interface PermissionResponse {
    status: PermissionStatus;
    expires: PermissionExpiration;
    granted: boolean;
    canAskAgain: boolean;
  }

  export interface EventSubscription {
    remove: () => void;
  }
}
