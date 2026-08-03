import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadAnalysisCsv,
  processAnalysisJob,
  listAnalysisJobs,
  getAnalysisJob,
} from './api';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: vi.fn(),
}));

describe('Analysis API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('1. uploadAnalysisCsv sends correct FormData to /analysis/upload', async () => {
    const mockFile = new File(['test'], 'test.csv', { type: 'text/csv' });
    const mockResponse = { job_id: 1, status: 'PENDING' };
    vi.mocked(apiClient).mockResolvedValueOnce(mockResponse);

    const controller = new AbortController();
    const result = await uploadAnalysisCsv(mockFile, 'token123', controller.signal);

    expect(result).toBe(mockResponse);
    expect(apiClient).toHaveBeenCalledTimes(1);

    const args = vi.mocked(apiClient).mock.calls[0];
    expect(args[0]).toBe('/analysis/upload');
    expect(args[1]?.method).toBe('POST');
    expect(args[1]?.signal).toBe(controller.signal);
    expect(args[1]?.body).toBeInstanceOf(FormData);
    expect((args[1]?.body as FormData).get('file')).toBe(mockFile);
    expect(args[2]).toBe('token123');
  });

  it('2. processAnalysisJob sends correct POST to /analysis/{job_id}/process', async () => {
    const mockResponse = { job_id: 1, final_status: 'COMPLETED', records_processed: 10 };
    vi.mocked(apiClient).mockResolvedValueOnce(mockResponse);

    const controller = new AbortController();
    const result = await processAnalysisJob(1, 'token123', controller.signal);

    expect(result).toBe(mockResponse);
    expect(apiClient).toHaveBeenCalledWith(
      '/analysis/1/process',
      { method: 'POST', signal: controller.signal },
      'token123'
    );
  });

  it('3. processAnalysisJob rejects invalid job ID without calling apiClient', async () => {
    await expect(processAnalysisJob(-1, 'token123')).rejects.toThrow('Invalid job ID');
    await expect(processAnalysisJob(0, 'token123')).rejects.toThrow('Invalid job ID');
    await expect(processAnalysisJob(1.5, 'token123')).rejects.toThrow('Invalid job ID');
    expect(apiClient).not.toHaveBeenCalled();
  });

  it('4. listAnalysisJobs without params sends GET /analysis', async () => {
    const mockResponse = [{ id: 1, status: 'PENDING' }];
    vi.mocked(apiClient).mockResolvedValueOnce(mockResponse);

    const controller = new AbortController();
    const result = await listAnalysisJobs(undefined, 'token123', controller.signal);

    expect(result).toBe(mockResponse);
    expect(apiClient).toHaveBeenCalledWith(
      '/analysis',
      { method: 'GET', signal: controller.signal },
      'token123'
    );
  });

  it('5. listAnalysisJobs with params properly encodes query string', async () => {
    const mockResponse: unknown[] = [];
    vi.mocked(apiClient).mockResolvedValueOnce(mockResponse);

    await listAnalysisJobs({ status: 'COMPLETED', skip: 10, limit: 20 }, 'token123');

    expect(apiClient).toHaveBeenCalledWith(
      '/analysis?status=COMPLETED&skip=10&limit=20',
      { method: 'GET', signal: undefined },
      'token123'
    );
  });

  it('6. getAnalysisJob sends GET /analysis/{job_id}', async () => {
    const mockResponse = { id: 1, status: 'PENDING' };
    vi.mocked(apiClient).mockResolvedValueOnce(mockResponse);

    const controller = new AbortController();
    const result = await getAnalysisJob(1, 'token123', controller.signal);

    expect(result).toBe(mockResponse);
    expect(apiClient).toHaveBeenCalledWith(
      '/analysis/1',
      { method: 'GET', signal: controller.signal },
      'token123'
    );
  });

  it('7. getAnalysisJob rejects invalid job ID without calling apiClient', async () => {
    await expect(getAnalysisJob(-1, 'token123')).rejects.toThrow('Invalid job ID');
    await expect(getAnalysisJob(0, 'token123')).rejects.toThrow('Invalid job ID');
    expect(apiClient).not.toHaveBeenCalled();
  });
});
