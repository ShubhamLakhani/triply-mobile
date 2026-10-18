import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Surface } from '@/components/ui/Surface';
import { colors, radius, spacing } from '@/theme';

import { AppScreen } from './AppScreen';

export interface ComingSoonScreenProps {
  title: string;
  icon: IconName;
  headline: string;
  description: string;
  testID?: string;
}

/** Polished holding state for tabs whose product UI arrives in a later phase. */
export function ComingSoonScreen({
  title,
  icon,
  headline,
  description,
  testID,
}: ComingSoonScreenProps) {
  return (
    <AppScreen testID={testID} contentStyle={styles.content}>
      <AppText variant="h1">{title}</AppText>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Icon name={icon} size={36} color="primary" />
        </View>
        <AppText variant="h3" align="center">
          {headline}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {description}
        </AppText>
        <Surface tone="warm" style={styles.note}>
          <AppText variant="small" align="center">
            Coming soon. Finish your profile so you’re ready when it opens.
          </AppText>
        </Surface>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { alignSelf: 'stretch', paddingVertical: spacing.sm },
});
