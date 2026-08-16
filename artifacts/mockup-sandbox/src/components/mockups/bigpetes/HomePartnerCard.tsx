import React, { useState, useEffect } from 'react';

const seasonings = [
  { name: "Bold & Smoky", tagline: "The brisket whisperer", desc: "Deep oak smoke with cracked pepper crust", img: "/__mockup/images/bigpetes-bold-smoky.png", accent: "#E84820" },
  { name: "Sweet Heat", tagline: "Pork's best friend", desc: "Brown sugar crust with slow-building cayenne", img: "/__mockup/images/bigpetes-sweet-heat.png", accent: "#F97316" },
  { name: "Honey Garlic", tagline: "The crowd pleaser", desc: "Bright garlic and honey with citrus finish", img: "/__mockup/images/bigpetes-honey-garlic.png", accent: "#EAB308" },
  { name: "Competition Blend", tagline: "Trophy-winning all-purpose", desc: "Big Pete's secret weapon since day one", img: "/__mockup/images/bigpetes-competition.png", accent: "#8B5CF6" },
];

export default function HomePartnerCard() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % seasonings.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const current = seasonings[currentIndex];

  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <div 
        className="w-[390px] h-[844px] bg-[#131210] relative overflow-hidden text-[#F0E8D5] shadow-2xl ring-1 ring-white/10 flex flex-col" 
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        {/* Status Bar */}
        <div className="flex justify-between items-center px-[20px] pt-[14px] pb-[6px] text-[13px] font-medium text-[#F0E8D5]">
          <span>9:41</span>
          <div className="flex space-x-1.5 items-center text-[11px] text-[#8A7D70]">
            <span>●</span>
            <span>▲</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pb-6 custom-scrollbar">
          
          {/* Hero Banner */}
          <div className="w-full bg-gradient-to-b from-[#1C1C1F] to-[#2D1A0E] px-[20px] pt-[12px] pb-[16px]">
            <div className="text-[13px] text-[#8A7D70]">Good morning, Aaron 👋</div>
            <div className="text-[22px] font-bold text-[#F0E8D5] mt-[2px]">Ready to cook?</div>
            
            <div className="flex gap-[8px] mt-[12px]">
              <div className="bg-[#2C2520] rounded-[20px] px-[10px] py-[5px] text-[12px] text-[#8A7D70]">
                🍖 12 Cooks
              </div>
              <div className="bg-[#2C2520] rounded-[20px] px-[10px] py-[5px] text-[12px] text-[#8A7D70]">
                🔥 3 Grills
              </div>
              <div className="bg-[#2C2520] rounded-[20px] px-[10px] py-[5px] text-[12px] text-[#8A7D70]">
                ✅ 0 Active
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-[3px] w-full bg-[#E84820]"></div>

          {/* Section Header */}
          <div className="mx-[20px] mt-[18px] mb-[10px] flex justify-between items-end">
            <div className="text-[14px] font-bold text-[#F0E8D5]">Featured Partner</div>
            <div className="text-[11px] text-[#8A7D70]">Sponsored</div>
          </div>

          {/* BIG PETE'S ROTATING CARD */}
          <div 
            className="mx-[16px] rounded-[16px] overflow-hidden bg-[#1C1915]"
            style={{ 
              border: `1.5px solid ${current.accent}40`,
              transition: 'all 0.3s ease'
            }}
          >
            {/* Top Accent Strip */}
            <div 
              className="h-[5px] w-full"
              style={{ 
                backgroundColor: current.accent,
                transition: 'all 0.3s ease'
              }}
            ></div>
            
            <div className="p-[16px]">
              <div className="flex flex-row gap-[14px] items-center">
                <div className="flex-1">
                  <div 
                    className="text-[10px] uppercase tracking-wider mb-[2px]"
                    style={{ 
                      color: current.accent,
                      transition: 'color 0.3s ease'
                    }}
                  >
                    {current.tagline}
                  </div>
                  <div className="text-[17px] font-bold text-[#F0E8D5] transition-all duration-300">
                    {current.name}
                  </div>
                  <div className="text-[12px] text-[#8A7D70] leading-[17px] mt-[3px] transition-all duration-300 h-[34px]">
                    {current.desc}
                  </div>
                  <div className="mt-[10px] flex items-center">
                    <div className="bg-[#E8482015] border border-[#E8482040] rounded-[6px] px-[10px] py-[4px] text-[12px] font-semibold text-[#E84820]">
                      Code: KYP15
                    </div>
                    <div className="text-[13px] text-[#E84820] ml-[10px] font-medium">
                      Shop →
                    </div>
                  </div>
                </div>
                
                <img 
                  src={current.img} 
                  alt={current.name}
                  className="w-[80px] h-[80px] rounded-[12px] object-cover bg-[#2C2520]"
                  style={{ transition: 'opacity 0.3s ease' }}
                />
              </div>
              
              {/* Dots Indicator */}
              <div className="mt-[12px] flex justify-center gap-[6px]">
                {seasonings.map((_, i) => (
                  <div 
                    key={i}
                    className="h-[6px] rounded-[3px]"
                    style={{ 
                      backgroundColor: i === currentIndex ? current.accent : '#2C2520',
                      width: i === currentIndex ? '20px' : '6px',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Section Header */}
          <div className="mx-[20px] mt-[20px] mb-[10px] flex justify-between items-end">
            <div className="text-[17px] font-bold text-[#F0E8D5]">Recent Cooks</div>
            <div className="text-[13px] text-[#E84820]">See all</div>
          </div>

          {/* Cook Cards */}
          <div className="mx-[16px] mb-[8px] bg-[#1C1915] border border-[#2C2520] rounded-[12px] p-[14px] flex flex-row gap-[12px] items-center">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-gradient-to-br from-[#E84820] to-[#FF6B2B] flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-[#F0E8D5]">Brisket</div>
              <div className="text-[12px] text-[#8A7D70]">Completed · 14h 22m</div>
            </div>
            <div className="text-[13px] text-[#E84820] font-medium">
              ★ 9.2
            </div>
          </div>

          <div className="mx-[16px] mb-[8px] bg-[#1C1915] border border-[#2C2520] rounded-[12px] p-[14px] flex flex-row gap-[12px] items-center">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-[#2C2520] flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-[#F0E8D5]">Pork Ribs</div>
              <div className="text-[12px] text-[#8A7D70]">Completed · 5h 45m</div>
            </div>
            <div className="text-[13px] text-[#E84820] font-medium">
              ★ 8.7
            </div>
          </div>
          
          <div className="h-[83px]" /> {/* Spacer for bottom tab bar */}
        </div>

        {/* Bottom Tab Bar */}
        <div className="absolute bottom-0 w-full h-[83px] bg-[#1C1915] border-t border-[#2C2520] flex flex-row justify-around items-center pb-[20px] pt-[12px]">
          <div className="flex flex-col items-center gap-[3px]">
            <div className="text-[20px] text-[#E84820]">🏠</div>
            <div className="text-[10px] text-[#E84820]">Home</div>
          </div>
          <div className="flex flex-col items-center gap-[3px]">
            <div className="text-[20px] text-[#8A7D70]">➕</div>
            <div className="text-[10px] text-[#8A7D70]">Plan</div>
          </div>
          <div className="flex flex-col items-center gap-[3px]">
            <div className="text-[20px] text-[#8A7D70]">📋</div>
            <div className="text-[10px] text-[#8A7D70]">Cook Log</div>
          </div>
          <div className="flex flex-col items-center gap-[3px]">
            <div className="text-[20px] text-[#8A7D70]">☰</div>
            <div className="text-[10px] text-[#8A7D70]">More</div>
          </div>
        </div>
        
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
