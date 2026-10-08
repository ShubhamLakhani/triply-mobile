# storage

Device-local persistence primitives.

- `local-storage.ts` — Expo SQLite-backed `localStorage` used for the Supabase auth session.

Rules: no secrets, no server data mirrors (TanStack Query owns server state), no sensitive
profile/chat content. Any future encrypted storage requirement must be justified in a design note first.
