/**
 * Triply colour tokens (UI/UX Spec v1 §38, Visual Identity v1 §6).
 * Light theme only until a dark theme is intentionally designed.
 */
export const palette = {
  violet: '#6C4DF6',
  coral: '#FF6B5F',
  deepInk: '#15131D',
  slate: '#6E6A78',
  cloud: '#F7F6FB',
  white: '#FFFFFF',
  mist: '#E8E5EF',
  lavenderMist: '#E9E4FF',
  warmSand: '#FFF1E8',
  softRose: '#FFE5E2',
  green: '#1F9D73',
  amber: '#D98E1E',
  red: '#D9465F',
  blue: '#4E7AD9',
} as const;

export const colors = {
  primary: palette.violet,
  accent: palette.coral,
  textPrimary: palette.deepInk,
  textSecondary: palette.slate,
  background: palette.cloud,
  surface: palette.white,
  border: palette.mist,
  success: palette.green,
  warning: palette.amber,
  danger: palette.red,
  info: palette.blue,
  /** Text/icons placed on a primary (violet) fill. */
  onPrimary: palette.white,
  /** Text/icons placed on a danger fill. */
  onDanger: palette.white,
  primarySubtle: palette.lavenderMist,
  accentSubtle: palette.softRose,
  warmSubtle: palette.warmSand,
} as const;

export type ColorToken = keyof typeof colors;
