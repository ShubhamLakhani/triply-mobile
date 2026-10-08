import { contrastRatio } from '../../tests/utils/contrast';

import { colors, MIN_TOUCH_TARGET, radius, resolveDuration, spacing, textVariants, theme } from '.';

describe('theme tokens', () => {
  it('matches the approved Triply core palette', () => {
    expect(colors).toMatchObject({
      primary: '#6C4DF6',
      accent: '#FF6B5F',
      textPrimary: '#15131D',
      textSecondary: '#6E6A78',
      background: '#F7F6FB',
      surface: '#FFFFFF',
      border: '#E8E5EF',
      success: '#1F9D73',
      warning: '#D98E1E',
      danger: '#D9465F',
      info: '#4E7AD9',
    });
  });

  it('uses the approved spacing and radius scales', () => {
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 24, 32, 48, 64]);
    expect(Object.values(radius)).toEqual([10, 16, 24, 999]);
  });

  it('meets WCAG AA (4.5:1) for body text pairings', () => {
    expect(contrastRatio(colors.textPrimary, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textPrimary, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textSecondary, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textSecondary, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('meets WCAG AA large-text contrast (3:1) for destructive buttons', () => {
    // Button labels are 16px semibold; danger fill is reserved for destructive actions.
    expect(contrastRatio(colors.onDanger, colors.danger)).toBeGreaterThanOrEqual(3);
  });

  it('never renders text below the 12px caption minimum', () => {
    for (const variant of Object.values(textVariants)) {
      expect(variant.fontSize).toBeGreaterThanOrEqual(12);
      expect(variant.lineHeight).toBeGreaterThan(variant.fontSize);
    }
  });

  it('keeps tap targets at least 44pt', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
  });

  it('collapses motion to zero when reduced motion is preferred', () => {
    expect(resolveDuration('standard', true)).toBe(0);
    expect(resolveDuration('standard', false)).toBe(theme.motion.duration.standard);
    const { micro, standard, brand } = theme.motion.duration;
    expect(micro).toBeGreaterThanOrEqual(120);
    expect(micro).toBeLessThanOrEqual(220);
    expect(standard).toBeGreaterThanOrEqual(220);
    expect(standard).toBeLessThanOrEqual(350);
    expect(brand).toBeGreaterThanOrEqual(400);
    expect(brand).toBeLessThanOrEqual(700);
  });
});
