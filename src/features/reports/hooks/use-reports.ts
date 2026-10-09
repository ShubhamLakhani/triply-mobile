import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchOwnReports, reportUser } from '../api/report-api';
import { ReportError } from '../api/report-errors';
import { reportKeys } from '../api/report-keys';
import type { ReportUserInput } from '../schemas/report.schema';
import type { ReportResult } from '../types';

function requireUser(userId: string | null): string {
  if (!userId) throw new ReportError('not_authenticated', 'Not signed in.');
  return userId;
}

/** Reports the signed-in user submitted. */
export function useOwnReports(userId: string | null) {
  return useQuery({
    queryKey: reportKeys.own(userId ?? 'signed-out'),
    queryFn: () => fetchOwnReports(requireUser(userId)),
    enabled: userId !== null,
  });
}

/**
 * Files a report. Reporting does not block; combine with `useBlockUser` for "Report and block".
 */
export function useReportUser(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<ReportResult, ReportError | Error, ReportUserInput>({
    mutationFn: (input) => {
      requireUser(userId);
      return reportUser(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reportKeys.own(requireUser(userId)) });
    },
  });
}
