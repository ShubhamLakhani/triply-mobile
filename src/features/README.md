# Mobile data layer: integration map (Phase 1M)

This is the cross-feature map: how the feature modules fit together, and the Phase 1M exit
status. Each feature's own `README.md` has its details. Database rules are documented in
`supabase/README.md`, and security in `SECURITY.md`. This file lives here rather than in
`docs/`, which holds the founder's source documents.

## Layering

```
screens (app/) ──► feature hooks (hooks/) ──► feature API (api/) ──► getSupabaseClient()
                         │                         │
                   TanStack Query            Zod schemas + typed errors
```

- **Screens never import the Supabase client.** Only `src/services/supabase` and the feature
  `api/` modules call it (audited in 1M-I: no exceptions). Route files under `app/` are thin:
  they export a feature component.
- **One auth subscription.** `AuthProvider` (inside `AppProviders`) owns session state, cache
  reset and analytics identity; `useAuthSession` reads it. `RootNavigator` guards the route
  groups with `Stack.Protected` from `resolveAppArea`.
- **Server state lives only in TanStack Query.** Zustand (`src/stores`) holds transient UI
  state only.
- **Columns are always listed explicitly.** There is no `select('*')` anywhere.

## Feature inventory

| Feature      | API (own data unless noted)                                                                                                            | Writes via                                                    | Query keys                                         | Error type                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| auth         | `getCurrentSession`, `getCurrentUser`, `subscribeToAuthChanges`, `registerAuthCacheReset`                                              | Supabase Auth                                                 | —                                                  | Supabase `AuthError`         |
| profile      | `fetchOwnProfile`, `updateOwnProfile`                                                                                                  | column-granted UPDATE                                         | `profileKeys.own(uid)`                             | `ProfileError`               |
| destinations | `fetchActiveDestinations`, `fetchDestinationBySlug` (catalog)                                                                          | —                                                             | `destinationKeys.list()`, `.detail(slug)` (global) | `DestinationError` (no code) |
| trips        | `fetchOwnTrips`, `fetchOwnTripById`, `createTrip`, `updateTrip`, `cancelTrip`                                                          | column-granted INSERT/UPDATE                                  | `tripKeys.own(uid)` > `.detail(uid, id)`           | `TripError`                  |
| interests    | `fetchActiveInterests` (catalog), `fetchOwnInterests`, `addInterest`, `removeInterest`, `replaceOwnInterests`                          | INSERT/DELETE, RPC `replace_profile_interests`                | `interestKeys.catalog()` (global), `.own(uid)`     | `InterestError`              |
| preferences  | `fetchOwnDiscoveryPreferences`, `updateDiscoveryPreferences`, `fetchOwnGenderPreferences`, `setGenderPreferences`                      | column-granted UPDATE, RPC `set_discovery_gender_preferences` | `preferenceKeys.discovery(uid)`, `.genders(uid)`   | `PreferenceError`            |
| decisions    | `submitDecision`, `fetchOwnDecisions`, `fetchOwnDecisionForUser`                                                                       | RPC `submit_decision`                                         | `decisionKeys.own(uid)`                            | `DecisionError`              |
| matches      | `fetchOwnMatches`, `fetchOwnMatchById`, `unmatch`                                                                                      | RPC `unmatch`                                                 | `matchKeys.own(uid)` > `.detail(uid, id)`          | `MatchError`                 |
| blocks       | `fetchOwnBlocks`, `blockUser`, `unblockUser`                                                                                           | RPCs                                                          | `blockKeys.own(uid)`                               | `BlockError`                 |
| reports      | `reportUser`, `fetchOwnReports`                                                                                                        | RPC `report_user`                                             | `reportKeys.own(uid)`                              | `ReportError`                |
| photos       | `fetchOwnProfilePhotos`, `uploadProfilePhoto`, `deleteProfilePhoto`, `setPrimaryPhoto`, `reorderProfilePhotos`, `createSignedPhotoUrl` | Storage + RPCs                                                | `photoKeys.own(uid)`, `.signedUrl(path)`           | `PhotoError`                 |

- **Validation.** Every write input is a `.strict()` Zod schema. Server-owned fields (ids,
  owner/actor/blocker/reporter, status, position, primary, timestamps, completeness) are
  rejected before any network call. Update schemas are `.partial()` but refuse an empty
  update. Limits mirror the database CHECKs: names, bio, ages 18–99, overlap 1–60 days,
  10 interests, 6 photos, 10 MB, report details 2000 characters.
- **Types.** Rows use the generated `Tables<…>` types, narrowed with `Pick` or composed where
  useful. `DecisionResult` is hand-typed on purpose, because the RPC's generated return type
  says `match_id` is never null, which is wrong.

## Cache rules

- **Keys are user-scoped.** Every user-owned key contains the user id; only the destination
  and interest catalogs are global (they are the same for every user). Detail keys nest under
  their list key, so invalidating the list also refreshes the details.
- **Signed-out is disabled, not silent.** Hooks take `userId: string | null` and are disabled
  while it is `null`. Mutations throw `not_authenticated` without calling the API.
- **Identity changes clear the whole cache** (`registerAuthCacheReset`, registered once in
  `AppProviders`). This happens on `SIGNED_OUT`, and when a session for a different user
  appears without a sign-out. Token refreshes keep the cache. Covered by
  `tests/integration/data-layer.test.tsx`.
- **Retries.** Queries retry up to 2 times only for transient failures (network, HTTP 5xx,
  408/429, Postgres connection/serialization/resource errors). Typed feature errors, RLS
  failures, validation, not-found and PostgREST errors fail at once (fixed in 1M-I).
  Mutations never retry automatically.
- **Freshness.** Catalogs are treated as fresh for 1 hour; user data for 30 seconds, with
  refetch on focus and on reconnect. Signed photo URLs are cached in memory for 45 minutes
  and dropped at 48, against a 60-minute expiry.

## Cross-feature invalidation

| Mutation                         | Refreshes                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| update profile                   | writes the returned row, then refreshes `profileKeys.own`                               |
| create, update or cancel trip    | seeds `tripKeys.detail`, refreshes `tripKeys.own`                                       |
| add, remove or replace interests | `interestKeys.own`                                                                      |
| update preferences / set genders | writes the returned data, then refreshes that key                                       |
| submit decision                  | `decisionKeys.own`, plus `matchKeys.own` when `matched`                                 |
| unmatch                          | writes `matchKeys.detail`, refreshes `matchKeys.own`                                    |
| block                            | `blockKeys.own`, `matchKeys.own` (the server ends the match), `decisionKeys.own`        |
| unblock                          | `blockKeys.own` only (nothing is restored)                                              |
| report                           | `reportKeys.own` only. Reporting never blocks; "Report and block" = report, then block. |
| upload photo                     | `photoKeys.own` (the profile is unaffected: photos don't count toward completeness)     |
| delete photo                     | drops that photo's `photoKeys.signedUrl`, refreshes `photoKeys.own`                     |
| set primary / reorder photos     | writes the server's ordered list to `photoKeys.own`                                     |

Nothing ever writes or invalidates another user's cache.

## Error codes (stable, safe to show)

| Meaning                  | Codes                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Signed out               | `not_authenticated`                                                                                                  |
| Forbidden or unavailable | `not_allowed`, `forbidden` (profile), `unavailable` (blocked or incomplete target), `profile_incomplete` (decisions) |
| Not found                | `not_found`, `user_not_found`                                                                                        |
| Validation               | `invalid_input`, `rejected_by_database` (a CHECK failed)                                                             |
| Conflict                 | `already_selected` (interests), `trip_cancelled`                                                                     |
| Limits                   | `limit_reached` (interests, photos)                                                                                  |
| Catalog item unavailable | `interest_unavailable`, `destination_unavailable`                                                                    |
| Other                    | `upload_failed`, `unexpected_response`, `unknown`                                                                    |

An error's `message` is a fixed, user-safe sentence. The raw database error is kept only as
`cause`, which Sentry receives in scrubbed form.

## Phase 1M integration matrix

| Domain       | DB schema                      | RLS / grants                        | Typed API | Validation | React Query | Tests (DB / Jest) | Remote                | Deferred                                       |
| ------------ | ------------------------------ | ----------------------------------- | --------- | ---------- | ----------- | ----------------- | --------------------- | ---------------------------------------------- |
| auth         | `auth.users` + profile trigger | n/a                                 | ✓         | n/a        | cache reset | ✓ / ✓             | ✓                     | central session provider (UI phase)            |
| profiles     | ✓                              | owner-only, column grants           | ✓         | ✓          | ✓           | ✓ / ✓             | ✓                     | —                                              |
| destinations | ✓                              | read active only                    | ✓         | n/a (read) | ✓ (global)  | ✓ / ✓             | ✓                     | —                                              |
| trips        | ✓                              | owner-only, column grants           | ✓         | ✓          | ✓           | ✓ / ✓             | ✓                     | —                                              |
| interests    | ✓                              | owner-only; max 10                  | ✓         | ✓          | ✓           | ✓ / ✓             | ✓                     | —                                              |
| preferences  | ✓                              | owner-only                          | ✓         | ✓          | ✓           | ✓ / ✓             | ✓                     | —                                              |
| decisions    | ✓                              | RPC-only, outgoing only, 18+ gate   | ✓         | ✓          | ✓           | ✓ / ✓             | ✓                     | likes from before a block survive unblock      |
| matches      | ✓                              | participants only, terminal unmatch | ✓         | ✓          | ✓           | ✓ / ✓             | ✓                     | —                                              |
| blocks       | ✓                              | blocker only                        | ✓         | ✓          | ✓           | ✓ / ✓             | ✓                     | discovery must exclude blocked pairs both ways |
| reports      | ✓                              | reporter content only               | ✓         | ✓          | ✓           | ✓ / ✓             | ✓                     | retention, rate limiting, moderation           |
| photos       | ✓ + private bucket             | owner-only, storage policies        | ✓         | ✓          | ✓           | ✓ / ✓             | ✓ (hosted smoke test) | orphan cleanup, EXIF, moderation               |

"Remote ✓" means the 8 migrations through `20261009122115_security_rls_hardening` are
committed (`c76b7bc`). Confirm with `npx supabase migration list` that the remote has all 8.

## Known deferred work (not blocking Phase 1M)

- **Catalog hooks** (`useDestinations`, `useInterests`) run whenever they are enabled. Screens
  shown while signed out must pass `enabled: false`.
- **Error codes** use a few legacy synonyms (`forbidden` vs `not_allowed`,
  `rejected_by_database` vs `invalid_input`). They are documented above; unify them when the
  UI copy is written.
- **Profile and preference saves** write the server row to the cache and then refetch once
  more, a deliberate belt-and-braces choice (one extra read per save).
- **Not built yet:** discovery, chat, notifications, account deletion, moderation tooling.
  `SECURITY.md` lists the security-related deferred items.
- **Android:** the JavaScript bundle exports cleanly, but verification on a physical device
  is still pending (tracked separately and not marked as done).
