import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { deleteProfilePhoto, setPrimaryPhoto, uploadProfilePhoto } from '../api/photo-api';
import { photoKeys } from '../api/photo-keys';
import type { ProfilePhoto } from '../types';

import {
  useDeleteProfilePhoto,
  useSetPrimaryPhoto,
  useUploadProfilePhoto,
} from './use-profile-photos';

jest.mock('../api/photo-api', () => ({
  createSignedPhotoUrl: jest.fn(),
  deleteProfilePhoto: jest.fn(),
  fetchOwnProfilePhotos: jest.fn(),
  reorderProfilePhotos: jest.fn(),
  setPrimaryPhoto: jest.fn(),
  uploadProfilePhoto: jest.fn(),
}));

const USER_ID = '1e000000-0000-4000-8000-00000000000a';
const PHOTO_ID = 'ab000000-0000-4000-8000-000000000001';
const PATH = `${USER_ID}/${PHOTO_ID}.jpg`;
const photo: ProfilePhoto = {
  id: PHOTO_ID,
  user_id: USER_ID,
  storage_path: PATH,
  position: 0,
  is_primary: true,
  mime_type: 'image/jpeg',
  file_size_bytes: 3,
  width: null,
  height: null,
  created_at: '2026-10-09T00:00:00Z',
  updated_at: '2026-10-09T00:00:00Z',
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('profile photo hooks', () => {
  afterEach(() => jest.clearAllMocks());

  it('refreshes own photos after an upload (profile caches untouched)', async () => {
    jest.mocked(uploadProfilePhoto).mockResolvedValue(photo);
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useUploadProfilePhoto(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        localUri: 'file:///a.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 3,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(uploadProfilePhoto).toHaveBeenCalledWith(USER_ID, expect.anything());
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: photoKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('drops the deleted photo signed URL and refreshes own photos', async () => {
    jest.mocked(deleteProfilePhoto).mockResolvedValue({ storagePath: PATH, objectRemoved: true });
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(photoKeys.signedUrl(PATH), 'https://example.test/signed');
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useDeleteProfilePhoto(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(PHOTO_ID);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(photoKeys.signedUrl(PATH))).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: photoKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('caches the ordered set returned by set primary', async () => {
    jest.mocked(setPrimaryPhoto).mockResolvedValue([photo]);
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useSetPrimaryPhoto(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(PHOTO_ID);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(photoKeys.own(USER_ID))).toEqual([photo]);
    queryClient.clear();
  });

  it('rejects uploads while signed out', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useUploadProfilePhoto(null), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          localUri: 'file:///a.jpg',
          mimeType: 'image/jpeg',
          fileSizeBytes: 3,
        }),
      ).rejects.toMatchObject({ code: 'not_authenticated' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(uploadProfilePhoto).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
