import { useMemo, useSyncExternalStore } from 'react';
import type { z } from 'zod';

import { getDeviceLocalStorage } from './local-storage';

/**
 * Per-user drafts that survive a cold restart (an onboarding step edited but not yet saved).
 *
 * - Keyed by user id: one user's draft is never visible to another account on the device.
 * - Validated with a Zod schema on read, so a corrupt or outdated value is ignored (null).
 * - The latest value written this session is kept in memory as well, so the UI keeps working
 *   when the device copy cannot be written; `write` reports that so the screen can warn.
 * - Never holds secrets: only in-progress choices (ids, preference values).
 */
const KEY_PREFIX = 'triply.draft.v1.';
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

function storage(): Storage | null {
  try {
    return getDeviceLocalStorage();
  } catch {
    return null;
  }
}

function readRaw(key: string): string | null {
  const inMemory = memory.get(key);
  if (inMemory !== undefined) return inMemory;
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export interface UserDraftStore<T> {
  readonly name: string;
  key(userId: string): string;
  /** Parses a stored value; null when there is none or it fails validation. */
  parse(raw: string | null): T | null;
  read(userId: string): T | null;
  /**
   * Stores the draft. Returns false when the device copy could not be written (the draft then
   * lives in memory only and is lost on a cold restart; the caller should say so).
   */
  write(userId: string, value: T): boolean;
  clear(userId: string): void;
}

export function createUserDraftStore<T>(name: string, schema: z.ZodType<T>): UserDraftStore<T> {
  const key = (userId: string) => `${KEY_PREFIX}${name}.${userId}`;
  const parse = (raw: string | null): T | null => {
    if (raw === null) return null;
    try {
      const result = schema.safeParse(JSON.parse(raw));
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  };
  return {
    name,
    key,
    parse,
    read: (userId) => parse(readRaw(key(userId))),
    write: (userId, value) => {
      const storageKey = key(userId);
      const raw = JSON.stringify(value);
      memory.set(storageKey, raw);
      let persisted = false;
      try {
        const device = storage();
        if (device) {
          device.setItem(storageKey, raw);
          persisted = true;
        }
      } catch {
        persisted = false;
      }
      emit();
      return persisted;
    },
    clear: (userId) => {
      const storageKey = key(userId);
      memory.delete(storageKey);
      try {
        storage()?.removeItem(storageKey);
      } catch {
        // Best effort: a stale draft is validated on read and cleared on the next save.
      }
      emit();
    },
  };
}

/**
 * Reactive view of one user's draft. `null` while signed out, without a store, or when there
 * is no (valid) draft. The parsed value is stable until the stored text changes.
 */
export function useUserDraft<T>(store: UserDraftStore<T> | null, userId: string | null): T | null {
  const read = () => (store && userId ? readRaw(store.key(userId)) : null);
  const raw = useSyncExternalStore(subscribe, read, read);
  return useMemo(() => (store ? store.parse(raw) : null), [store, raw]);
}
