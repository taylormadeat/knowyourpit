import { Flame, Clock, Brain, Activity, ChefHat, Camera, LineChart, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL;

export default function Home() {
  return (
    <div className="w-full flex flex-col">
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden py-24">
        <div className="absolute inset-0 bg-black">
          <img 
            src={`${BASE}hero-smoker.png`} 
            alt="BBQ Smoker glowing coals" 
            className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        
        <div className="container relative z-10 px-4 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="mb-8"
          >
            <img
              src={`${BASE}logo.png`}
              alt="KnowYourPit"
              className="w-56 md:w-80 lg:w-96 rounded-3xl [filter:drop-shadow(0_0_60px_rgba(221,107,32,0.45))]"
            />
          </motion.div>

          <motion.p 
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            KnowYourPit tracks your MEATER and ThermoWorks probes, learns your grill profile, and tells you exactly when to wrap, when to add fuel, and when to rest. 
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          >
            <a 
              href="https://apps.apple.com/app/id6763445064" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center justify-center h-14 px-8 rounded-lg bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(221,107,32,0.5)]"
            >
              Available on iOS
            </a>
          </motion.div>
        </div>
      </section>

      <section className="py-24 bg-background border-b border-white/5">
        <div className="container px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col items-center md:items-start order-2 md:order-1">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                The App
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-center md:text-left">
                Your pit, in your pocket.
              </h2>
              <p className="text-muted-foreground text-lg text-center md:text-left mb-6">
                Live probe temps, predicted finish times, and the next move on your cook — all in one feed. Designed for one-handed use while you're holding tongs.
              </p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="rounded-lg border border-white/10 bg-card/40 p-3 text-sm">
                  <div className="text-primary font-bold">203°F</div>
                  <div className="text-muted-foreground text-xs">Probe 1 — Brisket</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-card/40 p-3 text-sm">
                  <div className="text-primary font-bold">274°F</div>
                  <div className="text-muted-foreground text-xs">Pit temp</div>
                </div>
                <div className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <div className="text-foreground font-medium">Wrap in ~22 min</div>
                  <div className="text-muted-foreground text-xs">Stall detected. Spritz now.</div>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2 flex justify-center">
              <div className="relative w-[300px] h-[600px] rounded-[3rem] border-[10px] border-zinc-800 bg-black shadow-[0_30px_80px_-20px_rgba(221,107,32,0.4)] overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-2xl z-10" />
                <div className="w-full h-full bg-gradient-to-b from-[#0e0e10] to-[#1a1a1f] flex flex-col">
                  <div className="px-6 pt-12 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Active cook</div>
                      <div className="flex items-center gap-1 text-[10px] text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Live
                      </div>
                    </div>
                    <div className="text-foreground font-bold text-lg">Texas brisket</div>
                    <div className="text-muted-foreground text-xs">14.2 lb · Offset · 6h 22m elapsed</div>
                  </div>
                  <div className="px-6">
                    <div className="rounded-2xl bg-card/80 border border-white/10 p-5 mb-3">
                      <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Internal</div>
                      <div className="text-5xl font-black text-primary leading-none">203°</div>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full w-[81%] bg-gradient-to-r from-orange-600 to-primary" />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>0°</span>
                        <span className="text-primary">81% to 250°</span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 mb-3">
                      <div className="text-primary text-[10px] font-bold uppercase tracking-wider mb-1">AI suggestion</div>
                      <div className="text-foreground text-sm">Wrap in butcher paper in ~22 min</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-card/60 border border-white/5 p-3">
                        <div className="text-muted-foreground text-[10px]">Pit temp</div>
                        <div className="text-foreground font-bold">274°</div>
                      </div>
                      <div className="rounded-lg bg-card/60 border border-white/5 p-3">
                        <div className="text-muted-foreground text-[10px]">Outdoor</div>
                        <div className="text-foreground font-bold">62°</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card/40 border-b border-white/5">
        <div className="container px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              How it works
            </span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Three steps to a better cook.
            </h2>
            <p className="text-muted-foreground text-lg">
              No docs to read. Just light the fire and start.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                icon: ChefHat,
                title: "Set up your pit",
                desc: "Tell us what you're cooking on — Kamado, offset, pellet, kettle. Pair your MEATER or ThermoWorks if you have one. Takes about 60 seconds.",
              },
              {
                num: "02",
                icon: Camera,
                title: "Start the cook",
                desc: "Pick a recipe or just enter what you're cooking. Snap a photo of any analog gauge if you don't have a smart probe. We'll log everything for you.",
              },
              {
                num: "03",
                icon: Bell,
                title: "Cook smarter, not harder",
                desc: "Get pinged when it's time to wrap, spritz, add fuel, or pull. The AI watches your stall, your weather, and your grill so you don't have to.",
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative rounded-2xl bg-background border border-white/10 p-8 flex flex-col"
              >
                <div className="absolute -top-4 left-8 text-7xl font-black text-primary/10 leading-none select-none">
                  {step.num}
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <step.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img 
                src={`${BASE}brisket-smoke.png`} 
                alt="Smoking brisket on cutting board" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent" />
            </div>
            
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Serious BBQ requires serious tools.</h2>
                <p className="text-muted-foreground text-lg">
                  You wouldn't use a cheap thermometer on a $90 piece of meat. Why use a generic timer app? KnowYourPit is built specifically for low-and-slow cooking.
                </p>
              </div>
              
              <div className="grid gap-6">
                {[
                  { icon: Brain, title: "AI Cook Assistant", desc: "It learns how your smoker behaves in different weather and predicts the stall before it happens." },
                  { icon: Activity, title: "Hardware Agnostic", desc: "Connects to MEATER Cloud, ThermoWorks, or you can just snap a photo of any thermometer." },
                  { icon: Clock, title: "Fuel & Wrap Reminders", desc: "Get alerted precisely when it's time to spritz, wrap in butcher paper, or add more hickory." }
                ].map((feature, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 p-4 rounded-xl bg-card/50 border border-white/5"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-y border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src={`${BASE}glowing-coals.png`} className="w-full h-full object-cover" alt="" />
        </div>
        <div className="container relative z-10 px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-12">The proof is in the bark.</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-4">
              <div className="text-4xl font-black text-primary">100+</div>
              <h3 className="font-bold">Grill Profiles</h3>
              <p className="text-sm text-muted-foreground">From Kamado Joes to custom 500-gallon offsets. The AI knows how they run.</p>
            </div>
            <div className="p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-4 mt-8 md:mt-0">
              <div className="text-4xl font-black text-primary">24/7</div>
              <h3 className="font-bold">Cloud Sync</h3>
              <p className="text-sm text-muted-foreground">Your cook history, recipes, and notes synced instantly to all your devices.</p>
            </div>
            <div className="p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-4 mt-8 md:mt-0">
              <div className="text-4xl font-black text-primary">Smart</div>
              <h3 className="font-bold">Vision Scanning</h3>
              <p className="text-sm text-muted-foreground">No smart probe? Snap a pic of your analog gauge and let the AI log it.</p>
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-32 flex flex-col items-center justify-center text-center px-4 bg-background">
        <ChefHat className="w-16 h-16 text-primary mb-6" />
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">Fire it up.</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mb-10">
          Join the pitmasters who have stopped guessing and started knowing.
        </p>
        <a 
          href="https://apps.apple.com/app/id6763445064" 
          target="_blank" 
          rel="noreferrer"
          className="inline-flex items-center justify-center h-14 px-12 rounded-lg bg-white text-black font-bold text-lg hover:bg-gray-200 transition-colors"
        >
          Download on the App Store
        </a>
      </section>
    </div>
  );
}
