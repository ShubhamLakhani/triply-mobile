import { reorderPhotoIdsSchema, uploadProfilePhotoSchema } from './photo.schema';

const ID = (n: number) => `ab000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = {
  localUri: 'file:///tmp/a.jpg',
  mimeType: 'image/jpeg',
  fileSizeBytes: 1024,
} as const;

describe('uploadProfilePhotoSchema', () => {
  it('accepts jpeg, png and webp with optional dimensions', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp'] as const) {
      expect(uploadProfilePhotoSchema.safeParse({ ...base, mimeType }).success).toBe(true);
    }
    expect(uploadProfilePhotoSchema.safeParse({ ...base, width: 1080, height: 1350 }).success).toBe(
      true,
    );
  });

  it('rejects gif, svg, heic and video', () => {
    for (const mimeType of ['image/gif', 'image/svg+xml', 'image/heic', 'video/mp4']) {
      expect(uploadProfilePhotoSchema.safeParse({ ...base, mimeType }).success).toBe(false);
    }
  });

  it('enforces size, dimensions and a non-empty uri', () => {
    expect(
      uploadProfilePhotoSchema.safeParse({ ...base, fileSizeBytes: 10 * 1024 * 1024 }).success,
    ).toBe(true);
    expect(
      uploadProfilePhotoSchema.safeParse({ ...base, fileSizeBytes: 10 * 1024 * 1024 + 1 }).success,
    ).toBe(false);
    expect(uploadProfilePhotoSchema.safeParse({ ...base, fileSizeBytes: 0 }).success).toBe(false);
    expect(uploadProfilePhotoSchema.safeParse({ ...base, width: 0 }).success).toBe(false);
    expect(uploadProfilePhotoSchema.safeParse({ ...base, localUri: '  ' }).success).toBe(false);
  });

  it('never accepts user id, path, position or primary from the client', () => {
    for (const extra of [
      { userId: ID(1) },
      { storagePath: 'x/y.jpg' },
      { position: 0 },
      { isPrimary: true },
    ]) {
      expect(uploadProfilePhotoSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    }
  });
});

describe('reorderPhotoIdsSchema', () => {
  it('accepts up to 6 unique ids', () => {
    expect(reorderPhotoIdsSchema.safeParse([1, 2, 3, 4, 5, 6].map(ID)).success).toBe(true);
  });

  it('rejects duplicates, empty lists, more than 6 and non-uuids', () => {
    expect(reorderPhotoIdsSchema.safeParse([ID(1), ID(1)]).success).toBe(false);
    expect(reorderPhotoIdsSchema.safeParse([]).success).toBe(false);
    expect(reorderPhotoIdsSchema.safeParse([1, 2, 3, 4, 5, 6, 7].map(ID)).success).toBe(false);
    expect(reorderPhotoIdsSchema.safeParse(['nope']).success).toBe(false);
  });
});
