import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listDetectionResults, getAnalysisSummary } from './api';
import { apiClient } from '../../api/client';
import type { DetectionResultPage, AnalysisSummary } from './types';

// Mock the apiClient
vi.mock('../../api/client', () => ({
  apiClient: vi.fn(),
}));

describe('Detections API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockToken = 'mock-test-token';
  const mockAbortController = new AbortController();

  describe('listDetectionResults', () => {
    const mockPage: DetectionResultPage = {
      items: [],
      total: 0,
      skip: 0,
      limit: 50,
    };

    it('1. Parametresiz sonuç isteği doğru endpoint’e gider', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockPage);
      const result = await listDetectionResults(123);

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/results', { method: 'GET', signal: undefined }, undefined);
      expect(result).toBe(mockPage);
    });

    it('2. skip, limit, isAttack ve riskLevel doğru query string’e çevrilir', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockPage);
      await listDetectionResults(123, { skip: 10, limit: 20, isAttack: true, riskLevel: 'HIGH' });

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/results?skip=10&limit=20&is_attack=true&risk_level=HIGH', { method: 'GET', signal: undefined }, undefined);
    });

    it('3. skip: 0 korunur', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockPage);
      await listDetectionResults(123, { skip: 0 });

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/results?skip=0', { method: 'GET', signal: undefined }, undefined);
    });

    it('4. isAttack: false query’ye is_attack=false olarak eklenir', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockPage);
      await listDetectionResults(123, { isAttack: false });

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/results?is_attack=false', { method: 'GET', signal: undefined }, undefined);
    });

    it('5. Token doğru aktarılır', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockPage);
      await listDetectionResults(123, undefined, mockToken);

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/results', { method: 'GET', signal: undefined }, mockToken);
    });

    it('6. AbortSignal doğru aktarılır', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockPage);
      await listDetectionResults(123, undefined, undefined, mockAbortController.signal);

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/results', { method: 'GET', signal: mockAbortController.signal }, undefined);
    });

    it('8. Geçersiz jobId API çağrısı yapmadan reddedilir', async () => {
      await expect(listDetectionResults(0)).rejects.toThrow('Invalid job ID');
      await expect(listDetectionResults(-1)).rejects.toThrow('Invalid job ID');
      await expect(listDetectionResults(1.5)).rejects.toThrow('Invalid job ID');
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('9. Negatif veya kesirli skip reddedilir', async () => {
      await expect(listDetectionResults(123, { skip: -1 })).rejects.toThrow('Invalid skip parameter');
      await expect(listDetectionResults(123, { skip: 1.5 })).rejects.toThrow('Invalid skip parameter');
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('10. 0, 101 veya kesirli limit reddedilir', async () => {
      await expect(listDetectionResults(123, { limit: 0 })).rejects.toThrow('Invalid limit parameter');
      await expect(listDetectionResults(123, { limit: 101 })).rejects.toThrow('Invalid limit parameter');
      await expect(listDetectionResults(123, { limit: 10.5 })).rejects.toThrow('Invalid limit parameter');
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('11. Geçersiz runtime risk seviyesi reddedilir', async () => {
      // @ts-expect-error Testing invalid runtime value
      await expect(listDetectionResults(123, { riskLevel: 'INVALID_RISK' })).rejects.toThrow('Invalid risk level parameter');
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('12. Filtre verilmediğinde gereksiz ? eklenmez', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockPage);
      await listDetectionResults(123, {});

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/results', { method: 'GET', signal: undefined }, undefined);
    });

    it('13. Mock response nesnesi değiştirilmeden döndürülür', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockPage);
      const result = await listDetectionResults(123);

      expect(result).toBe(mockPage);
    });
  });

  describe('getAnalysisSummary', () => {
    const mockSummary: AnalysisSummary = {
      job_id: 123,
      status: 'COMPLETED',
      total_records: 100,
      normal_count: 80,
      attack_count: 20,
      risk_level_counts: { LOW: 0, MEDIUM: 0, HIGH: 10, CRITICAL: 10 },
      completed_at: '2026-08-03T00:00:00Z',
    };

    it('7. Özet isteği doğru endpoint’e gider', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockSummary);
      const result = await getAnalysisSummary(123);

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/summary', { method: 'GET', signal: undefined }, undefined);
      expect(result).toBe(mockSummary);
    });

    it('5. Token doğru aktarılır (getAnalysisSummary)', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockSummary);
      await getAnalysisSummary(123, mockToken);

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/summary', { method: 'GET', signal: undefined }, mockToken);
    });

    it('6. AbortSignal doğru aktarılır (getAnalysisSummary)', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(mockSummary);
      await getAnalysisSummary(123, undefined, mockAbortController.signal);

      expect(apiClient).toHaveBeenCalledWith('/analysis/123/summary', { method: 'GET', signal: mockAbortController.signal }, undefined);
    });

    it('8. Geçersiz jobId API çağrısı yapmadan reddedilir (getAnalysisSummary)', async () => {
      await expect(getAnalysisSummary(0)).rejects.toThrow('Invalid job ID');
      await expect(getAnalysisSummary(-5)).rejects.toThrow('Invalid job ID');
      await expect(getAnalysisSummary(2.5)).rejects.toThrow('Invalid job ID');
      expect(apiClient).not.toHaveBeenCalled();
    });
  });
});
