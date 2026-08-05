import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDashboardSummary } from './api';
import { ApiError } from '../../api/types';

describe('Dashboard API Client', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const mockResponse = (status: number, ok: boolean, data: unknown) => {
    const res = new Response(JSON.stringify(data), {
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    Object.defineProperty(res, 'ok', { value: ok });
    return res;
  };

  const validResponse = {
    generated_at: '2024-01-01T12:00:00.000Z',
    analysis_summary: {
      total_jobs: 10,
      completed_jobs: 8,
      status_distribution: { PENDING: 1, PROCESSING: 1, COMPLETED: 8, FAILED: 0 }
    },
    detection_summary: { total_detections: 100, benign_count: 80, attack_count: 20 },
    detection_class_distribution: { benign: 80, attack: 20 },
    risk_distribution: { LOW: 50, MEDIUM: 30, HIGH: 15, CRITICAL: 5 },
    incident_summary: {
      total_incidents: 5,
      status_distribution: { OPEN: 2, IN_PROGRESS: 1, RESOLVED: 2, FALSE_POSITIVE: 0 },
      severity_distribution: { LOW: 1, MEDIUM: 2, HIGH: 1, CRITICAL: 1 }
    },
    trend_7_days: [
      { date: '2024-01-01', total: 10, benign: 8, attack: 2 },
      { date: '2024-01-02', total: 15, benign: 10, attack: 5 },
      { date: '2024-01-03', total: 5, benign: 5, attack: 0 },
      { date: '2024-01-04', total: 20, benign: 15, attack: 5 },
      { date: '2024-01-05', total: 10, benign: 8, attack: 2 },
      { date: '2024-01-06', total: 10, benign: 8, attack: 2 },
      { date: '2024-01-07', total: 10, benign: 8, attack: 2 },
    ],
    recent_detections: [],
    recent_incidents: []
  };

  it('sends GET request to correct endpoint', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    await getDashboardSummary();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/dashboard/summary',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('sends request without body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    await getDashboardSummary();
    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0][1];
    expect(callArgs?.body).toBeUndefined();
  });

  it('does not attach any query parameter', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    await getDashboardSummary();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/dashboard/summary',
      expect.anything()
    );
  });

  it('passes AbortSignal correctly', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    const controller = new AbortController();
    await getDashboardSummary(null, controller.signal);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('returns parsed valid response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    const res = await getDashboardSummary();
    expect(res.analysis_summary.total_jobs).toBe(10);
    expect(res.trend_7_days).toHaveLength(7);
  });

  it('rejects if response lacks required fields (validator rejects)', async () => {
    const invalidResp = { ...validResponse };
    delete (invalidResp as any).analysis_summary;
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, invalidResp));
    await expect(getDashboardSummary()).rejects.toThrow('Invalid dashboard response');
  });

  it('rejects if response contains unknown enum', async () => {
    const invalidResp = JSON.parse(JSON.stringify(validResponse));
    invalidResp.analysis_summary.status_distribution['UNKNOWN_NEW'] = 5;
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, invalidResp));
    await expect(getDashboardSummary()).rejects.toThrow('Invalid dashboard response');
  });

  it('rejects invalid trend data', async () => {
    const invalidResp = JSON.parse(JSON.stringify(validResponse));
    invalidResp.trend_7_days.pop();
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, invalidResp));
    await expect(getDashboardSummary()).rejects.toThrow('Invalid dashboard response');
  });

  it('preserves 401 secure ApiError behavior', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(401, false, { error: { message: 'Unauthorized' } }));
    try {
      await getDashboardSummary();
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(401);
      expect(e.message).toBe('Unauthorized');
    }
  });

  it('preserves 403 secure ApiError behavior', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(403, false, { error: { message: 'Forbidden' } }));
    try {
      await getDashboardSummary();
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(403);
    }
  });

  it('safely handles 422 errors', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(422, false, { error: { message: 'Unprocessable' } }));
    try {
      await getDashboardSummary();
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(422);
    }
  });

  it('safely handles 500 errors', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(500, false, { error: { message: 'Server error' } }));
    try {
      await getDashboardSummary();
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(500);
    }
  });

  it('safely handles network errors', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    try {
      await getDashboardSummary();
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(0);
      expect(e.code).toBe('NETWORK_ERROR');
    }
  });

  it('handles abort correctly', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(abortErr);
    try {
      await getDashboardSummary();
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.status).toBe(0);
    }
  });

  it('does not embed token in the URL', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    await getDashboardSummary('super-secret-token');
    const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(url).not.toContain('super-secret-token');
  });

  it('does not embed token in request body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    await getDashboardSummary('super-secret-token');
    const opts = vi.mocked(globalThis.fetch).mock.calls[0][1];
    expect(opts?.body).toBeUndefined();
  });

  it('does not write response to localStorage', async () => {
    const spySetItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    await getDashboardSummary();
    expect(spySetItem).not.toHaveBeenCalled();
  });

  it('does not write response to sessionStorage', async () => {
    const spySetItem = vi.spyOn(Storage.prototype, 'setItem');
    // Using sessionStorage involves Storage prototype or window.sessionStorage
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    await getDashboardSummary();
    expect(spySetItem).not.toHaveBeenCalled();
  });

  it('does not embed raw backend payload in api error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(500, false, { some_raw_data: 'secret123' }));
    try {
      await getDashboardSummary();
      expect.fail('Should throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(JSON.stringify(e)).not.toContain('secret123');
    }
  });

  it('does not automatically send a second request', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockResponse(200, true, validResponse));
    await getDashboardSummary();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
