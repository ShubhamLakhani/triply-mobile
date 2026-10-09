# features/decisions

The signed-in user's like/pass decisions (see `supabase/README.md → Decisions + matching`).

- `api/decision-api.ts`: `submitDecision` (the `submit_decision` RPC is the only write path),
  `fetchOwnDecisions`, `fetchOwnDecisionForUser`
- `api/decision-keys.ts`: `decisionKeys.own(userId)`, `decisionKeys.forTarget(userId, targetId)`
- `hooks/use-decisions.ts`: `useOwnDecisions`, `useSubmitDecision` (refreshes own matches when `matched`)
- `schemas/decision.schema.ts`: input and RPC response validation

Privacy:

- Only outgoing decisions are readable.
- There is no "who liked me" API, and there must never be one.
- `submit_decision` reports `matched` only when a match actually exists.

Phase 1M-H: only complete (18+) profiles can submit decisions. An incomplete caller gets
`DecisionError` code `profile_incomplete`; an incomplete target gets the same generic
`unavailable` as a blocked pair.
