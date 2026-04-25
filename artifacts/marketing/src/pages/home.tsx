import { Flame, Clock, Brain, Activity, ChefHat } from "lucide-react";
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Flame className="w-4 h-4" />
              The Pitmaster's Brain, Digitized
            </span>
          </motion.div>
          
          <motion.h1 
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white max-w-4xl mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          >
            Never ruin a <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-primary to-orange-600">brisket</span> again.
          </motion.h1>
          
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
