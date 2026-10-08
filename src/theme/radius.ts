/** Corner radius scale (Visual Identity v1 §8). */
export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;
