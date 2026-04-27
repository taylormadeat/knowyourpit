import { Flame, Clock, Brain, Activity, ChefHat, Camera, LineChart, Bell, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL;

export default function Home() {
  const [muted, setMuted] = useState(true);

  function toggleMute() {
    setMuted((prev) => !prev);
  }

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
          <h1 className="sr-only">knowyourpit — AI that reads your cook data and tells you what it means</h1>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="mb-6 md:mb-8"
          >
            <img
              src={`${BASE}logo.png`}
              alt="knowyourpit"
              className="w-44 sm:w-56 md:w-80 lg:w-96 rounded-3xl [filter:drop-shadow(0_0_60px_rgba(210,80,30,0.5))]"
            />
          </motion.div>

          <motion.p
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 md:mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            Analyze your cook in real-time. knowyourpit reads it — analyzing temperatures, catching stalls early, and delivering real decisions the moment they matter. For the championship pitmaster, that's a precise debrief on how close you hit your plan. For the backyard cook, that's the confidence to nail a cook you've never done before.
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

      {/* ─── See it in action (demo video) ────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background border-b border-white/5">
        <div className="container px-4 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-center max-w-2xl mb-10 md:mb-14"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              See it in action
            </span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Watch the AI work a real cook.
            </h2>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              From logging a cook to getting live decisions — here's what it actually looks like inside the app.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="relative w-[min(280px,85vw)] sm:w-[300px] md:w-[320px]"
          >
            <div className="relative aspect-[888/1920] rounded-[2.5rem] md:rounded-[3rem] border-[8px] md:border-[10px] border-zinc-800 bg-black shadow-[0_40px_100px_-20px_rgba(221,107,32,0.35)] overflow-hidden">
              <video
                src={`${BASE}app-demo.mp4`}
                poster={`${BASE}app-demo-poster.jpg`}
                autoPlay
                muted={muted}
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute video" : "Mute video"}
              aria-pressed={!muted}
              className="absolute bottom-4 right-[-12px] md:right-[-16px] w-10 h-10 rounded-full bg-zinc-900/90 border border-white/10 flex items-center justify-center text-white shadow-lg backdrop-blur-sm transition-all hover:bg-zinc-800 active:scale-95"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
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
                Same data. Same AI. Different insight for every pitmaster.
              </h2>
              <p className="text-muted-foreground text-base md:text-lg text-center md:text-left mb-6 leading-relaxed">
                The AI watches every probe, reads every curve, and gives you back something useful — whether that's a debrief on how your competition brisket tracked against your plan, or step-by-step guidance through your first pork shoulder. What it tells you depends on who you are.
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
                  <div className="text-foreground font-medium">8°F below plan at hour 4</div>
                  <div className="text-muted-foreground text-xs">Stall running long. Wrap now to recover.</div>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2 flex justify-center">
              <div className="relative w-[min(260px,80vw)] sm:w-[280px] md:w-[300px] aspect-[35/76] rounded-[2.5rem] md:rounded-[3rem] border-[8px] md:border-[10px] border-zinc-800 bg-black shadow-[0_30px_80px_-20px_rgba(221,107,32,0.4)] overflow-hidden">
                <img
                  src={`${BASE}ss-dashboard.png`}
                  alt="knowyourpit home screen showing PitMaster Score, recent cooks, and grill stats"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
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
              The AI in action
            </span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              What the AI gives back.
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Every screen shows what knowyourpit does with your cook data — analysis, feedback, and decisions returned to you in plain language.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {[
              {
                src: "ss-image-scanner.png",
                title: "Snap any thermometer",
                caption: "Point your camera at any analog gauge or thermal image. The AI reads the temperature, grades the cook stage, and adds it to your session — no smart probe required.",
                alt: "PitMaster Image Scanner reading a temperature graph from photos",
              },
              {
                src: "ss-plan-cook.png",
                title: "A plan built for your pit",
                caption: "Tell PitMaster what you're cooking and when you want to serve. It builds an hour-by-hour schedule around your specific smoker, your cook history, and today's outdoor temperature — not a generic timeline.",
                alt: "Plan a Cook screen with Pulled Pork selected and a prep guide open",
              },
              {
                src: "ss-cook-log.png",
                title: "Sequence a full multi-item cook",
                caption: "Add your brisket, ribs, and chicken — pick one serve time — and PitMaster works out when each item needs to start. It tells you when to light every grill, when to put each cut on, and when to pull it, so everything is resting and ready at the same moment.",
                alt: "Cook Log showing a Multi-Cook Session with Spare Ribs, Prime Rib, and Chicken Thighs",
              },
              {
                src: "ss-cook-detail.png",
                title: "Decisions from your data",
                caption: "The AI reads your live temperature curve and ranks your next moves — hold steady, wrap now, raise pit temp — with the reasoning behind each one. Not generic advice. Decisions from what's happening in your pit right now.",
                alt: "Cook detail screen showing PitMaster analysis and temperature graph",
              },
              {
                src: "ss-pitmaster.png",
                title: "Ask anything about BBQ",
                caption: "PitMaster answers your BBQ questions instantly — best wood for brisket, how long per pound for pork butt, how to manage the stall. Grounded in your cook history, not generic internet answers.",
                alt: "PitMaster AI chat screen showing BBQ questions",
              },
              {
                src: "ss-cook-timeline.png",
                title: "Your cook, debriefed",
                caption: "After every session, the AI compares your result to your plan — what you hit, where you drifted, and what the data says about why. Rate tenderness, flavor, and bark.",
                alt: "Cook debrief screen showing timeline, what went well, and next time tips",
              },
            ].map((shot, i) => (
              <motion.figure
                key={`${shot.src}-${i}`}
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
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
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
              Light the fire. The AI does the reading.
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              No setup docs. No learning curve. Just cook.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            {[
              {
                num: "01",
                icon: ChefHat,
                title: "Tell it about your pit",
                desc: "Kamado, offset, pellet, kettle — choose your smoker. Pair your MEATER or ThermoWorks if you have one. Takes about 60 seconds and the AI starts learning how your rig runs.",
              },
              {
                num: "02",
                icon: Camera,
                title: "Start the cook",
                desc: "Pick a cut or just describe what you're making. Snap a photo of any analog gauge if you don't have a smart probe. The AI begins reading your data from the first temperature.",
              },
              {
                num: "03",
                icon: Bell,
                title: "Get the insight back",
                desc: "The AI watches your stall, outdoor temperature, and your grill's behavior — and returns real decisions, not reminders. Championship pitmasters get a precise plan debrief. First-timers get the confidence to pull it off.",
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

      {/* ─── Your pit talks ────────────────────────────────────────────── */}
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
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Your pit talks. knowyourpit listens.</h2>
                <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                  Every cook generates data — temperatures, timing, decisions, results. The AI reads all of it and gives it back as something useful: a debrief, a recommendation, a warning, or a plan. For the pitmaster who's been doing this for 20 years, and the one firing up for the first time.
                </p>
              </div>

              <div className="grid gap-4 md:gap-6">
                {[
                  { icon: Brain, title: "AI Data Analysis", desc: "Reads your temperature curves, detects stalls before they peak, and compares every cook against your plan. Returns real feedback grounded in what actually happened — not generic tips." },
                  { icon: Activity, title: "Hardware Agnostic", desc: "Connects to MEATER Cloud, ThermoWorks, or you can snap a photo of any analog gauge. Any probe, any pit, any setup." },
                  { icon: Clock, title: "Insight for Every Level", desc: "For the championship pitmaster: a precise session debrief and plan comparison after every cook. For the first-time smoker: step-by-step decisions built on what your pit is actually doing right now." }
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
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-10 md:mb-12">The data doesn't lie.</h2>
          <div className="grid md:grid-cols-3 gap-5 md:gap-8">
            <div className="p-6 md:p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-3 md:gap-4">
              <div className="text-4xl font-black text-primary">Live</div>
              <h3 className="font-bold">Instant Analysis</h3>
              <p className="text-sm text-muted-foreground">The AI reads your temperature data mid-cook and returns feedback in seconds — while there's still time to act on it.</p>
            </div>
            <div className="p-6 md:p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-3 md:gap-4">
              <div className="text-4xl font-black text-primary">100+</div>
              <h3 className="font-bold">Grill Profiles</h3>
              <p className="text-sm text-muted-foreground">From Kamado Joes to custom 500-gallon offsets. The AI knows how they run.</p>
            </div>
            <div className="p-6 md:p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-3 md:gap-4">
              <div className="text-4xl font-black text-primary">Multi</div>
              <h3 className="font-bold">Cook Sequencer</h3>
              <p className="text-sm text-muted-foreground">Plan up to 5 items to finish at the same time. PitMaster calculates the start time for each one — brisket, ribs, chicken, and more — all timed to your table.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 md:py-32 flex flex-col items-center justify-center text-center px-4 bg-background">
        <ChefHat className="w-14 h-14 md:w-16 md:h-16 text-primary mb-5 md:mb-6" />
        <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-5 md:mb-6">Your pit. Your data. Your edge.</h2>
        <p className="text-base md:text-xl text-muted-foreground max-w-2xl mb-8 md:mb-10 leading-relaxed">
          The AI that makes your cook data mean something — whether you're chasing a ribbon or your first pulled pork.
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
