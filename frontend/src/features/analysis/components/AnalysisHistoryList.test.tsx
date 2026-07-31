import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisHistoryList } from './AnalysisHistoryList';
import { useAuth } from '../../auth/useAuth';
import { listAnalysisJobs } from '../api';
import { ApiError } from '../../../api/types';
import type { AnalysisJobListItem } from '../types';

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

describe('AnalysisHistoryList', () => {
  const mockToken = 'test-token';

  const mockJob: AnalysisJobListItem = {
    id: 1,
    file_name: 'test.csv',
    file_size: 1024,
    status: 'COMPLETED',
    created_at: '2026-07-31T10:00:00Z',
    completed_at: '2026-07-31T10:01:00Z',
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
    vi.mocked(listAnalysisJobs).mockResolvedValue([mockJob]);
  });

  it('1, 5, 34, 35. Authenticated ANALYST triggers initial API call with correct pagination params and no status', async () => {
    render(<AnalysisHistoryList />);
    await waitFor(() => {
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenCalledWith(
        { skip: 0, limit: 20 },
        mockToken,
        expect.any(AbortSignal)
      );
    });
  });

  it('2. Authenticated ADMIN triggers initial API call', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 2, role: 'ADMIN', username: 'admin', email: 'a@a.com', created_at: '' },
      accessToken: mockToken,
      isAuthenticated: true,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
    render(<AnalysisHistoryList />);
    await waitFor(() => {
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenCalledWith(
        { skip: 0, limit: 20 },
        mockToken,
        expect.any(AbortSignal)
      );
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
  });

  it('3. Unauthenticated user prevents API call', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, accessToken: null, isAuthenticated: false, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    });
    render(<AnalysisHistoryList />);
    await new Promise(r => setTimeout(r, 20));
    expect(vi.mocked(listAnalysisJobs)).not.toHaveBeenCalled();
    expect(screen.queryByText('Analiz geçmişi yükleniyor...')).not.toBeInTheDocument();
  });

  it('4. Authenticated but missing token prevents API call', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: null, isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    });
    render(<AnalysisHistoryList />);
    await new Promise(r => setTimeout(r, 20));
    expect(vi.mocked(listAnalysisJobs)).not.toHaveBeenCalled();
    expect(screen.queryByText('Analiz geçmişi yükleniyor...')).not.toBeInTheDocument();
  });

  it('6, 7, 8, 9, 16. Render jobs safely according to their status without raw errors', async () => {
    const unknownJob: AnalysisJobListItem = { ...mockJob, id: 5 };
    Object.assign(unknownJob, { status: 'UNKNOWN_STATUS' });

    const jobs: AnalysisJobListItem[] = [
      { ...mockJob, id: 1, status: 'PENDING' },
      { ...mockJob, id: 2, status: 'PROCESSING' },
      { ...mockJob, id: 3, status: 'COMPLETED' },
      { ...mockJob, id: 4, status: 'FAILED' },
      unknownJob,
    ];
    vi.mocked(listAnalysisJobs).mockResolvedValue(jobs);
    render(<AnalysisHistoryList />);

    await waitFor(() => {
      const list = screen.getByRole('list');
      expect(within(list).getByText('Bekliyor')).toBeInTheDocument();
      expect(within(list).getByText('İşleniyor')).toBeInTheDocument();
      expect(within(list).getByText('Tamamlandı')).toBeInTheDocument();
      expect(within(list).getByText('Başarısız')).toBeInTheDocument();
      expect(within(list).getByText('Bilinmeyen')).toBeInTheDocument();
    });
  });

  it('10-15, 58, 59. Display job ID/filename safely, hides token and sensitive data', async () => {
    const jobWithSecrets: AnalysisJobListItem = {
       ...mockJob,
       id: 99,
       file_name: '<script>alert(1)</script>malicious.csv',
    };
    Object.assign(jobWithSecrets, { file_hash: 'secret-hash', user_id: 42 });

    vi.mocked(listAnalysisJobs).mockResolvedValue([jobWithSecrets]);
    render(<AnalysisHistoryList />);

    await waitFor(() => {
      expect(screen.getByText('#99')).toBeInTheDocument();
      expect(screen.getByText('<script>alert(1)</script>malicious.csv')).toBeInTheDocument();
      const html = document.body.innerHTML;
      expect(html).not.toContain('secret-hash');
      expect(html).not.toContain(mockToken);
      expect(html).not.toContain('user_id":42');
    });
  });

  it('17, 18. Dates are formatted securely and handle invalid inputs gracefully', async () => {
    const jobs: AnalysisJobListItem[] = [
      { ...mockJob, id: 1, created_at: '2026-07-31T10:00:00Z', completed_at: null },
      { ...mockJob, id: 2, created_at: 'invalid-date', completed_at: 'invalid' },
    ];
    vi.mocked(listAnalysisJobs).mockResolvedValue(jobs);
    render(<AnalysisHistoryList />);

    await waitFor(() => {
      const html = document.body.innerHTML;
      expect(html).not.toContain('Invalid Date');
      expect(screen.getAllByText(/Bilinmiyor/)).toHaveLength(2);
    });
  });

  it('19, 20. Format file sizes and ignore invalid/negative ones', async () => {
    const jobs: AnalysisJobListItem[] = [
      { ...mockJob, id: 1, file_size: 1048576 },
      { ...mockJob, id: 2, file_size: -100 },
      { ...mockJob, id: 3, file_size: NaN },
      { ...mockJob, id: 4, file_size: Infinity },
    ];
    vi.mocked(listAnalysisJobs).mockResolvedValue(jobs);
    render(<AnalysisHistoryList />);

    await waitFor(() => {
      expect(screen.getByText(/1 MB/)).toBeInTheDocument();
      const html = document.body.innerHTML;
      expect(html).not.toContain('-100');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
      expect(screen.getAllByText(/Bilinmiyor/)).toHaveLength(3);
    });
  });

  it('21, 53, 55. Loading aria-busy, Empty State, and role="status"', async () => {
    const deferred = createDeferred<AnalysisJobListItem[]>();
    vi.mocked(listAnalysisJobs).mockReturnValueOnce(deferred.promise);
    render(<AnalysisHistoryList />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Analiz geçmişi yükleniyor...')).toBeInTheDocument();

    const wrapper = screen.getByRole('status').parentElement;
    expect(wrapper).toHaveAttribute('aria-busy', 'true');

    deferred.resolve([]);

    await waitFor(() => {
      expect(screen.getByText('Henüz analiz kaydı bulunmuyor.')).toBeInTheDocument();
      expect(wrapper).toHaveAttribute('aria-busy', 'false');
    });
  });

  it('22-27, 48, 56. Status filters map enum to backend correctly, resetting skip, and aborting previous requests', async () => {
    const deferred1 = createDeferred<AnalysisJobListItem[]>();
    const deferred2 = createDeferred<AnalysisJobListItem[]>();

    let signal1: AbortSignal;
    vi.mocked(listAnalysisJobs).mockImplementationOnce((_p, _t, s) => { signal1 = s!; return deferred1.promise; });

    render(<AnalysisHistoryList />);

    await waitFor(() => expect(vi.mocked(listAnalysisJobs)).toHaveBeenCalledTimes(1));

    vi.mocked(listAnalysisJobs).mockImplementationOnce(() => { return deferred2.promise; });

    const filter = screen.getByLabelText('Durum Filtresi');
    fireEvent.change(filter, { target: { value: 'PENDING' } });

    await waitFor(() => {
      expect(signal1.aborted).toBe(true);
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenLastCalledWith(
        { skip: 0, limit: 20, status: 'PENDING' }, mockToken, expect.any(AbortSignal)
      );
    });

    const filterCases = ['PROCESSING', 'COMPLETED', 'FAILED'];
    for (const st of filterCases) {
      fireEvent.change(filter, { target: { value: st } });
      await waitFor(() => {
         expect(vi.mocked(listAnalysisJobs)).toHaveBeenLastCalledWith(
           { skip: 0, limit: 20, status: st }, mockToken, expect.any(AbortSignal)
         );
      });
    }
  });

  it('28-33, 49. Pagination buttons handle skip increments and disables properly, aborting old requests', async () => {
    const twentyJobs = Array.from({ length: 20 }, (_, i) => ({ ...mockJob, id: i + 1 }));
    vi.mocked(listAnalysisJobs).mockResolvedValue(twentyJobs);

    render(<AnalysisHistoryList />);

    await waitFor(() => {
      expect(screen.getByText('Sayfa 1')).toBeInTheDocument();
    });

    const prevBtn = screen.getByRole('button', { name: 'Önceki' });
    const nextBtn = screen.getByRole('button', { name: 'Sonraki' });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    vi.mocked(listAnalysisJobs).mockResolvedValue([]);
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('Sayfa 2')).toBeInTheDocument();
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenLastCalledWith(
        { skip: 20, limit: 20 }, mockToken, expect.any(AbortSignal)
      );
    });

    expect(nextBtn).toBeDisabled();
    expect(prevBtn).not.toBeDisabled();

    vi.mocked(listAnalysisJobs).mockResolvedValue(twentyJobs);
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getByText('Sayfa 1')).toBeInTheDocument();
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenLastCalledWith(
        { skip: 0, limit: 20 }, mockToken, expect.any(AbortSignal)
      );
    });

    expect(prevBtn).toBeDisabled();
  });

  it('36-38, 57. Manual refresh uses same params, prevents duplicate during load, and recovers from errors', async () => {
    const deferred = createDeferred<AnalysisJobListItem[]>();
    vi.mocked(listAnalysisJobs).mockReturnValueOnce(deferred.promise);

    render(<AnalysisHistoryList />);

    const refreshBtn = screen.getByRole('button', { name: 'Listeyi Yenile' });
    expect(refreshBtn).toBeDisabled();

    deferred.reject(new ApiError(500, { code: 'E', message: 'Fail', details: null }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(refreshBtn).not.toBeDisabled();
    });

    const deferred2 = createDeferred<AnalysisJobListItem[]>();
    vi.mocked(listAnalysisJobs).mockReturnValueOnce(deferred2.promise);

    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(listAnalysisJobs)).toHaveBeenLastCalledWith(
        { skip: 0, limit: 20 }, mockToken, expect.any(AbortSignal)
      );
    });
  });

  it('39-45, 54. Maps errors securely and shows them in role="alert"', async () => {
    const errorCases = [
      { status: 400, expected: 'İstek doğrulanamadı.' },
      { status: 401, expected: 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.' },
      { status: 403, expected: 'Analiz geçmişini görüntüleme yetkiniz bulunmuyor.' },
      { status: 404, expected: 'Analiz geçmişi bulunamadı.' },
      { status: 0, expected: 'Sunucuya şu anda ulaşılamıyor.' },
      { status: 503, expected: 'Analiz geçmişi servisi geçici olarak kullanılamıyor.' },
    ];

    const { unmount } = render(<AnalysisHistoryList />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Listeyi Yenile' })).not.toBeDisabled());

    for (const { status, expected } of errorCases) {
      vi.mocked(listAnalysisJobs).mockRejectedValueOnce(new ApiError(status, { code: 'E', message: 'SECRET_TRACE', details: null }));

      fireEvent.click(screen.getByRole('button', { name: 'Listeyi Yenile' }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(expected);
        expect(alert.textContent).not.toContain('SECRET_TRACE');
      });
    }

    vi.mocked(listAnalysisJobs).mockRejectedValueOnce(new Error('SyntaxError: trace /app/app.js'));
    fireEvent.click(screen.getByRole('button', { name: 'Listeyi Yenile' }));

    await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Analiz geçmişi güvenli biçimde yüklenemedi.');
        expect(alert.textContent).not.toContain('/app/app.js');
    });

    unmount();
  });

  it('46. AbortError is swallowed safely without showing an alert', async () => {
    vi.mocked(listAnalysisJobs).mockRejectedValueOnce(Object.assign(new Error('Abort'), { name: 'AbortError' }));
    render(<AnalysisHistoryList />);

    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('47. Unmount aborts active signal', async () => {
    let activeSignal: AbortSignal | null = null;
    vi.mocked(listAnalysisJobs).mockImplementationOnce((_p, _t, s) => {
      activeSignal = s!;
      return new Promise(() => {});
    });

    const { unmount } = render(<AnalysisHistoryList />);

    await waitFor(() => expect(activeSignal).not.toBeNull());
    unmount();
    expect(activeSignal!.aborted).toBe(true);
  });

  it('50-52, 60. Stale response does not overwrite state or disable loading for new request', async () => {
    const deferred1 = createDeferred<AnalysisJobListItem[]>();
    const deferred2 = createDeferred<AnalysisJobListItem[]>();

    vi.mocked(listAnalysisJobs)
      .mockReturnValueOnce(deferred1.promise)
      .mockReturnValueOnce(deferred2.promise);

    render(<AnalysisHistoryList />);

    fireEvent.change(screen.getByLabelText('Durum Filtresi'), { target: { value: 'COMPLETED' } });

    deferred1.resolve([{ ...mockJob, id: 999 }]);

    await new Promise(r => setTimeout(r, 20));

    expect(screen.getByText('Analiz geçmişi yükleniyor...')).toBeInTheDocument();

    deferred2.resolve([{ ...mockJob, id: 111 }]);

    await waitFor(() => {
      expect(screen.getByText('#111')).toBeInTheDocument();
      expect(screen.queryByText('#999')).not.toBeInTheDocument();
    });
  });

  it('61. Does not create too many live regions when rendering multiple records', async () => {
    const twentyJobs = Array.from({ length: 20 }, (_, i) => ({ ...mockJob, id: i + 1 }));
    vi.mocked(listAnalysisJobs).mockResolvedValue(twentyJobs);

    render(<AnalysisHistoryList />);

    await waitFor(() => {
      const list = screen.getByRole('list');
      expect(within(list).getAllByText('Tamamlandı')).toHaveLength(20);
    });

    const liveRegions = screen.queryAllByRole('status');
    expect(liveRegions.length).toBeLessThanOrEqual(1);
  });
});
