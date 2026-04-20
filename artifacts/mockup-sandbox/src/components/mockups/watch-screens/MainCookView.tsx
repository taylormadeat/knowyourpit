import "./_group.css";

function WatchBezel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="relative" style={{ width: 200, height: 242 }}>
        {/* Outer case */}
        <div
          className="absolute inset-0 rounded-[44px]"
          style={{
            background: "linear-gradient(145deg, #2a2a2c 0%, #1a1a1c 50%, #111113 100%)",
            boxShadow: "0 0 0 1.5px #3a3a3c, 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        />
        {/* Digital Crown */}
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
        {/* Side button */}
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
        {/* Screen */}
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

export function MainCookView() {
  return (
    <WatchBezel>
      <div
        className="w-full h-full flex flex-col"
        style={{
          background: "linear-gradient(160deg, #0e0e10 0%, #141416 100%)",
          padding: "10px 10px 8px",
          fontFamily: "-apple-system, 'SF Pro Rounded', sans-serif",
        }}
      >
        {/* Cook name + status dot */}
        <div className="flex items-center gap-1 mb-0.5">
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#34C759",
              boxShadow: "0 0 4px #34C759",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: "#888",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Live Cook
          </span>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "#fff",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            marginBottom: 6,
          }}
        >
          Brisket — Texas Style
        </div>

        {/* Big temperature */}
        <div className="flex items-end gap-1 mb-1">
          <span
            style={{
              fontSize: 46,
              fontWeight: 800,
              color: "#E84820",
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            187
          </span>
          <span
            style={{
              fontSize: 18,
              color: "#E84820",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            °F
          </span>
        </div>

        {/* Target */}
        <div
          className="flex items-center justify-between mb-2"
          style={{ fontSize: 9 }}
        >
          <span style={{ color: "#666" }}>Internal Probe</span>
          <span style={{ color: "#aaa" }}>
            Target <span style={{ color: "#FF9F0A", fontWeight: 700 }}>203°</span>
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 5,
            background: "#222",
            borderRadius: 3,
            marginBottom: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "92%",
              height: "100%",
              borderRadius: 3,
              background: "linear-gradient(90deg, #E84820 0%, #FF9F0A 100%)",
            }}
          />
        </div>

        {/* Ambient temp */}
        <div
          className="flex items-center justify-between mb-6"
          style={{ fontSize: 9, color: "#555" }}
        >
          <span>🌡 Ambient: 262°F</span>
          <span>MEATER+</span>
        </div>

        {/* Elapsed time */}
        <div
          className="flex items-center justify-center"
          style={{
            background: "#1c1c1e",
            borderRadius: 10,
            padding: "5px 10px",
          }}
        >
          <span style={{ fontSize: 9, color: "#666", marginRight: 6 }}>⏱</span>
          <span
            style={{
              fontSize: 18,
              color: "#fff",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
            }}
          >
            8:42:15
          </span>
        </div>
      </div>
    </WatchBezel>
  );
}
