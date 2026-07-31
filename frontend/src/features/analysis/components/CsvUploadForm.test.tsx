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

  const createMockFile = (name: string, size: number, type: string) => {
    const file = new File([''], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

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
    expect(screen.getByLabelText(/CSV dosyası seçin/i)).toBeInTheDocument();
    expect(screen.getByText('Doğrulanmış Analizi Başlat ve Karar Desteği Üret')).toBeInTheDocument();
  });

  it('4. Prevents submit without file', () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const submitButton = screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret/i });
    expect(submitButton).toBeDisabled();
  });

  it('5. Rejects file with invalid extension', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    const file = createMockFile('test.txt', 100, 'text/plain');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Yalnızca CSV dosyaları yüklenebilir.');
    });
    
    const submitButton = screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret/i });
    expect(submitButton).toBeDisabled();
  });

  it('6. Accepts case-insensitive .CSV extension', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    const file = createMockFile('TEST.CSV', 1024, 'text/csv');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('TEST.CSV')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('7. Rejects empty file', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    const file = createMockFile('empty.csv', 0, 'text/csv');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Boş CSV dosyaları yüklenemez.');
    });
  });

  it('8. Rejects file larger than 50 MB', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    const file = createMockFile('large.csv', 51 * 1024 * 1024, 'text/csv');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('CSV dosyası en fazla 50 MB olabilir.');
    });
  });

  it('9. Supports drag and drop', async () => {
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const dropzone = screen.getByTestId('dropzone');
    const file = createMockFile('dragged.csv', 1024, 'text/csv');
    
    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toContain('border-cyber-cyan');
    
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] }
    });
    
    await waitFor(() => {
      expect(screen.getByText('dragged.csv')).toBeInTheDocument();
    });
  });

  it('10. Submits valid file and calls onUploaded with correct token and signal', async () => {
    const mockResponse = { job_id: 1, file_name: 'valid.csv', file_hash: 'abc', file_size: 1024, created_at: '', status: 'PENDING' as const };
    vi.mocked(uploadAnalysisCsv).mockResolvedValueOnce(mockResponse);
    
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    const file = createMockFile('valid.csv', 1024, 'text/csv');
    fireEvent.change(input, { target: { files: [file] } });
    
    const submitButton = screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    
    fireEvent.click(submitButton);
    
    expect(screen.getByRole('button', { name: /Yükleniyor.../i })).toBeDisabled();
    
    await waitFor(() => {
      expect(vi.mocked(uploadAnalysisCsv)).toHaveBeenCalledWith(file, mockToken, expect.any(AbortSignal));
      expect(mockOnUploaded).toHaveBeenCalledWith(mockResponse);
    });
  });

  it('11. Handles validation error from API securely (422)', async () => {
    vi.mocked(uploadAnalysisCsv).mockRejectedValueOnce(new ApiError(422, { code: 'VAL', message: 'Raw error', details: null }));
    
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile('valid.csv', 1024, 'text/csv')] } });
    
    const submitButton = screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('CSV dosyası doğrulanamadı. Dosya biçimini kontrol edin.');
      expect(alert).not.toHaveTextContent('Raw error');
    });
  });

  it('12. Handles duplicate upload error (409)', async () => {
    vi.mocked(uploadAnalysisCsv).mockRejectedValueOnce(new ApiError(409, { code: 'DUP', message: 'Already exists', details: null }));
    
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile('valid.csv', 1024, 'text/csv')] } });
    
    const submitButton = screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Bu CSV dosyası daha önce yüklenmiş.');
    });
  });

  it('13. Does not leak sensitive information in DOM on unexpected error', async () => {
    vi.mocked(uploadAnalysisCsv).mockRejectedValueOnce(new Error('My secret stack trace /home/user'));
    
    render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile('valid.csv', 1024, 'text/csv')] } });
    
    const submitButton = screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret/i });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('CSV yükleme işlemi başarısız oldu. Lütfen tekrar deneyin.');
      expect(alert.textContent).not.toContain('secret stack trace');
      expect(alert.textContent).not.toContain(mockToken);
    });
  });

  it('14. Aborts request on unmount', () => {
    let abortSignal: AbortSignal | null = null;
    vi.mocked(uploadAnalysisCsv).mockImplementation((_file: File, _token: string | null | undefined, signal?: AbortSignal) => {
      if (signal) abortSignal = signal;
      return new Promise(() => {}); // never resolves
    });
    
    const { unmount } = render(<CsvUploadForm onUploaded={mockOnUploaded} />);
    
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [createMockFile('valid.csv', 1024, 'text/csv')] } });
    
    const submitButton = screen.getByRole('button', { name: /Doğrulanmış Analizi Başlat ve Karar Desteği Üret/i });
    fireEvent.click(submitButton);
    
    unmount();
    
    expect((abortSignal as AbortSignal | null)?.aborted).toBe(true);
  });
});
