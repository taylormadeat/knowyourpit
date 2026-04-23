export function Screen6Recipes() {
  const bg = { background: "radial-gradient(ellipse at 60% 60%, #1a0d00 0%, #0d0700 50%, #060300 100%)" };
  const recipes = [
    { name: "Central Texas Brisket", time: "14h", rating: 4.9, reviews: 2841, meat: "BEEF", color: "#7c2d12", emoji: "🥩" },
    { name: "St. Louis Spare Ribs", time: "6h", rating: 4.8, reviews: 1923, meat: "PORK", color: "#7c3d12", emoji: "🍖" },
    { name: "Competition Pulled Pork", time: "12h", rating: 4.9, reviews: 3104, meat: "PORK", color: "#5c2d08", emoji: "🐷" },
  ];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={bg}>
      <p className="text-red-400 text-xs font-bold tracking-[0.25em] uppercase">KnowYourPit</p>
      <h1 className="text-white text-2xl font-black text-center leading-tight max-w-[280px]">
        Proven recipes from<br />real pitmasters
      </h1>
      <IPhoneFrame>
        <div className="w-full h-full flex flex-col" style={{ background: "#0e0e0e", fontFamily: "system-ui" }}>
          <div className="flex justify-between items-center px-5 pt-10 pb-1 text-white text-[9px] font-semibold">
            <span>9:41</span>
            <div className="flex gap-1"><span>●●●</span><span>WiFi</span><span>🔋</span></div>
          </div>
          <div className="px-4 pt-1 pb-2 flex justify-between items-center">
            <div>
              <p className="text-gray-500 text-[9px]">237 recipes</p>
              <h2 className="text-white text-[14px] font-bold">Pitmaster Recipes</h2>
            </div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 text-sm" style={{ background: "#1a1a1a" }}>🔍</div>
          </div>
          {/* Category tabs */}
          <div className="px-3 mb-2">
            <div className="flex gap-1 overflow-hidden">
              {[["All", true], ["Beef", false], ["Pork", false], ["Chicken", false], ["Lamb", false]].map(([label, active]) => (
                <div key={label as string} className="rounded-full px-3 py-1 flex-shrink-0" style={{ background: active ? "#f97316" : "#1a1a1a" }}>
                  <p className="text-[8px] font-bold" style={{ color: active ? "#fff" : "#666" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Featured */}
          <div className="mx-3 rounded-2xl overflow-hidden mb-2 relative" style={{ height: "90px", background: "linear-gradient(135deg, #7c2d12, #c2410c, #ea580c)" }}>
            <div className="absolute inset-0 p-3 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="rounded-full px-2 py-0.5" style={{ background: "rgba(0,0,0,0.4)" }}>
                  <p className="text-white text-[7px] font-bold">⭐ FEATURED</p>
                </div>
                <span className="text-2xl">🏆</span>
              </div>
              <div>
                <p className="text-white text-[12px] font-black">Aaron Franklin-Style Brisket</p>
                <p className="text-orange-200 text-[8px]">18h · Serves 12 · Oak wood</p>
              </div>
            </div>
          </div>
          {/* Recipe list */}
          <div className="px-3 flex flex-col gap-2 overflow-hidden">
            {recipes.map((r) => (
              <div key={r.name} className="rounded-2xl p-2.5 flex gap-2 items-center" style={{ background: "#1a1a1a" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: r.color }}>
                  {r.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="rounded-sm px-1" style={{ background: "#2a1a1a" }}>
                      <p className="text-orange-400 text-[6px] font-bold">{r.meat}</p>
                    </div>
                  </div>
                  <p className="text-white text-[10px] font-bold leading-tight">{r.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-yellow-400 text-[8px]">★ {r.rating}</p>
                    <p className="text-gray-600 text-[7px]">({r.reviews.toLocaleString()})</p>
                    <p className="text-gray-600 text-[7px]">· ⏱ {r.time}</p>
                  </div>
                </div>
                <span className="text-gray-600 text-sm">›</span>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t flex justify-around py-2 px-4" style={{ borderColor: "#222", background: "#111" }}>
            {[["🏠", "Home", false], ["🔥", "Cook", false], ["📋", "Plan", false], ["📖", "Recipes", true], ["👤", "Profile", false]].map(([icon, label, active]) => (
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
