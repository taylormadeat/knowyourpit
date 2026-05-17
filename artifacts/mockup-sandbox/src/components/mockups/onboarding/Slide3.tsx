export function Slide3() {
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
          {/* Icon */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 32,
              background: "linear-gradient(145deg, #101828 0%, #0A1020 100%)",
              border: "1px solid rgba(100,160,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 40,
              boxShadow: "0 0 60px rgba(80,140,255,0.12)",
            }}
          >
            {/* Brain/sparkle icon */}
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" fill="#60A5FA" opacity="0.9" />
              <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" fill="#93C5FD" opacity="0.7" />
              <path d="M5 16l.5 1.5L7 18l-1.5.5L5 20l-.5-1.5L3 18l1.5-.5L5 16z" fill="#BFDBFE" opacity="0.6" />
            </svg>
          </div>

          {/* Label */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: "#60A5FA", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
              PITMASTER AI
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
            Your personal pit coach
          </h1>

          {/* Body */}
          <p
            style={{
              color: "#7A6E68",
              fontSize: 17,
              textAlign: "center",
              lineHeight: 1.5,
              maxWidth: 280,
              marginBottom: 36,
            }}
          >
            Ask anything — cook times, temperatures, wood pairings, troubleshooting. PitMaster knows BBQ.
          </p>

          {/* Chat preview bubble */}
          <div
            style={{
              width: "100%",
              background: "#16161A",
              borderRadius: 16,
              padding: "14px 18px",
              border: "1px solid #2A2420",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#E84820", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C9.5 5 8 7.5 8 10c0 1.5.5 3 1.5 4C8.5 12.5 8 11 8 10c-1.5 2-2 4-1 6 1 3 4 5 5 5s4-2 5-5c1-2 .5-4-1-6 0 1-.5 2.5-1.5 4C15.5 13 16 11.5 16 10c0-2.5-1.5-5-4-8z" fill="white" />
                </svg>
              </div>
              <div>
                <span style={{ color: "#E84820", fontSize: 12, fontWeight: 600 }}>PitMaster</span>
                <p style={{ color: "#D4C8C0", fontSize: 14, lineHeight: 1.5, margin: "4px 0 0" }}>
                  Your 12lb brisket should be ready in <strong style={{ color: "#F5EDE3" }}>about 14 hours</strong> at 225°F. Wrap around 165°F internal.
                </p>
              </div>
            </div>
            <div
              style={{
                background: "#1E1E24",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#6B6060",
                fontSize: 14,
              }}
            >
              Ask anything about your cook...
            </div>
          </div>
        </div>

        {/* Bottom area */}
        <div style={{ padding: "0 28px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: i === 2 ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === 2 ? "#E84820" : "#2A2420",
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
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(232,72,32,0.35)",
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
