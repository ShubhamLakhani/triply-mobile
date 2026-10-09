# features/matches

The signed-in user's matches (see `supabase/README.md → Decisions + matching`).

- `api/match-api.ts`: `fetchOwnMatches`, `fetchOwnMatchById`, `unmatch` (RPC)
- `api/match-keys.ts`: `matchKeys.own(userId)`, `matchKeys.detail(userId, matchId)`
- `hooks/use-matches.ts`: `useOwnMatches`, `useOwnMatch`, `useUnmatch`
- `types.ts`: `OwnMatch` adds `other_user_id` and `is_active` to the canonical row

How matches behave:

- Matches are created only by the server, on a mutual like.
- Unmatching is explicit and terminal; a pair is never re-matched in this phase.
- Unmatched rows stay visible to both participants as history (`is_active = false`).
