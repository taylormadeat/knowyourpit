import { Flame, Clock, Brain, Activity, ChefHat, Camera, LineChart, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL;

export default function Home() {
  return (
    <div className="w-full flex flex-col">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-[78vh] md:min-h-[90vh] flex items-center justify-center overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-black">
          <img
            src={`${BASE}hero-smoker.png`}
            alt="BBQ Smoker glowing coals"
            className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        <div className="container relative z-10 px-4 flex flex-col items-center text-center">
          <h1 className="sr-only">KnowYourPit — AI BBQ assistant for low-and-slow cooks</h1>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="mb-6 md:mb-8"
          >
            <img
              src={`${BASE}logo.png`}
              alt="KnowYourPit"
              className="w-44 sm:w-56 md:w-80 lg:w-96 rounded-3xl [filter:drop-shadow(0_0_60px_rgba(210,80,30,0.5))]"
            />
          </motion.div>

          <motion.p
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 md:mb-10 leading-relaxed"
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
            className="w-full sm:w-auto flex justify-center"
          >
            <a
              href="https://apps.apple.com/app/id6763445064"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-full sm:w-auto h-14 px-8 rounded-lg bg-primary text-primary-foreground font-bold text-base md:text-lg transition-all md:hover:bg-primary/90 md:hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(210,80,30,0.5)]"
            >
              Available on iOS
            </a>
          </motion.div>
        </div>
      </section>

      {/* ─── App preview ───────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background border-b border-white/5">
        <div className="container px-4">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="flex flex-col items-center md:items-start order-2 md:order-1">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                The App
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-center md:text-left">
                Your pit, in your pocket.
              </h2>
              <p className="text-muted-foreground text-base md:text-lg text-center md:text-left mb-6 leading-relaxed">
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
              {/* Responsive phone frame containing the real Home/Dashboard screenshot.
                  The top black band masks the iOS status bar and Expo dev pill from the
                  source PNG so they never appear on the marketing site. */}
              <div className="relative w-[min(260px,80vw)] sm:w-[280px] md:w-[300px] aspect-[35/76] rounded-[2.5rem] md:rounded-[3rem] border-[8px] md:border-[10px] border-zinc-800 bg-black shadow-[0_30px_80px_-20px_rgba(221,107,32,0.4)] overflow-hidden">
                <img
                  src={`${BASE}app-dashboard.png`}
                  alt="KnowYourPit home screen showing PitMaster Score, recent cooks, and grill stats"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
                {/* Top black band that hides the iOS chrome + dev bar from the source PNG */}
                <div className="absolute top-0 inset-x-0 h-[10%] bg-black z-[5]" />
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 md:w-32 h-5 md:h-6 bg-zinc-900 rounded-b-2xl z-10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Inside the app (real screenshots) ─────────────────────────── */}
      <section className="py-16 md:py-24 bg-background border-b border-white/5">
        <div className="container px-4">
          <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              Inside the app
            </span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Real screens, real cooks.
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Every screen below is straight out of the live app — no mockups, no stock photos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {[
              {
                src: "app-image-scanner.png",
                title: "Snap any thermometer",
                caption: "Upload a photo of an analog gauge or thermal camera — the AI reads the temperature graph and grades the cook.",
                alt: "PitMaster Image Scanner reading a temperature graph from photos",
              },
              {
                src: "app-pitmaster-plan.png",
                title: "AI cook schedule",
                caption: "Tell PitMaster what you're cooking. It builds a hour-by-hour plan with wrap timing and serve time.",
                alt: "PitMaster Plan screen showing a suggested cook schedule for spare ribs",
              },
              {
                src: "app-decisions.png",
                title: "What to do next",
                caption: "Mid-cook, get ranked next moves — hold steady, wrap now, raise pit temp — with the why behind each one.",
                alt: "Decisions screen showing Hold Steady, Wrap Now, and Raise Pit Temp options",
              },
              {
                src: "app-plan-cook.png",
                title: "Built-in prep guides",
                caption: "Each cut comes with a prep guide so you know exactly how to trim, season, and time it.",
                alt: "Plan a Cook screen showing a prep guide for St. Louis spare ribs",
              },
              {
                src: "app-cook-log.png",
                title: "Every cook, scored",
                caption: "Tenderness, flavor, and bark ratings on every session so PitMaster gets sharper over time.",
                alt: "Cook Log screen listing past cooks with star ratings",
              },
            ].map((shot, i) => (
              <motion.figure
                key={shot.src}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: (i % 3) * 0.1 }}
                className="flex flex-col gap-4"
              >
                <div className="relative w-full aspect-[35/76] rounded-[2rem] border-[8px] border-zinc-800 bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] overflow-hidden">
                  <img
                    src={`${BASE}${shot.src}`}
                    alt={shot.alt}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                  {/* Mask iOS chrome + Expo dev bar from source PNG */}
                  <div className="absolute top-0 inset-x-0 h-[10%] bg-black z-[5]" />
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-4 bg-zinc-900 rounded-b-2xl z-10" />
                </div>
                <figcaption className="px-1">
                  <h3 className="text-base md:text-lg font-bold text-foreground mb-1">{shot.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{shot.caption}</p>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Three steps ───────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-card/40 border-b border-white/5">
        <div className="container px-4">
          <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              How it works
            </span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Three steps to a better cook.
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              No docs to read. Just light the fire and start.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
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
                className="relative rounded-2xl bg-background border border-white/10 p-6 md:p-8 flex flex-col"
              >
                <div className="absolute -top-3 md:-top-4 left-6 md:left-8 text-6xl md:text-7xl font-black text-primary/10 leading-none select-none">
                  {step.num}
                </div>
                <div className="relative z-10">
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <step.icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Serious tools ─────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container px-4">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl max-w-md w-full mx-auto md:max-w-none">
              <img
                src={`${BASE}brisket-smoke.png`}
                alt="Smoking brisket on cutting board"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent" />
            </div>

            <div className="flex flex-col gap-6 md:gap-8">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Serious BBQ requires serious tools.</h2>
                <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                  You wouldn't use a cheap thermometer on a $90 piece of meat. Why use a generic timer app? KnowYourPit is built specifically for low-and-slow cooking.
                </p>
              </div>

              <div className="grid gap-4 md:gap-6">
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
                    <div className="w-11 h-11 md:w-12 md:h-12 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <feature.icon className="w-5 h-5 md:w-6 md:h-6" />
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

      {/* ─── Stats ─────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-card border-y border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src={`${BASE}glowing-coals.png`} className="w-full h-full object-cover" alt="" />
        </div>
        <div className="container relative z-10 px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-10 md:mb-12">The proof is in the bark.</h2>
          <div className="grid md:grid-cols-3 gap-5 md:gap-8">
            <div className="p-6 md:p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-3 md:gap-4">
              <div className="text-4xl font-black text-primary">100+</div>
              <h3 className="font-bold">Grill Profiles</h3>
              <p className="text-sm text-muted-foreground">From Kamado Joes to custom 500-gallon offsets. The AI knows how they run.</p>
            </div>
            <div className="p-6 md:p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-3 md:gap-4">
              <div className="text-4xl font-black text-primary">24/7</div>
              <h3 className="font-bold">Cloud Sync</h3>
              <p className="text-sm text-muted-foreground">Your cook history, recipes, and notes synced instantly to all your devices.</p>
            </div>
            <div className="p-6 md:p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-3 md:gap-4">
              <div className="text-4xl font-black text-primary">Smart</div>
              <h3 className="font-bold">Vision Scanning</h3>
              <p className="text-sm text-muted-foreground">No smart probe? Snap a pic of your analog gauge and let the AI log it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 md:py-32 flex flex-col items-center justify-center text-center px-4 bg-background">
        <ChefHat className="w-14 h-14 md:w-16 md:h-16 text-primary mb-5 md:mb-6" />
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-5 md:mb-6">Fire it up.</h2>
        <p className="text-base md:text-xl text-muted-foreground max-w-2xl mb-8 md:mb-10 leading-relaxed">
          Join the pitmasters who have stopped guessing and started knowing.
        </p>
        <a
          href="https://apps.apple.com/app/id6763445064"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center w-full max-w-xs sm:max-w-none sm:w-auto h-14 px-10 sm:px-12 rounded-lg bg-white text-black font-bold text-base md:text-lg md:hover:bg-gray-200 active:scale-95 transition-all"
        >
          Download on the App Store
        </a>
      </section>
    </div>
  );
}
