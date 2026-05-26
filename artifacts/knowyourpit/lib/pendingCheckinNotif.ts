export interface PendingCheckin {
  cookId: number;
  phaseKey: string;
  phaseLabel: string;
  scheduledAt: number;
  /** When true the cook detail screen opens the check-in sheet immediately
   *  instead of showing the "Check In Now" banner. Used for in-app taps
   *  (e.g. the Home card hint row) where the user explicitly chose to check in. */
  autoOpen?: boolean;
}

let _pending: PendingCheckin | null = null;

export function setPendingCheckin(data: PendingCheckin): void {
  _pending = data;
}

export function consumePendingCheckin(): PendingCheckin | null {
  const v = _pending;
  _pending = null;
  return v;
}
