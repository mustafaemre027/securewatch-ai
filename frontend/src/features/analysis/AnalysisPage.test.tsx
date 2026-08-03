import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisPage } from './AnalysisPage';
import { useAuth } from '../auth/useAuth';
import { MemoryRouter, Routes, Route } from 'react-router';

const mockHistoryMount = vi.fn();
const mockHistoryUnmount = vi.fn();

// Mock components
vi.mock('./components/CsvUploadForm', () => ({
  CsvUploadForm: vi.fn(({ onUploaded }) => (
    <div data-testid="mock-upload-form">
      CsvUploadForm
      <button
        data-testid="mock-upload-btn"
        onClick={() => onUploaded({ job_id: 123, status: 'PENDING', file_name: 'test.csv', file_size: 1024, created_at: '2026-07-31T10:00:00Z', file_hash: 'hash' })}
      >
        Upload Success
      </button>
    </div>
  )),
}));

vi.mock('./components/AnalysisExecutionPanel', () => ({
  AnalysisExecutionPanel: vi.fn(({ onSuccess, onReset }) => (
    <div data-testid="mock-execution-panel">
      AnalysisExecutionPanel
      <button data-testid="mock-process-btn" onClick={() => onSuccess({ job_id: 123, final_status: 'COMPLETED', records_processed: 100 })}>Process Success</button>
      <button data-testid="mock-process-fail-btn" onClick={() => { /* Does nothing on failure */ }}>Process Fail</button>
      <button data-testid="mock-reset-btn" onClick={onReset}>Reset</button>
    </div>
  )),
}));

vi.mock('./components/AnalysisHistoryList', () => ({
  AnalysisHistoryList: vi.fn(() => {
    useEffect(() => {
      mockHistoryMount();
      return () => { mockHistoryUnmount(); };
    }, []);
    return <div data-testid="mock-history-list">AnalysisHistoryList</div>;
  }),
}));

vi.mock('../auth/useAuth');

describe('AnalysisPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={ui} />
        </Routes>
      </MemoryRouter>
    );
  };

  const getH1s = () => screen.queryAllByRole('heading', { level: 1 });

  it('2. ANALYST sees upload form and history list, exactly one h1', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter(<AnalysisPage />);

    expect(screen.getByTestId('mock-upload-form')).toBeInTheDocument();
    expect(screen.getByTestId('mock-history-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-execution-panel')).not.toBeInTheDocument();

    expect(getH1s()).toHaveLength(1);
    expect(getH1s()[0]).toHaveTextContent('Analiz İşlemleri');
  });

  it('3. ADMIN sees history list and fallback message, exactly one h1', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 2, role: 'ADMIN', username: 'admin', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter(<AnalysisPage />);

    expect(screen.getByTestId('mock-upload-form')).toBeInTheDocument();
    expect(screen.getByText('Güvenlik analiz kayıtlarını inceleyin.')).toBeInTheDocument();
    expect(screen.getByTestId('mock-history-list')).toBeInTheDocument();

    expect(getH1s()).toHaveLength(1);
    expect(getH1s()[0]).toHaveTextContent('Analiz İşlemleri');
  });

  it('4. Successful upload transitions to execution panel, exactly one h1', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter(<AnalysisPage />);

    act(() => {
      fireEvent.click(screen.getByTestId('mock-upload-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-execution-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-upload-form')).not.toBeInTheDocument();
    });

    expect(getH1s()).toHaveLength(1);
  });

  it('6. Successful process calls onSuccess which changes history key (remounts list)', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter(<AnalysisPage />);

    // Initial mount
    expect(mockHistoryMount).toHaveBeenCalledTimes(1);
    expect(mockHistoryUnmount).toHaveBeenCalledTimes(0);

    act(() => {
      fireEvent.click(screen.getByTestId('mock-upload-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('mock-execution-panel')).toBeInTheDocument());

    // Upload should not remount history
    expect(mockHistoryMount).toHaveBeenCalledTimes(1);
    expect(mockHistoryUnmount).toHaveBeenCalledTimes(0);

    act(() => {
      fireEvent.click(screen.getByTestId('mock-process-btn'));
    });

    // Unmount and mount again
    await waitFor(() => {
      expect(mockHistoryUnmount).toHaveBeenCalledTimes(1);
      expect(mockHistoryMount).toHaveBeenCalledTimes(2);
    });
  });

  it('8. Unsuccessful process does NOT remount history list', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter(<AnalysisPage />);

    act(() => {
      fireEvent.click(screen.getByTestId('mock-upload-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('mock-execution-panel')).toBeInTheDocument());

    expect(mockHistoryMount).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(screen.getByTestId('mock-process-fail-btn'));
    });

    // Still 1 mount, 0 unmounts
    expect(mockHistoryMount).toHaveBeenCalledTimes(1);
    expect(mockHistoryUnmount).toHaveBeenCalledTimes(0);
  });

  it('7. Reset callback clears selected job and returns to upload form, exactly one h1', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter(<AnalysisPage />);

    act(() => {
      fireEvent.click(screen.getByTestId('mock-upload-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('mock-execution-panel')).toBeInTheDocument());

    act(() => {
      fireEvent.click(screen.getByTestId('mock-reset-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-upload-form')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-execution-panel')).not.toBeInTheDocument();
    });

    expect(getH1s()).toHaveLength(1);
  });

  it('13, 14. Accessibility check: sections are labelled correctly', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter(<AnalysisPage />);

    expect(screen.getByRole('region', { name: 'Veri Yükleme ve İşleme' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Analiz Geçmişi Bölümü' })).toBeInTheDocument();
  });
});
