import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DashboardPage } from './DashboardPage';
import { getDashboardSummary } from './api';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../../api/types';
import type { DashboardSummaryResponse } from './types';

vi.mock('../auth/useAuth');
vi.mock('./api');
vi.mock('./components/DashboardSummaryCards', () => ({
  DashboardSummaryCards: () => <div data-testid="dashboard-summary-cards" />
}));

const mockSummary: DashboardSummaryResponse = {
  generated_at: '2026-08-05T12:00:00Z',
  analysis_summary: {
    total_jobs: 10,
    status_distribution: { PENDING: 0, PROCESSING: 0, COMPLETED: 10, FAILED: 0 },
    completed_jobs: 10,
  },
  detection_summary: {
    total_detections: 100,
    benign_count: 90,
    attack_count: 10,
  },
  detection_class_distribution: { benign: 90, attack: 10 },
  risk_distribution: { LOW: 10, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  incident_summary: {
    total_incidents: 5,
    status_distribution: { OPEN: 2, IN_PROGRESS: 1, RESOLVED: 2, FALSE_POSITIVE: 0 },
    severity_distribution: { LOW: 1, MEDIUM: 1, HIGH: 2, CRITICAL: 1 },
  },
  trend_7_days: [],
  recent_detections: [],
  recent_incidents: [],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'test-token',
      user: null,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
  });

  it('renders loading state initially', () => {
    vi.mocked(getDashboardSummary).mockImplementation(() => new Promise(() => {}));
    
    render(<DashboardPage />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Dashboard verileri yükleniyor...')).toBeInTheDocument();
  });

  it('renders error state when not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      accessToken: null,
      user: null,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
    
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Oturum bilgisi bulunamadı.')).toBeInTheDocument();
  });

  it('renders summary cards when API call is successful', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(mockSummary);
    
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-cards')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders error state and retry button when API fails', async () => {
    const error = new ApiError(500, { code: 'SERVER_ERROR', message: 'Server error', details: null });
    vi.mocked(getDashboardSummary).mockRejectedValue(error);
    
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Dashboard hizmeti geçici olarak kullanılamıyor.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument();
  });

  it('retries API call when retry button is clicked', async () => {
    const user = userEvent.setup();
    const error = new ApiError(500, { code: 'SERVER_ERROR', message: 'Server error', details: null });
    vi.mocked(getDashboardSummary)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(mockSummary);
    
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    
    const retryButton = screen.getByRole('button', { name: 'Tekrar Dene' });
    await user.click(retryButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary-cards')).toBeInTheDocument();
    });
    expect(vi.mocked(getDashboardSummary)).toHaveBeenCalledTimes(2);
  });
});
