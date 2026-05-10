import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const BASE = import.meta.env.BASE_URL;

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 80),    // ember bg + spark embers
      setTimeout(() => setPhase(2), 250),   // phone slides up + home-screen icon pops
      setTimeout(() => setPhase(3), 1300),  // wordmark above phone
      setTimeout(() => setPhase(4), 2100),  // tagline
      setTimeout(() => setPhase(5), 2900),  // Available on iOS lockup
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-charcoal flex flex-col items-center px-[6cqw]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1 }}
    >
      {/* Continuous coal-glow background */}
      <motion.img
        src={`${BASE}brand/coals-bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.0, opacity: 0.4 }}
        animate={{ scale: 1.08, opacity: 0.55 }}
        transition={{ duration: 4, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute inset-0 bg-ember-gradient"
        animate={{ opacity: [0.65, 0.85, 0.7] }}
        transition={{ duration: 3.5, ease: 'easeInOut' }}
      />

      {/* Floating sparks for continuous motion */}
      {[...Array(10)].map((_, i) => {
        const left = (i * 41 + 7) % 100;
        const delay = (i * 0.22) % 1.6;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: '-6%',
              width: 4,
              height: 4,
              background: i % 2 === 0 ? '#FF6A3D' : '#FFB347',
              boxShadow: '0 0 16px rgba(255,150,80,0.8)',
            }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: '-110cqh', opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 3.4,
              delay,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        );
      })}

      {/* Wordmark above phone */}
      <motion.div
        className="relative z-10 mt-[8cqh] flex justify-center w-full"
        initial={{ opacity: 0, scale: 0.85, y: 16 }}
        animate={
          phase >= 3
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.85, y: 16 }
        }
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        <img
          src={`${BASE}brand/wordmark.png`}
          alt="knowyourpit"
          className="object-contain"
          style={{
            width: '70cqw',
            maxWidth: 420,
            filter: 'drop-shadow(0 0 24px rgba(232,69,32,0.55))',
          }}
        />
      </motion.div>

      {/* Tagline */}
      <motion.div
        className="relative z-10 mt-[2cqh] text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="font-display text-cream text-[6cqw] leading-[0.95] glow-cream">
          KNOW YOUR PIT.
        </div>
        <div className="font-display text-blaze-bright text-[6cqw] leading-[0.95] glow-blaze mt-[0.6cqh]">
          OWN YOUR COOK.
        </div>
      </motion.div>

      {/* Phone with home-screen showing the real app icon highlighted */}
      <motion.div
        className="relative z-10 mt-[3cqh] flex justify-center"
        initial={{ opacity: 0, y: 60, rotateX: -8 }}
        animate={
          phase >= 2
            ? { opacity: 1, y: 0, rotateX: 0 }
            : { opacity: 0, y: 60, rotateX: -8 }
        }
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        style={{ transformPerspective: 800 }}
      >
        <div
          className="relative"
          style={{
            width: '54cqw',
            maxWidth: 280,
            aspectRatio: '9 / 17',
            background: 'linear-gradient(160deg, #2A2522 0%, #16130F 100%)',
            borderRadius: '6cqw',
            boxShadow:
              '0 0 0 2px rgba(232,69,32,0.35), 0 0 32px rgba(232,69,32,0.45), 0 14px 40px rgba(0,0,0,0.7)',
            padding: '1.2cqw',
          }}
        >
          {/* Phone screen (faux home screen) */}
          <div
            className="relative w-full h-full overflow-hidden flex flex-col items-center"
            style={{
              borderRadius: '4.6cqw',
              background:
                'linear-gradient(180deg, #1B1714 0%, #0E0B09 60%, #1B1714 100%)',
              padding: '2.2cqw 1.8cqw 1.5cqw',
            }}
          >
            {/* Notch */}
            <div
              className="absolute top-[1cqw] left-1/2 -translate-x-1/2"
              style={{
                width: '14cqw',
                maxWidth: 70,
                height: '1.6cqw',
                background: '#000',
                borderRadius: '999px',
              }}
            />
            {/* Status bar */}
            <div className="w-full flex items-center justify-between font-mono text-cream/70 text-[1.5cqw] mt-[1cqw] px-[1cqw]">
              <span>9:41</span>
              <span className="tracking-[0.2em]">●●●●</span>
            </div>

            {/* Icon grid */}
            <div className="grid grid-cols-4 gap-[1.6cqw] mt-[2cqw] w-full px-[0.4cqw]">
              {[...Array(8)].map((_, i) => {
                // Highlight the knowyourpit icon at position 2 (top row, 3rd column)
                const isApp = i === 2;
                return (
                  <motion.div
                    key={i}
                    className="flex flex-col items-center gap-[0.5cqw]"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={
                      phase >= 2
                        ? { opacity: 1, scale: 1 }
                        : { opacity: 0, scale: 0.5 }
                    }
                    transition={{
                      type: 'spring',
                      stiffness: 320,
                      damping: 22,
                      delay: 0.12 + i * 0.04,
                    }}
                  >
                    {isApp ? (
                      <motion.div
                        className="relative"
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{
                          duration: 1.4,
                          ease: 'easeInOut',
                          repeat: Infinity,
                          delay: 0.6,
                        }}
                      >
                        <div
                          className="absolute inset-[-1.2cqw] rounded-[2.6cqw]"
                          style={{
                            background:
                              'radial-gradient(circle, rgba(232,69,32,0.8) 0%, rgba(255,179,71,0.35) 45%, transparent 75%)',
                            filter: 'blur(6px)',
                          }}
                        />
                        <img
                          src={`${BASE}brand/app-icon.png`}
                          alt="knowyourpit app icon"
                          className="relative object-cover"
                          style={{
                            width: '8.4cqw',
                            maxWidth: 44,
                            height: '8.4cqw',
                            maxHeight: 44,
                            borderRadius: '2cqw',
                            boxShadow: '0 0 0 1.5px rgba(255,179,71,0.55)',
                          }}
                        />
                      </motion.div>
                    ) : (
                      <div
                        style={{
                          width: '8.4cqw',
                          maxWidth: 44,
                          height: '8.4cqw',
                          maxHeight: 44,
                          borderRadius: '2cqw',
                          background:
                            i % 3 === 0
                              ? 'linear-gradient(135deg, #3a3a3a, #1d1d1d)'
                              : i % 3 === 1
                              ? 'linear-gradient(135deg, #2c2422, #181412)'
                              : 'linear-gradient(135deg, #4a3530, #221715)',
                          opacity: 0.55,
                        }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Faux dock */}
            <div
              className="absolute bottom-[1.6cqw] left-[2.2cqw] right-[2.2cqw] h-[10cqw] max-h-[60px] rounded-[2.4cqw]"
              style={{
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(10px)',
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Available on iOS lockup — app icon sits directly inside the lockup */}
      <motion.div
        className="relative z-10 mt-[2cqh] flex items-center gap-[3cqw]"
        initial={{ opacity: 0, y: 12 }}
        animate={phase >= 5 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <img
          src={`${BASE}brand/app-icon.png`}
          alt="knowyourpit app icon"
          className="object-cover"
          style={{
            width: '14cqw',
            maxWidth: 80,
            height: '14cqw',
            maxHeight: 80,
            borderRadius: '3cqw',
            boxShadow:
              '0 0 0 1.5px rgba(255,179,71,0.6), 0 0 22px rgba(232,69,32,0.55)',
          }}
        />
        <div className="text-left">
          <div className="font-mono text-cream/60 text-[2.2cqw] tracking-[0.32em]">
            DOWNLOAD
          </div>
          <div className="font-display text-cream text-[6cqw] leading-none mt-[0.6cqw] glow-cream">
            AVAILABLE ON iOS
          </div>
        </div>
      </motion.div>

      {/* Subtle bottom heat line - continuous motion */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, #E84520, #FFB347, #E84520, transparent)',
          boxShadow: '0 0 24px rgba(232,69,32,0.8)',
        }}
        animate={{ x: ['-30%', '30%', '-30%'], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
      />
    </motion.div>
  );
}
