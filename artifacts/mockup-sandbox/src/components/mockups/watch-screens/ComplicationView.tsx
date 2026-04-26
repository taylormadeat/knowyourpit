import "./_group.css";

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
            background: "#000",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function ComplicationView() {
  return (
    <WatchBezel>
      <div
        className="w-full h-full flex flex-col items-center justify-center relative"
        style={{
          background: "#000",
          fontFamily: "-apple-system, 'SF Pro Rounded', sans-serif",
        }}
      >
        {/* Watch face — Modular style */}

        {/* Top complication — knowyourpit */}
        <div
          className="absolute flex flex-col items-center"
          style={{ top: 14 }}
        >
          <div
            className="flex items-center gap-1 px-3 py-1 rounded-full"
            style={{ background: "#1a1a1a" }}
          >
            <span style={{ fontSize: 8, color: "#E84820" }}>🔥</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#E84820" }}>
              187°F
            </span>
            <span style={{ fontSize: 7, color: "#666" }}>→ 203°</span>
          </div>
        </div>

        {/* Time */}
        <div className="flex flex-col items-center">
          <span
            style={{
              fontSize: 52,
              fontWeight: 200,
              color: "#fff",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            10:09
          </span>
        </div>

        {/* Bottom complications row */}
        <div
          className="absolute flex gap-2"
          style={{ bottom: 18, width: "calc(100% - 28px)", left: 14 }}
        >
          {/* Activity rings mini */}
          <div
            className="flex flex-col items-center justify-center rounded-xl flex-1"
            style={{ background: "#1a1a1a", height: 36 }}
          >
            <div className="flex gap-0.5">
              {["#FF2D55", "#AF52DE", "#30D158"].map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height: 14 - i * 2,
                    background: c,
                    borderRadius: 2,
                    alignSelf: "flex-end",
                  }}
                />
              ))}
            </div>
          </div>

          {/* knowyourpit complication */}
          <div
            className="flex flex-col items-center justify-center rounded-xl flex-1"
            style={{ background: "#1c0a00", border: "1px solid #E84820", height: 36 }}
          >
            <span style={{ fontSize: 7, color: "#E84820", fontWeight: 800 }}>
              🔥 BBQ
            </span>
            <span style={{ fontSize: 10, color: "#FF9F0A", fontWeight: 700 }}>
              187°
            </span>
          </div>

          {/* Date */}
          <div
            className="flex flex-col items-center justify-center rounded-xl flex-1"
            style={{ background: "#1a1a1a", height: 36 }}
          >
            <span style={{ fontSize: 7, color: "#888" }}>SUN</span>
            <span style={{ fontSize: 16, color: "#fff", fontWeight: 300, lineHeight: 1 }}>
              20
            </span>
          </div>
        </div>
      </div>
    </WatchBezel>
  );
}
