import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const BASE = import.meta.env.BASE_URL;

const dimensions = [
  { label: 'TENDERNESS', value: 96, color: 'var(--color-blaze)' },
  { label: 'BARK', value: 92, color: 'var(--color-ember)' },
  { label: 'FLAVOR', value: 95, color: 'var(--color-blaze-bright)' },
];

function useCountUp(target: number, active: boolean, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const e = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - e, 3);
      setVal(Math.round(target * eased));
      if (e < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return val;
}

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),  // phone in
      setTimeout(() => setPhase(2), 700),  // gauge sweeps
      setTimeout(() => setPhase(3), 1500), // dim bars
      setTimeout(() => setPhase(4), 3000), // verdict stamp
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const score = useCountUp(94, phase >= 2, 1200);

  // sweep gauge (270deg arc from -135 to +135)
  const sweepAngle = phase >= 2 ? -135 + (270 * 94) / 100 : -135;

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-charcoal"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
    >
      {/* Smoke wisp background, drifting */}
      <motion.img
        src={`${BASE}brand/smoke-wisp.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-40"
        animate={{ y: ['0%', '-3%', '0%'], opacity: [0.35, 0.5, 0.4] }}
        transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Header */}
      <div className="absolute inset-x-0 top-[5%] flex flex-col items-center px-8 z-10">
        <motion.div
          className="font-mono text-[2.8cqw] tracking-[0.45em] text-blaze-bright"
          initial={{ opacity: 0, y: -10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          AI PITMASTER SCORE
        </motion.div>
        <motion.div
          className="font-display text-[10cqw] leading-none text-cream mt-2 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          GRADED IN<br />SECONDS
        </motion.div>
      </div>

      {/* Phone frame with the score */}
      <motion.div
        className="absolute left-1/2 top-[28%] flex flex-col items-center"
        style={{ x: '-50%' }}
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.85, y: 30 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        <div
          className="relative rounded-[12cqw] border-[1.6cqw] border-charcoal-soft bg-charcoal-soft shadow-blaze overflow-hidden"
          style={{ width: '70cqw', height: '105cqw', maxHeight: '60cqh' }}
        >
          {/* Inner phone display */}
          <div className="absolute inset-0 bg-charcoal flex flex-col items-center justify-start p-[6cqw] pt-[10cqw]">
            {/* Gauge ring */}
            <div className="relative" style={{ width: '50cqw', height: '50cqw', maxWidth: 320, maxHeight: 320 }}>
              <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFB347" />
                    <stop offset="55%" stopColor="#FF6A3D" />
                    <stop offset="100%" stopColor="#E84520" />
                  </linearGradient>
                </defs>
                {/* track */}
                <circle
                  cx="100"
                  cy="100"
                  r="86"
                  fill="none"
                  stroke="rgba(155,104,64,0.25)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(270 / 360) * 2 * Math.PI * 86} 9999`}
                  transform="rotate(135 100 100)"
                />
                {/* progress */}
                <motion.circle
                  cx="100"
                  cy="100"
                  r="86"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: `0 9999` }}
                  animate={{
                    strokeDasharray: phase >= 2
                      ? `${(270 / 360) * 2 * Math.PI * 86 * 0.94} 9999`
                      : `0 9999`,
                  }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  transform="rotate(135 100 100)"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(232,69,32,0.85))' }}
                />
                {/* needle */}
                <motion.line
                  x1="100"
                  y1="100"
                  x2="100"
                  y2="30"
                  stroke="#FFF7E5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ rotate: -135 }}
                  animate={{ rotate: sweepAngle }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformOrigin: '100px 100px' }}
                />
                <circle cx="100" cy="100" r="6" fill="#E84520" />
              </svg>
              {/* Center number */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className="font-display leading-none text-blaze glow-blaze"
                  style={{ fontSize: 'min(20cqw, 110px)' }}
                >
                  {score}
                </div>
                <div className="font-mono text-[2.4cqw] tracking-[0.3em] text-cream/60 mt-1">
                  / 100
                </div>
              </div>
            </div>

            {/* Dimension bars */}
            <div className="w-full mt-[5cqw] space-y-[2.4cqw]">
              {dimensions.map((d, i) => (
                <DimRow key={d.label} label={d.label} value={d.value} color={d.color} active={phase >= 3} delay={i * 0.18} />
              ))}
            </div>

            {/* Verdict stamp */}
            <motion.div
              className="absolute bottom-[6cqw] left-1/2 -translate-x-1/2 px-[3.5cqw] py-[1.2cqw] border-[2px] border-blaze rounded-md"
              initial={{ opacity: 0, scale: 1.4, rotate: -8 }}
              animate={phase >= 4 ? { opacity: 1, scale: 1, rotate: -4 } : { opacity: 0, scale: 1.4, rotate: -8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              style={{ boxShadow: '0 0 24px rgba(232,69,32,0.75)' }}
            >
              <div className="font-display text-blaze-bright text-[4.2cqw] tracking-[0.15em] text-center leading-tight">
                8°F BELOW PLAN<br />
                <span className="text-cream/85 text-[2.8cqw] tracking-[0.25em]">
                  HOLD STEADY — COMPETITION READY
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DimRow({
  label,
  value,
  color,
  active,
  delay,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  delay: number;
}) {
  const v = useCountUp(value, active, 900);
  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-[0.6cqw]">
        <div className="font-mono text-[2.4cqw] tracking-[0.25em] text-cream/85">{label}</div>
        <div className="font-display text-[5cqw] text-cream leading-none">{v}</div>
      </div>
      <div className="relative w-full h-[1.4cqw] bg-wood rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          initial={{ width: '0%' }}
          animate={{ width: active ? `${value}%` : '0%' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay }}
        />
      </div>
    </div>
  );
}
