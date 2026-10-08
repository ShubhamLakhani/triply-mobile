/**
 * Motion durations in ms (UI/UX Spec v1 §43, Visual Identity v1 §12).
 * micro 120–220 · standard 220–350 · brand 400–700. Always respect reduced motion.
 */
export const motion = {
  duration: {
    micro: 180,
    standard: 280,
    brand: 520,
  },
} as const;

export type MotionDurationToken = keyof typeof motion.duration;

/** Returns 0 when the user prefers reduced motion so animations resolve instantly. */
export function resolveDuration(token: MotionDurationToken, reduceMotion: boolean): number {
  return reduceMotion ? 0 : motion.duration[token];
}
