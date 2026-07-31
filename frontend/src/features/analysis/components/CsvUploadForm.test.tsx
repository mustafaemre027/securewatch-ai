import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsvUploadForm } from './CsvUploadForm';
import { useAuth } from '../../auth/useAuth';
import { uploadAnalysisCsv } from '../api';
import { ApiError } from '../../../api/types';

vi.mock('../../auth/useAuth');
vi.mock('../api');

describe('CsvUploadForm', () => {
  const mockOnUploaded = vi.fn();
  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'testanalyst', email: 'test@test.com', created_at: '' },
      accessToken: mockToken,
      isAuthenticated: true,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
  });

  const createMockFile = (name: string, size: number, type: string = 'text/csv') => {
    const file = new File([''], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  const getSubmitButton = () => screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret|Yükleniyor.../i });

  it('1. Renders error message when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, accessToken: null, user: null, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null });
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);

    expect(screen.getByRole('alert')).toHaveTextContent('CSV yüklemek için geçerli bir oturum gereklidir.');
    expect(screen.queryByTestId('dropzone')).not.toBeInTheDocument();
  });

  it('2. Renders info message for ADMIN users', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: mockToken,
      user: { id: 1, role: 'ADMIN', username: 'admin', email: 'admin@test.com', created_at: '' },
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);

    expect(screen.getByRole('alert')).toHaveTextContent('CSV yükleme işlemi yalnızca güvenlik analistleri tarafından gerçekleştirilebilir.');
    expect(screen.queryByTestId('dropzone')).not.toBeInTheDocument();
  });

  it('3. Renders form for ANALYST users', () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    expect(screen.getByTestId('dropzone')).toBeInTheDocument();
  });

  it('4. Prevents submit without file and does not call API', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    const submitButton = getSubmitButton();
    expect(submitButton).toBeDisabled();

    // forcefully click
    fireEvent.click(submitButton);
    expect(vi.mocked(uploadAnalysisCsv)).not.toHaveBeenCalled();
  });

  it('5. Rejects file with invalid extension (.csv.exe)', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile('test.csv.exe', 100)] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Yalnızca CSV dosyaları yüklenebilir.');
    });
    expect(getSubmitButton()).toBeDisabled();
    expect(vi.mocked(uploadAnalysisCsv)).not.toHaveBeenCalled();
  });

  it('6. Accepts case-insensitive .CSV extension', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile('TEST.CSV', 1024)] } });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('TEST.CSV')).toBeInTheDocument();
    });
    expect(getSubmitButton()).not.toBeDisabled();
  });

  it('7. Rejects empty file', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile('empty.csv', 0)] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Boş CSV dosyaları yüklenemez.');
    });
  });

  it('8. Accepts exactly 50MB and rejects 50MB + 1 byte', async () => {
    const { unmount } = render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    const input = screen.getByTestId('file-input');

    // Exactly 50MB
    const exact50 = 50 * 1024 * 1024;
    fireEvent.change(input, { target: { files: [createMockFile('exact50.csv', exact50)] } });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(getSubmitButton()).not.toBeDisabled();
    });

    unmount();
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);

    const input2 = screen.getByTestId('file-input');

    // 50MB + 1 byte
    fireEvent.change(input2, { target: { files: [createMockFile('large.csv', exact50 + 1)] } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('CSV dosyası en fazla 50 MB olabilir.');
    });
  });

  it('9. Supports drag and drop', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    const dropzone = screen.getByTestId('dropzone');
    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toContain('border-cyber-cyan');

    fireEvent.drop(dropzone, { dataTransfer: { files: [createMockFile('dragged.csv', 1024)] } });

    await waitFor(() => {
      expect(screen.getByText('dragged.csv')).toBeInTheDocument();
    });
  });

  it('10. Submits valid file, calls onUploaded, renders success status', async () => {
    const mockResponse = { job_id: 1, file_name: 'valid.csv', file_hash: 'abc', file_size: 1024, created_at: '', status: 'PENDING' as const };
    vi.mocked(uploadAnalysisCsv).mockResolvedValueOnce(mockResponse);

    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [createMockFile('valid.csv', 1024)] } });

    const submitButton = getSubmitButton();
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(vi.mocked(uploadAnalysisCsv)).toHaveBeenCalledWith(expect.any(File), mockToken, expect.any(AbortSignal));
      expect(mockOnUploaded).toHaveBeenCalledWith(mockResponse);
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('CSV dosyası başarıyla yüklendi.');
      expect(status.textContent).not.toContain('abc'); // file hash is not leaked
    });
  });

  it('11. Prevents duplicate submit synchronously', async () => {
    let resolveApi: (value: unknown) => void;
    const promise = new Promise(resolve => { resolveApi = resolve; });
    vi.mocked(uploadAnalysisCsv).mockImplementation(() => promise as Promise<unknown> as ReturnType<typeof uploadAnalysisCsv>);

    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [createMockFile('dup.csv', 1024)] } });

    const submitButton = getSubmitButton();
    await waitFor(() => expect(submitButton).not.toBeDisabled());

    // Simulate double click synchronously (before React re-renders with disabled)
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(vi.mocked(uploadAnalysisCsv)).toHaveBeenCalledTimes(1);

    resolveApi!({ job_id: 1, file_name: 'dup.csv', file_hash: 'h', file_size: 1024, created_at: '', status: 'PENDING' });
  });

  it('12. Supports retry after failure', async () => {
    vi.mocked(uploadAnalysisCsv).mockRejectedValueOnce(new ApiError(500, { code: 'ERR', message: 'Fail', details: null }));
    const mockResponse = { job_id: 2, file_name: 'retry.csv', file_hash: 'abc', file_size: 1024, created_at: '', status: 'PENDING' as const };
    vi.mocked(uploadAnalysisCsv).mockResolvedValueOnce(mockResponse);

    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [createMockFile('retry.csv', 1024)] } });

    const submitButton = getSubmitButton();
    await waitFor(() => expect(submitButton).not.toBeDisabled());

    fireEvent.click(submitButton); // 1st try

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Sunucuya şu anda ulaşılamıyor.');
    });

    expect(getSubmitButton()).not.toBeDisabled();

    fireEvent.click(getSubmitButton()); // 2nd try

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('CSV dosyası başarıyla yüklendi.');
      expect(mockOnUploaded).toHaveBeenCalledTimes(1); // Only called on success
    });
  });

  it('13. Handles specific error codes safely (400/401/403/409/413/422/503/0)', async () => {
    const errorCases = [
      { status: 400, expected: 'CSV dosyası doğrulanamadı. Dosya biçimini kontrol edin.' },
      { status: 422, expected: 'CSV dosyası doğrulanamadı. Dosya biçimini kontrol edin.' },
      { status: 401, expected: 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.' },
      { status: 403, expected: 'Bu işlem için yetkiniz bulunmuyor.' },
      { status: 409, expected: 'Bu CSV dosyası daha önce yüklenmiş.' },
      { status: 413, expected: 'CSV dosyası izin verilen boyut sınırını aşıyor.' },
      { status: 503, expected: 'Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.' },
      { status: 0, expected: 'Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.' },
    ];

    const { unmount } = render(<CsvUploadForm onUploaded={mockOnUploaded} />);

    for (const { status, expected } of errorCases) {
      vi.mocked(uploadAnalysisCsv).mockRejectedValueOnce(new ApiError(status, { code: 'ERR', message: 'Raw Error from Backend', details: null }));

      fireEvent.change(screen.getByTestId('file-input'), { target: { files: [createMockFile('err.csv', 1024)] } });
      const submitButton = getSubmitButton();
      await waitFor(() => expect(submitButton).not.toBeDisabled());
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(expected);
        expect(alert.textContent).not.toContain('Raw Error');
      });
    }

    unmount();
  });

  it('14. Does not leak sensitive information on unexpected Error', async () => {
    vi.mocked(uploadAnalysisCsv).mockRejectedValueOnce(new Error('My secret stack trace /home/user'));

    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [createMockFile('valid.csv', 1024)] } });

    const submitButton = getSubmitButton();
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('CSV yükleme işlemi başarısız oldu. Lütfen tekrar deneyin.');
      expect(alert.textContent).not.toContain('secret stack trace');
    });
  });

  it('15. Aborts request on unmount and prevents state update', async () => {
    let abortSignal: AbortSignal | null = null;
    vi.mocked(uploadAnalysisCsv).mockImplementation((_file: File, _token: string | null | undefined, signal?: AbortSignal) => {
      if (signal) abortSignal = signal;
      return new Promise(() => {}); // never resolves
    });

    // We mock console.error to catch any "state update on unmounted component" warnings
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<CsvUploadForm onUploaded={mockOnUploaded} />);

    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [createMockFile('valid.csv', 1024)] } });
    const submitButton = getSubmitButton();
    fireEvent.click(submitButton);

    expect(abortSignal).not.toBeNull();

    unmount();

    expect((abortSignal as AbortSignal | null)?.aborted).toBe(true);

    // Give it a tick to ensure no state updates happen after unmount
    await new Promise(r => setTimeout(r, 10));

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
