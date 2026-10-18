import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';

import { MAX_PROFILE_PHOTO_BYTES } from '../types';

import { PhotoError } from './photo-errors';
import { fitWithin, normalizeProfilePhoto, PROFILE_PHOTO_MAX_DIMENSION } from './photo-normalize';
import { pickProfilePhoto } from './photo-picker';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

interface FakeSource {
  width: number;
  height: number;
  /** Size of the JPEG the encoder writes. */
  outputBytes?: number;
  failToDecode?: boolean;
}

/** Fake manipulator that decodes `source`, applies resize and "writes" a JPEG to the cache. */
function fakeManipulator(source: FakeSource) {
  const saveAsync = jest.fn();
  const release = jest.fn();
  let width = source.width;
  let height = source.height;
  interface FakeContext {
    resize: jest.Mock<FakeContext, [{ width?: number; height?: number }]>;
    renderAsync: jest.Mock;
    release: jest.Mock;
  }
  const context: FakeContext = {
    resize: jest.fn((size: { width?: number; height?: number }): FakeContext => {
      const ratio = size.width ? size.width / width : (size.height ?? height) / height;
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      return context;
    }),
    renderAsync: jest.fn(() => {
      if (source.failToDecode) return Promise.reject(new Error('cannot decode'));
      const snapshot = { width, height };
      return Promise.resolve({
        ...snapshot,
        release,
        saveAsync: saveAsync.mockImplementation((options: { format: string }) =>
          Promise.resolve({ uri: `file:///cache/manipulated.${options.format}`, ...snapshot }),
        ),
      });
    }),
    release,
  };
  jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
  jest
    .mocked(File)
    .mockImplementation(() => ({ size: source.outputBytes ?? 1_500_000 }) as unknown as File);
  return { context, saveAsync, release };
}

describe('fitWithin', () => {
  it('keeps images that already fit, and limits the longest side otherwise', () => {
    expect(fitWithin(1200, 1600)).toBeNull();
    expect(fitWithin(2048, 2048)).toBeNull();
    expect(fitWithin(4032, 3024)).toEqual({ width: PROFILE_PHOTO_MAX_DIMENSION });
    expect(fitWithin(3024, 4032)).toEqual({ height: PROFILE_PHOTO_MAX_DIMENSION });
  });
});

describe('normalizeProfilePhoto', () => {
  afterEach(() => jest.clearAllMocks());

  it('accepts an iPhone HEIC photo and returns a resized JPEG from the cache', async () => {
    const fake = fakeManipulator({ width: 3024, height: 4032 });
    const result = await normalizeProfilePhoto('file:///library/IMG_0001.HEIC');
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///library/IMG_0001.HEIC');
    expect(fake.context.resize).toHaveBeenCalledWith({ height: 2048 });
    expect(fake.saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
    expect(result).toEqual({
      localUri: 'file:///cache/manipulated.jpeg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1_500_000,
      width: 1536,
      height: 2048,
    });
    // Native image references are always released.
    expect(fake.release).toHaveBeenCalledTimes(3);
  });

  it.each(['photo.jpg', 'screenshot.png', 'sticker.webp', 'IMG_0002.heif'])(
    'normalizes %s to JPEG the same way',
    async (name) => {
      const fake = fakeManipulator({ width: 1080, height: 1350 });
      const result = await normalizeProfilePhoto(`file:///library/${name}`);
      expect(fake.context.resize).not.toHaveBeenCalled();
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.localUri).toMatch(/\.jpeg$/);
      expect(result).toMatchObject({ width: 1080, height: 1350 });
    },
  );

  it('rejects a normalized result that is still over the 10 MB limit', async () => {
    fakeManipulator({ width: 2000, height: 2000, outputBytes: MAX_PROFILE_PHOTO_BYTES + 1 });
    await expect(normalizeProfilePhoto('file:///library/huge.png')).rejects.toMatchObject({
      code: 'invalid_input',
      message: 'That photo is too large. Try another one.',
    });
  });

  it('turns a decode failure into a user-safe PhotoError', async () => {
    const fake = fakeManipulator({ width: 1, height: 1, failToDecode: true });
    const error: unknown = await normalizeProfilePhoto('file:///library/broken.heic').catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PhotoError);
    expect(error).toMatchObject({ code: 'invalid_input' });
    expect(fake.context.release).toHaveBeenCalled();
  });
});

describe('pickProfilePhoto', () => {
  afterEach(() => jest.clearAllMocks());

  it('asks the picker for no EXIF payload and full quality, then uploads the normalized JPEG', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
    } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///library/IMG_0003.HEIC', mimeType: 'image/heic' }],
    } as never);
    fakeManipulator({ width: 4032, height: 3024 });

    const picked = await pickProfilePhoto();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], exif: false, quality: 1 }),
    );
    expect(picked).toMatchObject({
      localUri: 'file:///cache/manipulated.jpeg',
      mimeType: 'image/jpeg',
      width: 2048,
      height: 1536,
    });
  });

  it("removes the picker's temporary original (with its metadata) after normalizing", async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
    } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/ImagePicker/original.heic' }],
    } as never);
    fakeManipulator({ width: 1200, height: 900 });
    const deleteFile = jest.fn();
    jest.mocked(File).mockImplementation(
      (uri: unknown) =>
        ({
          size: 400_000,
          exists: String(uri).includes('ImagePicker'),
          delete: deleteFile,
        }) as unknown as File,
    );
    await pickProfilePhoto();
    expect(File).toHaveBeenCalledWith('file:///cache/ImagePicker/original.heic');
    expect(deleteFile).toHaveBeenCalledTimes(1);
  });

  it('returns null on cancel and rejects when photo access is denied', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
    } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);
    await expect(pickProfilePhoto()).resolves.toBeNull();

    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: false,
    } as never);
    await expect(pickProfilePhoto()).rejects.toMatchObject({ code: 'not_allowed' });
  });
});
