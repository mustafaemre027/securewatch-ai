import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisExecutionPanel } from './AnalysisExecutionPanel';
import { useAuth } from '../../auth/useAuth';
import { processAnalysisJob } from '../api';
import { ApiError } from '../../../api/types';
import type { AnalysisUploadResponse, AnalysisProcessingResponse } from '../types';

vi.mock('../../auth/useAuth');
vi.mock('../api');

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('AnalysisExecutionPanel', () => {
  const mockOnSuccess = vi.fn();
  const mockOnReset = vi.fn();
  const mockToken = 'test-token';

  const mockJob: AnalysisUploadResponse = {
    job_id: 123,
    file_name: 'test_traffic.csv',
    file_hash: 'secret-hash-123',
    file_size: 1048576, // 1MB
    status: 'PENDING',
    created_at: '2026-07-31T10:00:00Z'
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: mockToken,
      isAuthenticated: true,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
  });

  it('1-3. PENDING render, safe data display, and correct role="status" area', () => {
    render(<AnalysisExecutionPanel job={mockJob} />);

    // File info safely rendered
    expect(screen.getByText('test_traffic.csv')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('#123')).toBeInTheDocument();

    // role="status" is continuous and present on first render
    const statusArea = screen.getByRole('status');
    expect(statusArea).toHaveAttribute('aria-live', 'polite');
    expect(statusArea).toHaveTextContent('Bekliyor');

    // No hash/token leaked
    const html = document.body.innerHTML;
    expect(html).not.toContain('secret-hash-123');
    expect(html).not.toContain(mockToken);
  });

  it('4. API not called before button press', () => {
    render(<AnalysisExecutionPanel job={mockJob} />);
    expect(vi.mocked(processAnalysisJob)).not.toHaveBeenCalled();
  });

  it('5. Valid ANALYST can start process', async () => {
    vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: 123, final_status: 'COMPLETED', records_processed: 10 });
    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    await waitFor(() => expect(vi.mocked(processAnalysisJob)).toHaveBeenCalled());
  });

  it('6. Valid ADMIN can start process', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ADMIN', username: 'admin', email: 'a@a.com', created_at: '' },
      accessToken: mockToken,
      isAuthenticated: true,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
    vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: 123, final_status: 'COMPLETED', records_processed: 10 });
    render(<AnalysisExecutionPanel job={mockJob} />);

    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    await waitFor(() => expect(vi.mocked(processAnalysisJob)).toHaveBeenCalled());
  });

  it('7-8. Unauthenticated or missing token prevents API call', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, accessToken: null, user: null, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null });
    render(<AnalysisExecutionPanel job={mockJob} />);

    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    expect(vi.mocked(processAnalysisJob)).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Oturumunuz geçersiz');
    });
  });

  it('9-10. Process called with correct params and button disabled with PROCESSING state', async () => {
    const deferred = createDeferred<AnalysisProcessingResponse>();
    vi.mocked(processAnalysisJob).mockReturnValue(deferred.promise);

    render(<AnalysisExecutionPanel job={mockJob} />);
    const startButton = screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' });
    fireEvent.click(startButton);

    expect(vi.mocked(processAnalysisJob)).toHaveBeenCalledWith(123, mockToken, expect.any(AbortSignal));

    await waitFor(() => {
      const processingButton = screen.getByRole('button', { name: /İşleniyor.../i });
      expect(processingButton).toBeDisabled();
      const statusArea = screen.getByRole('status');
      expect(statusArea).toHaveTextContent('İşleniyor');
    });

    deferred.resolve({ job_id: 123, final_status: 'COMPLETED', records_processed: 10 });
  });

  it('11. Fast double click causes only 1 API call', async () => {
    const deferred = createDeferred<AnalysisProcessingResponse>();
    vi.mocked(processAnalysisJob).mockReturnValue(deferred.promise);

    render(<AnalysisExecutionPanel job={mockJob} />);
    const startButton = screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' });

    fireEvent.click(startButton);
    fireEvent.click(startButton);

    expect(vi.mocked(processAnalysisJob)).toHaveBeenCalledTimes(1);
    deferred.resolve({ job_id: 123, final_status: 'COMPLETED', records_processed: 10 });
  });

  it('12-14. COMPLETED shows success, records count in same status region, calls callback once', async () => {
    const responseObj: AnalysisProcessingResponse = { job_id: 123, final_status: 'COMPLETED', records_processed: 42 };
    vi.mocked(processAnalysisJob).mockResolvedValueOnce(responseObj);

    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    await waitFor(() => {
      const statusArea = screen.getByRole('status');
      expect(statusArea).toHaveTextContent('Tamamlandı');
      expect(statusArea).toHaveTextContent('İşlenen Kayıt Sayısı: 42');
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnSuccess).toHaveBeenCalledWith(responseObj);
    });
  });

  it('15-16. Unexpected PENDING/PROCESSING final status shows FAILED', async () => {
    vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: 123, final_status: 'PENDING', records_processed: 0 });

    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    await waitFor(() => {
      const statusArea = screen.getByRole('status');
      expect(statusArea).toHaveTextContent('Başarısız');
      expect(screen.getByRole('alert')).toHaveTextContent('Analiz sonucu doğrulanamadı.');
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  it('17-18. Handles error mappings safely and prevents raw leak', async () => {
    const errorCases = [
      { status: 400, expected: 'İstek doğrulanamadı.' },
      { status: 422, expected: 'İstek doğrulanamadı.' },
      { status: 401, expected: 'Oturumunuz geçersiz.' },
      { status: 403, expected: 'Bu işlem için yetkiniz bulunmuyor.' },
      { status: 404, expected: 'Kayıt bulunamadı' },
      { status: 409, expected: 'Analiz mevcut durumunda başlatılamıyor.' },
      { status: 503, expected: 'Analiz servisi geçici olarak kullanılamıyor.' },
      { status: 0, expected: 'Sunucuya ulaşılamıyor.' }
    ];

    const { unmount } = render(<AnalysisExecutionPanel job={mockJob} />);

    for (const { status, expected } of errorCases) {
      vi.mocked(processAnalysisJob).mockRejectedValueOnce(new ApiError(status, { code: 'ERR', message: 'Raw DB Error StackTrace: XYZ', details: null }));

      fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(expected);
        expect(alert.textContent).not.toContain('StackTrace: XYZ');
      });
    }

    unmount();
  });

  it('19. Non-ApiError (ordinary error) rejected safely without sensitive leak', async () => {
    vi.mocked(processAnalysisJob).mockRejectedValueOnce(new Error('Internal raw trace: /usr/bin/python line 5'));

    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Analiz işlemi güvenli biçimde tamamlanamadı.');
      expect(alert.textContent).not.toContain('/usr/bin/python');
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  it('20. Manual retry succeeds after failure without double callback', async () => {
    vi.mocked(processAnalysisJob).mockRejectedValueOnce(new ApiError(500, { code: 'E', message: 'Fail', details: null }));
    const successResponse: AnalysisProcessingResponse = { job_id: 123, final_status: 'COMPLETED', records_processed: 5 };
    vi.mocked(processAnalysisJob).mockResolvedValueOnce(successResponse);

    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Analiz servisi geçici olarak kullanılamıyor.');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Tamamlandı');
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('21. Active signal aborted on component unmount', async () => {
    let activeSignal: AbortSignal | null = null;
    vi.mocked(processAnalysisJob).mockImplementation(async (_id, _token, signal) => {
      if (signal) activeSignal = signal;
      return new Promise<AnalysisProcessingResponse>(() => {});
    });

    const { unmount } = render(<AnalysisExecutionPanel job={mockJob} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    expect(activeSignal).not.toBeNull();
    unmount();

    expect((activeSignal as AbortSignal | null)?.aborted).toBe(true);
  });

  it('22. Job change causes unmount/remount, starts with PENDING and aborts old', async () => {
    let activeSignal: AbortSignal | null = null;
    vi.mocked(processAnalysisJob).mockImplementation(async (_id, _token, signal) => {
      if (signal) activeSignal = signal;
      return new Promise<AnalysisProcessingResponse>(() => {});
    });

    const { rerender } = render(<AnalysisExecutionPanel job={mockJob} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    expect(activeSignal).not.toBeNull();

    const newJob: AnalysisUploadResponse = { ...mockJob, job_id: 999 };
    rerender(<AnalysisExecutionPanel job={newJob} />);

    expect((activeSignal as AbortSignal | null)?.aborted).toBe(true);
    const statusArea = screen.getByRole('status');
    expect(statusArea).toHaveTextContent('Bekliyor');
  });

  it('23. Old job delayed response does not alter new job state', async () => {
    const deferred = createDeferred<AnalysisProcessingResponse>();
    vi.mocked(processAnalysisJob).mockReturnValueOnce(deferred.promise);

    const { rerender } = render(<AnalysisExecutionPanel job={mockJob} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    const newJob: AnalysisUploadResponse = { ...mockJob, job_id: 999, status: 'PENDING' };
    rerender(<AnalysisExecutionPanel job={newJob} />);

    deferred.resolve({ job_id: 123, final_status: 'FAILED', records_processed: 0 });

    await new Promise(r => setTimeout(r, 10));

    const statusArea = screen.getByRole('status');
    expect(statusArea).toHaveTextContent('Bekliyor');
    expect(statusArea).not.toHaveTextContent('Başarısız');
  });

  it('24. Aborted request does not show error to user', async () => {
    vi.mocked(processAnalysisJob).mockRejectedValueOnce(Object.assign(new Error('Abort'), { name: 'AbortError' }));
    render(<AnalysisExecutionPanel job={mockJob} />);

    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    await new Promise(r => setTimeout(r, 10));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('25. No React state update warning on unmount (no leak)', async () => {
    const deferred = createDeferred<AnalysisProcessingResponse>();
    vi.mocked(processAnalysisJob).mockReturnValueOnce(deferred.promise);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<AnalysisExecutionPanel job={mockJob} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    unmount();
    deferred.resolve({ job_id: 123, final_status: 'COMPLETED', records_processed: 10 });

    await new Promise(r => setTimeout(r, 10));
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('26. Backend terminal FAILED disables process button, shows message, no onSuccess', async () => {
    vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: 123, final_status: 'FAILED', records_processed: 0 });
    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);

    const button = screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Başarısız');
      expect(button).toBeDisabled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  it('27. Second process is prevented if status is COMPLETED', async () => {
    render(<AnalysisExecutionPanel job={{ ...mockJob, status: 'COMPLETED' }} />);
    const button = screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(vi.mocked(processAnalysisJob)).not.toHaveBeenCalled();
  });

  it('28. onReset callback works even if job failed', async () => {
    vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: 123, final_status: 'FAILED', records_processed: 0 });
    render(<AnalysisExecutionPanel job={mockJob} onReset={mockOnReset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Başarısız');
    });

    const resetButton = screen.getByRole('button', { name: 'Yeni CSV Yükle' });
    expect(resetButton).not.toBeDisabled();
    fireEvent.click(resetButton);
    expect(mockOnReset).toHaveBeenCalledTimes(1);
  });

  it('29. records_processed validates invalid/negative numbers', async () => {
    const invalidCases = [-5, NaN, Infinity, -Infinity, 10.5];

    const { unmount, rerender } = render(<AnalysisExecutionPanel job={mockJob} />);

    for (let i = 0; i < invalidCases.length; i++) {
      const val = invalidCases[i];
      const currentJobId = mockJob.job_id + i;

      if (i > 0) {
        rerender(<AnalysisExecutionPanel job={{ ...mockJob, job_id: currentJobId }} />);
      }

      vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: currentJobId, final_status: 'COMPLETED', records_processed: val });

      fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Tamamlandı');
        expect(screen.queryByText(/İşlenen Kayıt Sayısı/)).not.toBeInTheDocument();
      });
    }
    unmount();
  });

  it('30. Response job_id cross-check prevents state corruption', async () => {
    vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: 999, final_status: 'COMPLETED', records_processed: 50 });
    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Başarısız');
      expect(screen.getByRole('alert')).toHaveTextContent('Analiz sonucu doğrulanamadı.');
      expect(screen.queryByText(/İşlenen Kayıt Sayısı/)).not.toBeInTheDocument();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });
  it('31. MODEL_NOT_FOUND maps to safe message and prevents leak', async () => {
    vi.mocked(processAnalysisJob).mockRejectedValueOnce(
      new ApiError(404, { code: 'MODEL_NOT_FOUND', message: 'Trace: C:\\Projects\\securewatch-ai\\app\\ml_models\\model.joblib', details: { secret: 'token123' } })
    );

    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);

    const button = screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' });
    fireEvent.click(button);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Analiz modeli şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
      expect(alert.textContent).not.toContain('Kayıt bulunamadı veya bu kayda erişemiyorsunuz.');
      expect(alert.textContent).not.toContain('MODEL_NOT_FOUND');
      expect(alert.textContent).not.toContain('model.joblib');
      expect(alert.textContent).not.toContain('C:\\Projects\\securewatch-ai\\app\\ml_models');
      expect(alert.textContent).not.toContain('Trace');
      expect(alert.textContent).not.toContain('token123');

      expect(button).not.toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent('Bekliyor');
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });
});
