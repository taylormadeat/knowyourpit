import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const BASE = import.meta.env.BASE_URL;

const meats = [
  {
    name: 'BRISKET',
    cookHrs: 12,
    serveAt: 0.78,
    color: '#E84520',
    icon: '🥩',
    startPct: 0,
    durPct: 78,
  },
  {
    name: 'PORK RIBS',
    cookHrs: 6,
    serveAt: 0.78,
    color: '#FF6A3D',
    icon: '🍖',
    startPct: 39,
    durPct: 39,
  },
  {
    name: 'CHICKEN',
    cookHrs: 2.5,
    serveAt: 0.78,
    color: '#FFB347',
    icon: '🍗',
    startPct: 62,
    durPct: 16,
  },
];

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 80),    // header
      setTimeout(() => setPhase(2), 600),   // timeline
      setTimeout(() => setPhase(3), 1100),  // brisket bar
      setTimeout(() => setPhase(4), 1500),  // ribs bar
      setTimeout(() => setPhase(5), 1900),  // chicken bar
      setTimeout(() => setPhase(6), 2700),  // serve marker
      setTimeout(() => setPhase(7), 3400),  // SERVE callout
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-charcoal"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
    >
      {/* Subtle dark grid background, drifting */}
      <motion.div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(rgba(232,69,32,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(232,69,32,0.16) 1px, transparent 1px)',
          backgroundSize: '6cqw 6cqw',
        }}
        animate={{ backgroundPosition: ['0px 0px', '24px 24px'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />

      {/* Header */}
      <div className="absolute inset-x-0 top-[6%] flex flex-col items-center px-6 z-10">
        <motion.div
          className="font-mono text-[2.8cqw] tracking-[0.45em] text-blaze-bright"
          initial={{ opacity: 0, y: -10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          MULTI-COOK SEQUENCER
        </motion.div>
        <motion.div
          className="font-display text-[11cqw] leading-none text-cream mt-2 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          THREE MEATS<br />ONE FINISH
        </motion.div>
      </div>

      {/* Timeline panel */}
      <div className="absolute inset-x-[6cqw] top-[34%] z-10">
        {/* Time axis */}
        <motion.div
          className="relative w-full h-[1.5cqw] bg-wood rounded-full overflow-hidden mb-[3cqw]"
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={phase >= 2 ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0.6 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: 'left center' }}
        >
          <div className="absolute inset-0 flex justify-between px-[1cqw]">
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="w-[1px] h-full bg-cream/15" />
            ))}
          </div>
        </motion.div>

        {/* Bars */}
        <div className="space-y-[2.6cqw]">
          {meats.map((m, i) => {
            const barPhase = 3 + i;
            const active = phase >= barPhase;
            return (
              <div key={m.name} className="relative">
                <div className="flex items-center gap-[2.2cqw]">
                  <div
                    className="font-display text-[5cqw] text-cream w-[28cqw] text-right leading-none"
                  >
                    {m.name}
                  </div>
                  <div className="relative flex-1 h-[6cqw] bg-charcoal-soft rounded-md overflow-hidden border border-wood">
                    <motion.div
                      className="absolute inset-y-0 rounded-md"
                      style={{
                        left: `${m.startPct}%`,
                        background: `linear-gradient(90deg, ${m.color} 0%, ${m.color}cc 100%)`,
                        boxShadow: `0 0 18px ${m.color}90`,
                      }}
                      initial={{ width: '0%', opacity: 0 }}
                      animate={active ? { width: `${m.durPct}%`, opacity: 1 } : { width: '0%', opacity: 0 }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="absolute inset-0 flex items-center justify-end pr-[1.5cqw]">
                        <span className="font-mono text-[2.6cqw] text-charcoal font-bold">
                          {m.cookHrs}h
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Serve marker line */}
        <motion.div
          className="absolute top-[-3cqw] bottom-[-3cqw]"
          style={{
            left: `calc(28cqw + 2.2cqw + 78% * (100% - 30.2cqw) / 100)`,
            width: '3px',
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={phase >= 6 ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="absolute inset-0 bg-cream"
            style={{ boxShadow: '0 0 18px rgba(255,247,229,0.85)' }}
          />
        </motion.div>
      </div>

      {/* Real app-screen anchor: thumbnail of the actual Pitmaster Plan screen */}
      <motion.div
        className="absolute bottom-[24%] left-1/2 -translate-x-1/2 z-10 flex items-center gap-[2cqw]"
        initial={{ opacity: 0, y: 12 }}
        animate={phase >= 6 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: '14cqw',
            aspectRatio: '9 / 19',
            borderRadius: '2cqw',
            border: '1.5px solid rgba(232,69,32,0.55)',
            boxShadow:
              '0 0 0 1px rgba(255,179,71,0.35) inset, 0 0 18px rgba(232,69,32,0.45)',
          }}
        >
          <img
            src={`${BASE}screens/pitmaster-plan.png`}
            alt="Pitmaster Plan screen"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="font-mono text-[2.4cqw] tracking-[0.32em] text-cream/80 leading-tight">
          FROM YOUR<br />
          <span className="text-blaze-bright">PITMASTER PLAN</span>
        </div>
      </motion.div>

      {/* SERVE NOW callout */}
      <motion.div
        className="absolute bottom-[10%] left-1/2 -translate-x-1/2 z-20"
        initial={{ opacity: 0, scale: 0.8, y: 12 }}
        animate={phase >= 7 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      >
        <div className="px-[5cqw] py-[2cqw] bg-blaze rounded-md shadow-blaze">
          <div className="font-display text-cream-bright text-[6cqw] tracking-[0.15em] leading-none">
            SERVE 6:00 PM
          </div>
        </div>
      </motion.div>

      {/* Continuous-motion sweep line across panel */}
      <motion.div
        className="absolute top-[34%] bottom-[26%] w-[2px] bg-blaze-bright/70"
        style={{ boxShadow: '0 0 12px rgba(255,106,61,0.75)' }}
        initial={{ left: '6cqw' }}
        animate={{ left: ['6cqw', '94cqw', '6cqw'] }}
        transition={{ duration: 3.6, ease: 'easeInOut', repeat: Infinity }}
      />
    </motion.div>
  );
}
