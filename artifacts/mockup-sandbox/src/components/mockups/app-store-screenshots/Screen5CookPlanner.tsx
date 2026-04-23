export function Screen5CookPlanner() {
  const bg = { background: "radial-gradient(ellipse at 80% 20%, #1a1a00 0%, #0d0d00 50%, #060600 100%)" };
  const steps = [
    { time: "3:00 PM", action: "Light fire — target 225°F", done: true, isCurrent: false },
    { time: "4:30 PM", action: "Load brisket (fat cap up)", done: true, isCurrent: false },
    { time: "6:45 PM", action: "Add 2 oak splits", done: false, isCurrent: true },
    { time: "8:00 PM", action: "Check fat rendering progress", done: false, isCurrent: false },
    { time: "10:00 PM", action: "Wrap in butcher paper at 170°F", done: false, isCurrent: false },
    { time: "2:00 AM", action: "Pull at 203°F — rest 1 hr", done: false, isCurrent: false },
  ];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={bg}>
      <p className="text-yellow-400 text-xs font-bold tracking-[0.25em] uppercase">KnowYourPit</p>
      <h1 className="text-white text-2xl font-black text-center leading-tight max-w-[280px]">
        Plan the perfect<br />cook, start to finish
      </h1>
      <IPhoneFrame>
        <div className="w-full h-full flex flex-col" style={{ background: "#0e0e0e", fontFamily: "system-ui" }}>
          <div className="flex justify-between items-center px-5 pt-10 pb-1 text-white text-[9px] font-semibold">
            <span>9:41</span>
            <div className="flex gap-1"><span>●●●</span><span>WiFi</span><span>🔋</span></div>
          </div>
          <div className="px-4 pt-1 pb-2">
            <p className="text-gray-500 text-[9px]">PitMaster Planner</p>
            <h2 className="text-white text-[14px] font-bold">Tonight's Cook</h2>
          </div>
          {/* Cook overview */}
          <div className="mx-3 rounded-2xl p-3 mb-2" style={{ background: "linear-gradient(135deg, #1a1500, #2d2200)" }}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-yellow-400 text-[10px] font-bold">Packer Brisket — 14 lbs</p>
                <p className="text-gray-400 text-[8px]">Oak + Hickory · 225°F</p>
              </div>
              <div className="text-right">
                <p className="text-white text-[14px] font-black">11h 30m</p>
                <p className="text-gray-500 text-[8px]">total plan</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 rounded-full" style={{ background: "#333" }}>
              <div className="h-full rounded-full" style={{ width: "38%", background: "linear-gradient(90deg, #f59e0b, #f97316)" }} />
            </div>
            <p className="text-gray-500 text-[7px] mt-1">38% complete · Est. finish 2:00 AM</p>
          </div>
          {/* Timeline */}
          <div className="mx-3 flex-1 overflow-hidden">
            <p className="text-gray-500 text-[8px] font-bold uppercase mb-2">Cook Timeline</p>
            <div className="flex flex-col gap-1">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0" style={{
                      background: s.done ? "#22c55e" : s.isCurrent ? "#f97316" : "#2a2a2a",
                      color: s.done || s.isCurrent ? "#fff" : "#555",
                      border: s.isCurrent ? "2px solid #f97316" : "none"
                    }}>
                      {s.done ? "✓" : s.isCurrent ? "→" : "○"}
                    </div>
                    {i < steps.length - 1 && <div className="w-0.5 flex-1 mt-0.5" style={{ background: "#2a2a2a", minHeight: "8px" }} />}
                  </div>
                  <div className={`flex-1 rounded-xl p-1.5 mb-0.5 ${s.isCurrent ? "border" : ""}`} style={{ background: s.isCurrent ? "#1a0e00" : "transparent", borderColor: s.isCurrent ? "#f97316" : "transparent" }}>
                    <div className="flex justify-between items-start">
                      <p className={`text-[8px] font-semibold ${s.done ? "text-gray-500 line-through" : s.isCurrent ? "text-orange-400" : "text-gray-300"}`}>{s.action}</p>
                      <p className={`text-[7px] ml-2 flex-shrink-0 ${s.isCurrent ? "text-orange-400 font-bold" : "text-gray-600"}`}>{s.time}</p>
                    </div>
                    {s.isCurrent && <p className="text-orange-300 text-[7px] mt-0.5">⚡ Do this now</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto border-t flex justify-around py-2 px-4" style={{ borderColor: "#222", background: "#111" }}>
            {[["🏠", "Home", false], ["🔥", "Cook", false], ["📋", "Plan", true], ["📖", "Recipes", false], ["👤", "Profile", false]].map(([icon, label, active]) => (
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
