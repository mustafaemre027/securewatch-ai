import { apiClient } from '../../api/client';
import type { DetectionResultPage, AnalysisSummary, DetectionResultListParams, DetectionRiskLevel } from './types';

const VALID_RISK_LEVELS = new Set<DetectionRiskLevel>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const listDetectionResults = (
  jobId: number,
  params?: DetectionResultListParams,
  token?: string | null,
  signal?: AbortSignal
): Promise<DetectionResultPage> => {
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return Promise.reject(new Error('Invalid job ID'));
  }

  const searchParams = new URLSearchParams();

  if (params) {
    if (params.skip !== undefined) {
      if (!Number.isInteger(params.skip) || params.skip < 0) {
        return Promise.reject(new Error('Invalid skip parameter'));
      }
      searchParams.append('skip', params.skip.toString());
    }

    if (params.limit !== undefined) {
      if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100) {
        return Promise.reject(new Error('Invalid limit parameter'));
      }
      searchParams.append('limit', params.limit.toString());
    }

    if (params.isAttack !== undefined) {
      searchParams.append('is_attack', params.isAttack.toString());
    }

    if (params.riskLevel !== undefined) {
      if (!VALID_RISK_LEVELS.has(params.riskLevel)) {
        return Promise.reject(new Error('Invalid risk level parameter'));
      }
      searchParams.append('risk_level', params.riskLevel);
    }
  }

  const queryString = searchParams.toString();
  const path = queryString ? `/analysis/${jobId}/results?${queryString}` : `/analysis/${jobId}/results`;

  return apiClient<DetectionResultPage>(
    path,
    {
      method: 'GET',
      signal,
    },
    token
  );
};

export const getAnalysisSummary = (
  jobId: number,
  token?: string | null,
  signal?: AbortSignal
): Promise<AnalysisSummary> => {
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return Promise.reject(new Error('Invalid job ID'));
  }

  return apiClient<AnalysisSummary>(
    `/analysis/${jobId}/summary`,
    {
      method: 'GET',
      signal,
    },
    token
  );
};
