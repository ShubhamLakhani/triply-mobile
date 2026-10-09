# supabase

This folder holds Triply's database migrations, local Supabase config, and seed data. It's managed
with the Supabase CLI, which is pinned as a dev dependency, so always run it with `npx supabase …`
or the npm scripts below.

```
supabase/
  config.toml      Local stack config (ports, auth, storage). Committed.
  migrations/      Timestamped SQL migrations. The only way schema changes happen. Committed.
  seed.sql         Local-only development seed. Committed. Never reaches remote projects.
  .temp/           CLI state (linked project ref, cache). Gitignored.
src/services/supabase/database.types.ts   CLI-generated TypeScript types. Committed. Never hand-edited.
```

## Environments

| App variant | Supabase project                                 | How the app gets it                  |
| ----------- | ------------------------------------------------ | ------------------------------------ |
| development | **development/staging** project (or local stack) | `.env.local` / EAS `development` env |
| preview     | **development/staging** project                  | EAS `preview` env                    |
| production  | **production** project                           | EAS `production` env                 |

- The app only receives `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- The service-role / secret key, the DB password, and your `SUPABASE_ACCESS_TOKEN` must never go
  into the app, `.env.local`, `EXPO_PUBLIC_*`, or git.
- `app.config.ts` guards both directions once `TRIPLY_PRODUCTION_SUPABASE_REF` is set in your
  environment (and in each EAS environment):
  - development/preview builds refuse the production project
  - production builds refuse any other project
- The CLI is linked to the **development project only**. Production schema changes go through a
  separate, explicit release step (defined before launch). Never by linking production on a laptop.

## Prerequisites

- `npm ci` installs the CLI for your platform.
- Docker Desktop (or OrbStack) is only needed for the local stack (`supabase:start`, `supabase:reset`,
  `supabase:types:local`). Linking, pushing to the dev project and remote type generation don't
  need Docker.

## Common tasks

### Start or stop the local stack (Docker)

```bash
npm run supabase:start     # applies all migrations + seed.sql; prints local URL and keys
npm run supabase:status
npm run supabase:stop
```

To point the app at the local stack, temporarily set `EXPO_PUBLIC_SUPABASE_URL` to the API URL
printed by `supabase:start` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to its publishable key in
`.env.local`. Note that a simulator or device can't reach `127.0.0.1` on your Mac the same way;
use your LAN IP for physical devices.

### Link the development project (one time per machine)

```bash
npx supabase login                                   # opens the browser; stores your token locally
npx supabase link --project-ref <DEV_PROJECT_REF>    # prompts for the dev DB password
```

`<DEV_PROJECT_REF>` is the subdomain of the dev project's URL (`https://<ref>.supabase.co`). The
link is saved in `supabase/.temp/` (gitignored).

### Create a migration

```bash
npm run supabase:migration:new -- add_profiles   # → supabase/migrations/<timestamp>_add_profiles.sql
```

Write SQL in the new file and follow the conventions below. Never edit a migration after it has been
applied to the shared dev project; add a new one instead.

### Apply migrations

```bash
npm run supabase:reset            # LOCAL: rebuild local DB from migrations + seed (destructive, local only)
npx supabase db push --dry-run    # DEV: preview what would be applied to the linked dev project
npx supabase db push              # DEV: apply pending migrations to the linked dev project
npx supabase migration list       # compare local vs remote migration history
```

### Regenerate TypeScript types (after every schema change)

```bash
npm run supabase:types         # from the linked dev project (no Docker)
npm run supabase:types:local   # from the local stack
```

The script only overwrites `database.types.ts` when generation succeeds. Commit the regenerated
file in the same commit as the migration.

## Migration conventions

- **Files:** `<YYYYMMDDHHMMSS>_<snake_case>.sql`, always created with `supabase migration new`.
- **Naming:** `snake_case` identifiers; plural table names (`public.trips`).
- **Keys:** app-domain tables use `id uuid primary key default gen_random_uuid()`.
- **Time:**
  - `timestamptz` for timestamps: `created_at` / `updated_at not null default now()`.
  - `updated_at` is maintained by the trigger:
    `create trigger set_updated_at before update on public.<table> for each row execute function private.set_updated_at();`
- **Travel dates:** `date`, never `timestamptz`, with explicit checks (e.g. `check (end_date >= start_date)`).
- **Constraints:** explicit `not null`, `check`, `unique`, and foreign keys with a deliberate `on delete`.
- **RLS:** any table in an exposed schema (`public`) enables RLS **in the same migration** that
  creates it, together with its policies. RLS is never disabled.
- **Sensitive operations:** discovery, like/match, block, report, account deletion, moderation and
  push fan-out go through RPC / Edge Functions, not direct table writes from the app.
- **Functions:** `set search_path = ''` and fully-qualified object names. Internal helpers live in
  the `private` schema, which is not exposed via the Data API.
- **Extensions:** only add one in the migration that needs it, `with schema extensions`.
- **No manual changes:** never change staging or production schema from the dashboard.
  Migrations are the only source of truth.

`npm run migrations:check` (part of `npm run verify` and CI) enforces the file naming, RLS-in-same-
migration, no-RLS-disable, no-secrets and no-DDL-in-seed rules statically.

## Profiles (Phase 1M-B)

Migration: `migrations/20261009092316_auth_profiles.sql`. Tests:
`tests/database/profiles.test.sql`.

### Schema

`public.profiles` has one row per `auth.users` row. It holds user-facing fields only.
Credentials, sessions and email stay in Supabase Auth.

| Column                                      | Type        | Notes                                                              |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `id`                                        | uuid PK     | FK → `auth.users(id)` `on delete cascade`                          |
| `first_name`                                | text        | ≤ 80 chars                                                         |
| `date_of_birth`                             | date        | ≥ 1900-01-01, never in the future; age is never stored             |
| `gender`                                    | text        | `man`, `woman`, `non_binary`, `other`, `prefer_not_to_say` (CHECK) |
| `bio`                                       | text        | ≤ 1000 chars                                                       |
| `home_city` / `home_country` / `occupation` | text        | ≤ 120 chars each                                                   |
| `is_profile_complete`                       | boolean     | **database-maintained**                                            |
| `is_discoverable`                           | boolean     | user preference, default `false`, guarded                          |
| `created_at` / `updated_at`                 | timestamptz | database-controlled                                                |

All text fields are trimmed by the database. An empty or whitespace-only value becomes `NULL`.

### Lifecycle

- **Creation:** `private.handle_new_user()` is an AFTER INSERT trigger on `auth.users`. It is
  SECURITY DEFINER with `search_path = ''`. It inserts the profile `id` only, using
  `on conflict do nothing`, so retries are safe. Auth metadata is **not** copied, because
  clients can set it.
- **Deletion:** deleting the auth user cascades to the profile. Clients cannot delete profiles
  directly; account deletion comes later as a server-side flow.

### Rules enforced by the database

`private.profiles_before_write()` is a BEFORE INSERT/UPDATE trigger. It:

- **Protects canonical columns:**
  - rejects any change to `id`
  - keeps the original `created_at`
  - leaves `updated_at` to `private.set_updated_at()`
  - always recomputes `is_profile_complete`
- **Normalises text:** trims every text field and turns empty values into `NULL`.
- **Validates date of birth:** a future `date_of_birth` raises SQLSTATE `23514`. This lives in
  the trigger rather than a CHECK, because a CHECK using `current_date` is never re-evaluated.
- **Computes completeness** with `private.profile_is_complete()`. A profile is complete when it
  has a first name, a date of birth, the person is 18 or older, and a gender is set.
  `private.is_adult()` treats `date_of_birth <= current_date - 18 years` (UTC) as adult.
- **Guards discoverability:**
  - Asking for `is_discoverable = true` on an incomplete or under-18 profile raises `23514`.
  - An edit that makes a discoverable profile incomplete (for example, a DOB change to under
    18 or removing gender) silently resets it to `false`.
  - A CHECK constraint (`not is_discoverable or is_profile_complete`) backs this up even for
    privileged writes.
- **Known limitation:** completeness is evaluated at write time. Future discovery queries must
  re-check eligibility when they read; never rely only on the stored flag.

### Access

| Role            | SELECT                               | UPDATE                               | INSERT / DELETE |
| --------------- | ------------------------------------ | ------------------------------------ | --------------- |
| `anon`          | ✗                                    | ✗                                    | ✗               |
| `authenticated` | own row (RLS)                        | own row (RLS), editable columns only | ✗               |
| `service_role`  | all (bypasses RLS; server code only) | all (trigger rules still apply)      | ✓               |

- **Editable columns** (the column-level `GRANT UPDATE`): `first_name`, `date_of_birth`,
  `gender`, `bio`, `home_city`, `home_country`, `occupation`, `is_discoverable`.
- **Protected columns:** `id`, `created_at`, `updated_at`, `is_profile_complete`. Writing them
  as a client fails with `42501`.
- **No public reads:** there is no "everyone can read profiles" policy. Discovery-safe reads
  of other users come in the discovery phase, through a dedicated, minimal surface.

### Testing database policies

```bash
npx supabase test db   # authoritative: real local Supabase stack (Docker)
npm run test:db        # fallback: plain PostgreSQL 15+ with pgTAP, no Docker
```

`npm run test:db` builds a throwaway cluster. It applies `scripts/db-test/supabase-shim.sql`
(a minimal emulation of Supabase roles, `auth.users`, `auth.uid()` and default grants), then
runs every migration and every `tests/database/*.test.sql`. To install the tools on macOS:
`brew install postgresql@17 pgtap`, then set `PG_BIN=$(brew --prefix postgresql@17)/bin` if
needed.

### Recovery

The migration header lists the manual rollback statements. Once real users exist, prefer a
forward-fix migration over a rollback.

## Destinations + trips (Phase 1M-C)

Migration: `migrations/20261009101052_destinations_trips.sql`. Tests:
`tests/database/destinations_trips.test.sql` and `tests/database/seed.test.sql`.

Triply is trip-centric: users plan trips like "Bali, 4–12 Dec". The schema stores no live or
precise user location.

### `public.destinations` (catalog)

| Column                      | Rules                                                           |
| --------------------------- | --------------------------------------------------------------- |
| `slug`                      | unique, 2–80 chars, lowercase URL-safe (`bali`, `buenos-aires`) |
| `city_name`, `country_name` | trimmed, 1–120 chars                                            |
| `country_code`              | exactly two uppercase letters (ISO 3166-1 alpha-2)              |
| `latitude` / `longitude`    | optional city centroid, within range, both or neither           |
| `timezone`                  | optional IANA-style name (`Asia/Makassar`)                      |
| `hero_image_url`            | optional `https://` URL                                         |
| `active`                    | default `true`; inactive rows are hidden from clients           |

- **Reads:** signed-in users can read **active** destinations only. Logged-out users (`anon`)
  have no access.
- **Writes:** only migrations, the seed or server tooling (`service_role`) can write the catalog.

### `public.trips`

| Column                   | Rules                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `user_id`                | FK → `profiles(id)` `on delete cascade`, defaults to `auth.uid()`, immutable                       |
| `destination_id`         | FK → `destinations(id)` `on delete restrict`; must be **active** when the trip is created or moved |
| `start_date`, `end_date` | `date`, both required, `end_date >= start_date`; sanity bounds 2000-01-01 … 2100-12-31             |
| `status`                 | `planned` (default), `active`, `completed`, `cancelled`                                            |
| `visibility`             | `discoverable` (default) or `hidden`, chosen by the owner                                          |

- **Past trips are allowed.** History may matter later; discovery will filter to relevant trips.
- **No limits on repeats or length:** there is no maximum trip length and no uniqueness rule on
  destination or dates.
- **Status:**
  - The app may only move a trip to `cancelled`. It can't choose the initial status: new trips
    always start as `planned`.
  - `active` and `completed` are reserved for future server-side automation (`service_role`).
  - `cancelled` is **terminal**: a cancelled trip can't be edited or reopened. Cancelling it
    again is a no-op.
- **Cancel, don't delete:** the app has no DELETE grant or policy for trips. Trips are removed
  only when their owner's account is deleted (cascade).
- **Destination deactivated later:** existing trips keep their destination, but the client can no
  longer see it. In the app, `trip.destination` is `null` in that case.
- **Protected columns:**
  - `id`, `user_id`, `created_at` and `updated_at` aren't in the column-level grants.
  - `private.trips_before_write()` also rejects owner or id changes for privileged writes, and
    keeps `created_at` intact.

### Access

| Role            | destinations       | trips                                                                                                                                                                                                                  |
| --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon`          | ✗                  | ✗                                                                                                                                                                                                                      |
| `authenticated` | SELECT active rows | SELECT / INSERT / UPDATE **own rows only**. INSERT columns: `user_id` (must be self), `destination_id`, dates, `visibility`. UPDATE columns: `destination_id`, dates, `status` (cancel only), `visibility`. No DELETE. |
| `service_role`  | all                | all (trigger rules still apply)                                                                                                                                                                                        |

There are no broad SELECT policies on trips: no client can list other users' trips.

### Indexes

- **`trips_user_id_start_date_idx`:** the owner's trip list, ordered by date. It also serves the
  `user_id` cascade.
- **`trips_destination_id_idx`:** the destination FK (restrict checks, admin queries).
- **`trips_discovery_idx`:** partial `(destination_id, start_date, end_date)` covering only
  `visibility = 'discoverable'` trips in `planned` / `active` status. It's for future "same
  place, overlapping dates" lookups.
- **Deliberately left out:** separate status and visibility indexes. Those columns have few
  distinct values and are covered by the partial index's filter.

### How discovery will use trips (later phase)

Discovery will **not** widen these policies. It will use a SECURITY DEFINER RPC or view that
returns only discovery-safe fields for trips where all of the following hold:

- `visibility = 'discoverable'`
- `status in ('planned', 'active')`
- `end_date >= current_date`
- the owner's profile is discoverable and the owner is still an adult, re-checked when the
  data is read

Hidden and cancelled trips are never eligible.

## Preferences + interests (Phase 1M-D)

Migration: `migrations/20261009103602_preferences_interests.sql`. Tests:
`tests/database/preferences_interests.test.sql` (plus the interest checks in `seed.test.sql`).

Everything here belongs to the signed-in user. No client can read another user's interests or
preferences.

### `public.interests` (catalog)

| Column     | Rules                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| `slug`     | unique, 2–60 chars, lowercase URL-safe (`digital-nomad`)                       |
| `label`    | trimmed, 1–60 chars (`Digital nomad`)                                          |
| `category` | optional, lowercase (`outdoors`, `culture`, `lifestyle`, `social`, `wellness`) |
| `active`   | default `true`; inactive interests are hidden and can't be newly selected      |

- **Reads:** signed-in users can read **active** interests only. Logged-out users (`anon`) have
  no access.
- **Writes:** only migrations, the seed or server tooling. The app can't create free-text
  interests.

### `public.profile_interests` (selections)

- **Shape:** primary key `(user_id, interest_id)`, so the same interest can't be selected twice.
  `user_id` defaults to `auth.uid()`.
- **Interest references:** an interest that is still selected can't be deleted from the catalog
  (FK restrict).
- **Access:** the owner can read, add and remove their own rows. There is no UPDATE; remove one
  and add another instead.
- **Limit of 10 interests per user.** This keeps profiles focused and makes shared-interest
  signals meaningful.
  - Enforced by `private.profile_interests_before_insert()`.
  - A per-user advisory lock means concurrent inserts can't push a user past 10.
  - The 11th insert fails with `23514`.
- **Inactive interests:** can't be newly selected (`23503`). A selection made before an interest
  was deactivated stays until the user removes it. The app sees its `interest` as `null`.

### `public.discovery_preferences` (one row per profile)

| Column                 | Default | Rule                                                                                                  |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `min_age`              | 18      | ≥ 18                                                                                                  |
| `max_age`              | 99      | ≤ 99 and ≥ `min_age`                                                                                  |
| `minimum_overlap_days` | 1       | 1–60: how many days two trips must share. 60 blocks absurd input without limiting real travel         |
| `max_distance_km`      | null    | optional, 1–20000. **Future-facing only**: Triply collects no live location and nothing uses this yet |

- **Created automatically:** `private.handle_new_profile()`, an AFTER INSERT trigger on
  `public.profiles`, creates the row. It's idempotent, and the migration backfilled existing
  profiles.
- **Access:** the owner can SELECT and UPDATE the four preference columns. There is no
  INSERT or DELETE.
- **Protected:** `user_id` can't be changed, even by server-side writes, and `created_at` is
  preserved.

### `public.discovery_gender_preferences`

- **Shape:** zero or more rows of `(user_id, gender)`. Values match `profiles.gender`: `man`,
  `woman`, `non_binary`, `other`, `prefer_not_to_say`.
- **"Everyone":** selected by choosing every value. There is no "everyone" sentinel value.
- **No rows** means not configured yet. Discovery will decide how to treat that; onboarding
  should require at least one.
- **Access:** the owner can read, add and remove their own rows. There is no UPDATE.

### Atomic replacement RPCs

Use these for multi-select screens:

- `replace_profile_interests(uuid[])` and `set_discovery_gender_preferences(text[])`.
- **Same rules as direct writes:** they run as the caller (SECURITY INVOKER), so access policies,
  grants, the 10-interest limit and active-only selection all still apply.
- **All or nothing:** each call is one transaction, so an invalid entry rejects the whole call
  and leaves the previous selection intact. Duplicate entries in the input are collapsed.
- **Who can call them:** signed-in users only. Logged-out users get a permission error.

### Indexes

- **`profile_interests_interest_id_idx`:** supports the `interest_id` FK (catalog changes) and
  future shared-interest lookups. Lookups by `user_id` use the primary key.
- **No extra index on gender preferences:** per-user reads use the primary key. A reverse index
  on `gender` can be added alongside the discovery RPC if it needs one.

### How discovery will use these (later phase)

These tables will never get broad SELECT policies. The discovery RPC (SECURITY DEFINER) will
read them server-side to:

- filter candidates by mutual age range, mutual gender preference and trip overlap of at least
  `minimum_overlap_days`
- return only derived, discovery-safe results, such as "3 shared interests"

It will never expose another user's raw preference or selection rows.

## Decisions + matching (Phase 1M-E)

Migration: `20261009110512_decisions_matching.sql`. Tests:
`supabase/tests/database/decisions_matching.test.sql` (54 assertions).

### `public.user_decisions`

One row per actor → target pair (`user_decisions_actor_target_key`), `decision` is `like` or
`pass`, `actor_user_id <> target_user_id`. Optional `source_trip_id` / `target_trip_id` record
the trip context (FK to `trips`, `on delete set null`). Changing a decision (pass → like or
like → pass) updates the same row; the actor/target pair and `created_at` are immutable (trigger).

- **Incoming decisions are never readable.** The only select policy is
  `auth.uid() = actor_user_id`. There is no way to learn who liked you before a match.
- No insert/update/delete grants or policies for `authenticated`; writes go through
  `submit_decision` only.

### `public.matches`

Canonical pair: `user_low_id < user_high_id` (check), unique per pair (`matches_pair_key`).
`unmatched_at` / `unmatched_by` record a terminal unmatch (`unmatched_by` must be a participant
and requires `unmatched_at`). Participants can select their own matches; nobody can insert,
update or delete directly. Participants and `created_at` are immutable, and an unmatched row
cannot be changed or reopened (trigger, SQLSTATE `55000`).

### RPCs (SECURITY DEFINER, `search_path = ''`, actor = `auth.uid()`)

`submit_decision(p_target_user_id, p_decision, p_source_trip_id?, p_target_trip_id?)` returns
`decision_id, decision, matched, match_id, match_created`:

1. Rejects anonymous callers (`42501`), invalid input / self-decisions / foreign or cancelled
   trip context (`22023`), unknown targets (`P0002`).
2. Takes a transaction advisory lock on the canonical pair, so the two users' likes serialize.
3. Upserts the caller's decision.
4. If a match row already exists for the pair: reports `matched` = still active; an unmatched
   pair stays unmatched (no rematch) and `match_id` is null. A later pass does **not**
   implicitly unmatch — use `unmatch`.
5. Otherwise, if this is a like and the reverse like exists, inserts the canonical match
   (`on conflict do nothing`) in the same transaction.

`unmatch(p_match_id)` sets `unmatched_at = now()`, `unmatched_by = auth.uid()` for a participant.
Idempotent (a second call returns the existing row unchanged). Unknown or foreign matches
return `P0002 match not found` (no existence leak).

### Concurrency

The pair advisory lock plus the unique constraints make match creation race-safe. Verified ad
hoc on Postgres 16: 40 pairs liking each other simultaneously → exactly 40 matches, one
`match_created = true` per pair, no errors or deadlocks; 10 concurrent identical likes → one
decision row.

### Indexes

`user_decisions(target_user_id)` (reverse-like lookup / cascades; the unique key covers actor
lookups), `matches(user_high_id)` (the unique key covers `user_low_id`).

### Later phases

Discovery (later) will exclude users the caller already decided about and any pair with a
match row (active or unmatched). Blocking/reporting (1M-F) will hook into the same pair model.

## Blocking + reporting (Phase 1M-F)

Migration: `20261009112515_blocking_reporting.sql`. Tests:
`supabase/tests/database/blocking_reporting.test.sql` (85 assertions).

### `public.user_blocks` (directed)

Primary key `(blocker_user_id, blocked_user_id)`, not-self check, `created_at`. No reason is
stored (reasons belong in reports). A block is active until the blocker removes it.

- **Privacy:** the only select policy is `auth.uid() = blocker_user_id`. A user can never read
  who blocked them or anyone else's block list; no view or RPC returns reverse block state.
- **Writes:** RPC only (`block_user`, `unblock_user`); no client insert/update/delete.

### Blocking behaviour

`block_user(target)` (idempotent):

1. Inserts the caller's block (`on conflict do nothing`).
2. Ends an active match for the pair in the same transaction, using the Phase 1M-E terminal
   unmatch semantics (`unmatched_at = now()`, `unmatched_by = blocker`). The row is kept; an
   already-unmatched row is left as it is.
3. Keeps all decisions as history.

To the other participant, a block-ended match looks exactly like an ordinary unmatch.

`submit_decision` now rejects any decision while a block exists in **either** direction with
one generic error, `42501 interaction unavailable` (mobile `DecisionError` code
`unavailable`). The error is the same whichever side blocked, and the existing decision row is
not changed. So no match can be created while a block exists, even from earlier reciprocal
likes.

Limitation: a user who knows they did not block someone can still infer from this error that
the other side did. Future discovery must exclude blocked pairs in both directions so the
client never offers that interaction (Safety Architecture §11).

### Unblock semantics

`unblock_user(target)` deletes only the caller's own row and returns whether one was removed
(idempotent). It never reopens or creates a match, and never changes decisions, reports or
unmatch history. A pair that was matched stays terminal (Phase 1M-E). For a pair that never
matched, decisions work again, and a later like is matched against the other user's
**current** decision. A like they made before the block still counts.

### `public.user_reports`

`id`, `reporter_user_id`, `reported_user_id`, `reason`, `details` (≤ 2000 chars, trimmed,
blank → null), `related_match_id` / `related_trip_id` (`on delete set null`), `created_at`,
`status` (`open` | `reviewed` | `actioned` | `dismissed`, default `open`).

- **Reasons:** `harassment`, `spam`, `scam`, `inappropriate_content`, `impersonation`,
  `underage_concern`, `safety_concern`, `other`.
- **Privacy:** the reporter can read their own reports, and only the content columns
  (column-level grant). `status` is not readable, so moderation outcomes are not revealed. The
  reported user and third parties have no policy and see nothing. No report counts are
  exposed.
- **Status ownership:** there is no client write path. `report_user` has no status parameter.
  Status changes are service_role / future moderation tooling only.
- **Evidence integrity:** a trigger makes report content immutable even for privileged
  writes. Only `status` may change, and the related ids may only be cleared by the FK.
- **Duplicates:** multiple reports from the same reporter against the same user are allowed
  (separate incidents, moderation history). There is no rate limit yet.
- **Data minimisation:** text only. No uploads, screenshots, device data or IPs.

`report_user(reported, reason, details?, related_match?, related_trip?)` validates the
following, then returns `{ report_id, created_at }`:

- the caller is signed in
- the reason is valid
- the reporter is not reporting themselves
- the details length
- the reported user exists (`P0002`)
- the related match is the reporter's own match with the reported user (active or unmatched)
- the related trip belongs to the reporter or the reported user (any status)

Context failures return one generic error, `22023 invalid report context`. Reporting never
looks at blocks, so it cannot be used to find out about blocks, and a blocked user can still
report.

### Concurrency

`block_user` takes the same pair advisory lock as `submit_decision`. Either the block commits
first (the like is rejected), or the match commits first and the block ends it. Verified ad
hoc on Postgres 16:

- 60 pairs where one side likes while the other blocks at the same time: 33 likes created a
  match that the block then ended, and 27 likes were rejected. No active match was left with
  a block, and there were no errors or deadlocks.
- 15 identical concurrent blocks: 1 row.
- 50 concurrent reports: 50 rows.

### Indexes

- `user_blocks_pkey`: own list and pair check.
- `user_blocks_blocked_user_id_idx`: reverse check inside RPCs, and FK cascade.
- `user_reports (reporter_user_id, created_at desc)`: reporter history.
- `user_reports (reported_user_id, created_at desc)`: future moderation queue.

### Later phases

- Discovery must exclude blocked pairs in both directions, through a definer function.
- Chat must check blocks.
- Moderation tooling will own `status`, severity and protective actions.
- Account-deletion retention for reports is still to be decided: reports currently cascade
  with the profile.

## Seed data

`seed.sql` holds development and staging **reference data only**. Right now that's two catalogs:

- **Destinations:** Bali, Bangkok, Dubai, Barcelona, Paris and Lisbon.
- **Interests:** hiking, photography, food, coffee, beaches, surfing, nightlife, fitness, art,
  music, adventure, culture, wellness and digital nomad.

- **Local stack:** applied automatically on `supabase start` and `supabase db reset`.
- **Triply Development:** applied only on explicit request:
  `npx supabase db push --include-seed`, while linked to Triply Development.
- **Production:** never. Production reference data ships through reviewed migrations or
  server tooling.
- **Idempotent:** every insert upserts on a stable key (`slug`), so re-running it
  never duplicates rows. `npm run test:db` applies it twice to prove this.
- **No personal data:** no users, profiles, trips, interest selections or preferences.
  `npm run migrations:check` fails if the seed writes any table other than
  `public.destinations` or `public.interests`, or if an insert lacks `ON CONFLICT`.
