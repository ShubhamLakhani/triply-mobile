import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, type ColorToken } from '@/theme';

export type IconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'plus'
  | 'minus'
  | 'check'
  | 'close'
  | 'compass'
  | 'hearts'
  | 'suitcase'
  | 'person'
  | 'camera';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorToken;
  /** Optional raw colour (for use on filled surfaces). */
  rawColor?: string;
}

/**
 * Dependency-free line icons drawn with Views, so iOS and Android render identically and no
 * icon font is bundled. Decorative only: callers label the surrounding control.
 */
export function Icon({ name, size = 20, color = 'textPrimary', rawColor }: IconProps) {
  const stroke = rawColor ?? colors[color];
  const t = Math.max(1.5, Math.round(size / 11));
  const box: ViewStyle = { width: size, height: size };

  switch (name) {
    case 'chevron-left':
    case 'chevron-right': {
      const s = size * 0.42;
      return (
        <View style={[box, styles.center]} aria-hidden>
          <View
            style={{
              width: s,
              height: s,
              borderLeftWidth: t,
              borderBottomWidth: t,
              borderColor: stroke,
              transform: [
                { translateX: name === 'chevron-left' ? size * 0.1 : -size * 0.1 },
                { rotate: name === 'chevron-left' ? '45deg' : '225deg' },
              ],
            }}
          />
        </View>
      );
    }
    case 'plus':
    case 'close': {
      const len = size * 0.6;
      const rotate = name === 'close' ? '45deg' : '0deg';
      return (
        <View style={[box, styles.center, { transform: [{ rotate }] }]} aria-hidden>
          <View style={[styles.abs, { width: len, height: t, backgroundColor: stroke }]} />
          <View style={[styles.abs, { width: t, height: len, backgroundColor: stroke }]} />
        </View>
      );
    }
    case 'minus':
      return (
        <View style={[box, styles.center]} aria-hidden>
          <View style={{ width: size * 0.6, height: t, backgroundColor: stroke }} />
        </View>
      );
    case 'check':
      return (
        <View style={[box, styles.center]} aria-hidden>
          <View
            style={{
              width: size * 0.55,
              height: size * 0.3,
              borderLeftWidth: t,
              borderBottomWidth: t,
              borderColor: stroke,
              transform: [{ translateY: -size * 0.08 }, { rotate: '-45deg' }],
            }}
          />
        </View>
      );
    case 'compass':
      return (
        <View style={[box, styles.center]} aria-hidden>
          <View
            style={[
              styles.ring,
              { width: size, height: size, borderWidth: t, borderColor: stroke },
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                width: size * 0.2,
                height: size * 0.5,
                backgroundColor: stroke,
                borderRadius: size * 0.1,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </View>
      );
    case 'hearts':
      return (
        <View style={[box, styles.center]} aria-hidden>
          <View
            style={[
              styles.abs,
              styles.ring,
              {
                width: size * 0.62,
                height: size * 0.62,
                borderWidth: t,
                borderColor: stroke,
                left: 0,
                top: size * 0.19,
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              styles.ring,
              {
                width: size * 0.62,
                height: size * 0.62,
                borderWidth: t,
                borderColor: stroke,
                right: 0,
                top: size * 0.19,
              },
            ]}
          />
        </View>
      );
    case 'suitcase':
      return (
        <View style={[box, styles.center]} aria-hidden>
          <View
            style={[
              styles.abs,
              {
                width: size * 0.36,
                height: size * 0.22,
                borderWidth: t,
                borderBottomWidth: 0,
                borderColor: stroke,
                top: size * 0.08,
                borderTopLeftRadius: t * 2,
                borderTopRightRadius: t * 2,
              },
            ]}
          />
          <View
            style={{
              width: size * 0.9,
              height: size * 0.62,
              borderWidth: t,
              borderColor: stroke,
              borderRadius: size * 0.16,
              marginTop: size * 0.22,
            }}
          />
        </View>
      );
    case 'person':
      return (
        <View style={[box, styles.center]} aria-hidden>
          <View
            style={[
              styles.ring,
              {
                width: size * 0.42,
                height: size * 0.42,
                borderWidth: t,
                borderColor: stroke,
                marginBottom: size * 0.06,
              },
            ]}
          />
          <View
            style={{
              width: size * 0.8,
              height: size * 0.36,
              borderWidth: t,
              borderBottomWidth: 0,
              borderColor: stroke,
              borderTopLeftRadius: size * 0.4,
              borderTopRightRadius: size * 0.4,
            }}
          />
        </View>
      );
    case 'camera':
      return (
        <View style={[box, styles.center]} aria-hidden>
          <View
            style={{
              width: size * 0.9,
              height: size * 0.66,
              borderWidth: t,
              borderColor: stroke,
              borderRadius: size * 0.18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={[
                styles.ring,
                { width: size * 0.32, height: size * 0.32, borderWidth: t, borderColor: stroke },
              ]}
            />
          </View>
        </View>
      );
    default:
      return <View style={box} />;
  }
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  ring: { borderRadius: 999 },
});
