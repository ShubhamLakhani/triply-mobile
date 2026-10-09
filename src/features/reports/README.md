# features/reports

Reports the signed-in user files (see `supabase/README.md → Blocking + reporting`).

- `api/report-api.ts`: `reportUser` (RPC `report_user`), `fetchOwnReports`
- `api/report-keys.ts`: `reportKeys.own(userId)`
- `hooks/use-reports.ts`: `useReportUser`, `useOwnReports`
- `schemas/report.schema.ts`: `reportUserSchema` (reason enum, details ≤ 2000, optional match/trip)

Rules:

- Reports are moderation records. The reported user never sees them; there is no query for
  reports against the current user.
- Moderation `status` is not readable or writable by the app (server/admin only).
- Reporting and blocking are separate. "Report and block" in UI = `useReportUser` then
  `useBlockUser`.
- Never log report `details`.
