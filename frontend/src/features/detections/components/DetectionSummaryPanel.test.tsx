import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DetectionSummaryPanel } from './DetectionSummaryPanel';
import { getAnalysisSummary } from '../api';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../../api/types';
import type { AnalysisSummary } from '../types';

vi.mock('../api', () => ({
  getAnalysisSummary: vi.fn(),
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('DetectionSummaryPanel', () => {
  const mockToken = 'mock-safe-token';
  const validSummary: AnalysisSummary = {
    job_id: 123,
    status: 'COMPLETED',
    total_records: 100,
    normal_count: 80,
    attack_count: 20,
    risk_level_counts: {
      LOW: 50,
      MEDIUM: 20,
      HIGH: 20,
      CRITICAL: 10,
    },
    completed_at: '2026-08-03T00:00:00Z',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: mockToken,
      user: null,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('1. Geçerli oturumda mount sırasında doğru jobId, token ve AbortSignal ile API çağrılır', async () => {
    vi.mocked(getAnalysisSummary).mockReturnValue(new Promise(() => {}));

    render(<DetectionSummaryPanel jobId={123} />);

    expect(getAnalysisSummary).toHaveBeenCalledTimes(1);
    expect(getAnalysisSummary).toHaveBeenCalledWith(123, mockToken, expect.any(AbortSignal));
  });

  it('2. Loading durumu ve aria-busy gösterilir', async () => {
    vi.mocked(getAnalysisSummary).mockReturnValue(new Promise(() => {}));

    render(<DetectionSummaryPanel jobId={123} />);

    const loadingEl = screen.getByRole('status');
    expect(loadingEl).toBeInTheDocument();
    expect(loadingEl).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Analiz özeti yükleniyor...')).toBeInTheDocument();
  });

  it('3 & 4. Geçerli özet bütün toplam ve risk sayılarını ve risk metinlerini gösterir', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce(validSummary);

    render(<DetectionSummaryPanel jobId={123} />);

    await waitFor(() => {
      expect(screen.queryByText('Analiz özeti yükleniyor...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);

    expect(screen.getByText('Düşük')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();

    expect(screen.getByText('Orta')).toBeInTheDocument();

    expect(screen.getByText('Yüksek')).toBeInTheDocument();

    expect(screen.getByText('Kritik')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('5. Eksik authentication API çağrısını engeller', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      accessToken: null,
      user: null,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });

    render(<DetectionSummaryPanel jobId={123} />);
    expect(getAnalysisSummary).not.toHaveBeenCalled();
  });

  it('6. Eksik token API çağrısını engeller', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: null,
      user: null,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });

    render(<DetectionSummaryPanel jobId={123} />);
    expect(getAnalysisSummary).not.toHaveBeenCalled();
  });

  const testErrorMapping = async (status: number, code: string, expectedMessage: string) => {
    vi.mocked(getAnalysisSummary).mockRejectedValueOnce(
      new ApiError(status, { code, message: 'Backend Message', details: 'Stack trace etc' })
    );

    render(<DetectionSummaryPanel jobId={123} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(expectedMessage)).toBeInTheDocument();
    expect(screen.queryByText('Backend Message')).not.toBeInTheDocument();
    expect(screen.queryByText('Stack trace etc')).not.toBeInTheDocument();
  };

  it('7. 404 + NOT_FOUND güvenli mesaja eşlenir', () =>
    testErrorMapping(404, 'NOT_FOUND', 'Analiz kaydı bulunamadı veya bu kayda erişemiyorsunuz.')
  );

  it('8. 409 + NOT_COMPLETED güvenli mesaja eşlenir', () =>
    testErrorMapping(409, 'NOT_COMPLETED', 'Analiz özeti henüz hazır değil.')
  );

  it('9. 401 + TOKEN_EXPIRED güvenli mesaja eşlenir', () =>
    testErrorMapping(401, 'TOKEN_EXPIRED', 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.')
  );

  it('10. 403 + PERMISSION_DENIED güvenli mesaja eşlenir', () =>
    testErrorMapping(403, 'PERMISSION_DENIED', 'Bu analiz özetini görüntüleme yetkiniz bulunmuyor.')
  );

  it('11. 0 + NETWORK_ERROR güvenli mesaja eşlenir', () =>
    testErrorMapping(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.')
  );

  it('13. Sadece status eşleşip code farklıysa özel business mesajı kullanılmaz', () =>
    testErrorMapping(404, 'SOME_OTHER_ERROR', 'Analiz özeti güvenli biçimde yüklenemedi.')
  );

  it('14. Bilinmeyen hata güvenli fallback gösterir', () =>
    testErrorMapping(500, 'INTERNAL_SERVER_ERROR', 'Analiz özeti geçici olarak kullanılamıyor.')
  );

  it('15. job_id uyuşmazlığı response’u reddeder', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({ ...validSummary, job_id: 999 });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByText('Analiz özeti doğrulanamadı.')).toBeInTheDocument());
  });

  it('16. status !== COMPLETED response’u reddeder', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({ ...validSummary, status: 'FAILED' });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByText('Analiz özeti doğrulanamadı.')).toBeInTheDocument());
  });

  it('17. Negatif sayılar reddedilir', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({ ...validSummary, total_records: -100 });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByText('Analiz özeti doğrulanamadı.')).toBeInTheDocument());
  });

  it('17. NaN sayılar reddedilir', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({ ...validSummary, total_records: NaN });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByText('Analiz özeti doğrulanamadı.')).toBeInTheDocument());
  });

  it('17. Infinity sayılar reddedilir', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({ ...validSummary, total_records: Infinity });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByText('Analiz özeti doğrulanamadı.')).toBeInTheDocument());
  });

  it('17. Kesirli sayılar reddedilir', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({ ...validSummary, total_records: 100.5 });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByText('Analiz özeti doğrulanamadı.')).toBeInTheDocument());
  });

  it('18. Normal+saldırı toplamı uyuşmazsa response reddedilir', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({ ...validSummary, normal_count: 50, attack_count: 50, total_records: 101 });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByText('Analiz özeti doğrulanamadı.')).toBeInTheDocument());
  });

  it('19. Risk seviyesi toplamı uyuşmazsa response reddedilir', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({
      ...validSummary,
      risk_level_counts: { LOW: 10, MEDIUM: 5, HIGH: 3, CRITICAL: 10 }
    });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByText('Analiz özeti doğrulanamadı.')).toBeInTheDocument());
  });

  it('20. Sıfır kayıtlı geçerli özet doğru gösterilir', async () => {
    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({
      job_id: 123, status: 'COMPLETED', total_records: 0, normal_count: 0, attack_count: 0,
      risk_level_counts: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }, completed_at: null
    });
    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Analiz özeti doğrulanamadı.')).not.toBeInTheDocument();
  });

  it('21. Unmount aktif isteği abort eder', () => {
    vi.mocked(getAnalysisSummary).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<DetectionSummaryPanel jobId={123} />);

    unmount();

    const abortSignal = vi.mocked(getAnalysisSummary).mock.calls[0][2];
    expect(abortSignal?.aborted).toBe(true);
  });

  it('22. jobId değişimi eski isteği abort eder', () => {
    vi.mocked(getAnalysisSummary).mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<DetectionSummaryPanel jobId={123} />);

    const firstCallSignal = vi.mocked(getAnalysisSummary).mock.calls[0][2];
    expect(firstCallSignal?.aborted).toBe(false);

    rerender(<DetectionSummaryPanel jobId={124} />);

    expect(firstCallSignal?.aborted).toBe(true);
    const secondCallSignal = vi.mocked(getAnalysisSummary).mock.calls[1][2];
    expect(secondCallSignal?.aborted).toBe(false);
  });

  it('23. Eski job response’u yeni job state’ini değiştirmez', async () => {
    let resolveFirst: (v: AnalysisSummary) => void;
    vi.mocked(getAnalysisSummary).mockImplementationOnce(() => new Promise((resolve) => {
      resolveFirst = resolve;
    }));

    const { rerender } = render(<DetectionSummaryPanel jobId={123} />);

    vi.mocked(getAnalysisSummary).mockResolvedValueOnce({ ...validSummary, job_id: 124 });
    rerender(<DetectionSummaryPanel jobId={124} />);

    resolveFirst!({ ...validSummary, job_id: 123 });

    await waitFor(() => {
      expect(screen.getByText('#124')).toBeInTheDocument();
    });

    expect(screen.queryByText('#123')).not.toBeInTheDocument();
  });

  it('24. Abort edilen istek hata mesajı göstermez', async () => {
    vi.mocked(getAnalysisSummary).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    render(<DetectionSummaryPanel jobId={123} />);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('25. Retry başarısızlıktan sonra başarıyla tamamlanabilir', async () => {
    vi.mocked(getAnalysisSummary).mockRejectedValue(new ApiError(0, { code: 'NETWORK_ERROR', message: 'Err', details: null }));

    render(<DetectionSummaryPanel jobId={123} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    vi.mocked(getAnalysisSummary).mockResolvedValue(validSummary);
    const retryBtn = screen.getByText('Tekrar Dene');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  it('26. Hızlı çift retry yalnızca tek yeni çağrı yapar', async () => {
    vi.mocked(getAnalysisSummary).mockRejectedValue(new ApiError(0, { code: 'NETWORK_ERROR', message: 'Err', details: null }));

    render(<DetectionSummaryPanel jobId={123} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const initialCalls = vi.mocked(getAnalysisSummary).mock.calls.length;

    vi.mocked(getAnalysisSummary).mockReturnValue(new Promise(() => {}));

    const retryBtn = screen.getByText('Tekrar Dene');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);

    expect(getAnalysisSummary).toHaveBeenCalledTimes(initialCalls + 1);
  });

  it('27. Test tokenı ve hassas mock değerleri DOM’da bulunmaz', async () => {
    vi.mocked(getAnalysisSummary).mockRejectedValueOnce(
      new ApiError(500, { code: 'ERR', message: 'mock-safe-token secret', details: 'password123' })
    );

    render(<DetectionSummaryPanel jobId={123} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    expect(screen.queryByText(/mock-safe-token/)).not.toBeInTheDocument();
    expect(screen.queryByText(/password123/)).not.toBeInTheDocument();
  });
});
