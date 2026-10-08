import type { TextStyle } from 'react-native';

/**
 * Inter is the UI/body font (UI/UX Spec v1 §39). The display font is still an open decision,
 * so display/heading roles use Inter Bold until it is chosen.
 *
 * Fonts are loaded at runtime via @expo-google-fonts/inter, which gives identical family names on
 * iOS and Android. Weight is expressed through the family, never `fontWeight`, because Android
 * does not synthesise weights for custom fonts.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

type TextVariantStyle = Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight'>> &
  Pick<TextStyle, 'letterSpacing'>;

/** Mobile sizes from UI/UX Spec v1 §39. Caption never goes below 12. */
export const textVariants = {
  display: { fontFamily: fontFamily.bold, fontSize: 36, lineHeight: 44, letterSpacing: -0.5 },
  h1: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.4 },
  h2: { fontFamily: fontFamily.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.3 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 22, lineHeight: 28 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20 },
} as const satisfies Record<string, TextVariantStyle>;

export type TextVariant = keyof typeof textVariants;

export const headingVariants: readonly TextVariant[] = ['display', 'h1', 'h2', 'h3'];

/** Upper bound for Dynamic Type / font scale so layouts degrade gracefully, not break. */
export const maxFontSizeMultiplier = 1.8;
