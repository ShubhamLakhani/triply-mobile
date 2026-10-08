# supabase

Database migrations, RLS policies, RPC functions and Edge Functions live here.

**Phase 0M:** intentionally empty — no Triply business schema yet. The first migrations
(profiles, account state, RLS) arrive in **Phase 1M** together with the staging and production
Supabase projects and the Supabase CLI setup.

Rules (Architecture v2 §9–10):

- PostgreSQL is the system of record; every table has RLS enabled.
- Sensitive operations (discovery, like/match, block, report, deletion, moderation, push fan-out)
  run through RPC / Edge Functions, never direct client table writes.
- The service-role key is used only by trusted server code and never in the mobile app.
