import { motion } from 'framer-motion';

const BASE = import.meta.env.BASE_URL;

export function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-[#0D0D0D]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      <motion.img
        src={`${BASE}brand/scene1-couch.png`}
        alt="Relaxing on couch"
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.05, x: '2%', y: '2%' }}
        animate={{ scale: 1.15, x: '-2%', y: '-2%' }}
        transition={{ duration: 6, ease: 'linear' }}
      />
    </motion.div>
  );
}
