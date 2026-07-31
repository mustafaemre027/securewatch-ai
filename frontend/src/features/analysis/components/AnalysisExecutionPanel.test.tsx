import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisExecutionPanel } from './AnalysisExecutionPanel';
import { useAuth } from '../../auth/useAuth';
import { processAnalysisJob } from '../api';
import { ApiError } from '../../../api/types';
import type { AnalysisUploadResponse, AnalysisJobStatus } from '../types';

vi.mock('../../auth/useAuth');
vi.mock('../api');

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

  it('1-3. PENDING job rendered securely with correct data', () => {
    render(<AnalysisExecutionPanel job={mockJob} />);
    
    // 2. DOSYA ADI, BOYUTU, JOB NO
    expect(screen.getByText('test_traffic.csv')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('#123')).toBeInTheDocument();
    
    // 1. PENDING status safely rendered
    expect(screen.getByText('Bekliyor')).toBeInTheDocument();
    
    // 3. NO hash/token leaked
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

  it('9-10. Process function called with correct params and button disabled with PROCESSING state', async () => {
    let resolveApi: (value: any) => void;
    const promise = new Promise(resolve => { resolveApi = resolve; });
    vi.mocked(processAnalysisJob).mockReturnValue(promise as any);
    
    render(<AnalysisExecutionPanel job={mockJob} />);
    const startButton = screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' });
    fireEvent.click(startButton);
    
    expect(vi.mocked(processAnalysisJob)).toHaveBeenCalledWith(123, mockToken, expect.any(AbortSignal));
    
    await waitFor(() => {
      const processingButton = screen.getByRole('button', { name: /İşleniyor.../i });
      expect(processingButton).toBeDisabled();
      expect(screen.getByText('İşleniyor')).toBeInTheDocument();
    });
    
    resolveApi!({ job_id: 123, final_status: 'COMPLETED', records_processed: 10 });
  });

  it('11. Fast double click causes only 1 API call', async () => {
    let resolveApi: (value: any) => void;
    const promise = new Promise(resolve => { resolveApi = resolve; });
    vi.mocked(processAnalysisJob).mockReturnValue(promise as any);
    
    render(<AnalysisExecutionPanel job={mockJob} />);
    const startButton = screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' });
    
    fireEvent.click(startButton);
    fireEvent.click(startButton); // second synchronous click
    
    expect(vi.mocked(processAnalysisJob)).toHaveBeenCalledTimes(1);
    resolveApi!({ job_id: 123, final_status: 'COMPLETED', records_processed: 10 });
  });

  it('12-14. COMPLETED shows success, records count, and calls callback once', async () => {
    const responseObj = { job_id: 123, final_status: 'COMPLETED' as AnalysisJobStatus, records_processed: 42 };
    vi.mocked(processAnalysisJob).mockResolvedValueOnce(responseObj);
    
    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Analiz başarıyla tamamlandı');
      expect(screen.getByText('İşlenen Kayıt Sayısı: 42')).toBeInTheDocument();
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnSuccess).toHaveBeenCalledWith(responseObj);
    });
  });

  it('15-16. Unexpected PENDING/PROCESSING final status shows FAILED and safe error', async () => {
    vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: 123, final_status: 'PENDING', records_processed: 0 });
    
    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    await waitFor(() => {
      expect(screen.getByText('Başarısız')).toBeInTheDocument();
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

  it('19-20. Manual retry succeeds after failure without double callback', async () => {
    vi.mocked(processAnalysisJob).mockRejectedValueOnce(new ApiError(500, { code: 'E', message: 'Fail', details: null }));
    const successResponse = { job_id: 123, final_status: 'COMPLETED' as const, records_processed: 5 };
    vi.mocked(processAnalysisJob).mockResolvedValueOnce(successResponse);
    
    render(<AnalysisExecutionPanel job={mockJob} onSuccess={mockOnSuccess} />);
    
    // First try (Fail)
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Analiz servisi geçici olarak kullanılamıyor.');
    });
    expect(mockOnSuccess).not.toHaveBeenCalled(); // 20. no callback on fail
    
    // Second try (Success)
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Analiz başarıyla tamamlandı.');
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('21. Active signal aborted on unmount', async () => {
    let activeSignal: AbortSignal | null = null;
    vi.mocked(processAnalysisJob).mockImplementation((_id: number, _token: string | null | undefined, signal?: AbortSignal) => {
      if (signal) activeSignal = signal;
      return new Promise(() => {});
    });
    
    const { unmount } = render(<AnalysisExecutionPanel job={mockJob} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    expect(activeSignal).not.toBeNull();
    unmount();
    
    expect((activeSignal as AbortSignal | null)?.aborted).toBe(true);
  });

  it('22. Request aborted when job prop changes', () => {
    let activeSignal: AbortSignal | null = null;
    vi.mocked(processAnalysisJob).mockImplementation((_id: number, _token: string | null | undefined, signal?: AbortSignal) => {
      if (signal) activeSignal = signal;
      return new Promise(() => {});
    });
    
    const { rerender } = render(<AnalysisExecutionPanel job={mockJob} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    expect(activeSignal).not.toBeNull();
    
    const newJob: AnalysisUploadResponse = { ...mockJob, job_id: 999 };
    rerender(<AnalysisExecutionPanel job={newJob} />);
    
    expect((activeSignal as AbortSignal | null)?.aborted).toBe(true);
  });

  it('23. Old job delayed response does not alter new job state', async () => {
    let resolveFirstApi: (value: any) => void;
    vi.mocked(processAnalysisJob).mockReturnValueOnce(new Promise(r => { resolveFirstApi = r; }));
    
    const { rerender } = render(<AnalysisExecutionPanel job={mockJob} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    // Change job
    const newJob: AnalysisUploadResponse = { ...mockJob, job_id: 999, status: 'PENDING' };
    rerender(<AnalysisExecutionPanel job={newJob} />);
    
    // Resolve old job after it was aborted/unmounted conceptually
    resolveFirstApi!({ job_id: 123, final_status: 'FAILED', records_processed: 0 });
    
    // Give it a tick
    await new Promise(r => setTimeout(r, 10));
    
    // State should still be PENDING from new job, not FAILED from old response
    expect(screen.getByText('Bekliyor')).toBeInTheDocument();
    expect(screen.queryByText('Başarısız')).not.toBeInTheDocument();
  });

  it('24. Aborted request does not show error to user', async () => {
    vi.mocked(processAnalysisJob).mockRejectedValueOnce(Object.assign(new Error('Abort'), { name: 'AbortError' }));
    render(<AnalysisExecutionPanel job={mockJob} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    await new Promise(r => setTimeout(r, 10));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('25. No React state update warning on unmount', async () => {
    let resolveApi: (value: any) => void;
    vi.mocked(processAnalysisJob).mockReturnValueOnce(new Promise(r => { resolveApi = r; }));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { unmount } = render(<AnalysisExecutionPanel job={mockJob} />);
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    unmount();
    resolveApi!({ job_id: 123, final_status: 'COMPLETED', records_processed: 10 });
    
    await new Promise(r => setTimeout(r, 10));
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('26. ARIA roles are correct', async () => {
    vi.mocked(processAnalysisJob).mockRejectedValueOnce(new ApiError(404, { code: 'ERR', message: 'Fail', details: null }));
    render(<AnalysisExecutionPanel job={mockJob} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('27. Second process is prevented if status is COMPLETED', async () => {
    render(<AnalysisExecutionPanel job={{ ...mockJob, status: 'COMPLETED' }} />);
    const button = screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' });
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(vi.mocked(processAnalysisJob)).not.toHaveBeenCalled();
  });

  it('28. onReset callback works', () => {
    render(<AnalysisExecutionPanel job={mockJob} onReset={mockOnReset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Yeni CSV Yükle' }));
    expect(mockOnReset).toHaveBeenCalledTimes(1);
  });

  it('29. Negative/invalid records count not shown', async () => {
    vi.mocked(processAnalysisJob).mockResolvedValueOnce({ job_id: 123, final_status: 'COMPLETED', records_processed: -5 });
    render(<AnalysisExecutionPanel job={mockJob} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Analiz başarıyla tamamlandı.');
      expect(screen.queryByText(/İşlenen Kayıt Sayısı/)).not.toBeInTheDocument(); // should not show negative
    });
  });

  it('30. Old state cleared on job prop change', async () => {
    vi.mocked(processAnalysisJob).mockRejectedValueOnce(new ApiError(404, { code: 'ERR', message: 'Fail', details: null }));
    const { rerender } = render(<AnalysisExecutionPanel job={mockJob} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulanmış Analizi Başlat' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Kayıt bulunamadı');
    });
    
    const newJob: AnalysisUploadResponse = { ...mockJob, job_id: 999, status: 'PENDING' };
    rerender(<AnalysisExecutionPanel job={newJob} />);
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Bekliyor')).toBeInTheDocument();
  });
});
