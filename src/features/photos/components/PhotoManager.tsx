import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { useAnalytics } from '@/services/analytics';
import { colors, radius, spacing } from '@/theme';

import { PhotoError } from '../api/photo-errors';
import { pickProfilePhoto } from '../api/photo-picker';
import {
  useDeleteProfilePhoto,
  useOwnProfilePhotos,
  useReorderProfilePhotos,
  useSetPrimaryPhoto,
  useUploadProfilePhoto,
} from '../hooks/use-profile-photos';
import { MAX_PROFILE_PHOTOS } from '../types';

import { PhotoTile } from './PhotoTile';

export interface PhotoManagerProps {
  userId: string | null;
  /**
   * Onboarding is complete: the profile must always keep one photo (the database rejects
   * deleting the last one), so with a single photo "Remove" becomes "Replace" (add the new
   * photo first, then delete the old one).
   */
  protectLastPhoto?: boolean;
  testID?: string;
}

const COLUMNS = 3;

export function photoErrorMessage(error: unknown): string {
  if (error instanceof PhotoError) {
    switch (error.code) {
      case 'limit_reached':
        return `You can add up to ${MAX_PROFILE_PHOTOS} photos.`;
      case 'invalid_input':
        return error.message;
      case 'not_allowed':
        return error.message === 'Not allowed.'
          ? 'That photo can’t be changed right now.'
          : error.message;
      case 'upload_failed':
        return 'Upload didn’t finish. Check your connection and try again.';
      case 'last_photo':
        return 'Your profile needs at least one photo. Use Replace to swap it.';
      case 'replace_incomplete':
        return 'Your new photo was added, but the old one couldn’t be removed. Try removing it again.';
      case 'account_inactive':
        return 'Your account can’t make changes right now.';
      case 'not_authenticated':
        return 'Please sign in again to manage photos.';
      default:
        return 'Something went wrong with that photo. Please try again.';
    }
  }
  return 'Something went wrong with that photo. Please try again.';
}

/**
 * Up to 6 photos in a 3-column grid with empty slots for remaining capacity. Tapping a photo
 * reveals labelled actions (make main, move, remove) rather than relying on drag, so reordering
 * works identically on Android and with assistive tech.
 */
export function PhotoManager({
  userId,
  protectLastPhoto = false,
  testID = 'photo-manager',
}: PhotoManagerProps) {
  const analytics = useAnalytics();
  const { reduceMotion, duration } = useMotionPreference();
  const { width } = useWindowDimensions();
  const photos = useOwnProfilePhotos(userId);
  const upload = useUploadProfilePhoto(userId);
  const remove = useDeleteProfilePhoto(userId);
  const setPrimary = useSetPrimaryPhoto(userId);
  const reorder = useReorderProfilePhotos(userId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(
    () => [...(photos.data ?? [])].sort((a, b) => a.position - b.position),
    [photos.data],
  );
  const selected = list.find((p) => p.id === selectedId) ?? null;
  const selectedIndex = selected ? list.indexOf(selected) : -1;
  const count = list.length;
  const emptySlots = Math.max(0, MAX_PROFILE_PHOTOS - count - (upload.isPending ? 1 : 0));
  const tileSize = Math.floor((width - spacing.md * 2 - spacing.xs * (COLUMNS - 1)) / COLUMNS);
  const busy = upload.isPending || remove.isPending || setPrimary.isPending || reorder.isPending;
  const mustReplace = protectLastPhoto && count === 1;

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(photoErrorMessage(cause));
    }
  }, []);

  const onAdd = () =>
    run(async () => {
      const picked = await pickProfilePhoto();
      if (!picked) return;
      await upload.mutateAsync(picked);
      analytics.track('photo_upload_completed', { photo_count: count + 1 });
    });

  /** Swap the only photo: the new one is registered before the old one is deleted. */
  const onReplace = (oldId: string) =>
    run(async () => {
      const picked = await pickProfilePhoto();
      if (!picked) return;
      await upload.mutateAsync(picked);
      analytics.track('photo_upload_completed', { photo_count: count + 1 });
      try {
        await remove.mutateAsync(oldId);
      } catch (cause) {
        throw new PhotoError('replace_incomplete', 'Old photo was not removed.', { cause });
      }
      setSelectedId(null);
    });

  const move = (direction: -1 | 1) => {
    if (!selected) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((p) => p.id);
    [ids[selectedIndex], ids[target]] = [ids[target]!, ids[selectedIndex]!];
    void run(() => reorder.mutateAsync(ids));
  };

  return (
    <View style={styles.root} testID={testID}>
      <AppText variant="small" color="textSecondary" accessibilityLiveRegion="polite">
        {count === 0
          ? `Add up to ${MAX_PROFILE_PHOTOS} photos. The first one becomes your main photo.`
          : `${count} of ${MAX_PROFILE_PHOTOS} photos · tap a photo to edit`}
      </AppText>

      {photos.isLoading && !photos.data ? (
        <View style={styles.grid}>
          {Array.from({ length: COLUMNS }, (_, i) => (
            <Skeleton key={i} width={tileSize} height={tileSize * 1.25} />
          ))}
        </View>
      ) : (
        <Animated.View
          style={styles.grid}
          layout={reduceMotion ? undefined : Layout.duration(duration('standard'))}
        >
          {list.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              index={index}
              size={tileSize}
              selected={photo.id === selectedId}
              busy={busy && photo.id === selectedId}
              onPress={() => setSelectedId((current) => (current === photo.id ? null : photo.id))}
            />
          ))}
          {upload.isPending ? (
            <View
              style={[styles.slot, styles.uploading, { width: tileSize, height: tileSize * 1.25 }]}
              accessibilityLabel="Uploading photo"
              accessibilityRole="progressbar"
            >
              <Skeleton width={28} height={28} round />
              <AppText variant="caption" color="textSecondary">
                Uploading…
              </AppText>
            </View>
          ) : null}
          {Array.from({ length: emptySlots }, (_, i) => (
            <Pressable
              key={`empty-${i}`}
              accessibilityRole="button"
              accessibilityLabel={i === 0 ? 'Add photo' : `Empty photo slot ${count + i + 1}`}
              onPress={i === 0 ? onAdd : undefined}
              disabled={i !== 0 || busy}
              testID={i === 0 ? 'photo-add' : undefined}
              style={({ pressed }) => [
                styles.slot,
                { width: tileSize, height: tileSize * 1.25 },
                i === 0 && styles.addSlot,
                pressed && styles.pressed,
              ]}
            >
              {i === 0 ? (
                <>
                  <Icon name="plus" size={22} color="primary" />
                  <AppText variant="caption" color="primary">
                    Add photo
                  </AppText>
                </>
              ) : null}
            </Pressable>
          ))}
        </Animated.View>
      )}

      {selected ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(duration('micro'))}
          style={styles.actions}
          testID="photo-actions"
        >
          <View style={styles.actionRow}>
            <AppButton
              label="Make main"
              variant="secondary"
              disabled={selected.is_primary || busy}
              onPress={() => void run(() => setPrimary.mutateAsync(selected.id))}
              testID="photo-make-primary"
            />
            <AppButton
              label="Move left"
              variant="secondary"
              disabled={selectedIndex <= 0 || busy}
              onPress={() => move(-1)}
              accessibilityLabel="Move photo earlier"
              testID="photo-move-left"
            />
            <AppButton
              label="Move right"
              variant="secondary"
              disabled={selectedIndex >= list.length - 1 || busy}
              onPress={() => move(1)}
              accessibilityLabel="Move photo later"
              testID="photo-move-right"
            />
          </View>
          {mustReplace ? (
            <>
              <AppButton
                label="Replace photo"
                variant="secondary"
                disabled={busy}
                onPress={() => void onReplace(selected.id)}
                testID="photo-replace"
              />
              <AppText variant="caption" color="textSecondary" testID="photo-last-hint">
                Your profile needs at least one photo, so this one can be replaced but not removed.
              </AppText>
            </>
          ) : (
            <AppButton
              label="Remove photo"
              variant="destructive"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await remove.mutateAsync(selected.id);
                  setSelectedId(null);
                })
              }
              testID="photo-remove"
            />
          )}
        </Animated.View>
      ) : null}

      {error ? <InlineMessage tone="error" message={error} testID="photo-error" /> : null}
      {photos.isError ? (
        <InlineMessage
          tone="error"
          message="Couldn’t load your photos. Pull to refresh or try again later."
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  slot: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.surface,
  },
  addSlot: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
    borderStyle: 'solid',
  },
  uploading: { borderStyle: 'solid' },
  pressed: { opacity: 0.8 },
  actions: { gap: spacing.xs },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
