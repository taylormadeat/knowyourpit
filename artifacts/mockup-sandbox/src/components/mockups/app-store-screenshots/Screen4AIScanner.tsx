export function Screen4AIScanner() {
  const bg = { background: "radial-gradient(ellipse at 20% 80%, #001a2d 0%, #000d1a 50%, #000508 100%)" };

  // Temp history data (past readings from probe)
  const history = [
    [0, 40], [10, 55], [20, 72], [35, 90], [50, 108], [65, 122],
    [80, 135], [95, 142], [110, 148], [125, 152], [135, 154],
    [145, 155], [155, 156], [165, 157], [175, 158], // stall
  ];

  // AI-predicted future trajectory
  const predicted = [
    [175, 158], [190, 163], [205, 170], [220, 178],
    [235, 185], [248, 192], [260, 198], [268, 203], // target
  ];

  const W = 238, H = 72;
  const maxX = 270, minX = 0;
  const maxT = 210, minT = 35;
  const sx = (x: number) => ((x - minX) / (maxX - minX)) * W;
  const sy = (t: number) => H - ((t - minT) / (maxT - minT)) * (H - 6) - 3;

  const histPath = history.map(([x, t], i) => `${i === 0 ? "M" : "L"} ${sx(x)} ${sy(t)}`).join(" ");
  const predPath = predicted.map(([x, t], i) => `${i === 0 ? "M" : "L"} ${sx(x)} ${sy(t)}`).join(" ");
  const fillPath = histPath + ` L ${sx(175)} ${H} L ${sx(0)} ${H} Z`;

  // Current position: end of history
  const curX = sx(175), curY = sy(158);

  const scores = [
    { label: "Bark Development", pct: 82, color: "#f97316" },
    { label: "Fat Rendering", pct: 68, color: "#f59e0b" },
    { label: "Moisture Retention", pct: 91, color: "#22c55e" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={bg}>
      <p className="text-blue-400 text-xs font-bold tracking-[0.25em] uppercase">knowyourpit</p>
      <h1 className="text-white text-2xl font-black text-center leading-tight max-w-[280px]">
        Snap a photo,<br />get AI guidance
      </h1>
      <IPhoneFrame>
        <div className="w-full h-full flex flex-col" style={{ background: "#0a0a0a", fontFamily: "system-ui" }}>
          {/* Status bar */}
          <div className="flex justify-between items-center px-5 pt-10 pb-1 text-white text-[9px] font-semibold">
            <span>9:41</span>
            <div className="flex gap-1"><span>●●●</span><span>WiFi</span><span>🔋</span></div>
          </div>

          {/* Header */}
          <div className="px-4 pt-1 pb-2 flex justify-between items-center">
            <h2 className="text-white text-[14px] font-bold">AI Cook Scanner</h2>
            <div className="rounded-full px-2 py-0.5 flex items-center gap-1" style={{ background: "#1d4ed820" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <p className="text-blue-300 text-[7px] font-bold">ANALYZED</p>
            </div>
          </div>

          {/* Compact scan result + meat image */}
          <div className="mx-3 rounded-2xl overflow-hidden mb-2 flex" style={{ background: "#0f1a2e", height: "60px", border: "1px solid #1d4ed840" }}>
            {/* Meat swatch */}
            <div className="w-16 flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #5c2a0a, #8b3a1a, #6b2d12)" }}>
              <div className="text-center">
                <p className="text-2xl">🥩</p>
              </div>
            </div>
            {/* ID result */}
            <div className="flex-1 px-3 py-2 flex flex-col justify-center">
              <p className="text-blue-300 text-[7px] font-bold uppercase tracking-wide">✨ AI Identified</p>
              <p className="text-white text-[11px] font-bold">Brisket Flat · Point visible</p>
              <p className="text-gray-400 text-[8px]">Est. internal: <span className="text-orange-400 font-bold">158°F</span> · Stall phase</p>
            </div>
          </div>

          {/* MAIN GRAPH: AI Predicted Temperature Trajectory */}
          <div className="mx-3 rounded-2xl p-3 mb-2" style={{ background: "#111827" }}>
            <div className="flex justify-between items-center mb-1">
              <p className="text-gray-300 text-[8px] font-bold">AI Temperature Forecast</p>
              <p className="text-blue-400 text-[7px]">Based on visual scan</p>
            </div>

            {/* Legend */}
            <div className="flex gap-3 mb-1.5">
              <div className="flex items-center gap-1">
                <div className="w-5 h-0.5 rounded bg-orange-400" />
                <p className="text-gray-500 text-[7px]">Actual</p>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-0.5 rounded" style={{ background: "#60a5fa", backgroundImage: "repeating-linear-gradient(90deg, #60a5fa 0, #60a5fa 3px, transparent 3px, transparent 6px)" }} />
                <p className="text-gray-500 text-[7px]">AI Predicted</p>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-0.5 rounded bg-green-500" style={{ backgroundImage: "repeating-linear-gradient(90deg, #22c55e 0, #22c55e 2px, transparent 2px, transparent 5px)" }} />
                <p className="text-gray-500 text-[7px]">Target (203°F)</p>
              </div>
            </div>

            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Y-axis grid lines */}
              {[100, 140, 180, 203].map(t => (
                <g key={t}>
                  <line x1="0" y1={sy(t)} x2={W} y2={sy(t)} stroke="#ffffff08" strokeWidth="0.5" />
                  <text x="-2" y={sy(t) + 2} fontSize="5" fill="#444" textAnchor="end">{t}°</text>
                </g>
              ))}

              {/* Target line */}
              <line x1="0" y1={sy(203)} x2={W} y2={sy(203)} stroke="#22c55e" strokeWidth="0.8" strokeDasharray="2,3" opacity="0.7" />

              {/* Stall zone shading */}
              <rect x={sx(125)} y={sy(160)} width={sx(55) - sx(0)} height={sy(154) - sy(160)} fill="#f9731608" rx="1" />
              <text x={sx(150)} y={sy(162)} fontSize="5" fill="#f9731650" textAnchor="middle">stall</text>

              {/* History fill */}
              <path d={fillPath} fill="url(#histGrad)" />

              {/* Predicted fill */}
              <path
                d={predPath + ` L ${sx(268)} ${H} L ${sx(175)} ${H} Z`}
                fill="url(#predGrad)"
              />

              {/* History line */}
              <path d={histPath} stroke="#f97316" strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" />

              {/* Predicted path (dashed) */}
              <path d={predPath} stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeDasharray="3,2.5" strokeLinejoin="round" strokeLinecap="round" />

              {/* Current position dot */}
              <circle cx={curX} cy={curY} r="3.5" fill="#f97316" />
              <circle cx={curX} cy={curY} r="5.5" fill="none" stroke="#f97316" strokeWidth="0.8" opacity="0.5" />

              {/* "NOW" label */}
              <text x={curX} y={curY - 8} fontSize="5.5" fill="#f97316" textAnchor="middle" fontWeight="bold">NOW</text>
              <text x={curX} y={curY - 3.5} fontSize="4.5" fill="#f9731880" textAnchor="middle">158°F</text>

              {/* Target dot */}
              <circle cx={sx(268)} cy={sy(203)} r="3" fill="#22c55e" />
              <text x={sx(268) + 4} y={sy(203) + 2} fontSize="5" fill="#22c55e">Done</text>

              {/* X-axis labels */}
              <text x={sx(0)} y={H + 8} fontSize="5" fill="#444">Now</text>
              <text x={sx(90)} y={H + 8} fontSize="5" fill="#444" textAnchor="middle">+1.5h</text>
              <text x={sx(180)} y={H + 8} fontSize="5" fill="#444" textAnchor="middle">+3h</text>
              <text x={sx(268)} y={H + 8} fontSize="5" fill="#444" textAnchor="end">+~4.5h</text>
            </svg>

            <p className="text-gray-600 text-[7px] mt-2">AI predicts done around <span className="text-blue-400 font-semibold">2:15 AM</span> — confidence 87%</p>
          </div>

          {/* Visual analysis scores */}
          <div className="mx-3 rounded-2xl p-3 mb-1" style={{ background: "#1a1a1a" }}>
            <p className="text-gray-500 text-[8px] font-bold uppercase mb-2">Visual Quality Scores</p>
            {scores.map(({ label, pct, color }) => (
              <div key={label} className="mb-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <p className="text-gray-300 text-[8px]">{label}</p>
                  <p className="text-[8px] font-bold" style={{ color }}>{pct}%</p>
                </div>
                <div className="h-1 rounded-full" style={{ background: "#2a2a2a" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom nav */}
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
