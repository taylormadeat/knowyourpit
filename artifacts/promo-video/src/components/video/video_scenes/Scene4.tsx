import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 80),    // header + viewfinder
      setTimeout(() => setPhase(2), 700),   // analog gauge appears
      setTimeout(() => setPhase(3), 1700),  // shutter snap
      setTimeout(() => setPhase(4), 2050),  // flip + digital readout
      setTimeout(() => setPhase(5), 3000),  // labels stack in
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
      {/* Atmospheric backdrop - drifting wood-fire glow */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 30% 80%, rgba(232,69,32,0.25) 0%, transparent 55%), radial-gradient(ellipse at 70% 20%, rgba(255,106,61,0.18) 0%, transparent 50%)',
        }}
        animate={{ opacity: [0.7, 1, 0.85, 1] }}
        transition={{ duration: 4, ease: 'easeInOut' }}
      />

      {/* Header */}
      <div className="absolute inset-x-0 top-[5%] flex flex-col items-center px-6 z-10">
        <motion.div
          className="font-mono text-[2.8cqw] tracking-[0.45em] text-blaze-bright"
          initial={{ opacity: 0, y: -10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          GAUGE SCANNER
        </motion.div>
        <motion.div
          className="font-display text-[11cqw] leading-none text-cream mt-2 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          SNAP. READ.<br />LOG.
        </motion.div>
      </div>

      {/* Viewfinder corners */}
      <motion.div
        className="absolute left-[10cqw] right-[10cqw] top-[30%] bottom-[18%] pointer-events-none z-20"
        initial={{ opacity: 0, scale: 1.05 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {[
          'top-0 left-0 border-t-[4px] border-l-[4px]',
          'top-0 right-0 border-t-[4px] border-r-[4px]',
          'bottom-0 left-0 border-b-[4px] border-l-[4px]',
          'bottom-0 right-0 border-b-[4px] border-r-[4px]',
        ].map((cls, i) => (
          <div
            key={i}
            className={`absolute w-[7cqw] h-[7cqw] border-blaze ${cls}`}
            style={{ filter: 'drop-shadow(0 0 6px rgba(232,69,32,0.7))' }}
          />
        ))}
        {/* live REC dot */}
        <div className="absolute top-[1.5cqw] left-1/2 -translate-x-1/2 flex items-center gap-[1.5cqw]">
          <motion.div
            className="w-[2cqw] h-[2cqw] rounded-full bg-blaze"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            style={{ boxShadow: '0 0 12px rgba(232,69,32,0.85)' }}
          />
          <div className="font-mono text-[2cqw] tracking-[0.3em] text-cream/85">REC</div>
        </div>
      </motion.div>

      {/* Card stage - flips between analog gauge (front) and digital data (back) */}
      <div
        className="absolute left-1/2 top-[40%] z-10"
        style={{ transform: 'translateX(-50%)', perspective: '1400px' }}
      >
        <motion.div
          className="relative"
          style={{
            width: '60cqw',
            height: '60cqw',
            maxWidth: 380,
            maxHeight: 380,
            transformStyle: 'preserve-3d',
          }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: phase >= 4 ? 180 : 0 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* FRONT — analog gauge */}
          <div
            className="absolute inset-0 rounded-full border-[1.6cqw] border-charcoal-soft bg-cream-bright flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* dial face */}
              <circle cx="100" cy="100" r="92" fill="#F0E8D5" />
              <circle cx="100" cy="100" r="92" fill="none" stroke="#281E14" strokeWidth="3" />
              {/* tick marks */}
              {Array.from({ length: 21 }).map((_, i) => {
                const a = -135 + i * (270 / 20);
                const rad = (a * Math.PI) / 180;
                const major = i % 5 === 0;
                const r1 = 86;
                const r2 = major ? 72 : 78;
                const x1 = 100 + Math.sin(rad) * r1;
                const y1 = 100 - Math.cos(rad) * r1;
                const x2 = 100 + Math.sin(rad) * r2;
                const y2 = 100 - Math.cos(rad) * r2;
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#281E14"
                    strokeWidth={major ? 2.5 : 1.2}
                  />
                );
              })}
              {/* labels */}
              {[100, 200, 300, 400, 500].map((t, i) => {
                const a = -135 + i * (270 / 4);
                const rad = (a * Math.PI) / 180;
                const r = 60;
                const x = 100 + Math.sin(rad) * r;
                const y = 100 - Math.cos(rad) * r + 4;
                return (
                  <text
                    key={t}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    fontSize="11"
                    fontWeight="700"
                    fill="#281E14"
                  >
                    {t}
                  </text>
                );
              })}
              {/* °F text */}
              <text
                x="100"
                y="148"
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                fontSize="9"
                fontWeight="600"
                fill="#9B6840"
                letterSpacing="2"
              >
                °F
              </text>
              {/* Needle - drifting at 225° */}
              <motion.line
                x1="100"
                y1="100"
                x2="100"
                y2="32"
                stroke="#E84520"
                strokeWidth="3.5"
                strokeLinecap="round"
                initial={{ rotate: -135 }}
                animate={{ rotate: phase >= 2 ? -135 + (270 * 225) / 600 : -135 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: '100px 100px' }}
              />
              <circle cx="100" cy="100" r="8" fill="#281E14" />
              <circle cx="100" cy="100" r="3" fill="#E84520" />
            </svg>
          </div>

          {/* BACK — digital readout with explicit extracted fields */}
          <div
            className="absolute inset-0 rounded-3xl bg-charcoal-soft border-[3px] border-blaze flex flex-col items-stretch justify-center p-[3cqw]"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              boxShadow: '0 0 40px rgba(232,69,32,0.55)',
            }}
          >
            {/* Big current temperature reading */}
            <div className="flex flex-col items-center">
              <div className="font-mono text-[1.7cqw] tracking-[0.4em] text-blaze-bright">
                PIT TEMP
              </div>
              <div
                className="font-display text-blaze leading-none glow-blaze mt-[0.4cqw]"
                style={{ fontSize: 'min(17cqw, 100px)' }}
              >
                225°
              </div>
            </div>

            {/* Labeled extracted fields stack in after flip */}
            <div className="mt-[1.8cqw] grid grid-cols-2 gap-x-[2cqw] gap-y-[1cqw]">
              {[
                { label: 'PROBE', value: 'PIT 1', color: 'text-cream' },
                { label: 'CURRENT', value: '225°F', color: 'text-blaze-bright' },
                { label: 'TARGET', value: '225°F', color: 'text-cream' },
                { label: 'PHASE', value: 'STALL', color: 'text-cream' },
              ].map((field, i) => (
                <motion.div
                  key={field.label}
                  className="flex flex-col items-start"
                  initial={{ opacity: 0, x: -8 }}
                  animate={phase >= 5 ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                  transition={{
                    duration: 0.32,
                    delay: 0.06 + i * 0.07,
                    ease: 'easeOut',
                  }}
                >
                  <div className="font-mono text-[1.4cqw] tracking-[0.32em] text-cream/55 leading-none">
                    {field.label}
                  </div>
                  <div
                    className={`font-mono text-[2.6cqw] leading-none mt-[0.4cqw] ${field.color}`}
                  >
                    {field.value}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Status row */}
            <motion.div
              className="mt-[1.6cqw] flex items-center justify-center gap-[1.4cqw]"
              initial={{ opacity: 0 }}
              animate={phase >= 5 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <div
                className="w-[1.2cqw] h-[1.2cqw] rounded-full bg-success"
                style={{ boxShadow: '0 0 8px #66B85B' }}
              />
              <div className="font-mono text-[1.7cqw] tracking-[0.3em] text-success">
                LOCKED IN
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Shutter flash */}
      <motion.div
        className="absolute inset-0 bg-cream-bright pointer-events-none z-30"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: [0, 0.85, 0] } : { opacity: 0 }}
        transition={{ duration: 0.32, times: [0, 0.18, 1], ease: 'easeOut' }}
      />

      {/* Shutter sound bars (visual) */}
      <motion.div
        className="absolute bottom-[10%] left-1/2 -translate-x-1/2 flex gap-[1cqw] z-10"
        initial={{ opacity: 0 }}
        animate={phase >= 5 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="font-mono text-[3cqw] tracking-[0.35em] text-cream/85">
          NO MORE GUESSWORK
        </div>
      </motion.div>
    </motion.div>
  );
}
