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

## Seed data

`seed.sql` runs only against the local stack (`supabase start`, `supabase db reset`). It is never
applied by `db push`. It contains no fake users or product data yet.
