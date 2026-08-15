import React from 'react';
import { Clock, Flame } from 'lucide-react';

export default function PlanResultsCard() {
  return (
    <div 
      className="w-[390px] h-[844px] mx-auto bg-[#131210] text-[#F0E8D5] flex flex-col font-sans overflow-hidden" 
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Spacer to push content towards bottom like a real app screen */}
      <div className="flex-1" />

      {/* TOP SECTION: Cook Schedule Card */}
      <div className="mx-4 mb-6 bg-[#1C1915] border border-[#2C2520] rounded-[12px] overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-[#E84820] to-[#FF6B2B]">
          <Clock className="w-4 h-4 text-white" />
          <span className="text-[13px] font-semibold text-white">Your Cook Schedule</span>
        </div>
        
        {/* Timeline body */}
        <div className="p-[14px]">
          <div className="relative">
            {/* Timeline track line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-[#2C2520]" />
            
            {/* Timeline rows */}
            <div className="flex flex-col gap-4">
              <TimelineRow emoji="🔥" label="Preheat Grill" time="11:30 AM" />
              <TimelineRow emoji="🥩" label="Meat On" time="12:00 PM" />
              <TimelineRow emoji="📦" label="Wrap (Foil)" time="6:30 PM" />
              <TimelineRow emoji="✅" label="Rest & Serve" time="10:00 PM" />
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE: Start Cooking Button */}
      <button className="mx-4 h-[52px] bg-[#E84820] rounded-[12px] flex items-center justify-center gap-2 text-white text-[17px] font-semibold active:opacity-80 transition-opacity">
        <Flame className="w-5 h-5 fill-current" />
        Start Cooking Now
      </button>

      {/* PARTNER CARD */}
      <div className="mx-4 mt-3 bg-[#1C1915] border border-[#E84820]/40 rounded-[12px] p-[14px] flex flex-col mb-10">
        
        {/* Top row: Badge */}
        <div className="flex mb-3">
          <div className="bg-[#E84820]/15 text-[#E84820] text-[11px] font-medium rounded-[20px] px-2 py-[3px] flex items-center gap-1 border border-[#E84820]/10">
            <span>🤝</span> Featured Partner
          </div>
        </div>
        
        {/* Main row: Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 rounded-[12px] bg-[#E84820]/20 flex items-center justify-center text-2xl border border-[#E84820]/20">
            🧂
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-bold text-[#F0E8D5]">Big Pete's Seasoning</span>
            <span className="text-[12px] text-[#8A7D70]">Bold & Smoky — built for brisket</span>
          </div>
        </div>
        
        {/* Bottom row: Promo code and Shop link */}
        <div className="flex items-center justify-between mt-[10px]">
          <div className="bg-[#E84820]/15 text-[#E84820] text-[12px] font-semibold border border-[#E84820]/40 rounded-[6px] px-2.5 py-1">
            Code: KYP15
          </div>
          <button className="text-[#E84820] text-[12px] font-medium active:opacity-70 transition-opacity hover:underline">
            Shop &rarr;
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#2C2520] w-full mt-3 mb-2" />
        
        {/* Very bottom text */}
        <div className="text-[11px] text-[#8A7D70] text-center">
          15% off your first order &middot; bigpetesseasoning.com
        </div>
      </div>
      
      {/* Bottom SafeArea Spacer */}
      <div className="h-8" />
    </div>
  );
}

function TimelineRow({ emoji, label, time }: { emoji: string; label: string; time: string }) {
  return (
    <div className="flex items-center relative z-10">
      {/* Node */}
      <div className="w-[11px] h-[11px] rounded-full bg-[#1C1915] border-[2px] border-[#E84820] flex-shrink-0" />
      
      {/* Content */}
      <div className="flex items-center justify-between w-full ml-3">
        <span className="text-[12px] text-[#8A7D70] flex items-center gap-1.5">
          <span className="text-[14px]">{emoji}</span>
          {label}
        </span>
        <span className="text-[12px] text-[#E84820] font-medium">{time}</span>
      </div>
    </div>
  );
}
