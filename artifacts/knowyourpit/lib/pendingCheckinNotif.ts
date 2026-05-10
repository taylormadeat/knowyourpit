export interface PendingCheckin {
  cookId: number;
  phaseKey: string;
  phaseLabel: string;
  scheduledAt: number;
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
