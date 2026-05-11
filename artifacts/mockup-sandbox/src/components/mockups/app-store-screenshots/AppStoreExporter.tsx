import { useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";

// ── Brand colors ──────────────────────────────────────────────────────────────
const C = {
  bg: "#1C1C1F",
  card: "#2C2C2E",
  card2: "#38383A",
  orange: "#E84520",
  orangeLight: "#EB6C2B",
  text: "#F0E8D5",
  muted: "#8E8E93",
  border: "#48484A",
  blue: "#3B82F6",
  green: "#22C55E",
  amber: "#F59E0B",
  teal: "#14B8A6",
  heroTop: "#2D1A0E",
} as const;

const FONT = "-apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif";

type Device = "iphone" | "ipad";

// ── Shared status bar ─────────────────────────────────────────────────────────
function StatusBar({ scale = 1 }: { scale?: number }) {
  const fs = (n: number) => n * scale;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: `${5 * scale}px ${14 * scale}px ${2 * scale}px`,
      backgroundColor: C.bg, flexShrink: 0,
    }}>
      <span style={{ fontSize: fs(10), fontWeight: 700, color: C.text }}>9:41</span>
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        <svg width={fs(12)} height={fs(10)} viewBox="0 0 12 10" fill={C.text}>
          <rect x="0" y="4" width="2" height="6" rx="0.5" />
          <rect x="3.5" y="3" width="2" height="7" rx="0.5" />
          <rect x="7" y="1" width="2" height="9" rx="0.5" />
          <rect x="10.5" y="0" width="1.5" height="10" rx="0.5" />
        </svg>
        <svg width={fs(12)} height={fs(10)} viewBox="0 0 12 10" fill={C.text}>
          <path d="M6 2 C2 2, 0 4.5, 0 4.5 C0 4.5, 2 7, 6 7 C10 7, 12 4.5, 12 4.5 C12 4.5, 10 2, 6 2Z" />
          <circle cx="6" cy="4.5" r="1.5" />
        </svg>
        <svg width={fs(20)} height={fs(10)} viewBox="0 0 20 10" fill="none">
          <rect x="0.5" y="0.5" width="17" height="9" rx="2.5" stroke={C.text} strokeWidth="1" />
          <rect x="1.5" y="1.5" width="14" height="7" rx="1.5" fill={C.text} />
          <rect x="18" y="3" width="2" height="4" rx="1" fill={C.text} opacity="0.6" />
        </svg>
      </div>
    </div>
  );
}

// ── Star rating row ───────────────────────────────────────────────────────────
function Stars({ count, size = 8 }: { count: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ fontSize: size, color: n <= count ? "#FACC15" : C.border }}>★</span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 1: Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function DashboardContent({ device }: { device: Device }) {
  const isIpad = device === "ipad";
  const sc = isIpad ? 1.4 : 1;
  const fs = (n: number) => Math.round(n * sc);

  const recentCooks = [
    { food: "Pork Butt", date: "May 10", stars: 5, color: C.green },
    { food: "Baby Back Ribs", date: "Tomorrow", stars: 0, color: C.blue, planned: true },
    { food: "Chicken Thighs", date: "May 8", stars: 4, color: C.green },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.bg, fontFamily: FONT, overflow: "hidden" }}>
      <StatusBar scale={sc} />
      {/* Hero gradient */}
      <div style={{ background: `linear-gradient(160deg, ${C.heroTop} 0%, #1C1C1F 100%)`, padding: `${fs(8)}px ${fs(12)}px ${fs(10)}px`, flexShrink: 0 }}>
        <div style={{ fontSize: fs(9), color: C.muted, marginBottom: 1 }}>Good morning,</div>
        <div style={{ fontSize: fs(16), fontWeight: 700, color: C.text, marginBottom: 1 }}>Jake 🔥</div>
        <div style={{ fontSize: fs(10), color: C.muted, marginBottom: fs(8) }}>Your brisket is on the smoker right now</div>
        <div style={{ display: "flex", background: "#FFFFFF10", borderRadius: fs(8), overflow: "hidden" }}>
          {[["24", "Cooks"], ["3", "Grills"], ["1", "Active"]].map(([n, l], i) => (
            <div key={l} style={{ flex: 1, padding: `${fs(5)}px`, textAlign: "center", borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize: fs(14), fontWeight: 800, color: C.orange }}>{n}</div>
              <div style={{ fontSize: fs(8), color: C.muted, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active cook widget */}
      <div style={{ margin: `${fs(4)}px ${fs(8)}px ${fs(6)}px`, background: "linear-gradient(135deg, #2D1008, #1E0B04)", borderRadius: fs(12), border: `1px solid ${C.orange}55`, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ padding: `${fs(8)}px ${fs(10)}px ${fs(6)}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: fs(4), marginBottom: fs(4) }}>
            <div style={{ width: fs(7), height: fs(7), borderRadius: "50%", backgroundColor: C.orange }} />
            <span style={{ fontSize: fs(8), fontWeight: 700, color: C.orange, letterSpacing: 1 }}>LIVE ON THE SMOKER</span>
            <span style={{ marginLeft: "auto", fontSize: fs(8), color: C.muted }}>3h 45m in</span>
          </div>
          <div style={{ fontSize: fs(14), fontWeight: 700, color: C.text, marginBottom: 1 }}>Brisket</div>
          <div style={{ fontSize: fs(9), color: C.muted, marginBottom: fs(6) }}>Traeger Pro 575 · Pit: 250°F</div>
          <div style={{ display: "flex", alignItems: "center", gap: fs(4), background: "#F59E0B18", borderRadius: fs(6), padding: `${fs(4)}px ${fs(6)}px`, marginBottom: fs(6) }}>
            <div style={{ width: fs(5), height: fs(5), borderRadius: "50%", backgroundColor: C.amber, flexShrink: 0 }} />
            <span style={{ fontSize: fs(9), color: C.amber }}>Hold at 250°F — stall in progress, bark is setting nicely</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: fs(3) }}>
            <span style={{ fontSize: fs(9), color: C.orange }}>Check on your cook</span>
            <span style={{ fontSize: fs(10), color: C.orange }}>›</span>
          </div>
        </div>
        <div style={{ height: 3, backgroundColor: "#333" }}>
          <div style={{ height: "100%", width: "62%", background: `linear-gradient(90deg, ${C.orange}, ${C.orangeLight})` }} />
        </div>
      </div>

      {/* Recent cooks */}
      <div style={{ padding: `0 ${fs(8)}px`, flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: fs(6), marginBottom: fs(6) }}>
          <div style={{ width: fs(3), height: fs(12), borderRadius: fs(2), backgroundColor: C.orange }} />
          <span style={{ fontSize: fs(11), fontWeight: 600, color: C.text }}>Recent Cooks</span>
        </div>
        {recentCooks.map((c) => (
          <div key={c.food} style={{ display: "flex", alignItems: "center", gap: fs(8), padding: `${fs(7)}px ${fs(9)}px`, background: C.card, borderRadius: fs(10), marginBottom: fs(5) }}>
            <div style={{ width: fs(7), height: fs(7), borderRadius: "50%", backgroundColor: c.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: fs(11), fontWeight: 600, color: C.text }}>{c.food}</div>
              <div style={{ fontSize: fs(9), color: C.muted }}>{c.date}</div>
            </div>
            {c.stars > 0 && <Stars count={c.stars} size={fs(8)} />}
            {c.planned && <span style={{ fontSize: fs(8), color: C.blue, background: "#3B82F620", padding: `${fs(2)}px ${fs(6)}px`, borderRadius: fs(10) }}>Planned</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 2: Cook Log
// ─────────────────────────────────────────────────────────────────────────────
function CookLogContent({ device }: { device: Device }) {
  const isIpad = device === "ipad";
  const sc = isIpad ? 1.4 : 1;
  const fs = (n: number) => Math.round(n * sc);

  const cooks = [
    { food: "Brisket", sub: "Traeger Pro 575 · 3h 45m in", status: "live", progress: 62, color: C.orange },
    { food: "Pork Butt", sub: "May 10 · 14h 30m", status: "completed", stars: 5, color: C.green, tag: "Top 4%" },
    { food: "Baby Back Ribs", sub: "Tomorrow 8:00 AM", status: "planned", color: C.blue },
    { food: "Chicken Thighs", sub: "May 8 · 4h 15m", status: "completed", stars: 4, color: C.green },
    { food: "Brisket", sub: "May 5 · 16h 20m", status: "completed", stars: 3, color: C.green },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.bg, fontFamily: FONT, overflow: "hidden" }}>
      <StatusBar scale={sc} />
      <div style={{ padding: `${fs(6)}px ${fs(12)}px ${fs(8)}px`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: fs(16), fontWeight: 700, color: C.text }}>Cook Log</span>
        <div style={{ width: fs(28), height: fs(28), borderRadius: "50%", background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: fs(16), color: C.orange, lineHeight: 1 }}>+</span>
        </div>
      </div>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: fs(6), paddingLeft: fs(10), paddingBottom: fs(8), flexShrink: 0, flexWrap: "nowrap" }}>
        {["All", "⭐ Rated", "🏆 Comps"].map((f, i) => (
          <div key={f} style={{ padding: `${fs(4)}px ${fs(10)}px`, borderRadius: fs(20), background: i === 0 ? C.orange : C.card, fontSize: fs(9), color: i === 0 ? "#fff" : C.muted, fontWeight: i === 0 ? 700 : 400, flexShrink: 0 }}>
            {f}
          </div>
        ))}
        <div style={{ padding: `${fs(4)}px ${fs(10)}px`, borderRadius: fs(20), background: C.card, fontSize: fs(9), color: C.muted, marginLeft: "auto", marginRight: fs(10), flexShrink: 0 }}>
          Newest ▾
        </div>
      </div>
      {/* Cook cards */}
      <div style={{ flex: 1, padding: `0 ${fs(8)}px`, display: "flex", flexDirection: "column", gap: fs(5), overflow: "hidden" }}>
        {cooks.map((cook, idx) => (
          <div key={idx} style={{ background: C.card, borderRadius: fs(10), overflow: "hidden", border: cook.status === "live" ? `1px solid ${C.orange}55` : "1px solid transparent", flexShrink: 0 }}>
            <div style={{ padding: `${fs(7)}px ${fs(9)}px` }}>
              <div style={{ display: "flex", alignItems: "center", gap: fs(5), marginBottom: fs(2) }}>
                {cook.status === "live" && (
                  <div style={{ display: "flex", alignItems: "center", gap: fs(3) }}>
                    <div style={{ width: fs(6), height: fs(6), borderRadius: "50%", backgroundColor: C.orange }} />
                    <span style={{ fontSize: fs(7), fontWeight: 700, color: C.orange, letterSpacing: 0.5 }}>LIVE</span>
                  </div>
                )}
                <span style={{ fontSize: fs(11), fontWeight: 700, color: C.text }}>{cook.food}</span>
                {cook.status === "planned" && <span style={{ marginLeft: "auto", fontSize: fs(7), color: C.blue, background: "#3B82F620", padding: `${fs(1)}px ${fs(5)}px`, borderRadius: fs(4) }}>Planned</span>}
                {cook.tag && <span style={{ marginLeft: "auto", fontSize: fs(7), color: C.teal, background: "#14B8A610", padding: `${fs(1)}px ${fs(5)}px`, borderRadius: fs(4) }}>{cook.tag}</span>}
              </div>
              <div style={{ fontSize: fs(8.5), color: C.muted }}>{cook.sub}</div>
              {cook.stars && (
                <div style={{ marginTop: fs(3) }}>
                  <Stars count={cook.stars} size={fs(8)} />
                </div>
              )}
            </div>
            {cook.status === "live" && (
              <div style={{ height: 3, background: "#333" }}>
                <div style={{ height: "100%", width: `${cook.progress}%`, background: `linear-gradient(90deg, ${C.orange}, ${C.orangeLight})` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 3: Plan / AI Chat
// ─────────────────────────────────────────────────────────────────────────────
function PlanAIContent({ device }: { device: Device }) {
  const isIpad = device === "ipad";
  const sc = isIpad ? 1.4 : 1;
  const fs = (n: number) => Math.round(n * sc);

  const messages = [
    { role: "user", text: "My brisket is at 165°F and stuck in the stall. Should I wrap it now?" },
    { role: "ai", text: "You're right in the middle of the stall — completely normal for brisket. At 165°F with stable temps, wait 30–45 more minutes for the bark to set fully. What's your current pit temp?" },
    { role: "user", text: "Pit is holding steady at 250°F" },
    { role: "ai", text: "Perfect. Wrap in peach butcher paper now — it'll cut 1–2 hours off your timeline while keeping more bark intact than foil. I'll update your finish estimate." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.bg, fontFamily: FONT, overflow: "hidden" }}>
      <StatusBar scale={sc} />
      {/* Header */}
      <div style={{ padding: `${fs(6)}px ${fs(12)}px ${fs(4)}px`, flexShrink: 0 }}>
        <div style={{ fontSize: fs(16), fontWeight: 700, color: C.text, marginBottom: fs(2) }}>PitMaster</div>
        <div style={{ display: "flex", gap: 0, background: C.card2, borderRadius: fs(8), padding: fs(3) }}>
          {["Plan", "AI Chat"].map((t, i) => (
            <div key={t} style={{ flex: 1, textAlign: "center", padding: `${fs(4)}px`, borderRadius: fs(6), background: i === 1 ? C.bg : "transparent", fontSize: fs(9), fontWeight: i === 1 ? 600 : 400, color: i === 1 ? C.text : C.muted }}>
              {t}
            </div>
          ))}
        </div>
      </div>
      {/* AI avatar header */}
      <div style={{ display: "flex", alignItems: "center", gap: fs(8), padding: `${fs(6)}px ${fs(12)}px`, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ width: fs(32), height: fs(32), borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, ${C.heroTop})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: fs(16) }}>🔥</span>
        </div>
        <div>
          <div style={{ fontSize: fs(11), fontWeight: 700, color: C.text }}>PitMaster</div>
          <div style={{ fontSize: fs(8), color: C.green }}>● Online · Ready to help</div>
        </div>
      </div>
      {/* Messages */}
      <div style={{ flex: 1, overflow: "hidden", padding: `${fs(8)}px ${fs(10)}px`, display: "flex", flexDirection: "column", gap: fs(8) }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: fs(5) }}>
            {msg.role === "ai" && (
              <div style={{ width: fs(20), height: fs(20), borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, ${C.heroTop})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: fs(10) }}>🔥</span>
              </div>
            )}
            <div style={{
              maxWidth: "78%", padding: `${fs(7)}px ${fs(9)}px`, borderRadius: fs(12),
              background: msg.role === "user" ? C.orange : C.card,
              borderBottomRightRadius: msg.role === "user" ? fs(3) : fs(12),
              borderBottomLeftRadius: msg.role === "ai" ? fs(3) : fs(12),
            }}>
              <span style={{ fontSize: fs(9.5), color: msg.role === "user" ? "#fff" : C.text, lineHeight: 1.4 }}>{msg.text}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Input bar */}
      <div style={{ padding: `${fs(6)}px ${fs(10)}px ${fs(8)}px`, display: "flex", alignItems: "center", gap: fs(6), borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ flex: 1, background: C.card, borderRadius: fs(20), padding: `${fs(8)}px ${fs(12)}px` }}>
          <span style={{ fontSize: fs(9), color: C.muted }}>Ask PitMaster anything about your cook…</span>
        </div>
        <div style={{ width: fs(30), height: fs(30), borderRadius: "50%", background: C.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: fs(12), color: "#fff" }}>↑</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 4: Session Progress
// ─────────────────────────────────────────────────────────────────────────────
function SessionContent({ device }: { device: Device }) {
  const isIpad = device === "ipad";
  const sc = isIpad ? 1.4 : 1;
  const fs = (n: number) => Math.round(n * sc);

  const steps = [
    { label: "Light grill", time: "6:00 AM", done: true },
    { label: "Meat on", time: "6:30 AM", done: true },
    { label: "Wrap (peach paper)", time: "10:45 AM", done: true },
    { label: "Probe tender", time: "~1:30 PM", done: false, current: true, remaining: "2h 15m" },
    { label: "Rest (cooler)", time: "~2:30 PM", done: false },
    { label: "Slice & serve", time: "~3:00 PM", done: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.bg, fontFamily: FONT, overflow: "hidden" }}>
      <StatusBar scale={sc} />
      {/* Session header */}
      <div style={{ padding: `${fs(6)}px ${fs(12)}px ${fs(4)}px`, flexShrink: 0 }}>
        <div style={{ fontSize: fs(11), color: C.muted, marginBottom: fs(1) }}>SESSION · MEMORIAL DAY COOK</div>
        <div style={{ fontSize: fs(16), fontWeight: 700, color: C.text }}>Active Cook</div>
      </div>
      {/* Progress bar section */}
      <div style={{ padding: `${fs(4)}px ${fs(12)}px ${fs(8)}px`, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: fs(4) }}>
          <span style={{ fontSize: fs(10), color: C.muted }}>62% complete</span>
          <span style={{ fontSize: fs(10), color: C.orange, fontWeight: 600 }}>~2h 15m remaining</span>
        </div>
        <div style={{ height: fs(8), background: C.card, borderRadius: fs(4), overflow: "hidden" }}>
          <div style={{ height: "100%", width: "62%", background: `linear-gradient(90deg, ${C.orange}, ${C.orangeLight})`, borderRadius: fs(4) }} />
        </div>
      </div>
      {/* Cook info card */}
      <div style={{ margin: `0 ${fs(8)}px ${fs(8)}px`, background: "linear-gradient(135deg, #2D1008, #1E0B04)", borderRadius: fs(10), border: `1px solid ${C.orange}44`, padding: `${fs(8)}px ${fs(10)}px`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: fs(5) }}>
          <div style={{ width: fs(6), height: fs(6), borderRadius: "50%", backgroundColor: C.orange }} />
          <span style={{ fontSize: fs(8), fontWeight: 700, color: C.orange, letterSpacing: 0.5 }}>LIVE</span>
          <span style={{ marginLeft: "auto", fontSize: fs(8), color: C.muted }}>Pit: 250°F</span>
        </div>
        <div style={{ fontSize: fs(13), fontWeight: 700, color: C.text, marginTop: fs(2) }}>Brisket · 14.5 lbs</div>
        <div style={{ fontSize: fs(9), color: C.muted }}>Traeger Pro 575 · Started 6:30 AM</div>
      </div>
      {/* Checklist */}
      <div style={{ flex: 1, padding: `0 ${fs(8)}px`, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: fs(6), marginBottom: fs(6) }}>
          <div style={{ width: fs(3), height: fs(12), borderRadius: fs(2), backgroundColor: C.orange }} />
          <span style={{ fontSize: fs(11), fontWeight: 600, color: C.text }}>Cook Timeline</span>
        </div>
        {steps.map((step, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: fs(8), marginBottom: fs(7), opacity: !step.done && !step.current ? 0.5 : 1 }}>
            <div style={{ width: fs(18), height: fs(18), borderRadius: "50%", border: `2px solid ${step.done ? C.green : step.current ? C.orange : C.border}`, background: step.done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {step.done && <span style={{ color: "#fff", fontSize: fs(10), fontWeight: 700 }}>✓</span>}
              {step.current && <div style={{ width: fs(6), height: fs(6), borderRadius: "50%", backgroundColor: C.orange }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: fs(10), fontWeight: step.current ? 700 : 600, color: step.current ? C.orange : step.done ? C.text : C.muted }}>{step.label}</div>
              <div style={{ fontSize: fs(8), color: C.muted }}>{step.time}{step.remaining ? ` · ${step.remaining} away` : ""}</div>
            </div>
          </div>
        ))}
        {/* Check-in button */}
        <div style={{ background: C.orange, borderRadius: fs(10), padding: `${fs(10)}px`, textAlign: "center", marginTop: fs(4) }}>
          <span style={{ fontSize: fs(11), fontWeight: 700, color: "#fff" }}>🔥 Check In with PitMaster</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 5: Paywall / Pro Features
// ─────────────────────────────────────────────────────────────────────────────
function PaywallContent({ device }: { device: Device }) {
  const isIpad = device === "ipad";
  const sc = isIpad ? 1.4 : 1;
  const fs = (n: number) => Math.round(n * sc);

  const features = [
    { icon: "⚡", title: "Unlimited cooks" },
    { icon: "💬", title: "Unlimited AI chat" },
    { icon: "📸", title: "Unlimited scans" },
    { icon: "📊", title: "Cook analytics" },
    { icon: "🏆", title: "Competition mode" },
    { icon: "❄️", title: "Frozen planner" },
    { icon: "📡", title: "Live auto-grading" },
    { icon: "🤖", title: "Grill Fingerprint" },
    { icon: "📅", title: "Multi-cook planner" },
    { icon: "☁️", title: "Weather forecast" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.bg, fontFamily: FONT, overflow: "hidden" }}>
      <StatusBar scale={sc} />
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${C.heroTop} 0%, #1C1C1F 100%)`, padding: `${fs(8)}px ${fs(14)}px ${fs(12)}px`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: fs(5), marginBottom: fs(8) }}>
          <span style={{ fontSize: fs(10) }}>🏆</span>
          <span style={{ fontSize: fs(9), fontWeight: 700, color: C.orange, letterSpacing: 1 }}>KNOWYOURPIT PRO</span>
        </div>
        <div style={{ fontSize: fs(17), fontWeight: 800, color: C.text, marginBottom: fs(4) }}>Unlock knowyourpit Pro</div>
        <div style={{ fontSize: fs(10), color: C.muted }}>Get every feature, with no caps.</div>
      </div>
      {/* Features grid */}
      <div style={{ flex: 1, padding: `${fs(8)}px ${fs(10)}px`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: fs(5), marginBottom: fs(8) }}>
          {features.map((f) => (
            <div key={f.title} style={{ display: "flex", alignItems: "center", gap: fs(5), padding: `${fs(5)}px ${fs(7)}px`, background: C.card, borderRadius: fs(8) }}>
              <span style={{ fontSize: fs(11) }}>{f.icon}</span>
              <span style={{ fontSize: fs(8.5), fontWeight: 500, color: C.text }}>{f.title}</span>
            </div>
          ))}
        </div>
        {/* Annual plan card */}
        <div style={{ background: `linear-gradient(135deg, ${C.orange}22, ${C.heroTop})`, border: `2px solid ${C.orange}88`, borderRadius: fs(12), padding: `${fs(10)}px ${fs(12)}px`, marginBottom: fs(5) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: fs(2) }}>
            <span style={{ fontSize: fs(11), fontWeight: 700, color: C.text }}>Annual</span>
            <span style={{ fontSize: fs(7), fontWeight: 700, color: "#fff", background: C.orange, padding: `${fs(2)}px ${fs(6)}px`, borderRadius: fs(10) }}>BEST VALUE</span>
          </div>
          <div style={{ fontSize: fs(16), fontWeight: 800, color: C.text }}>$49.99 <span style={{ fontSize: fs(9), fontWeight: 400, color: C.muted }}>/ year</span></div>
          <div style={{ fontSize: fs(8), color: C.teal }}>~$4.17/month · Save $20 vs monthly</div>
        </div>
        {/* Monthly plan card */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: fs(12), padding: `${fs(8)}px ${fs(12)}px`, marginBottom: fs(8) }}>
          <div style={{ fontSize: fs(11), fontWeight: 600, color: C.text, marginBottom: fs(1) }}>Monthly</div>
          <div style={{ fontSize: fs(14), fontWeight: 800, color: C.text }}>$6.99 <span style={{ fontSize: fs(9), fontWeight: 400, color: C.muted }}>/ month</span></div>
          <div style={{ fontSize: fs(8), color: C.muted }}>Pay as you go</div>
        </div>
        {/* CTA */}
        <div style={{ background: C.orange, borderRadius: fs(12), padding: `${fs(12)}px`, textAlign: "center" }}>
          <span style={{ fontSize: fs(12), fontWeight: 700, color: "#fff" }}>Start 7-Day Free Trial</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Device frame + caption wrapper
// ─────────────────────────────────────────────────────────────────────────────
function IPhoneDeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: 310, height: 660, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 50, background: "linear-gradient(145deg, #5a5a5a 0%, #3a3a3a 40%, #2a2a2a 100%)", boxShadow: "0 30px 80px #00000088, 0 0 0 1px #11111188", padding: 7 }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", backgroundColor: "#000", position: "relative" }}>
          {/* Dynamic island */}
          <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 100, height: 26, borderRadius: 13, backgroundColor: "#000", zIndex: 10 }} />
          <div style={{ width: "100%", height: "100%" }}>{children}</div>
        </div>
      </div>
      {/* Volume buttons */}
      <div style={{ position: "absolute", top: 100, left: -5, width: 4, height: 30, borderRadius: 2, backgroundColor: "#555" }} />
      <div style={{ position: "absolute", top: 140, left: -5, width: 4, height: 44, borderRadius: 2, backgroundColor: "#555" }} />
      <div style={{ position: "absolute", top: 195, left: -5, width: 4, height: 44, borderRadius: 2, backgroundColor: "#555" }} />
      {/* Power button */}
      <div style={{ position: "absolute", top: 150, right: -5, width: 4, height: 55, borderRadius: 2, backgroundColor: "#555" }} />
    </div>
  );
}

function IPadDeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: 700, height: 950, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 36, background: "linear-gradient(145deg, #5a5a5a 0%, #3a3a3a 40%, #2a2a2a 100%)", boxShadow: "0 40px 100px #00000088, 0 0 0 1px #11111188", padding: 10 }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 26, overflow: "hidden", backgroundColor: "#000" }}>
          {children}
        </div>
      </div>
      {/* Power button */}
      <div style={{ position: "absolute", top: 80, right: -5, width: 4, height: 40, borderRadius: 2, backgroundColor: "#555" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full screenshot composite (background + caption + frame + content)
// ─────────────────────────────────────────────────────────────────────────────
const SCREEN_CAPTIONS: Record<string, { headline: string; sub: string }> = {
  dashboard: { headline: "Track Every Cook", sub: "Your BBQ command center" },
  cooklog: { headline: "Your Full History", sub: "Every cook, rated & logged" },
  planai: { headline: "AI-Powered Plans", sub: "Ask PitMaster anything" },
  session: { headline: "Real-Time Progress", sub: "Live checklist & countdown" },
  paywall: { headline: "Everything Unlocked", sub: "Upgrade to Pro, cook smarter" },
};

const SCREEN_BG: Record<string, string> = {
  dashboard: "radial-gradient(ellipse at 30% 20%, #3d1a00 0%, #1a0800 50%, #0d0400 100%)",
  cooklog: "radial-gradient(ellipse at 70% 30%, #1a1200 0%, #0d0900 50%, #050300 100%)",
  planai: "radial-gradient(ellipse at 50% 10%, #2d0a1a 0%, #1a0510 50%, #0a0308 100%)",
  session: "radial-gradient(ellipse at 20% 80%, #001a2d 0%, #000d1a 50%, #000508 100%)",
  paywall: "radial-gradient(ellipse at 80% 20%, #1a1a00 0%, #0d0d00 50%, #060600 100%)",
};

interface ScreenshotCompositeProps {
  screenKey: string;
  device: Device;
  children: React.ReactNode;
}

function ScreenshotComposite({ screenKey, device, children }: ScreenshotCompositeProps) {
  const caption = SCREEN_CAPTIONS[screenKey];
  const bg = SCREEN_BG[screenKey];
  const isIpad = device === "ipad";

  // Full canvas dims (logical CSS px)
  const W = isIpad ? 1032 : 430;
  const H = isIpad ? 1376 : 932;

  // Bottom bar height
  const bottomH = isIpad ? 200 : 180;
  const topH = isIpad ? 140 : 120;
  const frameH = H - topH - bottomH;
  const frameW = isIpad ? 700 : 310;

  return (
    <div style={{ width: W, height: H, background: bg, display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT, position: "relative", overflow: "hidden" }}>
      {/* Top caption */}
      <div style={{ height: topH, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: isIpad ? 24 : 16, textAlign: "center" }}>
        <div style={{ fontSize: isIpad ? 9 : 8, fontWeight: 700, color: C.orange, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>knowyourpit</div>
        <div style={{ fontSize: isIpad ? 30 : 22, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 6 }}>{caption.headline}</div>
        <div style={{ fontSize: isIpad ? 14 : 11, color: "#ffffff88", fontWeight: 400 }}>{caption.sub}</div>
      </div>

      {/* Device frame with content */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
        {isIpad ? (
          <IPadDeviceFrame>
            <div style={{ width: "100%", height: "100%" }}>{children}</div>
          </IPadDeviceFrame>
        ) : (
          <IPhoneDeviceFrame>
            <div style={{ width: "100%", height: "100%" }}>{children}</div>
          </IPhoneDeviceFrame>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ height: bottomH, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ width: isIpad ? 60 : 40, height: 4, borderRadius: 2, backgroundColor: "#ffffff33" }} />
        <div style={{ fontSize: isIpad ? 11 : 9, color: "#ffffff44", letterSpacing: 1 }}>Available on the App Store</div>
      </div>

      {/* Subtle glow overlay */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${C.orange}08 0%, transparent 60%)`, pointerEvents: "none" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen registry
// ─────────────────────────────────────────────────────────────────────────────
const SCREENS: { key: string; label: string; Content: React.ComponentType<{ device: Device }> }[] = [
  { key: "dashboard", label: "Dashboard", Content: DashboardContent },
  { key: "cooklog", label: "Cook Log", Content: CookLogContent },
  { key: "planai", label: "Plan / AI", Content: PlanAIContent },
  { key: "session", label: "Session Progress", Content: SessionContent },
  { key: "paywall", label: "Pro Paywall", Content: PaywallContent },
];

// ─────────────────────────────────────────────────────────────────────────────
// Export a single screenshot PNG via html2canvas
// ─────────────────────────────────────────────────────────────────────────────
async function exportScreenshot(screenKey: string, device: Device, Content: React.ComponentType<{ device: Device }>) {
  const isIpad = device === "ipad";
  const W = isIpad ? 1032 : 430;
  const H = isIpad ? 1376 : 932;
  const exportScale = isIpad ? 2 : 3; // → 2064×2752 or 1290×2796

  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    width: `${W}px`,
    height: `${H}px`,
    overflow: "hidden",
    zIndex: "-1",
  });
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    <ScreenshotComposite screenKey={screenKey} device={device}>
      <Content device={device} />
    </ScreenshotComposite>
  );

  // Let React render + fonts settle
  await new Promise((r) => setTimeout(r, 600));
  await document.fonts.ready;

  const canvas = await html2canvas(container, {
    scale: exportScale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    width: W,
    height: H,
  });

  root.unmount();
  document.body.removeChild(container);

  const link = document.createElement("a");
  link.download = `knowyourpit-${screenKey}-${device}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────────────────────
export function AppStoreExporter() {
  const [device, setDevice] = useState<Device>("iphone");
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);

  const isIpad = device === "ipad";
  const W = isIpad ? 1032 : 430;
  const H = isIpad ? 1376 : 932;
  const previewScale = isIpad ? 0.2 : 0.38;

  const exportOne = async (screenKey: string, Content: React.ComponentType<{ device: Device }>) => {
    setExporting(screenKey);
    try {
      await exportScreenshot(screenKey, device, Content);
    } finally {
      setExporting(null);
    }
  };

  const exportAll = async () => {
    setExportingAll(true);
    for (const s of SCREENS) {
      setExporting(s.key);
      await exportScreenshot(s.key, device, s.Content);
      await new Promise((r) => setTimeout(r, 300));
    }
    setExporting(null);
    setExportingAll(false);
  };

  const pxLabel = isIpad ? "2064×2752 px" : "1290×2796 px";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", fontFamily: FONT, padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>KNOWYOURPIT · APP STORE ASSETS</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0, marginBottom: 4 }}>Screenshot Generator</h1>
            <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
              Exports at <strong style={{ color: "#aaa" }}>{pxLabel}</strong> · {isIpad ? "iPad 13-inch Pro" : "iPhone 6.7-inch"} ·{" "}
              <span style={{ color: "#555" }}>Renders as PNG via html2canvas</span>
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* Device toggle */}
            <div style={{ display: "flex", background: "#1a1a1a", borderRadius: 10, padding: 4, border: "1px solid #333" }}>
              {(["iphone", "ipad"] as Device[]).map((d) => (
                <button key={d} onClick={() => setDevice(d)} style={{ padding: "8px 18px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s", background: device === d ? C.orange : "transparent", color: device === d ? "#fff" : "#888" }}>
                  {d === "iphone" ? "📱 iPhone 6.7\"" : "📋 iPad 13\""}
                </button>
              ))}
            </div>
            <button
              onClick={exportAll}
              disabled={exportingAll}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: exportingAll ? "#333" : C.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: exportingAll ? "not-allowed" : "pointer" }}
            >
              {exportingAll ? `Exporting ${exporting}…` : `⬇ Export All 5 PNGs`}
            </button>
          </div>
        </div>

        {/* Preview grid */}
        <div style={{ display: "flex", gap: 20, overflowX: "auto", paddingBottom: 16 }}>
          {SCREENS.map(({ key, label, Content }) => (
            <div key={key} style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa" }}>{label}</span>
                <button
                  onClick={() => exportOne(key, Content)}
                  disabled={!!exporting}
                  style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.orange}66`, background: exporting === key ? C.orange : "transparent", color: exporting === key ? "#fff" : C.orange, cursor: exporting ? "not-allowed" : "pointer", fontWeight: 600 }}
                >
                  {exporting === key ? "Exporting…" : "⬇ PNG"}
                </button>
              </div>
              {/* Preview box (clipped, scaled) */}
              <div style={{ width: Math.round(W * previewScale), height: Math.round(H * previewScale), overflow: "hidden", borderRadius: 8, border: "1px solid #222", boxShadow: "0 8px 32px #00000088", cursor: "pointer", position: "relative" }} onClick={() => exportOne(key, Content)}>
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: W, height: H }}>
                  <ScreenshotComposite screenKey={key} device={device}>
                    <Content device={device} />
                  </ScreenshotComposite>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div style={{ marginTop: 32, padding: "20px 24px", background: "#111", borderRadius: 12, border: "1px solid #222" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 10 }}>HOW TO USE</div>
          <ol style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12, color: "#666", lineHeight: 2 }}>
            <li>Select <strong style={{ color: "#aaa" }}>iPhone 6.7"</strong> or <strong style={{ color: "#aaa" }}>iPad 13"</strong> above</li>
            <li>Click <strong style={{ color: "#aaa" }}>Export All 5 PNGs</strong> — each file downloads automatically</li>
            <li>iPhone exports at <strong style={{ color: "#aaa" }}>1290×2796 px</strong> (3× scale) · iPad at <strong style={{ color: "#aaa" }}>2064×2752 px</strong> (2× scale)</li>
            <li>Upload PNGs directly in App Store Connect → <em>App Information → Screenshots</em></li>
            <li>Note: if fonts look wrong in the export, try Chrome — it has the best html2canvas support</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default AppStoreExporter;
