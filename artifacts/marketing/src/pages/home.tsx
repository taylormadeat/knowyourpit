import { ChefHat, Volume2, VolumeX, ChevronLeft, ChevronRight, Thermometer, Timer, Layers, Snowflake, Wifi, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL;

const SHOTS = [
  {
    src: "ss-image-scanner.png",
    title: "Any thermometer. Any app. Any data source.",
    caption: "Already using MEATER, ThermoWorks, or another thermometer app? Upload a screenshot of the graph. Got an analog gauge on your pit? Take a photo. Prefer to log readings by hand? That works too. knowyourpit pulls the numbers from wherever they live and runs the analysis — no specific hardware required.",
    alt: "PitMaster Image Scanner reading a temperature graph from photos",
  },
  {
    src: "ss-plan-cook.png",
    title: "A plan built for your pit — or your whole spread",
    caption: "Tell PitMaster what you're cooking and when you want to serve. It builds a step-by-step schedule tailored to your rig and history. Running multiple cuts across different grills? Switch to Multi-Cook and it sequences every start time so everything finishes at once.",
    alt: "Plan a Cook screen with Pulled Pork selected and a prep guide open",
  },
  {
    src: "ss-cook-detail.png",
    title: "Live analysis. Ranked moves. Actual reasoning.",
    caption: "PitMaster reads your temperature curve in real time, detects stalls and climbs, and gives you a ranked list of next moves — each with the reasoning behind it. Not a generic suggestion. A call from what's happening in your pit right now.",
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
];

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

const APP_STORE_URL = "https://apps.apple.com/app/id6763445064";

function AppStoreButton({ className = "", label = "Download on the App Store" }: { className?: string; label?: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center h-14 px-8 rounded-lg bg-primary text-primary-foreground font-bold text-base md:text-lg transition-all md:hover:bg-primary/90 md:hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(210,80,30,0.5)] ${className}`}
    >
      {label}
    </a>
  );
}

export default function Home() {
  const [muted, setMuted] = useState(true);
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);

  function toggleMute() {
    setMuted((prev) => !prev);
  }

  function goTo(next: number) {
    setDir(next > slide ? 1 : -1);
    setSlide(next);
  }

  function prev() {
    goTo((slide - 1 + SHOTS.length) % SHOTS.length);
  }

  function next() {
    goTo((slide + 1) % SHOTS.length);
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -40) next();
    else if (info.offset.x > 40) prev();
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
          <h1 className="sr-only">knowyourpit — live AI analysis of your temperature curve, stall detection, ranked next moves, and multi-cook sequencing for BBQ</h1>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="mb-6 md:mb-8"
          >
            <img
              src={`${BASE}logo-transparent-light.png`}
              alt="knowyourpit"
              className="w-44 sm:w-56 md:w-80 lg:w-96 [filter:drop-shadow(0_0_60px_rgba(210,80,30,0.5))]"
            />
          </motion.div>

          <motion.h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4 md:mb-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          >
            Plan it. Cook it. Know exactly what to do at every step.
          </motion.h2>

          <motion.p
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 md:mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            PitMaster analyzes your live probe and pit temperatures, tells you what to do next with the reasoning behind the call, and sequences multi-cook spreads so everything finishes at once. Cooking from frozen? It folds in thaw time and temper windows so the full schedule is accounted for — not just the smoke.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-4 items-center"
          >
            <AppStoreButton label="Available on iOS" className="w-full sm:w-auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-10 md:mt-14 flex flex-wrap justify-center gap-6 md:gap-10 text-sm text-muted-foreground"
          >
            {[
              { icon: <Thermometer className="w-4 h-4" />, label: "Live temp curve analysis" },
              { icon: <Layers className="w-4 h-4" />, label: "Multi-cook sequencing" },
              { icon: <Snowflake className="w-4 h-4" />, label: "Frozen meat planning" },
              { icon: <Wifi className="w-4 h-4" />, label: "Bluetooth & WiFi probe support" },
              { icon: <Timer className="w-4 h-4" />, label: "Stall & climb detection" },
              { icon: <BrainCircuit className="w-4 h-4" />, label: "AI check-in analysis" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-primary">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Meet PitMaster (demo video) ───────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background border-b border-white/5">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row md:items-center md:gap-16 lg:gap-24 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="flex flex-col items-center md:items-start text-center md:text-left mb-10 md:mb-0 md:flex-1"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                Meet PitMaster
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Watch it detect a stall and rank your next moves.
              </h2>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                This is PitMaster live — reading a real temperature curve, identifying what's happening, and returning a ranked list of next moves with the reasoning behind each one. Your data in, decisions out.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="flex justify-center md:flex-shrink-0"
            >
              <div className="relative w-[min(280px,85vw)] sm:w-[300px] md:w-[320px]">
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
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Live Cook ─────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background border-b border-white/5">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row md:items-center md:gap-16 lg:gap-24 max-w-5xl mx-auto">
            {/* Text — left on desktop, top on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="flex flex-col items-center md:items-start text-center md:text-left md:flex-1 mb-10 md:mb-0"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                <Thermometer className="w-3.5 h-3.5" />
                Live Cook
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Live probe data. Stall detected. Next move clear.
              </h2>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-6">
                PitMaster reads your probe and pit temperatures the moment a session starts. It detects stalls and climbs from the actual data, tells you what to do next with the reasoning behind the call, and updates its read as your cook evolves.
              </p>
              <ul className="space-y-3 text-sm md:text-base text-muted-foreground mb-8 text-left w-full max-w-sm md:max-w-none">
                {[
                  "Live probe and pit temps feed the analysis — stall and climb detection from real data",
                  "PitMaster tells you what to do next and explains why — based on what's actually happening in your pit",
                  "Check in at any point for a fresh read — the recommendation updates against your current curve",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <AppStoreButton label="Start your first live cook" className="w-full sm:w-auto" />
            </motion.div>

            {/* Phone mockup — right on desktop, bottom on mobile */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="flex justify-center md:flex-shrink-0"
            >
              {/* Fixed-height phone frame: 180px wide → 390px tall on mobile/desktop.
                  Using explicit h/w instead of aspect-ratio prevents the frame from
                  overflowing the section on any viewport. */}
              <div className="relative w-[220px] h-[477px] sm:w-[240px] sm:h-[520px] md:w-[170px] md:h-[369px] lg:w-[185px] lg:h-[402px]">
                <div className="absolute inset-0 rounded-[2rem] md:rounded-[2.5rem] border-[8px] md:border-[8px] border-zinc-800 bg-black shadow-[0_30px_80px_-20px_rgba(221,107,32,0.45)] overflow-hidden">
                  <img
                    src={`${BASE}ss-live-cook.png`}
                    alt="Live cook screen showing elapsed timer, probe temperature, and AI verdict banner"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                {/* Glow pulse effect */}
                <div className="absolute inset-0 rounded-[2rem] md:rounded-[2.5rem] ring-1 ring-primary/20 animate-pulse pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Multi-Cook Mode ─────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background border-b border-white/5">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row md:items-center md:gap-16 lg:gap-24 max-w-5xl mx-auto">
            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="flex flex-col items-center md:items-start text-center md:text-left md:flex-1 mb-10 md:mb-0"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                <Layers className="w-3.5 h-3.5" />
                Multi-Cook
              </span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Multiple cuts. Multiple grills.<br />One serve time.
              </h2>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-6">
                Tell PitMaster when you want to serve. Add your cuts, assign each to its grill, and it works backwards to calculate every start time — so ribs, brisket, and wings all land on the table together.
              </p>
              <ul className="space-y-3 text-sm md:text-base text-muted-foreground mb-8 text-left w-full max-w-sm md:max-w-none">
                {[
                  "One serve time drives the whole plan — PitMaster sequences backwards from there",
                  "Each cut gets its own step timeline: light, load, wrap, and pull",
                  "Mix fresh and frozen cuts in the same spread — thaw time is factored into the sequence automatically",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Two phones — staggered */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="flex justify-center md:flex-shrink-0 gap-3 items-start"
            >
              {/* Phone 1 — setup screen, shifted down */}
              <div className="relative w-[150px] h-[325px] sm:w-[165px] sm:h-[358px] md:w-[155px] md:h-[336px] lg:w-[175px] lg:h-[380px] mt-8">
                <div className="absolute inset-0 rounded-[1.75rem] border-[7px] border-zinc-800 bg-black shadow-[0_20px_60px_-15px_rgba(221,107,32,0.3)] overflow-hidden">
                  <img
                    src={`${BASE}ss-multi-grill-assign.png`}
                    alt="Multi-Cook setup screen with Spare Ribs, Oxtail, and Chicken Wings assigned to two different grills"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="absolute inset-0 rounded-[1.75rem] ring-1 ring-primary/15 pointer-events-none" />
              </div>
              {/* Phone 2 — sequence result */}
              <div className="relative w-[150px] h-[325px] sm:w-[165px] sm:h-[358px] md:w-[155px] md:h-[336px] lg:w-[175px] lg:h-[380px]">
                <div className="absolute inset-0 rounded-[1.75rem] border-[7px] border-zinc-800 bg-black shadow-[0_20px_60px_-15px_rgba(221,107,32,0.35)] overflow-hidden">
                  <img
                    src={`${BASE}ss-multi-sequence-result.png`}
                    alt="Cook Sequence result showing everything ready by 6:00 PM with per-item start times"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="absolute inset-0 rounded-[1.75rem] ring-1 ring-primary/15 pointer-events-none" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Inside the app (carousel) ──────────────────────────────────── */}
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

          {/* Mobile: vertical stack. Desktop: phone left, caption right */}
          <div className="flex flex-col md:flex-row md:items-center md:gap-16 lg:gap-24 max-w-5xl mx-auto">
            {/* Phone + arrows */}
            <div className="flex items-center justify-center gap-3 md:flex-shrink-0 mb-8 md:mb-0">
              <button
                onClick={prev}
                aria-label="Previous screenshot"
                className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-white hover:bg-zinc-800 active:scale-95 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="relative overflow-hidden w-[min(220px,70vw)] md:w-[280px] lg:w-[320px]">
                <AnimatePresence initial={false} custom={dir} mode="popLayout">
                  <motion.figure
                    key={slide}
                    custom={dir}
                    variants={SLIDE_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.15}
                    onDragEnd={handleDragEnd}
                    className="cursor-grab active:cursor-grabbing select-none"
                  >
                    <div className="relative w-full aspect-[35/76] rounded-[2rem] border-[8px] border-zinc-800 bg-black shadow-[0_20px_60px_-20px_rgba(221,107,32,0.35)] overflow-hidden">
                      <img
                        src={`${BASE}${SHOTS[slide].src}`}
                        alt={SHOTS[slide].alt}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                      />
                    </div>
                  </motion.figure>
                </AnimatePresence>
              </div>

              <button
                onClick={next}
                aria-label="Next screenshot"
                className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-white hover:bg-zinc-800 active:scale-95 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Caption + dots — below on mobile, right column on desktop */}
            <div className="flex flex-col items-center md:items-start md:flex-1">
              {/* Dot indicators */}
              <div className="flex items-center gap-2 mb-6">
                {SHOTS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-label={`Go to screenshot ${i + 1}`}
                    className={`rounded-full transition-all ${i === slide ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-white/20 hover:bg-white/40"}`}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={slide}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="text-center md:text-left"
                >
                  <h3 className="text-lg md:text-2xl font-bold text-foreground mb-3">{SHOTS[slide].title}</h3>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{SHOTS[slide].caption}</p>
                </motion.div>
              </AnimatePresence>
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
          href={APP_STORE_URL}
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
