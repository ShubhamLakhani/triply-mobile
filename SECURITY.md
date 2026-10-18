# Triply mobile: security architecture

This file is the security architecture and audit record. It was introduced by the Phase 1M-H
audit and is the place to update when security boundaries change. Domain details stay in
`supabase/README.md` and the feature READMEs. This file sits at the repository root because
`docs/` holds the founder's source documents and is not edited by implementation phases.

## 1. Trust boundaries

| Zone                                            | Trusted with                                                                         | Never trusted with                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Mobile app (public binary)                      | public Supabase URL, publishable key, Sentry DSN, PostHog key (all public by design) | service-role/secret keys, DB password, Supabase access token, SENTRY_AUTH_TOKEN, Resend/moderation secrets |
| PostgREST / Storage API (anon, authenticated)   | only what grants + RLS allow                                                         | caller-supplied identity: owner, actor, blocker, reporter and storage folder always come from `auth.uid()` |
| Database (postgres-owned SECURITY DEFINER RPCs) | hidden social-graph reads (reverse likes, blocks), cross-table invariants            | anything not derived from `auth.uid()`                                                                     |
| `service_role`                                  | future server/admin tooling only (report status, cleanup jobs)                       | must never reach the app                                                                                   |

Every `EXPO_PUBLIC_*` variable is embedded in the binary. `scripts/check-security.mjs` keeps an
allowlist of public variables and scans for secret patterns. `.env.local` is gitignored; it
was checked and holds only the public URL and publishable key.

## 2. Database strategy

- **RLS everywhere.** Every `public` table has RLS enabled, and every policy is scoped
  `to authenticated`. `anon` has no table, column or function privileges in `public`
  (enforced by `security_audit.test.sql`).
- **Grants are explicit and fail closed.** Supabase grants new objects to the API roles by
  default, so every migration revokes those grants and then grants the minimum back. Since
  1M-H, `scripts/check-migrations.mjs` fails any migration where:
  - a public table has no revoke;
  - a public or private function has no `revoke ... from public`;
  - a SECURITY DEFINER function does not set `search_path = ''`.
- **Column-level writes protect server-owned columns** (`is_profile_complete`, trip `status`
  on insert, ids, timestamps). Triggers re-check the same rules even for privileged writes.
  The exact write-grant inventory is pinned by a test.
- **RPC-only writes** for social-graph and integrity-sensitive tables: decisions, matches,
  blocks, reports and photos.
- **Functions.** All 27 functions in `public`/`private` set `search_path = ''`, use fully
  qualified names, contain no dynamic SQL and are not executable by `anon` or `PUBLIC`.
  - SECURITY DEFINER is used only where an RPC must read data hidden from the caller (reverse
    likes, blocks) or write tables with no client grants.
  - Each such function derives identity from `auth.uid()`.
  - Private trigger functions are DEFINER only when they must call private helpers or write
    another table (`profiles_before_write`, `handle_new_user`, `handle_new_profile`).
- **`private` schema.** `anon` and `authenticated` have no usage on it.

## 3. Hidden social graph

| Data           | Who can read it                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions      | the actor only. Incoming likes are never readable; `submit_decision` reveals a like only by creating a match.                                                     |
| Matches        | the two participants (history stays visible after unmatch).                                                                                                       |
| Blocks         | the blocker only. A blocked pair, or an incomplete target, gets the same `interaction unavailable` error, and a block-ended match looks like an ordinary unmatch. |
| Reports        | the reporter, content columns only. `status` is neither readable nor writable by the app; the reported user and third parties see nothing.                        |
| Report context | a related match or trip must belong to the reporter's own pair; anything else gets the same generic `invalid report context`.                                     |
| Photos         | the owner only, both metadata and objects.                                                                                                                        |

**Age gate (1M-H).** `is_profile_complete` (first name, 18+ date of birth, gender) is
maintained by the database. Since 1M-H it is also required to like or be liked:
`submit_decision` rejects an incomplete caller with `complete your profile first` and an
incomplete target with the generic `interaction unavailable`. Blocking and reporting stay
open to every signed-in user.

## 4. Storage

- **Bucket.** `profile-photos` is private, with a 10 MiB limit and `image/jpeg`, `image/png`,
  `image/webp` only.
- **Path.** `{auth.uid()}/{uuid}.{jpg|png|webp}`; both the policy and the register RPC enforce
  it.
- **Policies** (bucket-scoped, authenticated only):
  - SELECT own folder;
  - INSERT own folder with the canonical name;
  - DELETE own folder, and only objects that are no longer registered;
  - no UPDATE, so no overwrite or move.
- **Display.** 1-hour signed URLs, kept in the in-memory query cache only (garbage-collected
  at 48 minutes). The scrubber removes `token=` from anything sent to Sentry.
- **Hosted smoke test (founder, 1M-G).** Passed: own JPEG upload, signed URL, foreign-folder
  denial, GIF denial, >10 MB denial, and deleting an own unregistered object.

## 5. Client, session and cache

- **Session.** Supabase JS with `expo-sqlite` `localStorage` persistence, as Supabase
  recommends for Expo. It is not hardware-encrypted, so it relies on device encryption.
  Auto-refresh runs only while the app is in the foreground. The app never logs tokens.
- **Email codes (Pre-3M).** Sign-up confirmation and password reset use 6-digit codes typed in
  the app (`verifyOtp` types `email` / `recovery`); emails contain no link. Codes expire after
  1 hour, only the newest works, resend is limited to once per 60 s, and verification is rate
  limited by Supabase Auth. The reset request never reveals whether an email has an account. A
  verified recovery code signs the user in; the router keeps them on the new-password screen
  until the password is saved or they sign out. Password minimum is 8 (app, local config and
  hosted settings).
- **Auth links (Phase 2M hardening; DEPRECATED, kept one release for old emails).** The client
  uses the PKCE flow. Only
  `<this install's scheme>://auth/callback?code=…` is acted on; the code is exchanged with the
  verifier stored on the device, so a link crafted or intercepted elsewhere cannot sign anyone
  in. Raw `access_token` / `refresh_token` links are rejected (never passed to `setSession`),
  links are ignored while a session exists (no silent account switch), codes are exchanged at
  most once, and failures show fixed copy (`link_expired` / `link_invalid`), never provider
  text.
  - Hermes has no WebCrypto, so auth-js runs PKCE in `plain` mode (verified on the iOS
    simulator: "WebCrypto API is not supported"). The verifier is generated on the device and
    only ever sent over TLS to Supabase; a link alone still cannot be exchanged elsewhere.
    Moving to `S256` needs a `crypto.subtle.digest` polyfill (e.g. `expo-crypto`); deferred.
  - auth-js discards the verifier on any failed exchange, so a link is single-shot. Supabase
    has already confirmed the email by then; the copy tells the user to sign in.
- **Timeouts.** Every Supabase HTTP request has a time budget enforced by an aborting fetch
  wrapper (30 s; storage 180 s; logout 10 s), because React Native's Android HTTP client has no
  default timeouts. Auth calls also settle after 20 s with a stable `timeout` error. Sign-out
  clears the device even when the revoke request fails (the refresh token then expires
  server-side).
- **Stale connections (found in simulator E2E).** An idle HTTP/3 connection to Supabase died
  silently after ~90–100 s (NAT/UDP timeout) and iOS reused it: POSTs failed with
  NSURLErrorNetworkConnectionLost (-1005) and are not retried by iOS (sign-in, the PKCE code
  exchange and a profile save all failed this way). Writes after 25 s of quiet now send one
  idempotent `GET /auth/v1/health` first (8 s budget, one retry), which makes iOS replace the
  dead connection; writes are never retried blindly (photo registration is not idempotent).
- **Password fields.** iOS "Automatic Strong Password" silently filled the sign-up field and the
  user could not sign in (no Associated Domains, so the generated password is not offered back).
  Sign-up uses `textContentType="password"` until Associated Domains (`webcredentials:`) exist.
- **Cache.** Server state lives only in TanStack Query, and every user-owned query key
  includes the user id.
  - The whole cache is cleared on `SIGNED_OUT`.
  - Since 1M-H it is also cleared when a session for a different user appears without a
    sign-out (account switch).
- **Observability.** Sentry runs with `sendDefaultPii: false`, no screenshots and no view
  hierarchy.
  - `beforeSend` and `beforeBreadcrumb` scrub emails, JWTs, bearer tokens, Supabase keys and
    token query parameters.
  - `captureError` sends errors only, never mutation variables, so report details and photo
    paths are not sent.
  - `console.error` is used only in `__DEV__` builds.
- **Analytics.** Phase 2M events (sign-in/up method, onboarding step names, counts) carry no
  content or PII; identity is the opaque user UUID. The catalogue (`events.ts`) forbids content.
- **Data access.** Screens never import the Supabase client; all access goes through feature
  `api/` modules.
- **Account status (Pre-3M).** `public.account_states` has no client privileges; the app reads
  its own effective status through `get_my_account_state()` (never the internal safety hold).
  Every profile, preference, interest, photo and onboarding write calls
  `private.assert_active_actor()` (SQLSTATE `TR001`), so a suspended or banned user cannot act by
  calling RPCs directly. The restricted-account screen is UX only.
- **Server-owned onboarding state (Pre-3M).** `onboarding_completed_at` is set only by
  `complete_onboarding()` after server-side validation and can never change or clear;
  `discovery_paused_at` only through `set_discovery_paused`. Direct client writes to interest and
  gender-preference rows are revoked (RPC-only), so post-onboarding minimums cannot be bypassed.
  Under-18 dates of birth are rejected at write; the date of birth is locked after onboarding.

## 6. Adversarial test matrix (pgTAP, `npm run test:db`)

Roles: anon, A (attacker), B (victim), C (nonparticipant / blocked third party), an under-18 or
incomplete account, and the owner role (as a stand-in for privileged access).

| Domain                  | anon | A on own rows                                     | A on B's rows                                | C / third party                  | Covered in                                             |
| ----------------------- | ---- | ------------------------------------------------- | -------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| profiles                | deny | read; update allowed columns; completeness forced | invisible; update matches 0 rows             | —                                | profiles, security_audit                               |
| trips                   | deny | insert (planned only), update, cancel             | invisible; cannot insert for B               | —                                | destinations_trips, security_audit                     |
| preferences / interests | deny | update, RPC replace (max 10, serialised)          | invisible; cannot write for B                | —                                | preferences_interests, security_audit                  |
| decisions               | deny | own outgoing only; RPC only                       | incoming invisible                           | blocked/incomplete: generic deny | decisions_matching, blocking_reporting, security_audit |
| matches                 | deny | participants read; RPC unmatch                    | —                                            | cannot see, unmatch or cite      | decisions_matching, security_audit                     |
| blocks                  | deny | own outgoing only; RPC only                       | reverse lookup impossible                    | cannot see                       | blocking_reporting, security_audit                     |
| reports                 | deny | content of own submissions only; no status        | the reported user sees nothing               | sees nothing                     | blocking_reporting, security_audit                     |
| photos and storage      | deny | own folder and metadata; RPC writes               | foreign folder read, write and delete denied | —                                | profile_photos                                         |

**Mutation testing (1M-H).** Each of these 14 weakenings made the suite fail:

1. a broad profile SELECT policy
2. a direct UPDATE grant on `matches`
3. a DEFINER RPC that trusts a caller-supplied id
4. an exposed report `status`
5. reverse-block SELECT
6. direct INSERT into `matches`
7. a loosened storage folder policy
8. a function without `search_path`
9. a table without RLS
10. a grant to `anon`
11. removing the 1M-H age gate
12. incoming likes made visible
13. `private` schema usage granted
14. `is_profile_complete` made writable

## 7. Known accepted risks and deferred items

| Item                                      | Status / decision                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report retention on account deletion      | Reports cascade with the profile, so evidence is lost if the reported user deletes their account. Decide on retention (soft delete or anonymised report rows) in the account-deletion phase.                                                                                                                               |
| Orphan storage objects                    | Possible after a failed object delete or an account deletion. Owner-only and private. Needs a service-role cleanup job, and possibly an upload quota (the policy cannot count objects).                                                                                                                                    |
| Likes from before a block survive unblock | For a pair that never matched, a pre-block like can still match after unblock if the other side likes again. Product decision pending.                                                                                                                                                                                     |
| Report rate limiting                      | None yet. Add server-side throttling with moderation tooling.                                                                                                                                                                                                                                                              |
| Blocked-pair exclusion in discovery       | Required. The future discovery or profile-detail RPC must exclude blocks in both directions and non-discoverable or incomplete profiles, check trip eligibility, and sign photo URLs server-side. Photo policies stay owner-only until then.                                                                               |
| Block inference                           | Someone who did not block a person can still infer from the generic error that they were blocked. Mitigated once discovery hides blocked pairs.                                                                                                                                                                            |
| Existence probes                          | RPCs return `user not found` for unknown ids and validate trip ids passed as context. Exploiting this needs UUIDs that cannot be guessed. Accepted.                                                                                                                                                                        |
| Admin / moderation path                   | `service_role` only. There is no admin role or UI yet.                                                                                                                                                                                                                                                                     |
| Account deletion flow                     | Not built.                                                                                                                                                                                                                                                                                                                 |
| Audit / event logging                     | None yet. Add security-event logging with the moderation tooling.                                                                                                                                                                                                                                                          |
| Photo moderation and EXIF                 | Moderation not built. Since Phase 2M hardening every photo is decoded and re-encoded on the device to a ≤2048 px JPEG (expo-image-manipulator) and only that file is uploaded; the encoders do not copy source EXIF/GPS. Not enforced server-side, and file content is not sniffed (the declared content type is trusted). |
| Production separation                     | development and preview builds use the dev project. Production needs its own Supabase project, its own keys, and `TRIPLY_PRODUCTION_SUPABASE_REF` set (an `app.config.ts` guard).                                                                                                                                          |
| Session storage                           | expo-sqlite storage, not the Keychain. Accepted per the Supabase/Expo recommendation.                                                                                                                                                                                                                                      |

## 8. Production-readiness checklist

- [ ] Separate production Supabase project and keys; `TRIPLY_PRODUCTION_SUPABASE_REF` set; RLS
      tests run against it.
- [ ] Before the first production users, confirm no matches or decisions involve incomplete
      profiles (query in `20261009122115_security_rls_hardening.sql`).
- [ ] Discovery RPC enforces blocks, the age gate and discoverability, with server-side signed
      URLs.
- [ ] Account deletion with a report-retention decision and storage cleanup.
- [ ] Moderation tooling (service role) for report status, rate limits and audit logs.
- [ ] Photo moderation (client-side EXIF stripping by re-encode is done; no server-side check).
- [ ] Sentry DSN and source maps configured; `SENTRY_AUTH_TOKEN` kept only as an EAS secret.
- [ ] Supabase Auth settings reviewed (email confirmation, password policy, rate limits, leaked
      password protection).
