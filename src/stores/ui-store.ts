import { create } from 'zustand';

/**
 * Small, local, transient UI state only (Architecture v2 §7).
 * Never mirror server data here — that belongs to TanStack Query.
 * Create additional small stores per concern instead of growing one global store.
 */
export type SheetId = 'foundation-info';

interface UiState {
  activeSheet: SheetId | null;
  openSheet: (sheet: SheetId) => void;
  closeSheet: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeSheet: null,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
}));
