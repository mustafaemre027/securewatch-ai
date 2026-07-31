import { apiClient } from '../../api/client';
import type {
  AnalysisUploadResponse,
  AnalysisProcessingResponse,
  AnalysisJobListItem,
  AnalysisJobDetail,
  AnalysisJobListParams,
} from './types';

export const uploadAnalysisCsv = (
  file: File,
  token?: string | null,
  signal?: AbortSignal
): Promise<AnalysisUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient<AnalysisUploadResponse>(
    '/analysis/upload',
    {
      method: 'POST',
      body: formData,
      signal,
    },
    token
  );
};

export const processAnalysisJob = (
  jobId: number,
  token?: string | null,
  signal?: AbortSignal
): Promise<AnalysisProcessingResponse> => {
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return Promise.reject(new Error('Invalid job ID'));
  }

  return apiClient<AnalysisProcessingResponse>(
    `/analysis/${jobId}/process`,
    {
      method: 'POST',
      signal,
    },
    token
  );
};

export const listAnalysisJobs = (
  params?: AnalysisJobListParams,
  token?: string | null,
  signal?: AbortSignal
): Promise<AnalysisJobListItem[]> => {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.append('status', params.status);
  }
  if (params?.skip !== undefined) {
    searchParams.append('skip', params.skip.toString());
  }
  if (params?.limit !== undefined) {
    searchParams.append('limit', params.limit.toString());
  }

  const queryString = searchParams.toString();
  const path = queryString ? `/analysis?${queryString}` : '/analysis';

  return apiClient<AnalysisJobListItem[]>(
    path,
    {
      method: 'GET',
      signal,
    },
    token
  );
};

export const getAnalysisJob = (
  jobId: number,
  token?: string | null,
  signal?: AbortSignal
): Promise<AnalysisJobDetail> => {
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return Promise.reject(new Error('Invalid job ID'));
  }

  return apiClient<AnalysisJobDetail>(
    `/analysis/${jobId}`,
    {
      method: 'GET',
      signal,
    },
    token
  );
};
