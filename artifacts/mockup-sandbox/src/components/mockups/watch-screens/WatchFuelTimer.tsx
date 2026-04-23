export function WatchFuelTimer() {
  // Progress: 37 min elapsed of 60 min interval → 62%
  const elapsed = 37;
  const interval = 60;
  const remaining = interval - elapsed;
  const progress = elapsed / interval;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;
  const gap = circ - dash;

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900">
      <div
        style={{
          width: 198,
          height: 242,
          borderRadius: 56,
          background: "linear-gradient(160deg, #1a1a1a 0%, #0d0d0d 100%)",
          border: "2px solid #2a2a2a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          overflow: "hidden",
          fontFamily: "-apple-system, 'SF Pro Rounded', Helvetica, sans-serif",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "12px 14px 2px", width: "100%", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Add Wood / Fuel In
          </div>
        </div>

        {/* Ring + countdown */}
        <div style={{ position: "relative", width: 130, height: 130, marginTop: 4 }}>
          <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
            {/* Track */}
            <circle cx="65" cy="65" r={r} fill="none" stroke="#1e1e1e" strokeWidth="10" />
            {/* Progress */}
            <circle
              cx="65" cy="65" r={r}
              fill="none"
              stroke="#EB6C2B"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
            />
          </svg>
          {/* Countdown text centered in ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 30, fontWeight: 300, letterSpacing: -1, lineHeight: 1 }}>
              {remaining}
            </span>
            <span style={{ color: "#666", fontSize: 8.5, letterSpacing: 0.4 }}>min left</span>
          </div>
        </div>

        {/* Next interval label */}
        <div style={{ color: "#555", fontSize: 8, marginTop: 4 }}>
          Every <span style={{ color: "#888" }}>60 min</span> · 🔥 Apple Wood
        </div>

        {/* Reset button */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%", padding: "0 12px 12px" }}>
          <button
            style={{
              width: "100%",
              background: "rgba(235,108,43,0.15)",
              border: "1px solid rgba(235,108,43,0.3)",
              borderRadius: 13,
              padding: "9px 0",
              color: "#EB6C2B",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ↺ Added — Reset Timer
          </button>
        </div>
      </div>
    </div>
  );
}
