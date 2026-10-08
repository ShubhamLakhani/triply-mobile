import { colors, palette } from './colors';
import { motion } from './motion';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { fontFamily, maxFontSizeMultiplier, textVariants } from './typography';

export const theme = {
  colors,
  palette,
  spacing,
  radius,
  fontFamily,
  textVariants,
  maxFontSizeMultiplier,
  motion,
  shadows,
} as const;

export type Theme = typeof theme;

/** Minimum touch target (UI/UX Spec v1 §45). */
export const MIN_TOUCH_TARGET = 44;

export { colors, palette, type ColorToken } from './colors';
export { spacing, type SpacingToken } from './spacing';
export { radius, type RadiusToken } from './radius';
export {
  fontFamily,
  textVariants,
  headingVariants,
  maxFontSizeMultiplier,
  type TextVariant,
} from './typography';
export { motion, resolveDuration, type MotionDurationToken } from './motion';
export { shadows, type ShadowToken } from './shadows';
