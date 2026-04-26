export function Screen5CookPlanner() {
  const bg = { background: "radial-gradient(ellipse at 80% 20%, #1a1a00 0%, #0d0d00 50%, #060600 100%)" };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={bg}>
      <p className="text-orange-400 text-xs font-bold tracking-[0.25em] uppercase">knowyourpit</p>
      <h1 className="text-white text-2xl font-black text-center leading-tight max-w-[280px]">
        Plan the cook.<br />Nail the pull.
      </h1>
      <IPhoneFrame>
        <img
          src="/ss-plan-cook.png"
          alt="Plan a Cook screen with Pulled Pork selected and a detailed prep guide expanded"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
        />
      </IPhoneFrame>
      <p className="text-gray-500 text-[10px] text-center">Available on the App Store</p>
    </div>
  );
}

function IPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative" style={{ width: "290px", height: "590px" }}>
      <div className="absolute inset-0 rounded-[50px] shadow-2xl" style={{ background: "linear-gradient(145deg, #5a5a5a 0%, #3a3a3a 40%, #2a2a2a 100%)", padding: "7px" }}>
        <div className="w-full h-full rounded-[44px] overflow-hidden bg-black relative">
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
