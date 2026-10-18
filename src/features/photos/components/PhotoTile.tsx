import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, radius, spacing } from '@/theme';

import { useSignedPhotoUrl } from '../hooks/use-profile-photos';
import type { ProfilePhoto } from '../types';

export interface PhotoTileProps {
  photo: ProfilePhoto;
  index: number;
  selected: boolean;
  busy?: boolean;
  onPress: () => void;
  size: number;
}

/** One photo in the grid, loaded through a short-lived signed URL. */
export function PhotoTile({ photo, index, selected, busy = false, onPress, size }: PhotoTileProps) {
  const signed = useSignedPhotoUrl(photo.storage_path);
  const label = `${photo.is_primary ? 'Main photo' : `Photo ${index + 1}`}${selected ? ', selected' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens photo actions"
      accessibilityState={{ selected, busy }}
      onPress={onPress}
      testID={`photo-tile-${index}`}
      style={[styles.tile, { width: size, height: size * 1.25 }, selected && styles.selected]}
    >
      {signed.data ? (
        <Image
          source={{ uri: signed.data }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
          recyclingKey={photo.id}
        />
      ) : signed.isError ? (
        <View style={[styles.image, styles.fallback]}>
          <Icon name="camera" size={24} color="textSecondary" />
          <AppText variant="caption" color="textSecondary">
            Couldn’t load
          </AppText>
        </View>
      ) : (
        <Skeleton width="100%" height={size * 1.25} />
      )}
      {photo.is_primary ? (
        <View style={styles.badge}>
          <AppText variant="caption" color="onPrimary">
            Main
          </AppText>
        </View>
      ) : null}
      {busy ? (
        <View style={styles.busy}>
          <Skeleton width={28} height={28} round />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.border,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: { borderColor: colors.primary },
  image: { width: '100%', height: '100%' },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.primarySubtle,
  },
  badge: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  busy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
