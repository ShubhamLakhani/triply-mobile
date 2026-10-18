import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';
import { PhotoError } from '../api/photo-errors';
import { normalizeProfilePhoto } from '../api/photo-normalize';
import {
  useDeleteProfilePhoto,
  useOwnProfilePhotos,
  useReorderProfilePhotos,
  useSetPrimaryPhoto,
  useSignedPhotoUrl,
  useUploadProfilePhoto,
} from '../hooks/use-profile-photos';
import type { ProfilePhoto } from '../types';

import { PhotoManager } from './PhotoManager';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(() => ({ size: 1234 })) }));
jest.mock('../api/photo-normalize', () => ({ normalizeProfilePhoto: jest.fn() }));
jest.mock('../hooks/use-profile-photos', () => ({
  useOwnProfilePhotos: jest.fn(),
  useSignedPhotoUrl: jest.fn(),
  useUploadProfilePhoto: jest.fn(),
  useDeleteProfilePhoto: jest.fn(),
  useSetPrimaryPhoto: jest.fn(),
  useReorderProfilePhotos: jest.fn(),
}));

const USER_ID = '1a000000-0000-4000-8000-00000000000a';
const photo = (n: number, primary = n === 1): ProfilePhoto => ({
  id: `ab000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  user_id: USER_ID,
  storage_path: `${USER_ID}/ab000000-0000-4000-8000-${String(n).padStart(12, '0')}.jpg`,
  position: n - 1,
  is_primary: primary,
  mime_type: 'image/jpeg',
  file_size_bytes: 10,
  width: null,
  height: null,
  created_at: '',
  updated_at: '',
});

function setup(
  photos: ProfilePhoto[],
  overrides: Partial<Record<'upload' | 'remove' | 'setPrimary' | 'reorder', jest.Mock>> = {},
) {
  const upload = overrides.upload ?? jest.fn().mockResolvedValue(photo(photos.length + 1));
  const remove =
    overrides.remove ?? jest.fn().mockResolvedValue({ storagePath: 'x', objectRemoved: true });
  const setPrimary = overrides.setPrimary ?? jest.fn().mockResolvedValue(photos);
  const reorder = overrides.reorder ?? jest.fn().mockResolvedValue(photos);
  jest
    .mocked(useOwnProfilePhotos)
    .mockReturnValue({ data: photos, isLoading: false, isError: false } as never);
  jest
    .mocked(useSignedPhotoUrl)
    .mockReturnValue({ data: 'https://example.test/signed', isError: false } as never);
  jest
    .mocked(useUploadProfilePhoto)
    .mockReturnValue({ mutateAsync: upload, isPending: false } as never);
  jest
    .mocked(useDeleteProfilePhoto)
    .mockReturnValue({ mutateAsync: remove, isPending: false } as never);
  jest
    .mocked(useSetPrimaryPhoto)
    .mockReturnValue({ mutateAsync: setPrimary, isPending: false } as never);
  jest
    .mocked(useReorderProfilePhotos)
    .mockReturnValue({ mutateAsync: reorder, isPending: false } as never);
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  // A typical iPhone camera photo: HEIC, 12 MP.
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///tmp/IMG_0001.HEIC',
        mimeType: 'image/heic',
        fileSize: 2_900_000,
        width: 3024,
        height: 4032,
      },
    ],
  } as never);
  jest.mocked(normalizeProfilePhoto).mockResolvedValue({
    localUri: 'file:///cache/normalized.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 812_000,
    width: 1536,
    height: 2048,
  });
  return { upload, remove, setPrimary, reorder, ...createTestProviders() };
}

describe('PhotoManager', () => {
  afterEach(() => jest.clearAllMocks());

  it('accepts a HEIC photo and uploads the normalized JPEG, never the original', async () => {
    const { upload, wrapper, transport } = setup([]);
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    await fireEvent.press(screen.getByTestId('photo-add'));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        exif: false,
        allowsMultipleSelection: false,
      }),
    );
    expect(normalizeProfilePhoto).toHaveBeenCalledWith('file:///tmp/IMG_0001.HEIC');
    expect(upload).toHaveBeenCalledWith({
      localUri: 'file:///cache/normalized.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 812_000,
      width: 1536,
      height: 2048,
    });
    expect(transport.capture).toHaveBeenCalledWith('photo_upload_completed', { photo_count: 1 });
  });

  it('does nothing when the picker is cancelled', async () => {
    const { upload, wrapper } = setup([]);
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({ canceled: true, assets: null } as never);
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    await fireEvent.press(screen.getByTestId('photo-add'));
    expect(upload).not.toHaveBeenCalled();
  });

  it('shows the main badge and hides the add slot at six photos', async () => {
    const { wrapper } = setup([1, 2, 3, 4, 5, 6].map((n) => photo(n)));
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    expect(screen.getByText('Main')).toBeOnTheScreen();
    expect(screen.queryByTestId('photo-add')).toBeNull();
    expect(screen.getByText('6 of 6 photos · tap a photo to edit')).toBeOnTheScreen();
  });

  it('sets primary, reorders and removes through the labelled actions', async () => {
    const photos = [photo(1), photo(2), photo(3)];
    const { setPrimary, reorder, remove, wrapper } = setup(photos);
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    await fireEvent.press(screen.getByTestId('photo-tile-1'));
    expect(screen.getByTestId('photo-actions')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('photo-make-primary'));
    expect(setPrimary).toHaveBeenCalledWith(photos[1]!.id);
    await fireEvent.press(screen.getByTestId('photo-move-right'));
    expect(reorder).toHaveBeenCalledWith([photos[0]!.id, photos[2]!.id, photos[1]!.id]);
    await fireEvent.press(screen.getByTestId('photo-remove'));
    expect(remove).toHaveBeenCalledWith(photos[1]!.id);
  });

  it('cannot move the first photo left and cannot make the main photo main again', async () => {
    const { wrapper } = setup([photo(1), photo(2)]);
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    await fireEvent.press(screen.getByTestId('photo-tile-0'));
    expect(screen.getByTestId('photo-move-left').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('photo-make-primary').props.accessibilityState.disabled).toBe(true);
  });

  it('shows a recoverable message when the upload fails', async () => {
    const upload = jest
      .fn()
      .mockRejectedValue(new PhotoError('upload_failed', 'Photo upload failed.'));
    const { wrapper } = setup([], { upload });
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    await fireEvent.press(screen.getByTestId('photo-add'));
    expect(await screen.findByTestId('photo-error')).toHaveTextContent(/didn’t finish/);
    expect(screen.getByTestId('photo-add')).toBeOnTheScreen();
  });

  it('explains the limit when the server rejects a 7th photo', async () => {
    const upload = jest.fn().mockRejectedValue(new PhotoError('limit_reached', 'x'));
    const { wrapper } = setup([photo(1)], { upload });
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    await fireEvent.press(screen.getByTestId('photo-add'));
    expect(await screen.findByTestId('photo-error')).toHaveTextContent(/up to 6 photos/);
  });

  it('shows the normalization error when a photo cannot be prepared', async () => {
    const { upload, wrapper } = setup([]);
    jest
      .mocked(normalizeProfilePhoto)
      .mockRejectedValue(
        new PhotoError('invalid_input', 'That photo is too large. Try another one.'),
      );
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    await fireEvent.press(screen.getByTestId('photo-add'));
    expect(await screen.findByTestId('photo-error')).toHaveTextContent(/too large/);
    expect(upload).not.toHaveBeenCalled();
  });

  it('shows a fallback when a signed URL cannot be created', async () => {
    const { wrapper } = setup([photo(1)]);
    jest.mocked(useSignedPhotoUrl).mockReturnValue({ data: undefined, isError: true } as never);
    await render(<PhotoManager userId={USER_ID} />, { wrapper });
    expect(screen.getByText('Couldn’t load')).toBeOnTheScreen();
  });
});
