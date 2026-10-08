import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

export interface AppScreenProps {
  children: ReactNode;
  /** Defaults to top/left/right — the tab bar or home indicator area owns the bottom edge. */
  edges?: readonly Edge[];
  scroll?: boolean;
  /** Wraps content so focused inputs stay visible above the keyboard. */
  keyboardAware?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'left', 'right'];

/**
 * Base screen container: safe areas (iOS notch/home indicator, Android edge-to-edge system bars),
 * theme background, optional scrolling and keyboard avoidance.
 *
 * Keyboard: Expo's guidance for the built-in KeyboardAvoidingView is `padding` on iOS and no
 * behaviour on Android (the OS resizes the window). Revisit with react-native-keyboard-controller
 * only if onboarding/chat need it.
 */
export function AppScreen({
  children,
  edges = DEFAULT_EDGES,
  scroll = false,
  keyboardAware = false,
  contentStyle,
  testID,
}: AppScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root} edges={edges} testID={testID}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg, gap: spacing.md },
});
