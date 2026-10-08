import { StyleSheet, Text, type TextProps } from 'react-native';

import {
  colors,
  headingVariants,
  maxFontSizeMultiplier,
  textVariants,
  type ColorToken,
  type TextVariant,
} from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
}

/** Themed text. Headings are exposed to screen readers as headers; font scaling stays enabled. */
export function AppText({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  accessibilityRole,
  ...rest
}: AppTextProps) {
  const isHeading = headingVariants.includes(variant);
  return (
    <Text
      accessibilityRole={accessibilityRole ?? (isHeading ? 'header' : undefined)}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[textVariants[variant], { color: colors[color] }, align && styles[align], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
});
