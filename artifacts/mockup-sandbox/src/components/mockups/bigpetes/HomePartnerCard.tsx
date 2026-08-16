import React, { useState, useEffect } from "react";

const SEASONINGS = [
  { name: "Steak Night",    tagline: "For beef, brisket & burgers",    desc: "Steak seasoning — date night just got better",         img: "/__mockup/images/bp-steak-night.png",    accent: "#E84820" },
  { name: "PORKEN",         tagline: "Competition pork & chicken rub", desc: "BBQ rub — your everyday meat rub for pork & chicken", img: "/__mockup/images/bp-porken.png",         accent: "#F97316" },
  { name: "Cajun Blast",    tagline: "Bold Cajun heat",                desc: "Cajun seasoning — blast your food with flavor",        img: "/__mockup/images/bp-cajun-blast.png",    accent: "#EF4444" },
  { name: "Everyday Tacos", tagline: "Chicken, tacos & everything",    desc: "Taco seasoning — making tacos easy",                  img: "/__mockup/images/bp-everyday-tacos.png", accent: "#84CC16" },
];

export default function HomePartnerCard() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SEASONINGS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const s = SEASONINGS[currentIndex];

  return (
    <div style={{ width: 390, height: 844, backgroundColor: "#131210", fontFamily: "system-ui, -apple-system, sans-serif", color: "#F0E8D5", display: "flex", flexDirection: "column", overflow: "hidden", margin: "0 auto" }}>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* Status Bar */}
        <div style={{ padding: "14px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>9:41</div>
          <div style={{ fontSize: 11, color: "#8A7D70", letterSpacing: 1 }}>● ▲ 🔋</div>
        </div>

        {/* Hero Banner */}
        <div style={{ background: "linear-gradient(180deg,#1C1C1F,#2D1A0E)", padding: "12px 20px 18px" }}>
          <div style={{ fontSize: 13, color: "#8A7D70" }}>Good morning, Aaron 👋</div>
          <div style={{ fontSize: 22, fontWeight: "bold", marginTop: 2 }}>Ready to cook?</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {["🍖 12 Cooks", "🔥 3 Grills", "✅ 0 Active"].map(label => (
              <div key={label} style={{ backgroundColor: "#2C2520", padding: "5px 10px", borderRadius: 20, fontSize: 12, color: "#8A7D70" }}>{label}</div>
            ))}
          </div>
        </div>

        {/* Orange Divider */}
        <div style={{ height: 3, backgroundColor: "#E84820" }} />

        {/* PitMaster Score section */}
        <div style={{ margin: "16px 16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 3, height: 16, backgroundColor: "#E84820", borderRadius: 2 }} />
              <div style={{ fontSize: 17, fontWeight: "bold" }}>PitMaster Score</div>
            </div>
            <div style={{ fontSize: 12, color: "#E84820" }}>Details</div>
          </div>

          {/* Score card */}
          <div style={{ backgroundColor: "#1C1915", border: "1px solid #2C2520", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Grade circle */}
              <div style={{ width: 60, height: 60, borderRadius: 30, background: "linear-gradient(135deg,#E84820,#FF6B2B)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff" }}>A</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#8A7D70" }}>Pitmaster II</div>
                <div style={{ fontSize: 24, fontWeight: "bold", color: "#E84820", lineHeight: "28px" }}>84<span style={{ fontSize: 14, color: "#8A7D70" }}>/100</span></div>
                {/* Progress bar */}
                <div style={{ height: 6, backgroundColor: "#2C2520", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "84%", background: "linear-gradient(90deg,#E84820,#FF6B2B)", borderRadius: 3 }} />
                </div>
              </div>
            </div>
            {/* Score chips */}
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              {[["Consistency","A"],["Technique","B+"],["Timing","A-"]].map(([label, grade]) => (
                <div key={label} style={{ backgroundColor: "#2C2520", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#8A7D70" }}>
                  {label} <span style={{ color: "#E84820", fontWeight: 600 }}>{grade}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat with PitMaster row */}
        <div style={{ margin: "10px 16px 0", backgroundColor: "#1C1915", border: "1px solid #2C2520", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#E8482018", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Chat with PitMaster</div>
            <div style={{ fontSize: 12, color: "#8A7D70", marginTop: 2 }}>Ask anything about your cook · history included</div>
          </div>
          <div style={{ color: "#8A7D70", fontSize: 12 }}>›</div>
        </div>

        {/* ── Big Pete's Partner Card ── */}
        <div style={{ margin: "14px 16px 4px", backgroundColor: "#1C1915", borderRadius: 16, overflow: "hidden", border: `1.5px solid ${s.accent}50` }}>
          {/* Accent strip */}
          <div style={{ height: 5, backgroundColor: s.accent }} />

          <div style={{ padding: 14 }}>
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ backgroundColor: "#E8482015", padding: "3px 8px", borderRadius: 20 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#E84820", letterSpacing: 0.5, textTransform: "uppercase" }}>🤝 Featured Partner</span>
              </div>
              {/* Dots */}
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {SEASONINGS.map((_, i) => (
                  <div key={i} style={{ width: i === currentIndex ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === currentIndex ? s.accent : "#2C2520" }} />
                ))}
              </div>
            </div>

            {/* Product row */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: s.accent, marginBottom: 3 }}>{s.tagline}</div>
                <div style={{ fontSize: 17, fontWeight: "bold" }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "#8A7D70", lineHeight: "17px", marginTop: 3 }}>{s.desc}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#E84820", marginTop: 10 }}>Use code KYP15 for 15% off →</div>
              </div>
              <img src={s.img} alt={s.name} style={{ width: 76, height: 76, borderRadius: 10, objectFit: "contain", backgroundColor: "#0D0C0B" }} />
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10, color: "#8A7D70", textAlign: "center", marginBottom: 14, marginTop: 4 }}>15% off · bigpetesseasoning.com</div>

        {/* Recent Cooks */}
        <div style={{ margin: "0 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 3, height: 16, backgroundColor: "#E84820", borderRadius: 2 }} />
            <div style={{ fontSize: 17, fontWeight: "bold" }}>Recent Cooks</div>
          </div>
          <div style={{ fontSize: 13, color: "#E84820" }}>See all</div>
        </div>

        <div style={{ margin: "0 16px 8px", backgroundColor: "#1C1915", border: "1px solid #2C2520", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#E84820,#FF6B2B)", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18 }}>🥩</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Brisket</div>
            <div style={{ fontSize: 12, color: "#8A7D70", marginTop: 2 }}>Completed · 14h 22m</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#E84820" }}>★ 9.2</div>
        </div>

        <div style={{ margin: "0 16px 8px", backgroundColor: "#1C1915", border: "1px solid #2C2520", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#2C2520", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18 }}>🍖</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Pork Ribs</div>
            <div style={{ fontSize: 12, color: "#8A7D70", marginTop: 2 }}>Completed · 5h 45m</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#E84820" }}>★ 8.7</div>
        </div>

        <div style={{ height: 32 }} />
      </div>

      {/* Bottom Tab Bar */}
      <div style={{ backgroundColor: "#1C1915", borderTop: "1px solid #2C2520", height: 83, paddingBottom: 20, display: "flex", justifyContent: "space-around", alignItems: "center", flexShrink: 0 }}>
        {[["🏠","Home","#E84820"],["➕","Plan","#8A7D70"],["📋","Cook Log","#8A7D70"],["☰","More","#8A7D70"]].map(([icon, label, color]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 10, color }}>{label}</div>
          </div>
        ))}
      </div>

    </div>
  );
}
