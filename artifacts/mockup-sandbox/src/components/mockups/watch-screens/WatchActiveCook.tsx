export function WatchActiveCook() {
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
        {/* Status bar */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px 0", alignItems: "center" }}>
          <span style={{ color: "#EB6C2B", fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
            🔥 ACTIVE
          </span>
          <span style={{ color: "#666", fontSize: 9 }}>2:47</span>
        </div>

        {/* Cook name */}
        <div style={{ padding: "4px 14px 0" }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.1 }}>
            Baby Back Ribs
          </div>
        </div>

        {/* Probe temp — main hero number */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
          <div style={{ color: "#aaa", fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 1 }}>
            PROBE TEMP
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <span style={{ color: "#EB6C2B", fontSize: 44, fontWeight: 300, letterSpacing: -2, lineHeight: 1 }}>
              145
            </span>
            <span style={{ color: "#EB6C2B", fontSize: 14, fontWeight: 400, marginTop: 6 }}>°F</span>
          </div>
          {/* Target temp */}
          <div style={{ color: "#555", fontSize: 9, marginTop: 2 }}>
            Target <span style={{ color: "#888" }}>195°F</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#1e1e1e", margin: "0 14px" }} />

        {/* Elapsed + remaining */}
        <div style={{ display: "flex", padding: "8px 14px 10px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#555", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Elapsed</div>
            <div style={{ color: "#ddd", fontSize: 12, fontWeight: 600, marginTop: 1 }}>2h 47m</div>
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ color: "#555", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>Est. finish</div>
            <div style={{ color: "#ddd", fontSize: 12, fontWeight: 600, marginTop: 1 }}>~1h 10m</div>
          </div>
        </div>
      </div>
    </div>
  );
}
