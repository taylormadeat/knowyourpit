export const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

export const VERDICT_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  perfect: { label: "Perfect Cook", color: "#22c55e", icon: "award" },
  good: { label: "Good Cook", color: "#84cc16", icon: "thumbs-up" },
  overcooked: { label: "Overcooked", color: "#f97316", icon: "thermometer" },
  undercooked: { label: "Undercooked", color: "#3b82f6", icon: "thermometer" },
  needs_work: { label: "Needs Work", color: "#eab308", icon: "tool" },
};

export const EVENT_ICONS: Record<string, string> = {
  wrap: "package",
  stall: "pause-circle",
  spike: "zap",
  done: "check-circle",
  note: "message-circle",
};

export const EDIT_TIME_SLOTS: Array<{ h: number; m: number }> = (() => {
  const slots: Array<{ h: number; m: number }> = [];
  for (let h = 0; h <= 23; h++) {
    slots.push({ h, m: 0 });
    slots.push({ h, m: 30 });
  }
  return slots;
})();
