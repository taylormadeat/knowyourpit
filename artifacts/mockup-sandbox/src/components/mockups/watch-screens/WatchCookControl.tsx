export function WatchCookControl() {
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
        {/* Cook name */}
        <div style={{ padding: "14px 14px 4px" }}>
          <div style={{ color: "#666", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
            Cook in progress
          </div>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.1 }}>
            Baby Back Ribs
          </div>
          <div style={{ color: "#EB6C2B", fontSize: 10, fontWeight: 500, marginTop: 2 }}>
            145°F → 195°F target
          </div>
        </div>

        {/* Main action — big red stop button */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 14px" }}>
          <button
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #c0392b 0%, #922b21 100%)",
              border: "none",
              borderRadius: 14,
              padding: "11px 0",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.2,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(192,57,43,0.4)",
            }}
          >
            ⏹ Stop Cook
          </button>
          <div style={{ color: "#444", fontSize: 8, letterSpacing: 0.4, textAlign: "center" }}>
            HOLD 2s TO CONFIRM
          </div>
        </div>

        {/* Secondary — mark done */}
        <div style={{ padding: "0 14px 14px" }}>
          <button
            style={{
              width: "100%",
              background: "#1e1e1e",
              border: "1px solid #2e2e2e",
              borderRadius: 12,
              padding: "8px 0",
              color: "#22c55e",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✓ Mark Done
          </button>
        </div>
      </div>
    </div>
  );
}
