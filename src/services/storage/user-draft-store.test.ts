import { act, renderHook } from '@testing-library/react-native';
import { z } from 'zod';

import { getDeviceLocalStorage } from './local-storage';
import { createUserDraftStore, useUserDraft } from './user-draft-store';

jest.mock('./local-storage', () => ({ getDeviceLocalStorage: jest.fn() }));

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

/** A Map-backed Storage whose writes can be made to fail. */
function fakeStorage(options: { failWrites?: boolean } = {}) {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (options.failWrites) throw new Error('disk full');
      map.set(k, v);
    },
    removeItem: (k: string) => map.delete(k),
  } as unknown as Storage;
  jest.mocked(getDeviceLocalStorage).mockReturnValue(storage);
  return map;
}

const picks = createUserDraftStore(`test.picks.${Math.random()}`, z.array(z.uuid()).max(3));

describe('user draft store', () => {
  afterEach(() => {
    picks.clear(A);
    picks.clear(B);
    jest.clearAllMocks();
  });

  it('writes to the device under a per-user key and reads it back after a "cold start"', () => {
    const map = fakeStorage();
    expect(picks.write(A, [A])).toBe(true);
    const [key] = [...map.keys()];
    expect(key).toContain(A);
    expect(key).toMatch(/^triply\.draft\.v1\./);
    // A fresh read (nothing in component state) sees the device copy.
    expect(picks.read(A)).toEqual([A]);
  });

  it('keeps one user’s draft invisible to another account', () => {
    fakeStorage();
    picks.write(A, [A]);
    expect(picks.read(B)).toBeNull();
    picks.write(B, [B]);
    expect(picks.read(A)).toEqual([A]);
    expect(picks.read(B)).toEqual([B]);
    picks.clear(A);
    expect(picks.read(A)).toBeNull();
    expect(picks.read(B)).toEqual([B]);
  });

  it('ignores corrupt or outdated device values instead of restoring garbage', () => {
    const map = fakeStorage();
    map.set(picks.key(A), 'not json');
    expect(picks.read(A)).toBeNull();
    map.set(picks.key(A), JSON.stringify(['not-a-uuid']));
    expect(picks.read(A)).toBeNull();
    map.set(picks.key(A), JSON.stringify([A, A, A, A]));
    expect(picks.read(A)).toBeNull();
  });

  it('reports a failed device write but keeps the value for this session', () => {
    fakeStorage({ failWrites: true });
    expect(picks.write(A, [A])).toBe(false);
    expect(picks.read(A)).toEqual([A]);
  });

  it('works without any device storage (memory only) and reports it', () => {
    jest.mocked(getDeviceLocalStorage).mockImplementation(() => {
      throw new Error('no sqlite');
    });
    expect(picks.write(A, [A])).toBe(false);
    expect(picks.read(A)).toEqual([A]);
    picks.clear(A);
    expect(picks.read(A)).toBeNull();
  });

  it('useUserDraft follows writes, clears and the signed-in user', async () => {
    fakeStorage();
    const { result, rerender } = await renderHook(
      ({ userId }: { userId: string | null }) => useUserDraft(picks, userId),
      { initialProps: { userId: A } },
    );
    expect(result.current).toBeNull();
    await act(async () => {
      picks.write(A, [A]);
    });
    expect(result.current).toEqual([A]);
    const first = result.current;
    await rerender({ userId: A });
    expect(result.current).toBe(first); // stable reference while unchanged

    await rerender({ userId: B });
    expect(result.current).toBeNull(); // never another user's draft
    await rerender({ userId: null });
    expect(result.current).toBeNull();

    await rerender({ userId: A });
    await act(async () => {
      picks.clear(A);
    });
    expect(result.current).toBeNull();
  });
});
