import React, { useState, useEffect } from "react";

const SEASONINGS = [
  { name: "Steak Night",    tagline: "For beef, brisket & burgers",    desc: "Steak seasoning — date night just got better",           img: "/__mockup/images/bp-steak-night.png",    accent: "#E84820" },
  { name: "PORKEN",         tagline: "Competition pork & chicken rub", desc: "BBQ rub — your everyday meat rub for pork & chicken",   img: "/__mockup/images/bp-porken.png",         accent: "#F97316" },
  { name: "Cajun Blast",    tagline: "Bold Cajun heat",                desc: "Cajun seasoning — blast your food with flavor",          img: "/__mockup/images/bp-cajun-blast.png",    accent: "#EF4444" },
  { name: "Everyday Tacos", tagline: "Chicken, tacos & everything",   desc: "Taco seasoning — making tacos easy",                    img: "/__mockup/images/bp-everyday-tacos.png", accent: "#84CC16" },
];

export default function HomePartnerCard() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % SEASONINGS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const currentSeasoning = SEASONINGS[currentIndex];

  return (
    <div style={{ width: 390, height: 844, backgroundColor: "#131210", fontFamily: "system-ui, -apple-system, sans-serif", color: "#F0E8D5", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", margin: "0 auto" }}>
      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        
        {/* Status Bar */}
        <div style={{ padding: "14px 20px 8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#F0E8D5" }}>9:41</div>
          <div style={{ fontSize: 11, color: "#8A7D70", letterSpacing: "1px" }}>● ▲ 🔋</div>
        </div>

        {/* Hero Banner */}
        <div style={{ background: "linear-gradient(180deg, #1C1C1F 0%, #2D1A0E 100%)", padding: "12px 20px 18px 20px" }}>
          <div style={{ fontSize: 13, color: "#8A7D70" }}>Good morning, Aaron 👋</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#F0E8D5", marginTop: 2 }}>Ready to cook?</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div style={{ backgroundColor: "#2C2520", padding: "5px 10px", borderRadius: 20, fontSize: 12, color: "#8A7D70", display: "flex", alignItems: "center", gap: 4 }}>
              <span>🍖</span> 12 Cooks
            </div>
            <div style={{ backgroundColor: "#2C2520", padding: "5px 10px", borderRadius: 20, fontSize: 12, color: "#8A7D70", display: "flex", alignItems: "center", gap: 4 }}>
              <span>🔥</span> 3 Grills
            </div>
            <div style={{ backgroundColor: "#2C2520", padding: "5px 10px", borderRadius: 20, fontSize: 12, color: "#8A7D70", display: "flex", alignItems: "center", gap: 4 }}>
              <span>✅</span> 0 Active
            </div>
          </div>
        </div>

        {/* Orange Divider */}
        <div style={{ height: 3, backgroundColor: "#E84820", width: "100%" }} />

        {/* Partner Section Header */}
        <div style={{ margin: "18px 20px 12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: "bold", color: "#F0E8D5" }}>Featured Partner</div>
          <div style={{ fontSize: 11, color: "#8A7D70" }}>Sponsored · bigpetesseasoning.com</div>
        </div>

        {/* Rotating Partner Card */}
        <div style={{ 
          margin: "0 16px 4px 16px", 
          backgroundColor: "#1C1915", 
          borderRadius: 16, 
          overflow: "hidden", 
          border: `1.5px solid ${currentSeasoning.accent}50`,
          transition: "border-color 0.4s ease"
        }}>
          {/* Top Strip */}
          <div style={{ height: 5, backgroundColor: currentSeasoning.accent, transition: "background 0.4s ease" }} />
          
          {/* Card Body */}
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: currentSeasoning.accent, marginBottom: 3, transition: "color 0.4s ease" }}>
                  {currentSeasoning.tagline}
                </div>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#F0E8D5", lineHeight: "22px" }}>
                  {currentSeasoning.name}
                </div>
                <div style={{ fontSize: 12, color: "#8A7D70", lineHeight: "17px", marginTop: 4 }}>
                  {currentSeasoning.desc}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#E84820", marginTop: 12 }}>
                  Use code KYP15 for 15% off →
                </div>
              </div>
              <img 
                src={currentSeasoning.img} 
                alt={currentSeasoning.name} 
                style={{ width: 84, height: 84, borderRadius: 12, objectFit: "contain", backgroundColor: "#0D0C0B" }} 
              />
            </div>
            
            {/* Dot Indicator */}
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 6 }}>
              {SEASONINGS.map((seasoning, index) => {
                const isActive = index === currentIndex;
                return (
                  <div 
                    key={index} 
                    style={{ 
                      width: isActive ? 20 : 6, 
                      height: 6, 
                      borderRadius: 3, 
                      backgroundColor: isActive ? seasoning.accent : "#2C2520",
                      transition: "all 0.3s ease" 
                    }} 
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div style={{ margin: "20px 20px 10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: "bold", color: "#F0E8D5", flex: 1 }}>Recent Cooks</div>
          <div style={{ fontSize: 13, color: "#E84820" }}>See all</div>
        </div>

        {/* Two Cook Cards */}
        <div style={{ margin: "0 16px 8px 16px", backgroundColor: "#1C1915", border: "1px solid #2C2520", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #E84820, #FF6B2B)", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18 }}>
            🥩
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#F0E8D5" }}>Brisket</div>
            <div style={{ fontSize: 12, color: "#8A7D70", marginTop: 2 }}>Completed · 14h 22m</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#E84820" }}>★ 9.2</div>
        </div>

        <div style={{ margin: "0 16px 8px 16px", backgroundColor: "#1C1915", border: "1px solid #2C2520", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#2C2520", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18 }}>
            🍖
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#F0E8D5" }}>Pork Ribs</div>
            <div style={{ fontSize: 12, color: "#8A7D70", marginTop: 2 }}>Completed · 5h 45m</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#E84820" }}>★ 8.7</div>
        </div>
        
        {/* Extra space for scroll to clear tab bar */}
        <div style={{ height: 40 }} />
      </div>

      {/* Bottom Tab Bar */}
      <div style={{ 
        backgroundColor: "#1C1915", 
        borderTop: "1px solid #2C2520", 
        height: 83, 
        paddingBottom: 20, 
        display: "flex", 
        justifyContent: "space-around", 
        alignItems: "center",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 10, color: "#E84820" }}>Home</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>➕</div>
          <div style={{ fontSize: 10, color: "#8A7D70" }}>Plan</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>📋</div>
          <div style={{ fontSize: 10, color: "#8A7D70" }}>Cook Log</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>☰</div>
          <div style={{ fontSize: 10, color: "#8A7D70" }}>More</div>
        </div>
      </div>
      
    </div>
  );
}
