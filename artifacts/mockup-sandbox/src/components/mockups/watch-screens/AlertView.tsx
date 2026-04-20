import "./_group.css";
import { useEffect, useState } from "react";

function WatchBezel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="relative" style={{ width: 200, height: 242 }}>
        <div
          className="absolute inset-0 rounded-[44px]"
          style={{
            background: "linear-gradient(145deg, #2a2a2c 0%, #1a1a1c 50%, #111113 100%)",
            boxShadow: "0 0 0 1.5px #3a3a3c, 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 8,
            height: 38,
            right: -5,
            top: 72,
            background: "linear-gradient(180deg, #3a3a3c, #2a2a2c)",
            boxShadow: "1px 0 3px rgba(0,0,0,0.5)",
            borderRadius: 4,
          }}
        />
        <div
          className="absolute rounded"
          style={{
            width: 5,
            height: 24,
            right: -4,
            top: 118,
            background: "#2a2a2c",
            borderRadius: 3,
          }}
        />
        <div
          className="absolute overflow-hidden"
          style={{
            inset: 6,
            borderRadius: 38,
            background: "#111113",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function AlertView() {
  const [pulse, setPulse] = useState(false);
  const [ripple, setRipple] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setRipple(r => (r + 1) % 3), 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <WatchBezel>
      <div
        className="w-full h-full flex flex-col items-center"
        style={{
          background: "linear-gradient(160deg, #0e0e10 0%, #1a0800 100%)",
          padding: "12px 10px 10px",
          fontFamily: "-apple-system, 'SF Pro Rounded', sans-serif",
        }}
      >
        {/* Pulsing flame icon */}
        <div
          className="flex items-center justify-center mb-2"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: pulse
              ? "rgba(232,72,32,0.25)"
              : "rgba(232,72,32,0.12)",
            transition: "background 0.4s ease",
            position: "relative",
          }}
        >
          {/* Ripple rings */}
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: -(i * 6 + 4),
                borderRadius: "50%",
                border: "1px solid rgba(232,72,32,0.3)",
                opacity: ripple === i ? 0.8 : 0.15,
                transition: "opacity 0.4s ease",
                pointerEvents: "none",
              }}
            />
          ))}
          <span style={{ fontSize: 22 }}>🔥</span>
        </div>

        {/* Alert title */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "-0.01em",
            marginBottom: 2,
          }}
        >
          Target Reached!
        </div>

        {/* Cook name */}
        <div
          style={{
            fontSize: 9,
            color: "#888",
            marginBottom: 10,
          }}
        >
          Brisket — Texas Style
        </div>

        {/* Big temp */}
        <div className="flex items-end gap-0.5 mb-1">
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: "#34C759",
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            203
          </span>
          <span
            style={{
              fontSize: 16,
              color: "#34C759",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            °F ✓
          </span>
        </div>

        <div
          style={{
            fontSize: 8,
            color: "#555",
            marginBottom: 12,
          }}
        >
          Probe pulled at target
        </div>

        {/* Haptic indicator */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-3"
          style={{ background: "#1c1c1e" }}
        >
          <div
            style={{
              display: "flex",
              gap: 2,
              alignItems: "center",
            }}
          >
            {[3, 5, 3, 5, 2].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: h,
                  background: pulse ? "#E84820" : "#444",
                  borderRadius: 1,
                  transition: "background 0.4s ease",
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 8, color: "#666" }}>Haptic fired</span>
        </div>

        {/* Dismiss button */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: "100%",
            height: 26,
            background: "rgba(232,72,32,0.15)",
            border: "1px solid rgba(232,72,32,0.4)",
          }}
        >
          <span style={{ fontSize: 10, color: "#E84820", fontWeight: 700 }}>
            Dismiss
          </span>
        </div>
      </div>
    </WatchBezel>
  );
}
