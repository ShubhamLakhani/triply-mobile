/** 4-based spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export type SpacingToken = keyof typeof spacing;
