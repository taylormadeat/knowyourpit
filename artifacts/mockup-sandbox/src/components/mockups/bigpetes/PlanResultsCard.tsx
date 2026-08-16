import React, { useState } from 'react';

type MeatType = 'brisket' | 'ribs' | 'chicken' | 'seafood' | 'other';

const MEAT_TYPES: { id: MeatType; label: string }[] = [
  { id: 'brisket', label: 'Brisket' },
  { id: 'ribs', label: 'Pork Ribs' },
  { id: 'chicken', label: 'Chicken' },
  { id: 'seafood', label: 'Seafood' },
  { id: 'other', label: 'Other' }
];

const PAIRINGS: Record<string, { name: string; desc: string; img: string; tags: string }> = {
  brisket:  { name: "Steak Night",    desc: "The ultimate flavor for steaks, brisket, and burgers", img: "/__mockup/images/bp-steak-night.png",    tags: "Beef · Steak · Brisket" },
  ribs:     { name: "PORKEN",         desc: "Sweet & smoky competition rub — top honors in pork & chicken", img: "/__mockup/images/bp-porken.png",         tags: "Pork · Ribs · Chicken" },
  chicken:  { name: "Everyday Tacos", desc: "Bold flavor for chicken, tacos, and everything in between", img: "/__mockup/images/bp-everyday-tacos.png", tags: "Chicken · Tacos · Fajitas" },
  seafood:  { name: "Cajun Blast",    desc: "Bold Cajun kick with a slow-building heat for any protein", img: "/__mockup/images/bp-cajun-blast.png",    tags: "Seafood · Spicy · Everything" },
  other:    { name: "Sizzle",         desc: "Big Pete's versatile everyday seasoning for any cook", img: "/__mockup/images/bp-sizzle.png",         tags: "Everything · Versatile" },
};

export default function PlanResultsCard() {
  const [selectedMeat, setSelectedMeat] = useState<MeatType>('brisket');
  const seasoning = PAIRINGS[selectedMeat];

  return (
    <div 
      className="w-[390px] h-[844px] mx-auto bg-[#131210] text-[#F0E8D5] flex flex-col font-sans overflow-hidden relative" 
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Spacer to push content down */}
      <div className="flex-1" />

      {/* Meat Selector */}
      <div className="mt-[16px] mb-[4px] mx-[16px]">
        <div className="text-[11px] text-[#8A7D70] mb-[6px]">Pair with your cut:</div>
        <div 
          className="flex overflow-x-auto gap-[8px] scrollbar-hide" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {MEAT_TYPES.map((meat) => {
            const isActive = selectedMeat === meat.id;
            return (
              <button
                key={meat.id}
                onClick={() => setSelectedMeat(meat.id)}
                className={`shrink-0 px-[14px] py-[7px] rounded-[20px] text-[12px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#E84820] text-white border-none'
                    : 'bg-[#1C1915] text-[#8A7D70] border border-[#2C2520]'
                }`}
                style={isActive ? { padding: '7px 15px' } : {}} /* Compensate for 1px border */
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
      <button className="mx-[16px] mb-[14px] h-[52px] bg-[#E84820] rounded-[12px] flex items-center justify-center text-white text-[16px] font-semibold">
        🔥 Start Cooking Now
      </button>

      {/* Big Pete's Partner Card */}
      <div className="mx-[16px] mb-[16px]">
        <div className="bg-[#1C1915] border-[1.5px] border-[rgba(232,72,32,0.35)] rounded-[14px] overflow-hidden">
          {/* Top Strip */}
          <div className="h-[5px] w-full bg-gradient-to-r from-[#E84820] to-[#FF6B2B]" />
          
          <div className="p-[14px]">
            {/* Header Badge */}
            <div className="inline-block bg-[#E84820]/15 text-[#E84820] text-[10px] uppercase tracking-[0.06em] px-[8px] py-[3px] rounded-[20px] mb-[12px]">
              🤝 Featured Partner
            </div>
            
            {/* Main Content */}
            <div className="flex items-start gap-[14px]">
              <div className="flex-1">
                <div className="text-[17px] font-bold text-[#F0E8D5] leading-[22px]">{seasoning.name}</div>
                <div className="text-[11px] text-[#E84820] mt-[2px]">
                  {seasoning.tags}
                </div>
                <div className="text-[12px] text-[#8A7D70] leading-[17px] mt-[5px]">
                  {seasoning.desc}
                </div>
                <div className="text-[11px] italic text-[#E84820] mt-[5px]">
                  Perfect pairing for this cook
                </div>
              </div>
              <div className="w-[76px] h-[76px] shrink-0 bg-[#0D0C0B] rounded-[10px] overflow-hidden flex items-center justify-center">
                <img 
                  src={seasoning.img} 
                  alt={seasoning.name}
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
        
        {/* Footer Text */}
        <div className="text-[10px] text-[#8A7D70] text-center mt-[4px]">
          15% off your first order &middot; bigpetesseasoning.com
        </div>
      </div>
      
    </div>
  );
}
