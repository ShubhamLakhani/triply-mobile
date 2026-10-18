import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSignedPhotoUrl } from '@/features/photos/hooks/use-profile-photos';
import type { ProfilePhoto } from '@/features/photos/types';
import { colors, radius, spacing } from '@/theme';

export interface ProfileHeaderPhotoProps {
  photo: ProfilePhoto | null | undefined;
  photoCount: number;
  isLoading: boolean;
  onManage: () => void;
}

/** Large primary-photo area at the top of the Profile tab, with a manage affordance. */
export function ProfileHeaderPhoto({
  photo,
  photoCount,
  isLoading,
  onManage,
}: ProfileHeaderPhotoProps) {
  const signed = useSignedPhotoUrl(photo?.storage_path ?? null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        photo ? `Your main photo. ${photoCount} photos. Manage photos` : 'Add profile photos'
      }
      onPress={onManage}
      style={({ pressed }) => [styles.frame, pressed && styles.pressed]}
      testID="profile-photo-hero"
    >
      {isLoading ? (
        <Skeleton width="100%" height={320} />
      ) : photo && signed.data ? (
        <Image
          source={{ uri: signed.data }}
          style={styles.image}
          contentFit="cover"
          transition={250}
          accessibilityIgnoresInvertColors
        />
      ) : photo ? (
        <Skeleton width="100%" height={320} />
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="camera" size={28} color="primary" />
          </View>
          <AppText variant="bodyStrong">Add your photos</AppText>
          <AppText variant="small" color="textSecondary" align="center">
            Profiles with photos are shown first.
          </AppText>
        </View>
      )}
      <View style={styles.pill}>
        <AppText variant="caption" color="onPrimary">
          {photo ? `${photoCount} photo${photoCount === 1 ? '' : 's'} · Manage` : 'Add photos'}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 320,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primarySubtle,
  },
  pressed: { opacity: 0.92 },
  image: { width: '100%', height: '100%' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pill: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(21, 19, 29, 0.7)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
});
