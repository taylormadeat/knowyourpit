import React from 'react';

export default function HomePartnerCard() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black p-4">
      <div 
        className="w-[390px] h-[844px] bg-[#131210] relative overflow-hidden text-[#F0E8D5] shadow-2xl ring-1 ring-white/10" 
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        {/* Status Bar */}
        <div className="flex justify-between items-center px-5 pt-[14px] pb-2 text-[11px] font-semibold tracking-wide text-[#F0E8D5]">
          <span>9:41</span>
          <div className="flex space-x-1.5 items-center">
            <span className="text-[11px]">📶</span>
            <span className="text-[11px]">🛜</span>
            <span className="text-[11px]">🔋</span>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="w-full bg-gradient-to-r from-[#1C1C1F] to-[#2D1A0E] px-5 pt-3 pb-5">
          <div className="text-[13px] text-[#8A7D70] mb-1 font-medium">Good morning, Aaron 👋</div>
          <div className="text-[22px] font-bold text-[#F0E8D5] mb-4">Ready to cook?</div>
          
          <div className="flex space-x-2">
            <div className="bg-[#2C2520] rounded-full px-3 py-1.5 flex items-center text-[12px] font-medium text-[#F0E8D5]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E84820] mr-2"></div>
              12 Cooks
            </div>
            <div className="bg-[#2C2520] rounded-full px-3 py-1.5 flex items-center text-[12px] font-medium text-[#F0E8D5]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E84820] mr-2"></div>
              3 Grills
            </div>
            <div className="bg-[#2C2520] rounded-full px-3 py-1.5 flex items-center text-[12px] font-medium text-[#F0E8D5]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#8A7D70] mr-2"></div>
              0 Active
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-[3px] w-full bg-[#E84820] opacity-40"></div>

        {/* Scrollable Content Area */}
        <div className="h-[calc(844px-130px-83px)] overflow-y-auto pb-6 custom-scrollbar">
          
          {/* Active Cooks Section */}
          <div className="flex justify-between items-end mx-5 mt-5 mb-3">
            <div className="text-[17px] font-bold text-[#F0E8D5]">Active Cooks</div>
            <div className="text-[13px] text-[#E84820] font-medium">See all</div>
          </div>

          <div className="bg-[#1C1915] rounded-[12px] mx-5 p-4 flex justify-center items-center">
            <div className="text-[12px] text-[#8A7D70] text-center font-medium">
              No active cooks · Start a new cook on the Plan tab
            </div>
          </div>

          {/* Partner Card */}
          <div className="mx-5 mt-4 mb-2">
            <div className="bg-[#1C1915] border border-[#E84820]/30 rounded-[14px] overflow-hidden relative shadow-lg shadow-black/20">
              {/* TOP strip */}
              <div className="h-[6px] w-full bg-gradient-to-r from-[#E84820] to-[#C63800]"></div>
              
              <div className="p-[14px]">
                <div className="flex justify-between items-start mb-3">
                  <div className="pr-2">
                    <div className="text-[#E84820] text-[10px] uppercase tracking-wider font-semibold mb-1">
                      Featured Partner
                    </div>
                    <div className="text-[#F0E8D5] text-[15px] font-bold mb-1">
                      Big Pete's Seasoning
                    </div>
                    <div className="text-[#8A7D70] text-[12px] leading-[17px] pr-2 font-medium">
                      The secret weapon for competition BBQ
                    </div>
                  </div>
                  <div className="w-[52px] h-[52px] rounded-[26px] bg-[#E84820]/15 flex justify-center items-center text-[24px] shrink-0">
                    🧂
                  </div>
                </div>
                
                <div className="h-[1px] w-full bg-[#2C2520] mb-3"></div>
                
                <div className="flex justify-between items-center">
                  <div className="text-[12px] text-[#8A7D70] font-medium">
                    Use code <span className="font-semibold text-[#F0E8D5]">KYP15</span> for 15% off
                  </div>
                  <div className="text-[13px] font-semibold text-[#E84820] hover:text-[#FF6A45] transition-colors cursor-pointer">
                    Shop Now →
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right mt-1.5 pr-1">
              <span className="text-[10px] text-[#8A7D70] font-medium uppercase tracking-wide">Sponsored</span>
            </div>
          </div>

          {/* Recent Cooks Section */}
          <div className="mx-5 mt-5 mb-3">
            <div className="text-[17px] font-bold text-[#F0E8D5]">Recent Cooks</div>
          </div>

          <div className="mx-5 space-y-2.5">
            {/* Card 1 */}
            <div className="bg-[#1C1915] border border-[#2C2520] rounded-[12px] p-[14px] flex items-center">
              <div className="w-[40px] h-[40px] rounded-[10px] bg-gradient-to-br from-[#E84820]/80 to-[#9B6840]/80 mr-3 shrink-0 flex items-center justify-center text-[20px]">
                🥩
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-[#F0E8D5] mb-0.5">Brisket</div>
                <div className="text-[12px] text-[#8A7D70] font-medium">Completed · 14h 22m</div>
              </div>
              <div className="text-[13px] text-[#E84820] font-semibold bg-[#E84820]/10 px-2 py-1 rounded-md">★ 9.2</div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#1C1915] border border-[#2C2520] rounded-[12px] p-[14px] flex items-center">
              <div className="w-[40px] h-[40px] rounded-[10px] bg-[#2C2520] mr-3 shrink-0 flex items-center justify-center text-[20px]">
                🍖
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-[#F0E8D5] mb-0.5">Pork Ribs</div>
                <div className="text-[12px] text-[#8A7D70] font-medium">Completed · 5h 45m</div>
              </div>
              <div className="text-[13px] text-[#E84820] font-semibold bg-[#E84820]/10 px-2 py-1 rounded-md">★ 8.7</div>
            </div>
          </div>
        </div>

        {/* Bottom Tab Bar */}
        <div className="absolute bottom-0 w-full h-[83px] bg-[#1C1915] border-t border-[#2C2520] px-8 pt-3 pb-8 flex justify-between items-start z-10">
          <div className="flex flex-col items-center space-y-1.5 cursor-pointer">
            <div className="text-[20px] leading-none">🏠</div>
            <div className="text-[10px] text-[#E84820] font-semibold tracking-wide">Home</div>
          </div>
          <div className="flex flex-col items-center space-y-1.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity grayscale">
            <div className="text-[20px] leading-none">📝</div>
            <div className="text-[10px] text-[#8A7D70] font-medium tracking-wide">Plan</div>
          </div>
          <div className="flex flex-col items-center space-y-1.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity grayscale">
            <div className="text-[20px] leading-none">🔥</div>
            <div className="text-[10px] text-[#8A7D70] font-medium tracking-wide">Cook Log</div>
          </div>
          <div className="flex flex-col items-center space-y-1.5 cursor-pointer opacity-40 hover:opacity-100 transition-opacity grayscale">
            <div className="text-[20px] leading-none">⚙️</div>
            <div className="text-[10px] text-[#8A7D70] font-medium tracking-wide">More</div>
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
