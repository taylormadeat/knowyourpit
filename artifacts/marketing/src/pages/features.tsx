import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, Zap, ChefHat, Wifi, BookOpen, ClipboardList, Snowflake, Droplets } from "lucide-react";

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Multi-Cook Sequencer",
    shortTitle: "Sequencer",
    body: "Pick your proteins, name one serve time, and PitMaster calculates when every item needs to start. It tells you when to light each grill, when to put each cut on, and when to pull — so your brisket, ribs, and chicken all finish resting at exactly the same moment. No more doing the math in your head the morning of a cook.",
  },
  {
    icon: Zap,
    title: "Live Cook Decisions",
    shortTitle: "Live Decisions",
    body: "During an active cook, PitMaster reads your temperature curve in real time and tells you what to do next — hold steady, wrap now, raise pit temp — with the reasoning behind the call. It flags the stall before it peaks, catches plan drift early, and gives you a clear action while there's still time to use it. Not generic reminders. A call from what's happening in your pit right now.",
  },
  {
    icon: ChefHat,
    title: "PitMaster AI",
    shortTitle: "PitMaster AI",
    body: "PitMaster is the AI engine behind every insight in knowyourpit. It has access to your full cook history — every session, every grill, every result — and uses that context to give you guidance that's specific to how you cook, not how someone else does. Ask it anything about BBQ and the answers come from your data, not a generic database.",
  },
  {
    icon: ClipboardList,
    title: "Cook Planning",
    shortTitle: "Cook Planning",
    body: "Tell PitMaster what you're cooking and when you want to serve. It builds an hour-by-hour schedule around your specific smoker, your past cook times, and today's outdoor temperature. You get a start time for your fire, a time to put meat on, wrap checkpoints, and a target pull window — all calculated for your pit, not a textbook estimate.",
  },
  {
    icon: Wifi,
    title: "Any Thermometer. Any Data Source.",
    shortTitle: "Any Thermometer",
    body: "Connect any Bluetooth or WiFi probe and your readings flow straight into PitMaster — no manual logging required. MEATER and ThermoWorks Signals link directly, with support for additional brands. Prefer to log by hand? That works too. No specific hardware required.",
  },
  {
    icon: BookOpen,
    title: "Cook History & Debrief",
    shortTitle: "Cook History",
    body: "After every session, PitMaster runs through your temperature data and tells you what happened — where you hit your plan, where you fell off, and what likely caused the difference. Rate tenderness, flavor, and bark, and that feedback carries forward into every future cook. Over time, PitMaster's understanding of how your pit runs gets sharper with every session.",
  },
  {
    icon: Snowflake,
    title: "Frozen Meat Planning",
    shortTitle: "Frozen Planning",
    body: "Flag a cut as frozen and choose your thaw method — refrigerator, cold-water, microwave, counter, or cook-from-frozen. PitMaster calculates the thaw window, adds a temper time, and folds both into your cook plan so your start schedule accounts for the full timeline. Thaw countdown and notifications fire automatically when each window opens.",
  },
  {
    icon: Droplets,
    title: "Technique Memory",
    shortTitle: "Technique",
    body: "Set a spritz cadence, mop schedule, or injection preference and PitMaster remembers it for that cut across every cook. Spritz reminders fire on schedule during a live session, mop steps appear in your cook timeline, and it all feeds into your AI analysis — so guidance is based on how you actually cook, not a generic playbook.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5 } }),
};

function MobileFeatures() {
  const [active, setActive] = useState(0);
  const f = FEATURES[active];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Pill tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FEATURES.map((feat, i) => (
          <button
            key={feat.shortTitle}
            onClick={() => setActive(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
              active === i
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-white/10 hover:border-white/20 hover:text-foreground"
            }`}
          >
            {feat.shortTitle}
          </button>
        ))}
      </div>

      {/* ── Detail panel ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl bg-card border border-white/10 p-6 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <f.icon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold leading-tight">{f.title}</h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{f.body}</p>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 pt-1">
            {FEATURES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Go to feature ${i + 1}`}
                className={`rounded-full transition-all ${
                  i === active ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function Features() {
  return (
    <div className="w-full flex flex-col">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background border-b border-white/5 text-center">
        <div className="container px-4 max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-5">
              What's inside
            </span>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-5">
              Built around your cook. Not anyone else's.
            </h1>
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
              Every feature in knowyourpit is built on one idea: your data is the most valuable thing in the app. Here's how PitMaster puts it to work.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────────────── */}
      <section className="py-12 md:py-24 bg-background">
        <div className="container px-4 max-w-5xl mx-auto">
          {/* Mobile: tabs + detail panel */}
          <div className="md:hidden">
            <MobileFeatures />
          </div>

          {/* Desktop: 2-col grid */}
          <div className="hidden md:grid md:grid-cols-2 gap-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                className="rounded-2xl bg-card border border-white/10 p-8 flex flex-col gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">{f.title}</h2>
                  <p className="text-muted-foreground text-base leading-relaxed">{f.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background border-t border-white/5 text-center">
        <div className="container px-4">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-5">
            Your pit. Your data. Your edge.
          </h2>
          <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-xl mx-auto">
            Available now on iOS — free to download, no setup required.
          </p>
          <a
            href="https://apps.apple.com/app/id6763445064"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center h-14 px-10 rounded-lg bg-white text-black font-bold text-base md:text-lg hover:bg-gray-200 active:scale-95 transition-all"
          >
            Download on the App Store
          </a>
        </div>
      </section>
    </div>
  );
}
