import { apiClient } from '../../api/client';
import type { DashboardSummaryResponse } from './types';
import { parseDashboardSummary } from './validators';

export const getDashboardSummary = async (
  token?: string | null,
  signal?: AbortSignal
): Promise<DashboardSummaryResponse> => {
  const data = await apiClient<unknown>(
    '/dashboard/summary',
    {
      method: 'GET',
      signal,
    },
    token
  );

  return parseDashboardSummary(data);
};
