export function Screen3CookSession() {
  const bg = { background: "radial-gradient(ellipse at 50% 10%, #2d0a1a 0%, #1a0510 50%, #0a0308 100%)" };
  const pts = [
    [0, 85], [15, 83], [30, 80], [50, 76], [70, 68], [90, 60], [110, 54],
    [130, 52], [155, 52], [175, 52], [195, 53], [215, 55], [235, 60],
    [255, 65], [275, 70],
  ];
  const w = 240, h = 80;
  const maxY = Math.max(...pts.map(p => p[1]));
  const minY = Math.min(...pts.map(p => p[1]));
  const scaleX = (x: number) => (x / 275) * w;
  const scaleY = (y: number) => h - ((y - minY) / (maxY - minY)) * (h - 10) - 5;
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p[0])} ${scaleY(p[1])}`).join(" ");
  const fillPath = path + ` L ${scaleX(275)} ${h} L ${scaleX(0)} ${h} Z`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={bg}>
      <p className="text-pink-400 text-xs font-bold tracking-[0.25em] uppercase">knowyourpit</p>
      <h1 className="text-white text-2xl font-black text-center leading-tight max-w-[280px]">
        Monitor every<br />degree, live
      </h1>
      <IPhoneFrame>
        <div className="w-full h-full flex flex-col" style={{ background: "#0e0e0e", fontFamily: "system-ui" }}>
          <div className="flex justify-between items-center px-5 pt-10 pb-1 text-white text-[9px] font-semibold">
            <span>9:41</span>
            <div className="flex gap-1"><span>●●●</span><span>WiFi</span><span>🔋</span></div>
          </div>
          <div className="px-4 pt-1 pb-2 flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-[9px]">Traeger Pro 780 · Live</p>
              <h2 className="text-white text-[14px] font-bold">Sunday Brisket</h2>
            </div>
            <div className="rounded-full px-2 py-0.5 flex items-center gap-1" style={{ background: "#f9731620" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <p className="text-orange-400 text-[8px] font-bold">LIVE</p>
            </div>
          </div>
          {/* Timer + temps */}
          <div className="mx-3 rounded-2xl p-3 mb-2" style={{ background: "#1a1a1a" }}>
            <p className="text-gray-500 text-[8px] mb-1">Elapsed Time</p>
            <p className="text-white text-[22px] font-black tracking-wider">9:45:00</p>
            <div className="flex gap-2 mt-2">
              {[["🌡️ Pit", "225°F", "#f97316"], ["🥩 Internal", "172°F", "#fff"], ["🎯 Target", "203°F", "#666"]].map(([label, val, col]) => (
                <div key={label as string} className="flex-1 rounded-xl p-2 text-center" style={{ background: "#111" }}>
                  <p style={{ color: col, fontSize: "14px", fontWeight: 900 }}>{val}</p>
                  <p className="text-gray-600 text-[7px]">{label}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Temp graph */}
          <div className="mx-3 rounded-2xl p-3 mb-2" style={{ background: "#1a1a1a" }}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-400 text-[8px] font-bold">Internal Temp</p>
              <div className="flex gap-2">
                {[["1H", false], ["4H", false], ["All", true]].map(([t, a]) => (
                  <p key={t as string} className="text-[7px] px-1.5 py-0.5 rounded" style={{ background: a ? "#f97316" : "#333", color: a ? "#fff" : "#666" }}>{t}</p>
                ))}
              </div>
            </div>
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={fillPath} fill="url(#tempGrad)" />
              <path d={path} stroke="#f97316" strokeWidth="2" fill="none" strokeLinejoin="round" />
              <circle cx={scaleX(275)} cy={scaleY(pts[pts.length - 1][1])} r="3" fill="#f97316" />
              <line x1="0" y1={scaleY(65)} x2={w} y2={scaleY(65)} stroke="#f97316" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4" />
            </svg>
            <p className="text-gray-600 text-[7px] text-right mt-1">Stall zone: 155–175°F</p>
          </div>
          {/* Phase */}
          <div className="mx-3 rounded-2xl p-2 mb-2 flex gap-2 items-center border" style={{ background: "#111", borderColor: "#f9731630" }}>
            <span className="text-lg">⏳</span>
            <div>
              <p className="text-orange-400 text-[9px] font-bold">Stall in progress</p>
              <p className="text-gray-400 text-[8px]">Hold temp — this is normal. ~4h remaining</p>
            </div>
          </div>
          <div className="mt-auto border-t flex justify-around py-2 px-4" style={{ borderColor: "#222", background: "#111" }}>
            {[["🏠", "Home", false], ["🔥", "Cook", true], ["📋", "Plan", false], ["📖", "Recipes", false], ["👤", "Profile", false]].map(([icon, label, active]) => (
              <div key={label as string} className="flex flex-col items-center gap-0.5">
                <span className="text-sm">{icon}</span>
                <span className={`text-[6px] font-semibold ${active ? "text-orange-400" : "text-gray-600"}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </IPhoneFrame>
      <p className="text-gray-600 text-[10px] text-center">Available on the App Store</p>
    </div>
  );
}

function IPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative" style={{ width: "290px", height: "590px" }}>
      <div className="absolute inset-0 rounded-[50px] shadow-2xl" style={{ background: "linear-gradient(145deg, #5a5a5a 0%, #3a3a3a 40%, #2a2a2a 100%)", padding: "7px" }}>
        <div className="w-full h-full rounded-[44px] overflow-hidden bg-black relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 rounded-b-2xl" style={{ width: "100px", height: "30px", background: "#000" }} />
          {children}
        </div>
      </div>
      <div className="absolute top-20 -left-1.5 rounded-l w-0.5 h-7 bg-gray-600" />
      <div className="absolute top-32 -left-1.5 rounded-l w-0.5 h-10 bg-gray-600" />
      <div className="absolute top-44 -left-1.5 rounded-l w-0.5 h-10 bg-gray-600" />
      <div className="absolute top-28 -right-1.5 rounded-r w-0.5 h-14 bg-gray-600" />
    </div>
  );
}
