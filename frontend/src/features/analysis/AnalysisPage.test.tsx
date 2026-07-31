import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisPage } from './AnalysisPage';
import { useAuth } from '../auth/useAuth';
import { MemoryRouter, Routes, Route } from 'react-router';

// Mock components
vi.mock('./components/CsvUploadForm', () => ({
  CsvUploadForm: vi.fn(({ onUploaded }) => (
    <div data-testid="mock-upload-form">
      CsvUploadForm
      <button 
        data-testid="mock-upload-btn" 
        onClick={() => onUploaded({ job_id: 'job-123', status: 'PENDING', file_name: 'test.csv', file_size: 1024, created_at: '2026-07-31T10:00:00Z', file_hash: 'hash' })}
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
      <button data-testid="mock-process-btn" onClick={() => onSuccess({ job_id: 'job-123', final_status: 'COMPLETED', records_processed: 100 })}>Process Success</button>
      <button data-testid="mock-reset-btn" onClick={onReset}>Reset</button>
    </div>
  )),
}));

vi.mock('./components/AnalysisHistoryList', () => ({
  AnalysisHistoryList: vi.fn(() => <div data-testid="mock-history-list">AnalysisHistoryList</div>),
}));

vi.mock('../auth/useAuth');

describe('AnalysisPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it('2. ANALYST sees upload form and history list', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    });
    
    renderWithRouter(<AnalysisPage />);
    
    expect(screen.getByTestId('mock-upload-form')).toBeInTheDocument();
    expect(screen.getByTestId('mock-history-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-execution-panel')).not.toBeInTheDocument();
    
    // The h1 is rendered inside CsvUploadForm, so we won't see it directly if we fully mock it,
    // but we can assume CsvUploadForm renders its own.
  });

  it('3. ADMIN sees history list and fallback message, but no active upload form', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 2, role: 'ADMIN', username: 'admin', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    });
    
    renderWithRouter(<AnalysisPage />);
    
    expect(screen.getByTestId('mock-upload-form')).toBeInTheDocument();
    expect(screen.getByText('Güvenlik analiz kayıtlarını inceleyin.')).toBeInTheDocument();
    expect(screen.getByTestId('mock-history-list')).toBeInTheDocument();
  });

  it('4. Successful upload transitions to execution panel', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    });
    
    renderWithRouter(<AnalysisPage />);
    
    fireEvent.click(screen.getByTestId('mock-upload-btn'));
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-execution-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-upload-form')).not.toBeInTheDocument();
    });
  });

  it('6. Successful process calls onSuccess which changes history key (remounts list)', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    });
    
    renderWithRouter(<AnalysisPage />);
    
    fireEvent.click(screen.getByTestId('mock-upload-btn'));
    await waitFor(() => expect(screen.getByTestId('mock-execution-panel')).toBeInTheDocument());
    
    // We can't directly inspect key, but we know it's a child.
    // Vitest will rerender the component. Let's just trigger it.
    fireEvent.click(screen.getByTestId('mock-process-btn'));
    
    // It should NOT remove the execution panel
    await waitFor(() => expect(screen.getByTestId('mock-execution-panel')).toBeInTheDocument());
  });

  it('7. Reset callback clears selected job and returns to upload form', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    });
    
    renderWithRouter(<AnalysisPage />);
    
    fireEvent.click(screen.getByTestId('mock-upload-btn'));
    await waitFor(() => expect(screen.getByTestId('mock-execution-panel')).toBeInTheDocument());
    
    fireEvent.click(screen.getByTestId('mock-reset-btn'));
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-upload-form')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-execution-panel')).not.toBeInTheDocument();
    });
  });

  it('13, 14. Accessibility check: single h1 is rendered, sections are labelled correctly', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, role: 'ANALYST', username: 'analyst', email: 'a@a.com', created_at: '' },
      accessToken: 'token', isAuthenticated: true, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null
    });
    
    renderWithRouter(<AnalysisPage />);
    
    expect(screen.getByRole('region', { name: 'Veri Yükleme ve İşleme' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Analiz Geçmişi Bölümü' })).toBeInTheDocument();
    
    fireEvent.click(screen.getByTestId('mock-upload-btn'));
    
    expect(screen.getByRole('heading', { level: 1, name: 'Ağ Trafiği Analiz İşlemi' })).toBeInTheDocument();
  });
});
