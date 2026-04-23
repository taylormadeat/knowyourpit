export function WatchStallAlert() {
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
          overflow: "hidden",
          fontFamily: "-apple-system, 'SF Pro Rounded', Helvetica, sans-serif",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Warning header */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(234,179,8,0.18) 0%, rgba(234,179,8,0.06) 100%)",
            borderBottom: "1px solid rgba(234,179,8,0.2)",
            padding: "10px 14px 8px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>⚠️</span>
          <div>
            <div style={{ color: "#eab308", fontSize: 11, fontWeight: 700, letterSpacing: -0.2 }}>
              Stall Detected
            </div>
            <div style={{ color: "#78716c", fontSize: 8, marginTop: 1 }}>Temp flat for 38 min</div>
          </div>
        </div>

        {/* Current temp stalled */}
        <div style={{ padding: "8px 14px 0", display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{ color: "#eab308", fontSize: 36, fontWeight: 300, letterSpacing: -1.5, lineHeight: 1 }}>
            167
          </span>
          <span style={{ color: "#eab308", fontSize: 12, fontWeight: 400 }}>°F</span>
          <span style={{ color: "#555", fontSize: 9, marginLeft: 4 }}>→ 203°F target</span>
        </div>

        {/* Advice */}
        <div style={{ padding: "5px 14px 0", color: "#aaa", fontSize: 9.5, lineHeight: 1.4 }}>
          Wrap in butcher paper to push through faster, or ride it out.
        </div>

        {/* Action buttons */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 12px 12px", gap: 6 }}>
          <button
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
              border: "none",
              borderRadius: 13,
              padding: "9px 0",
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(217,119,6,0.35)",
            }}
          >
            🌯 Wrap It
          </button>
          <button
            style={{
              width: "100%",
              background: "#1e1e1e",
              border: "1px solid #2e2e2e",
              borderRadius: 12,
              padding: "7px 0",
              color: "#888",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Ride It Out
          </button>
        </div>
      </div>
    </div>
  );
}
