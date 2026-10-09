# features/safety

Phase 1M-F split the safety data layer into two modules:

- `src/features/blocks`: block / unblock (own outgoing blocks only)
- `src/features/reports`: report a user (own submitted reports only)

Safety UI (report sheet, block confirmation, safety center) belongs to a later phase.
