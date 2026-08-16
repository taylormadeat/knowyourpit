import React, { useState, useEffect } from 'react';

const ALL_SEASONINGS = {
  steakNight:    { name: "Steak Night",    desc: "Steak seasoning — date night just got better",           img: "/__mockup/images/bp-steak-night.png",    accent: "#E84820" },
  porken:        { name: "PORKEN",         desc: "BBQ rub — your everyday meat rub for pork & chicken",   img: "/__mockup/images/bp-porken.png",         accent: "#F97316" },
  sizzle:        { name: "Sizzle",         desc: "Chipotle BBQ rub — Porken's sassy southwestern cousin", img: "/__mockup/images/bp-sizzle.png",         accent: "#EF4444" },
  everydayTacos: { name: "Everyday Tacos", desc: "Taco seasoning — making tacos easy",                    img: "/__mockup/images/bp-everyday-tacos.png", accent: "#84CC16" },
  cajunBlast:    { name: "Cajun Blast",    desc: "Cajun seasoning — blast your food with flavor",          img: "/__mockup/images/bp-cajun-blast.png",    accent: "#EF4444" },
  highTide:      { name: "High Tide",      desc: "A fisherman's delight — seafood seasoning",              img: "/__mockup/images/bp-high-tide.png",      accent: "#22D3EE" },
};

const PAIRINGS: Record<string, (keyof typeof ALL_SEASONINGS)[]> = {
  brisket:  ["steakNight", "sizzle", "cajunBlast"],
  ribs:     ["porken", "cajunBlast", "sizzle"],
  chicken:  ["porken", "everydayTacos", "sizzle"],
  seafood:  ["highTide", "cajunBlast"],
  other:    ["sizzle", "everydayTacos", "cajunBlast"],
};

const MEAT_TYPES = [
  { id: 'brisket', label: 'Brisket' },
  { id: 'ribs', label: 'Pork Ribs' },
  { id: 'chicken', label: 'Chicken' },
  { id: 'seafood', label: 'Seafood' },
  { id: 'other', label: 'Other' }
];

export default function PlanResultsCard() {
  const [selectedCut, setSelectedCut] = useState<string>('brisket');
  const [carouselIndex, setCarouselIndex] = useState<number>(0);

  useEffect(() => {
    setCarouselIndex(0);
  }, [selectedCut]);

  useEffect(() => {
    const activePairings = PAIRINGS[selectedCut];
    if (!activePairings || activePairings.length <= 1) return;

    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % activePairings.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedCut]);

  const activePairings = PAIRINGS[selectedCut];
  const currentSeasoningKey = activePairings[carouselIndex] || activePairings[0];
  const currentSeasoning = ALL_SEASONINGS[currentSeasoningKey];

  return (
    <div 
      className="w-[390px] h-[844px] mx-auto bg-[#131210] text-[#F0E8D5] flex flex-col overflow-hidden relative" 
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="flex-1" />

      {/* Meat Selector */}
      <div className="mt-[16px] mb-[4px] mx-[16px]">
        <div className="text-[11px] text-[#8A7D70] mb-[6px]">Pair with your cut:</div>
        <div 
          className="flex overflow-x-auto gap-[8px] flex-nowrap" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {MEAT_TYPES.map((meat) => {
            const isActive = selectedCut === meat.id;
            return (
              <button
                key={meat.id}
                onClick={() => setSelectedCut(meat.id)}
                className={`shrink-0 px-[14px] py-[7px] rounded-[20px] text-[12px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#E84820] text-white border-none'
                    : 'bg-[#1C1915] text-[#8A7D70] border border-[#2C2520]'
                }`}
                style={isActive ? { padding: '7px 15px' } : {}} /* Compensate for 1px border on inactive */
              >
                {meat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cook Schedule Card */}
      <div className="mx-[16px] mb-[12px] bg-[#1C1915] border border-[#2C2520] rounded-[12px] overflow-hidden">
        <div className="px-[12px] py-[9px] bg-gradient-to-r from-[#E84820] to-[#FF6B2B]">
          <span className="text-[13px] font-semibold text-white">🕐 Your Cook Schedule</span>
        </div>
        
        <div className="flex flex-col">
          {[
            { label: '🔥 Preheat Grill', time: '12:00 PM' },
            { label: '🥩 Meat On', time: '12:30 PM' },
            { label: '📦 Wrap', time: '7:00 PM' },
            { label: '✅ Rest & Serve', time: '11:00 PM' },
          ].map((item, idx, arr) => (
            <div 
              key={idx} 
              className={`px-[12px] py-[9px] flex justify-between items-center ${
                idx !== arr.length - 1 ? 'border-b border-[#2C2520]' : ''
              }`}
            >
              <span className="text-[13px] text-[#F0E8D5]">{item.label}</span>
              <span className="text-[13px] text-[#E84820]">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Start Cooking Button */}
      <button className="mx-[16px] mb-[14px] h-[52px] bg-[#E84820] rounded-[12px] flex items-center justify-center text-white text-[16px] font-semibold cursor-pointer">
        🔥 Start Cooking Now
      </button>

      {/* Big Pete's Partner Card */}
      <div className="mx-[16px] mb-[8px]">
        <div className="bg-[#1C1915] border-[1.5px] border-[rgba(232,72,32,0.35)] rounded-[14px] overflow-hidden">
          {/* Top Strip */}
          <div 
            className="h-[5px] w-full" 
            style={{ 
              background: currentSeasoning.accent,
              transition: 'background 0.4s ease'
            }} 
          />
          
          <div className="p-[14px]">
            {/* Header Badge & Dot Indicator */}
            <div className="flex items-center justify-between mb-[10px]">
              <div className="inline-block bg-[#E84820]/15 text-[#E84820] text-[10px] uppercase tracking-[0.06em] px-[8px] py-[3px] rounded-[20px]">
                🤝 Featured Partner
              </div>
              <div className="flex gap-[5px]">
                {activePairings.map((_, idx) => (
                  <div 
                    key={idx}
                    style={{
                      width: carouselIndex === idx ? 18 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: carouselIndex === idx ? currentSeasoning.accent : '#2C2520',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex items-center gap-[14px] mt-[10px]">
              <div className="flex-1">
                <div className="text-[17px] font-bold text-[#F0E8D5]">{currentSeasoning.name}</div>
                <div className="text-[12px] text-[#8A7D70] leading-[17px] mt-[3px]">
                  {currentSeasoning.desc}
                </div>
                <div className="text-[11px] italic text-[#E84820] mt-[5px]">
                  Perfect pairing for this cook
                </div>
              </div>
              <div className="w-[76px] h-[76px] shrink-0 bg-[#0D0C0B] rounded-[10px] overflow-hidden flex items-center justify-center">
                <img 
                  src={currentSeasoning.img} 
                  alt={currentSeasoning.name}
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>
            
            {/* Divider */}
            <div className="h-px w-full bg-[#2C2520] mt-[12px] mb-[10px]" />
            
            {/* Bottom Row */}
            <div className="flex items-center justify-between">
              <div className="bg-[#E84820]/15 border border-[#E84820]/40 rounded-[6px] px-[10px] py-[5px] text-[12px] font-semibold text-[#E84820]">
                Code: KYP15
              </div>
              <div className="text-[13px] font-semibold text-[#E84820] cursor-pointer">
                Shop Big Pete's &rarr;
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Text */}
      <div className="text-[10px] text-[#8A7D70] text-center mt-[4px] mb-[16px]">
        15% off &middot; bigpetesseasoning.com
      </div>
      
    </div>
  );
}
