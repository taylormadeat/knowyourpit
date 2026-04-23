export function Screen4AIScanner() {
  const bg = { background: "radial-gradient(ellipse at 20% 80%, #001a2d 0%, #000d1a 50%, #000508 100%)" };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={bg}>
      <p className="text-blue-400 text-xs font-bold tracking-[0.25em] uppercase">KnowYourPit</p>
      <h1 className="text-white text-2xl font-black text-center leading-tight max-w-[280px]">
        Snap a photo,<br />get AI guidance
      </h1>
      <IPhoneFrame>
        <div className="w-full h-full flex flex-col" style={{ background: "#0a0a0a", fontFamily: "system-ui" }}>
          <div className="flex justify-between items-center px-5 pt-10 pb-1 text-white text-[9px] font-semibold">
            <span>9:41</span>
            <div className="flex gap-1"><span>●●●</span><span>WiFi</span><span>🔋</span></div>
          </div>
          <div className="px-4 pt-1 pb-2 flex justify-between items-center">
            <h2 className="text-white text-[14px] font-bold">AI Cook Scanner</h2>
            <span className="text-gray-400 text-lg">✕</span>
          </div>
          {/* Camera viewfinder */}
          <div className="mx-3 rounded-2xl overflow-hidden relative mb-2" style={{ height: "210px", background: "linear-gradient(135deg, #1a0f00 0%, #2d1a00 40%, #1a0800 100%)" }}>
            {/* Fake meat image */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl overflow-hidden" style={{ width: "180px", height: "120px", background: "linear-gradient(135deg, #5c2a0a, #8b3a1a, #6b2d12, #3d1608)", boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)" }}>
                <div className="w-full h-full opacity-60" style={{ background: "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)" }} />
              </div>
            </div>
            {/* Scanner overlay */}
            <div className="absolute inset-4 rounded-xl border-2 border-blue-400 opacity-80">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-300 rounded-tl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-300 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-300 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-300 rounded-br" />
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-0.5 opacity-50" style={{ background: "linear-gradient(90deg, transparent, #60a5fa, transparent)" }} />
              </div>
            </div>
            {/* Scanning label */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 flex items-center gap-1" style={{ background: "#1d4ed8" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
              <p className="text-white text-[8px] font-bold">Analyzing…</p>
            </div>
          </div>
          {/* AI result */}
          <div className="mx-3 rounded-2xl p-3 mb-2 border" style={{ background: "#0f1a2e", borderColor: "#1d4ed8" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ background: "#1d4ed8" }}>✨</div>
              <p className="text-blue-300 text-[9px] font-bold uppercase tracking-wide">AI Analysis</p>
            </div>
            <p className="text-white text-[11px] font-semibold mb-1">Brisket Flat — Point visible</p>
            <p className="text-gray-400 text-[9px] leading-relaxed">Color suggests internal temp around <span className="text-orange-400 font-bold">165–175°F</span>. Fat cap rendering well. Still in stall — bark developing nicely.</p>
          </div>
          {/* Suggestions */}
          <div className="mx-3 rounded-2xl p-3" style={{ background: "#1a1a1a" }}>
            <p className="text-gray-500 text-[8px] font-bold uppercase mb-2">Suggested Actions</p>
            {["Hold current temp — stall is normal", "Consider wrapping at 175°F", "Bark looks set — good color"].map((tip) => (
              <div key={tip} className="flex gap-2 items-start mb-1">
                <p className="text-green-400 text-[9px]">✓</p>
                <p className="text-gray-300 text-[8px]">{tip}</p>
              </div>
            ))}
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
