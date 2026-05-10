/**
 * VideoTemplate — knowyourpit vertical 9:16 promo (≈21.4s)
 *
 * Director's note — motion system
 * --------------------------------
 * • Scene order is driven by SCENE_DURATIONS (hook → score → sequencer →
 *   scanner → close). Total runtime is the sum of these durations and
 *   `useVideoPlayer({ totalDurationMs })` advances the timeline.
 * • Entrance: each scene mounts inside <AnimatePresence mode="sync">. The
 *   inner scene is rendered with `initial={{ opacity: 1 }}` because each
 *   scene drives its own staged reveal via a `phase` state machine. Avoid
 *   wrapping scenes in fade transitions here — the corner marks, ember
 *   layer, and accent dot are persistent and provide visual continuity.
 * • Exit: scenes do not crossfade. The vertical scan-line wipe is owned
 *   by the outgoing scene (see Scene1 / Scene3) so the cut feels intentional
 *   rather than hidden behind a dissolve.
 * • Persistent layers below: ember-loop video (smoke continuity), drifting
 *   accent dot, charcoal noise overlay, top + bottom hairline rules, and
 *   four corner crosshair marks. These read as a fixed "broadcast frame"
 *   so the actual scene swaps feel like channel cuts, not page changes.
 * • Easing convention: scene phase reveals use [0.16, 1, 0.3, 1] (expo-out)
 *   for hero text and [0.22, 1, 0.36, 1] (out-quart) for supporting layers.
 *   Continuous motion (sparks, scan lines, heat haze) uses easeInOut so
 *   nothing visibly stops between scene cuts.
 * • Loop: when `loop` is true the player resets to t=0 on completion. A
 *   `_r1`/`_r2` suffix on the active scene key forces re-mount on the next
 *   loop so internal `useEffect` timers re-fire (see useSceneControls).
 */
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  hook: 4200,
  score: 4500,
  sequencer: 4500,
  scanner: 4200,
  // Close holds longer so the "Available on iOS" lockup gets ≈ 2.5s of
  // readable hold (lockup reveals at phase 5 → 2.9s, so 5500 - 2900 = 2.6s).
  close: 5500,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  hook: Scene1,
  score: Scene2,
  sequencer: Scene3,
  scanner: Scene4,
  close: Scene5,
};

const accentX = ['12cqw', '78cqw', '20cqw', '70cqw', '50cqw'];
const accentY = ['18cqh', '72cqh', '40cqh', '12cqh', '88cqh'];
const accentScale = [1.1, 0.9, 1.3, 1.0, 1.5];
const accentOpacity = [0.35, 0.25, 0.3, 0.4, 0.2];

const ruleLeft = ['8cqw', '4cqw', '6cqw', '10cqw', '5cqw'];
const ruleRight = ['8cqw', '6cqw', '4cqw', '8cqw', '5cqw'];
const ruleTop = ['52%', '24%', '88%', '26%', '52%'];
const ruleOpacity = [0.4, 0.55, 0.5, 0.55, 0.7];

interface VideoTemplateProps {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
}

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: VideoTemplateProps = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const safeIndex = sceneIndex >= 0 ? sceneIndex : 0;
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="relative w-full h-full overflow-hidden bg-charcoal bg-grain">
      {/* Persistent ambient ember layer — always drifting */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: '70cqw',
            height: '70cqw',
            background:
              'radial-gradient(circle, rgba(232,69,32,0.5) 0%, rgba(232,69,32,0.1) 45%, transparent 70%)',
            left: '-20cqw',
            top: '-10cqh',
          }}
          animate={{
            x: ['0cqw', '40cqw', '10cqw', '-10cqw', '0cqw'],
            y: ['0cqh', '20cqh', '60cqh', '40cqh', '0cqh'],
          }}
          transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: '60cqw',
            height: '60cqw',
            background:
              'radial-gradient(circle, rgba(255,106,61,0.4) 0%, rgba(155,104,64,0.12) 45%, transparent 70%)',
            right: '-10cqw',
            bottom: '-10cqh',
          }}
          animate={{
            x: ['0cqw', '-20cqw', '10cqw', '-15cqw', '0cqw'],
            y: ['0cqh', '-30cqh', '-10cqh', '-40cqh', '0cqh'],
          }}
          transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>

      {/* Persistent moving accent dot — repositions each scene */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '8cqw',
          height: '8cqw',
          background:
            'radial-gradient(circle, rgba(255,180,71,0.85) 0%, rgba(232,69,32,0.5) 50%, transparent 80%)',
          filter: 'blur(8px)',
        }}
        animate={{
          x: accentX[safeIndex],
          y: accentY[safeIndex],
          scale: accentScale[safeIndex],
          opacity: accentOpacity[safeIndex],
        }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Persistent thin accent rule that travels across scenes */}
      <motion.div
        className="absolute h-[2px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--color-blaze), var(--color-ember), transparent)',
          boxShadow: '0 0 16px rgba(232,69,32,0.7)',
        }}
        animate={{
          left: ruleLeft[safeIndex],
          right: ruleRight[safeIndex],
          top: ruleTop[safeIndex],
          opacity: ruleOpacity[safeIndex],
        }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Persistent corner brand mark (small wordmark, top-right) */}
      <motion.div
        className="absolute z-30 pointer-events-none"
        animate={{
          top: safeIndex === 4 ? '-10cqh' : '3cqh',
          right: '4cqw',
          opacity: safeIndex === 4 ? 0 : 0.85,
        }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <img
          src={`${import.meta.env.BASE_URL}brand/marketing-logo.png`}
          alt=""
          className="object-contain"
          style={{
            width: '11cqw',
            maxWidth: 70,
            filter: 'drop-shadow(0 0 8px rgba(232,69,32,0.55))',
          }}
        />
      </motion.div>

      <AnimatePresence initial={false} mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
