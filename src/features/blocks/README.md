# features/blocks

The signed-in user's blocks (see `supabase/README.md → Blocking + reporting`).

- `api/block-api.ts`: `fetchOwnBlocks`, `blockUser` (RPC `block_user`), `unblockUser` (RPC `unblock_user`)
- `api/block-keys.ts`: `blockKeys.own(userId)`
- `hooks/use-blocks.ts`: `useOwnBlocks`, `useIsUserBlocked`, `useBlockUser`, `useUnblockUser`
- `types.ts`: `OwnBlock`, `isBlockedByMe`

Rules:

- Only OUTGOING blocks are readable. There is no "who blocked me" query, and none may be added.
- Blocking is idempotent and ends an active match with that user on the server.
- Unblocking removes only your own block and never restores a match.
- A blocked pair's decisions fail with `DecisionError` code `unavailable`, whichever side blocked.
