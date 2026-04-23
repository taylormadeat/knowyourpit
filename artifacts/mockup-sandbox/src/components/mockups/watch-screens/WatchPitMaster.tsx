export function WatchPitMaster() {
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
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "12px 14px 6px" }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              background: "linear-gradient(135deg, #EB6C2B, #c85a1e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            🤖
          </div>
          <span style={{ color: "#EB6C2B", fontSize: 11, fontWeight: 700, letterSpacing: -0.2 }}>
            PitMaster
          </span>
        </div>

        {/* AI insight bubble */}
        <div style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              background: "#1c1c1e",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: "8px 10px",
            }}
          >
            <div style={{ color: "#aaa", fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>
              WHAT TO DO NEXT
            </div>
            <div style={{ color: "#eee", fontSize: 10, lineHeight: 1.4 }}>
              Keep the lid closed. You're on track for 195°F in ~1h. Spritz if bark feels dry.
            </div>
          </div>
        </div>

        {/* Quick ask buttons */}
        <div style={{ padding: "6px 12px 12px", display: "flex", gap: 5 }}>
          <button
            style={{
              flex: 1,
              background: "#1e1e1e",
              border: "1px solid #2a2a2a",
              borderRadius: 10,
              padding: "7px 0",
              color: "#bbb",
              fontSize: 8.5,
              fontWeight: 500,
              cursor: "pointer",
              lineHeight: 1.2,
            }}
          >
            🌡 Check<br />Temps
          </button>
          <button
            style={{
              flex: 1,
              background: "rgba(235,108,43,0.15)",
              border: "1px solid rgba(235,108,43,0.3)",
              borderRadius: 10,
              padding: "7px 0",
              color: "#EB6C2B",
              fontSize: 8.5,
              fontWeight: 600,
              cursor: "pointer",
              lineHeight: 1.2,
            }}
          >
            🎙 Ask<br />PitMaster
          </button>
        </div>
      </div>
    </div>
  );
}
