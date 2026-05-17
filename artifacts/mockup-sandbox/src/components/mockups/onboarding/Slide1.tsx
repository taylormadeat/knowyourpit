export function Slide1() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0D0D10" }}>
      <div
        style={{
          width: 390,
          height: 844,
          background: "#0D0D10",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        }}
      >
        {/* Status bar spacer */}
        <div style={{ height: 54 }} />

        {/* Skip button */}
        <div style={{ position: "absolute", top: 60, right: 24 }}>
          <span style={{ color: "#8A7E78", fontSize: 16, fontWeight: 500 }}>Skip</span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 40px" }}>
          {/* Icon area */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 32,
              background: "linear-gradient(145deg, #2A1810 0%, #1A1008 100%)",
              border: "1px solid rgba(232,72,32,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 40,
              boxShadow: "0 0 60px rgba(232,72,32,0.18)",
            }}
          >
            {/* Flame icon SVG */}
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C9.5 5 8 7.5 8 10c0 1.5.5 3 1.5 4C8.5 12.5 8 11 8 10c-1.5 2-2 4-1 6 1 3 4 5 5 5s4-2 5-5c1-2 .5-4-1-6 0 1-.5 2.5-1.5 4C15.5 13 16 11.5 16 10c0-2.5-1.5-5-4-8z"
                fill="#E84820"
                opacity="0.9"
              />
              <path
                d="M12 14c-1 0-2 .7-2 2 0 1.5 1 2.5 2 2.5s2-1 2-2.5c0-1.3-1-2-2-2z"
                fill="#FF6B3D"
              />
            </svg>
          </div>

          {/* Wordmark */}
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#E84820", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
              KNOWYOURPIT
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              color: "#F5EDE3",
              fontSize: 32,
              fontWeight: 700,
              textAlign: "center",
              lineHeight: 1.15,
              marginBottom: 16,
              letterSpacing: -0.5,
            }}
          >
            Your AI BBQ companion
          </h1>

          {/* Body */}
          <p
            style={{
              color: "#7A6E68",
              fontSize: 17,
              textAlign: "center",
              lineHeight: 1.5,
              maxWidth: 280,
            }}
          >
            Plan cooks, track sessions, and get personalized guidance from PitMaster AI.
          </p>
        </div>

        {/* Bottom area */}
        <div style={{ padding: "0 28px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: i === 0 ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === 0 ? "#E84820" : "#2A2420",
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>

          {/* Next button */}
          <button
            style={{
              width: "100%",
              height: 56,
              borderRadius: 16,
              background: "#E84820",
              border: "none",
              color: "#fff",
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: 0.2,
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(232,72,32,0.35)",
            }}
          >
            Get Started →
          </button>
        </div>
      </div>
    </div>
  );
}
