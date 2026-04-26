import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const BASE = import.meta.env.BASE_URL;

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 60),    // bg + spark burst
      setTimeout(() => setPhase(2), 380),   // wordmark ignite
      setTimeout(() => setPhase(3), 1500),  // dual-audience tags
      setTimeout(() => setPhase(4), 2700),  // tagline
      setTimeout(() => setPhase(5), 3500),  // scan-line wipe out
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
    >
      {/* Coal background, slow zoom for continuous motion */}
      <motion.img
        src={`${BASE}brand/coals-bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.05, opacity: 0.5 }}
        animate={{ scale: 1.18, opacity: 0.85 }}
        transition={{ duration: 4.2, ease: 'easeOut' }}
      />

      {/* Heat haze pulse */}
      <motion.div
        className="absolute inset-0 bg-ember-gradient"
        initial={{ opacity: 0.55 }}
        animate={{ opacity: [0.55, 0.85, 0.7, 0.9, 0.7] }}
        transition={{ duration: 3.8, ease: 'easeInOut' }}
      />

      {/* Ignite spark burst — radiates outward from wordmark */}
      {[...Array(18)].map((_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const distance = 38 + (i % 4) * 8;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        return (
          <motion.div
            key={`spark-${i}`}
            className="absolute rounded-full"
            style={{
              left: '50%',
              top: '38%',
              width: 5,
              height: 5,
              background: i % 2 === 0 ? '#FFB347' : '#FF6A3D',
              boxShadow: '0 0 14px rgba(255,150,80,0.95)',
              translateX: '-50%',
              translateY: '-50%',
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={
              phase >= 2
                ? { x: `${x}cqw`, y: `${y}cqh`, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.6] }
                : { x: 0, y: 0, opacity: 0, scale: 0.4 }
            }
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.05 + (i % 6) * 0.025 }}
          />
        );
      })}

      {/* Floating ambient embers (continuous) */}
      {[...Array(10)].map((_, i) => {
        const left = (i * 41 + 11) % 100;
        const delay = (i * 0.22) % 2;
        const size = 3 + (i % 3);
        return (
          <motion.div
            key={`ember-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: '-10%',
              width: size,
              height: size,
              background: i % 2 === 0 ? '#FF6A3D' : '#FFB347',
              boxShadow: `0 0 ${size * 4}px rgba(255,150,80,0.85)`,
            }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: '-120cqh', opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 3.6 + (i % 3) * 0.4,
              delay,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        );
      })}

      {/* Center: wordmark ignite reveal */}
      <div className="absolute inset-x-0 top-[28%] flex flex-col items-center px-[6cqw]">
        {/* Igniting glow disc that swells behind the wordmark */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            top: '0cqh',
            width: '90cqw',
            height: '90cqw',
            background:
              'radial-gradient(circle, rgba(232,69,32,0.55) 0%, rgba(255,179,71,0.25) 40%, transparent 70%)',
            filter: 'blur(20px)',
          }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={
            phase >= 2
              ? { scale: [0.2, 1.15, 1], opacity: [0, 0.95, 0.55] }
              : { scale: 0.2, opacity: 0 }
          }
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Real wordmark image */}
        <motion.img
          src={`${BASE}brand/wordmark.png`}
          alt="knowyourpit"
          className="relative z-10 object-contain"
          style={{
            width: '82cqw',
            maxWidth: 480,
            filter: 'drop-shadow(0 0 28px rgba(232,69,32,0.7))',
          }}
          initial={{ opacity: 0, scale: 0.7, y: 20 }}
          animate={
            phase >= 2
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.7, y: 20 }
          }
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Dual-audience tags - the hook */}
      <div className="absolute inset-x-0 top-[60%] flex flex-col items-center gap-[2cqw] px-[8cqw]">
        <motion.div
          className="flex items-center gap-[3cqw]"
          initial={{ opacity: 0, y: 18 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="font-mono text-[3cqw] tracking-[0.32em] text-cream/75">
            FIRST-TIMER
          </span>
          <span
            className="h-[2px] w-[8cqw]"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--color-blaze), transparent)',
              boxShadow: '0 0 12px rgba(232,69,32,0.7)',
            }}
          />
          <span className="font-mono text-[3cqw] tracking-[0.32em] text-blaze-bright">
            CHAMPION
          </span>
        </motion.div>

        <motion.div
          className="font-display text-cream text-[12cqw] leading-[0.88] glow-cream text-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          ONE APP.
        </motion.div>
      </div>

      {/* Closing micro line - the dual-audience promise */}
      <motion.div
        className="absolute inset-x-0 bottom-[10%] flex justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="font-body text-[3.6cqw] text-cream/85 text-center px-10 leading-tight">
          Built for <span className="text-blaze-bright font-semibold">every cook</span>
        </div>
      </motion.div>

      {/* Vertical scan-line wipe at end (continuous motion through the hold) */}
      <motion.div
        className="absolute inset-x-0 h-[2px] bg-blaze"
        style={{
          boxShadow: '0 0 18px rgba(232,69,32,0.95), 0 0 60px rgba(232,69,32,0.45)',
        }}
        initial={{ top: '-2%', opacity: 0 }}
        animate={
          phase >= 5
            ? { top: '102%', opacity: [0, 1, 1, 0] }
            : { top: '-2%', opacity: 0 }
        }
        transition={{ duration: 0.7, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}
