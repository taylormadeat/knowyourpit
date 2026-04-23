export function Screen1Dashboard() {
  const bg = { background: "radial-gradient(ellipse at 30% 20%, #3d1a00 0%, #1a0800 50%, #0d0400 100%)" };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={bg}>
      <p className="text-orange-400 text-xs font-bold tracking-[0.25em] uppercase">KnowYourPit</p>
      <h1 className="text-white text-2xl font-black text-center leading-tight max-w-[280px]">
        Know exactly<br />what to do next
      </h1>
      <IPhoneFrame>
        <div className="w-full h-full flex flex-col" style={{ background: "#0e0e0e", fontFamily: "system-ui" }}>
          {/* Status bar */}
          <div className="flex justify-between items-center px-5 pt-10 pb-1 text-white text-[9px] font-semibold">
            <span>9:41</span>
            <div className="flex gap-1 items-center">
              <span>●●●</span>
              <span>WiFi</span>
              <span>🔋</span>
            </div>
          </div>
          {/* Header */}
          <div className="px-4 pt-1 pb-2">
            <p className="text-gray-500 text-[9px]">Thursday, April 24</p>
            <h2 className="text-white text-[15px] font-bold">What's next?</h2>
          </div>
          {/* Active cook banner */}
          <div className="mx-3 rounded-2xl p-3 mb-2" style={{ background: "linear-gradient(135deg, #7c2d12, #c2410c)" }}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-orange-200 text-[8px] font-semibold uppercase tracking-wide">Active Cook</p>
                <p className="text-white text-[13px] font-bold">Texas Brisket</p>
              </div>
              <div className="text-right">
                <p className="text-orange-300 text-[18px] font-black">9:32</p>
                <p className="text-orange-200 text-[8px]">elapsed</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 bg-black/30 rounded-xl p-2 text-center">
                <p className="text-orange-300 text-[14px] font-black">225°</p>
                <p className="text-orange-200 text-[7px]">Pit Temp</p>
              </div>
              <div className="flex-1 bg-black/30 rounded-xl p-2 text-center">
                <p className="text-white text-[14px] font-black">172°</p>
                <p className="text-orange-200 text-[7px]">Internal</p>
              </div>
              <div className="flex-1 bg-black/30 rounded-xl p-2 text-center">
                <p className="text-gray-400 text-[14px] font-black">203°</p>
                <p className="text-orange-200 text-[7px]">Target</p>
              </div>
            </div>
          </div>
          {/* Next action card */}
          <div className="mx-3 rounded-2xl p-3 mb-2 border" style={{ background: "#1a1a1a", borderColor: "#f97316" }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: "#f97316" }}>🪵</div>
              <div className="flex-1">
                <p className="text-orange-400 text-[8px] font-bold uppercase tracking-wide">Do This Now</p>
                <p className="text-white text-[11px] font-semibold">Add 2 wood splits to firebox</p>
              </div>
            </div>
          </div>
          {/* Phase info */}
          <div className="mx-3 rounded-2xl p-3 mb-2" style={{ background: "#1a1a1a" }}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-400 text-[8px] uppercase tracking-wide">Current Phase</p>
                <p className="text-white text-[11px] font-semibold">Stall — hold the line</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-[8px]">Est. done in</p>
                <p className="text-orange-400 text-[13px] font-bold">4h 28m</p>
              </div>
            </div>
          </div>
          {/* Upcoming */}
          <div className="mx-3 rounded-2xl p-3" style={{ background: "#1a1a1a" }}>
            <p className="text-gray-500 text-[8px] font-bold uppercase mb-2">Up Next</p>
            {[["~180°F", "Consider wrapping in butcher paper"], ["~195°F", "Start probing for tenderness"]].map(([temp, label]) => (
              <div key={temp} className="flex gap-2 items-center mb-1">
                <div className="w-1 h-1 rounded-full bg-gray-600" />
                <p className="text-orange-400 text-[8px] w-10">{temp}</p>
                <p className="text-gray-300 text-[8px]">{label}</p>
              </div>
            ))}
          </div>
          {/* Bottom nav */}
          <div className="mt-auto border-t flex justify-around py-2 px-4" style={{ borderColor: "#222", background: "#111" }}>
            {[["🏠", "Home"], ["🔥", "Cook"], ["📋", "Plan"], ["📖", "Recipes"], ["👤", "Profile"]].map(([icon, label]) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className="text-sm">{icon}</span>
                <span className={`text-[6px] font-semibold ${label === "Home" ? "text-orange-400" : "text-gray-600"}`}>{label}</span>
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
