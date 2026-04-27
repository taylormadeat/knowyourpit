import { ChefHat, Volume2, VolumeX } from "lucide-react";
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
            A great cook isn't guesswork — it's data. knowyourpit reads yours in real time, catching plan drift, flagging the stall before it peaks, and returning a clear next move while there's still time to make it count. For the competitive pitmaster, that's a session debrief tied to real numbers. For the first-timer, that's a guide they can actually trust.
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
                Same cook data. Completely different insight.
              </h2>
              <p className="text-muted-foreground text-base md:text-lg text-center md:text-left mb-6 leading-relaxed">
                knowyourpit doesn't give everyone the same answer. It reads your temperatures, your history, and your plan — and returns something that actually makes sense for your level. Serious competitors get hard numbers on what happened and why. Everyone else gets the confidence to finish what they started.
              </p>
              <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
                <img
                  src={`${BASE}ss-live-cook.jpg`}
                  alt="Live Cook screen showing MEATER linked, outdoor temperature, and pit readings"
                  className="w-full h-auto block"
                />
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
              PitMaster at work
            </span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Decisions from your data.
            </h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Every screen shows what knowyourpit does with your cook data — analysis, feedback, and decisions returned to you in plain language.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {[
              {
                src: "ss-image-scanner.png",
                title: "Any thermometer. Any app. Any data source.",
                caption: "Already using MEATER, ThermoWorks, or another thermometer app? Upload a screenshot of the graph. Got an analog gauge on your pit? Take a photo. Prefer to log readings by hand? That works too. knowyourpit pulls the numbers from wherever they live and runs the analysis — no specific hardware required.",
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
                caption: "PitMaster reads your live temperature curve and ranks your next moves — hold steady, wrap now, raise pit temp — with the reasoning behind each one. Not generic advice. Decisions from what's happening in your pit right now.",
                alt: "Cook detail screen showing PitMaster analysis and temperature graph",
              },
              {
                src: "ss-pitmaster.png",
                title: "Ask anything. PitMaster already knows your cooks.",
                caption: "Every question you ask is answered with your full cook history in context — your grills, your results, your past sessions. Ask about the stall on your last brisket or how your offset runs in cold weather. The answers come from your data, not the internet.",
                alt: "PitMaster AI chat screen showing BBQ questions",
              },
              {
                src: "ss-cook-timeline.png",
                title: "Every cook reviewed. Every result explained.",
                caption: "When the session ends, PitMaster runs through your temperature data and tells you exactly what happened — where you hit your plan, where you fell off, and what likely caused it. Rate the result and it feeds back into your history for next time.",
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
              <p className="text-sm text-muted-foreground">PitMaster reads your temperature data mid-cook and returns feedback in seconds — while there's still time to act on it.</p>
            </div>
            <div className="p-6 md:p-8 rounded-2xl bg-background border border-white/10 flex flex-col items-center text-center gap-3 md:gap-4">
              <div className="text-4xl font-black text-primary">100+</div>
              <h3 className="font-bold">Grill Profiles</h3>
              <p className="text-sm text-muted-foreground">From Kamado Joes to custom 500-gallon offsets. PitMaster knows how they run.</p>
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
          PitMaster makes your cook data mean something — whether you're chasing a ribbon or your first pulled pork.
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
