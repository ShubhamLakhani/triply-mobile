import { create } from 'zustand';

/**
 * The email waiting for its sign-up code. Memory only (never persisted, never a route param, so
 * the address does not end up in navigation state or breadcrumbs). After an app restart the
 * user signs in and is sent back to the code screen from there.
 */
interface PendingVerificationState {
  email: string | null;
  /** When the newest code was requested on this device; null when unknown. */
  sentAt: number | null;
  start: (email: string, sentAt: number | null) => void;
  markSent: (sentAt: number) => void;
  clear: () => void;
}

export const usePendingVerification = create<PendingVerificationState>()((set) => ({
  email: null,
  sentAt: null,
  start: (email, sentAt) => set({ email, sentAt }),
  markSent: (sentAt) => set({ sentAt }),
  clear: () => set({ email: null, sentAt: null }),
}));
