import { newPhotoId } from './photo-file';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));

describe('newPhotoId', () => {
  const g = globalThis as unknown as { expo?: { uuidv4?: () => string } };
  const original = g.expo;
  afterEach(() => {
    g.expo = original;
  });

  it('returns a v4 UUID from crypto.randomUUID (method call keeps `this`)', () => {
    expect(newPhotoId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('falls back to the native Expo generator', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      g.expo = { uuidv4: () => 'ab000000-0000-4000-8000-000000000001' };
      expect(newPhotoId()).toBe('ab000000-0000-4000-8000-000000000001');
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });
});
