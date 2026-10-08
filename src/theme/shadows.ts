import type { ViewStyle } from 'react-native';

/**
 * Soft, low-opacity shadows only (Visual Identity v1 §23).
 * `boxShadow` is supported on both iOS and Android with the New Architecture,
 * so no platform-specific shadow/elevation code is required.
 */
export const shadows = {
  none: {},
  card: { boxShadow: '0px 4px 16px rgba(21, 19, 29, 0.06)' },
  raised: { boxShadow: '0px 8px 24px rgba(21, 19, 29, 0.10)' },
} as const satisfies Record<string, ViewStyle>;

export type ShadowToken = keyof typeof shadows;
