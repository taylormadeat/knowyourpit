export function Slide5() {
  const features = [
    { icon: "🔥", label: "Plan a Cook", desc: "AI-powered time & temp estimates" },
    { icon: "📋", label: "Cook Log", desc: "Track every session" },
    { icon: "🌡️", label: "Temperature Alerts", desc: "Never miss a target temp" },
    { icon: "🏆", label: "Competition Mode", desc: "4-category KCBS planner" },
  ];

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

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px" }}>
          {/* Check icon */}
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "linear-gradient(145deg, #1A2A10 0%, #0F1A08 100%)",
              border: "2px solid rgba(74,200,74,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
              boxShadow: "0 0 40px rgba(74,200,74,0.15)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L20 7" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Headline */}
          <h1
            style={{
              color: "#F5EDE3",
              fontSize: 30,
              fontWeight: 700,
              textAlign: "center",
              lineHeight: 1.15,
              marginBottom: 8,
              letterSpacing: -0.5,
            }}
          >
            You're all set, Pitmaster
          </h1>
          <p style={{ color: "#7A6E68", fontSize: 16, textAlign: "center", marginBottom: 32 }}>
            Here's what's waiting for you
          </p>

          {/* Feature list */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            {features.map((f, i) => (
              <div
                key={i}
                style={{
                  background: "#16161A",
                  borderRadius: 14,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  border: "1px solid #1E1E24",
                }}
              >
                <span style={{ fontSize: 24 }}>{f.icon}</span>
                <div>
                  <div style={{ color: "#F0E8DE", fontSize: 15, fontWeight: 600 }}>{f.label}</div>
                  <div style={{ color: "#6A5E58", fontSize: 13, marginTop: 2 }}>{f.desc}</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="#3A3430" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            ))}
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
                  width: i === 4 ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === 4 ? "#E84820" : "#2A2420",
                }}
              />
            ))}
          </div>

          {/* CTA button */}
          <button
            style={{
              width: "100%",
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #E84820 0%, #C43018 100%)",
              border: "none",
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: 0.3,
              boxShadow: "0 6px 28px rgba(232,72,32,0.4)",
            }}
          >
            Let's Fire It Up 🔥
          </button>
        </div>
      </div>
    </div>
  );
}
