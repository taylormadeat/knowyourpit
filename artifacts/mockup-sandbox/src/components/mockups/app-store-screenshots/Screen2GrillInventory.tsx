export function Screen2GrillInventory() {
  const bg = { background: "radial-gradient(ellipse at 70% 80%, #1a2d00 0%, #0a1400 50%, #060d00 100%)" };
  const grills = [
    { name: "Traeger Pro 780", type: "Pellet Grill", surface: "780 sq in", status: "Ready", statusColor: "#22c55e", icon: "🔥" },
    { name: "Big Green Egg L", type: "Kamado / Charcoal", surface: "262 sq in", status: "Active", statusColor: "#f97316", icon: "🥚" },
    { name: "Pit Boss Austin XL", type: "Pellet Grill", surface: "1000 sq in", status: "Ready", statusColor: "#22c55e", icon: "🔥" },
  ];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={bg}>
      <p className="text-green-400 text-xs font-bold tracking-[0.25em] uppercase">knowyourpit</p>
      <h1 className="text-white text-2xl font-black text-center leading-tight max-w-[280px]">
        Your whole pit,<br />in one place
      </h1>
      <IPhoneFrame>
        <div className="w-full h-full flex flex-col" style={{ background: "#0e0e0e", fontFamily: "system-ui" }}>
          <div className="flex justify-between items-center px-5 pt-10 pb-1 text-white text-[9px] font-semibold">
            <span>9:41</span>
            <div className="flex gap-1"><span>●●●</span><span>WiFi</span><span>🔋</span></div>
          </div>
          <div className="px-4 pt-1 pb-3 flex justify-between items-center">
            <div>
              <p className="text-gray-500 text-[9px]">3 grills registered</p>
              <h2 className="text-white text-[15px] font-bold">My Pit</h2>
            </div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm" style={{ background: "#f97316" }}>+</div>
          </div>
          <div className="px-3 flex flex-col gap-2 flex-1 overflow-hidden">
            {grills.map((g) => (
              <div key={g.name} className="rounded-2xl p-3" style={{ background: "#1a1a1a" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "#2a2a2a" }}>{g.icon}</div>
                  <div className="flex-1">
                    <p className="text-white text-[11px] font-bold">{g.name}</p>
                    <p className="text-gray-500 text-[9px]">{g.type}</p>
                    <p className="text-gray-600 text-[9px]">{g.surface}</p>
                  </div>
                  <div className="rounded-full px-2 py-0.5" style={{ background: g.statusColor + "20" }}>
                    <p className="text-[8px] font-bold" style={{ color: g.statusColor }}>{g.status}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-2xl p-3 border border-dashed" style={{ borderColor: "#333" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: "#1e1e1e" }}>➕</div>
                <div>
                  <p className="text-gray-400 text-[11px] font-semibold">Add another grill</p>
                  <p className="text-gray-600 text-[9px]">Browse 200+ models</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl p-3" style={{ background: "#111" }}>
              <p className="text-gray-500 text-[8px] font-bold uppercase mb-2">Grill Stats</p>
              <div className="flex gap-2">
                {[["47", "Total Cooks"], ["1,240", "Hrs Smoked"], ["32", "Recipes Used"]].map(([val, label]) => (
                  <div key={label} className="flex-1 text-center">
                    <p className="text-orange-400 text-[14px] font-black">{val}</p>
                    <p className="text-gray-600 text-[7px]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-auto border-t flex justify-around py-2 px-4" style={{ borderColor: "#222", background: "#111" }}>
            {[["🏠", "Home", false], ["🔥", "Cook", false], ["📋", "Plan", false], ["📖", "Recipes", false], ["🍖", "My Pit", true]].map(([icon, label, active]) => (
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
