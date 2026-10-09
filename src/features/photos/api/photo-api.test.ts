import { getSupabaseClient } from '@/services/supabase';

import {
  createFakeSupabase,
  type FakeResult,
  type FakeStorageResults,
} from '../../../../tests/utils/fake-supabase';

import {
  createSignedPhotoUrl,
  deleteProfilePhoto,
  fetchOwnProfilePhotos,
  reorderProfilePhotos,
  setPrimaryPhoto,
  uploadProfilePhoto,
} from './photo-api';
import { newPhotoId, readLocalPhoto } from './photo-file';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('./photo-file', () => ({ newPhotoId: jest.fn(), readLocalPhoto: jest.fn() }));

const USER_ID = '1e000000-0000-4000-8000-00000000000a';
const PHOTO_ID = 'ab000000-0000-4000-8000-000000000001';
const PATH = `${USER_ID}/${PHOTO_ID}.jpg`;
const input = { localUri: 'file:///tmp/a.jpg', mimeType: 'image/jpeg', fileSizeBytes: 3 } as const;

function useFake(result: FakeResult, storage: FakeStorageResults = {}) {
  const { client, calls } = createFakeSupabase(result, storage);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

beforeEach(() => {
  jest.mocked(newPhotoId).mockReturnValue(PHOTO_ID);
  jest.mocked(readLocalPhoto).mockResolvedValue(new ArrayBuffer(3));
});
afterEach(() => jest.clearAllMocks());

describe('uploadProfilePhoto', () => {
  it('uploads to the canonical own-folder path, then registers metadata', async () => {
    const calls = useFake({ data: { id: PHOTO_ID, storage_path: PATH }, error: null });
    await uploadProfilePhoto(USER_ID, { ...input, width: 10, height: 20 });
    expect(calls[0]).toEqual({
      method: 'storage.upload',
      args: ['profile-photos', PATH, 'ArrayBuffer', { contentType: 'image/jpeg', upsert: false }],
    });
    expect(calls[1]).toEqual({
      method: 'rpc',
      args: [
        'register_profile_photo',
        {
          p_photo_id: PHOTO_ID,
          p_storage_path: PATH,
          p_mime_type: 'image/jpeg',
          p_file_size_bytes: 3,
          p_width: 10,
          p_height: 20,
        },
      ],
    });
  });

  it('uses the real byte length, not the declared size', async () => {
    jest.mocked(readLocalPhoto).mockResolvedValue(new ArrayBuffer(7));
    const calls = useFake({ data: { id: PHOTO_ID }, error: null });
    await uploadProfilePhoto(USER_ID, input);
    expect((calls[1]?.args[1] as { p_file_size_bytes: number }).p_file_size_bytes).toBe(7);
  });

  it('removes the uploaded object when registration fails', async () => {
    const calls = useFake({ data: null, error: { code: '54000', message: 'limit' } });
    await expect(uploadProfilePhoto(USER_ID, input)).rejects.toMatchObject({
      code: 'limit_reached',
    });
    expect(calls).toContainEqual({ method: 'storage.remove', args: ['profile-photos', [PATH]] });
  });

  it('does not register when the upload fails', async () => {
    const calls = useFake(
      { data: null, error: null },
      { upload: { data: null, error: { message: 'denied' } } },
    );
    await expect(uploadProfilePhoto(USER_ID, input)).rejects.toMatchObject({
      code: 'upload_failed',
    });
    expect(calls.some((call) => call.method === 'rpc')).toBe(false);
  });

  it('rejects unsupported or oversized files before any network call', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(
      uploadProfilePhoto(USER_ID, { ...input, mimeType: 'image/gif' as 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    jest.mocked(readLocalPhoto).mockResolvedValue(new ArrayBuffer(10 * 1024 * 1024 + 1));
    await expect(uploadProfilePhoto(USER_ID, input)).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('other photo operations', () => {
  it('reads own metadata ordered by position', async () => {
    const calls = useFake({ data: [], error: null });
    await fetchOwnProfilePhotos(USER_ID);
    expect(calls).toContainEqual({ method: 'from', args: ['profile_photos'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['user_id', USER_ID] });
    expect(calls).toContainEqual({ method: 'order', args: ['position', { ascending: true }] });
  });

  it('deletes metadata via RPC, then removes the returned object', async () => {
    const calls = useFake({ data: PATH, error: null });
    await expect(deleteProfilePhoto(PHOTO_ID)).resolves.toEqual({
      storagePath: PATH,
      objectRemoved: true,
    });
    expect(calls[0]).toEqual({
      method: 'rpc',
      args: ['delete_profile_photo', { p_photo_id: PHOTO_ID }],
    });
    expect(calls[1]).toEqual({ method: 'storage.remove', args: ['profile-photos', [PATH]] });
  });

  it('reports an orphan when the object removal fails', async () => {
    useFake({ data: PATH, error: null }, { remove: { data: null, error: { message: 'x' } } });
    await expect(deleteProfilePhoto(PHOTO_ID)).resolves.toEqual({
      storagePath: PATH,
      objectRemoved: false,
    });
  });

  it('maps not-found deletes and skips storage', async () => {
    const calls = useFake({ data: null, error: { code: 'P0002', message: 'photo not found' } });
    await expect(deleteProfilePhoto(PHOTO_ID)).rejects.toMatchObject({ code: 'not_found' });
    expect(calls.some((call) => call.method === 'storage.remove')).toBe(false);
  });

  it('sets primary and reorders through RPCs only', async () => {
    const calls = useFake({ data: [], error: null });
    await setPrimaryPhoto(PHOTO_ID);
    await reorderProfilePhotos([PHOTO_ID]);
    expect(calls).toEqual([
      { method: 'rpc', args: ['set_primary_profile_photo', { p_photo_id: PHOTO_ID }] },
      { method: 'rpc', args: ['reorder_profile_photos', { p_photo_ids: [PHOTO_ID] }] },
    ]);
  });

  it('rejects duplicate reorder ids locally', async () => {
    const calls = useFake({ data: [], error: null });
    await expect(reorderProfilePhotos([PHOTO_ID, PHOTO_ID])).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(calls).toHaveLength(0);
  });

  it('creates 1-hour signed URLs for canonical paths only', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(createSignedPhotoUrl(PATH)).resolves.toBe('https://example.test/signed');
    expect(calls[0]).toEqual({
      method: 'storage.createSignedUrl',
      args: ['profile-photos', PATH, 3600],
    });
    await expect(createSignedPhotoUrl('../other-bucket/x.jpg')).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });
});
