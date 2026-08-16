import React, { useState } from 'react';

type MeatType = 'brisket' | 'pork' | 'chicken' | 'other';

const MEAT_TYPES = [
  { id: 'brisket', label: 'Brisket' },
  { id: 'pork', label: 'Pork Ribs' },
  { id: 'chicken', label: 'Chicken' },
  { id: 'other', label: 'Other' }
];

const SEASONING_MAP = {
  brisket: { 
    name: "Bold & Smoky", 
    desc: "Deep oak smoke with cracked pepper — built for the long cook", 
    img: "/__mockup/images/bigpetes-bold-smoky.png",
    pairingText: "Perfect pairing for Brisket"
  },
  pork: { 
    name: "Sweet Heat", 
    desc: "Brown sugar crust with a slow-building cayenne kick", 
    img: "/__mockup/images/bigpetes-sweet-heat.png",
    pairingText: "Perfect pairing for Pork Ribs"
  },
  chicken: { 
    name: "Honey Garlic", 
    desc: "Bright garlic and honey glaze with citrus finish", 
    img: "/__mockup/images/bigpetes-honey-garlic.png",
    pairingText: "Perfect pairing for Chicken"
  },
  other: { 
    name: "Competition Blend", 
    desc: "Big Pete's all-purpose trophy winner — works on anything", 
    img: "/__mockup/images/bigpetes-competition.png",
    pairingText: "Perfect pairing for Any Cut"
  }
};

export default function PlanResultsCard() {
  const [selectedMeat, setSelectedMeat] = useState<MeatType>('brisket');
  const seasoning = SEASONING_MAP[selectedMeat];

  return (
    <div 
      className="w-[390px] h-[844px] mx-auto bg-[#131210] text-[#F0E8D5] flex flex-col font-sans overflow-hidden relative" 
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Spacer to push content to bottom */}
      <div className="flex-1" />

      {/* Top Meat Selector Row */}
      <div className="mt-4 mb-2 mx-4">
        <div className="text-[11px] text-[#8A7D70] mb-2">Selected cut:</div>
        <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {MEAT_TYPES.map((meat) => (
            <button
              key={meat.id}
              onClick={() => setSelectedMeat(meat.id as MeatType)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-[20px] text-[12px] transition-colors border ${
                selectedMeat === meat.id
                  ? 'bg-[#E84820] text-white border-[#E84820]'
                  : 'bg-[#1C1915] text-[#8A7D70] border-[#2C2520]'
              }`}
            >
              {meat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Card */}
      <div className="mx-4 mb-3 bg-[#1C1915] border border-[#2C2520] rounded-[12px] overflow-hidden">
        <div className="px-3 py-2 bg-gradient-to-r from-[#E84820] to-[#FF6B2B] flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-white">🕐 Your Cook Schedule</span>
        </div>
        
        <div className="flex flex-col">
          <div className="px-3 py-2 border-b border-[#2C2520] flex justify-between items-center">
            <span className="text-[12px] text-[#F0E8D5]">🔥 Preheat Grill</span>
            <span className="text-[12px] text-[#E84820]">12:00 PM</span>
          </div>
          <div className="px-3 py-2 border-b border-[#2C2520] flex justify-between items-center">
            <span className="text-[12px] text-[#F0E8D5]">🥩 Meat On</span>
            <span className="text-[12px] text-[#E84820]">12:30 PM</span>
          </div>
          <div className="px-3 py-2 border-b border-[#2C2520] flex justify-between items-center">
            <span className="text-[12px] text-[#F0E8D5]">📦 Wrap</span>
            <span className="text-[12px] text-[#E84820]">7:00 PM</span>
          </div>
          <div className="px-3 py-2 flex justify-between items-center">
            <span className="text-[12px] text-[#F0E8D5]">✅ Rest &amp; Serve</span>
            <span className="text-[12px] text-[#E84820]">11:00 PM</span>
          </div>
        </div>
      </div>

      {/* Start Cooking Button */}
      <button className="mx-4 h-[52px] mb-3 bg-[#E84820] rounded-[12px] flex items-center justify-center text-white text-[16px] font-semibold active:opacity-80 transition-opacity">
        🔥 Start Cooking Now
      </button>

      {/* Big Pete's Partner Card */}
      <div className="mx-4 mb-4">
        <div className="bg-[#1C1915] border-[1.5px] border-[#E84820]/50 rounded-[14px] overflow-hidden relative">
          {/* Top Strip */}
          <div className="h-[5px] w-full bg-gradient-to-r from-[#E84820] to-[#FF6B2B]" />
          
          <div className="p-[14px]">
            {/* Header Row */}
            <div className="inline-block bg-[#E84820]/15 text-[#E84820] text-[10px] uppercase tracking-wider px-2 py-[3px] rounded-[20px] font-medium">
              🤝 Featured Partner
            </div>
            
            {/* Main Content */}
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[16px] font-bold text-[#F0E8D5]">{seasoning.name}</div>
                <div className="text-[12px] text-[#8A7D70] leading-[17px] mt-0.5">
                  {seasoning.desc}
                </div>
                <div className="text-[11px] italic text-[#E84820] mt-1">
                  {seasoning.pairingText}
                </div>
              </div>
              <div className="w-[72px] h-[72px] shrink-0 bg-[#2C2520] rounded-[10px] overflow-hidden relative">
                {/* Fallback color, actual image overlaps */}
                <img 
                  src={seasoning.img} 
                  alt={seasoning.name}
                  className="w-full h-full object-cover absolute inset-0 z-10"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>
            
            {/* Divider */}
            <div className="h-px w-full bg-[#2C2520] mt-3 mb-2.5" />
            
            {/* Bottom Row */}
            <div className="flex items-center justify-between">
              <div className="bg-[#E84820]/15 border border-[#E84820]/40 rounded-[6px] px-2.5 py-1 text-[12px] font-semibold text-[#E84820]">
                Code: KYP15
              </div>
              <div className="text-[13px] font-semibold text-[#E84820] cursor-pointer hover:underline">
                Shop Big Pete's &rarr;
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer Text directly below card */}
        <div className="text-[10px] text-[#8A7D70] text-center mt-1">
          15% off your first order &middot; bigpetesseasoning.com
        </div>
      </div>
      
      {/* Bottom SafeArea Spacer to lift content slightly off bottom edge */}
      <div className="h-4" />
    </div>
  );
}
