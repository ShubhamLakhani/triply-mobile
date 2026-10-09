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

## Seed data

`seed.sql` runs only against the local stack (`supabase start`, `supabase db reset`). It is never
applied by `db push`. It contains no fake users or product data yet.
