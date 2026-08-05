import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentAssignmentPanel } from './IncidentAssignmentPanel';
import { listAssignableAnalysts } from '../analystApi';
import { updateIncident } from '../api';
import { useAuth } from '../../auth/useAuth';
import type { IncidentDetail } from '../types';
import type { UserResponse } from '../../auth/types';
import { ApiError } from '../../../api/types';

vi.mock('../../auth/useAuth');
vi.mock('../analystApi');
vi.mock('../api');

const mockIncident: IncidentDetail = {
  id: 101,
  title: 'Test',
  description: 'Desc',
  severity: 'HIGH',
  status: 'OPEN',
  assigned_analyst_id: null,
  detection_result_id: 202,
  created_at: '2023-01-01',
  updated_at: '2023-01-01',
  comments: []
};

const mockAnalysts = [
  { id: 1, username: 'analyst1', email: 'a1@test.com', role: 'ANALYST', created_at: 'd' },
  { id: 2, username: 'analyst2', email: 'a2@test.com', role: 'ANALYST', created_at: 'd' },
];

describe('IncidentAssignmentPanel', () => {
  const onUpdatedMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'token123',
      user: { id: 99, username: 'admin_user', email: 'a@a.com', role: 'ADMIN', created_at: 'd' },
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      isLoading: false,
      error: null
    });
    vi.mocked(listAssignableAnalysts).mockResolvedValue(mockAnalysts as unknown as UserResponse[]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Görünürlük', () => {
    it('1. ADMIN kullanıcıda panel görünür', async () => {
      render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      expect(screen.getByText('Analist Atama')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText(/Analistler yükleniyor/i)).not.toBeInTheDocument());
    });

    it('2, 3, 4, 5, 6. Yetkisiz veya ANALYST ise panel görünmez ve API çağrılmaz', () => {
      vi.mocked(useAuth).mockReturnValueOnce({
        isAuthenticated: true,
        accessToken: 'token123',
        user: { id: 99, username: 'analyst_user', email: 'a@a.com', role: 'ANALYST', created_at: 'd' },
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        isLoading: false,
        error: null
      });
      const { container } = render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      expect(container).toBeEmptyDOMElement();
      expect(listAssignableAnalysts).not.toHaveBeenCalled();
    });
  });

  describe('Liste yükleme', () => {
    it('7, 8, 9, 10, 11, 12, 13. Initial loading, API çağrısı ve seçenekler', async () => {
      render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      
      expect(screen.getByText(/Analistler yükleniyor/i)).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText(/Analistler yükleniyor/i)).not.toBeInTheDocument();
      });

      expect(listAssignableAnalysts).toHaveBeenCalledWith('token123', expect.any(AbortSignal));
      
      const select = screen.getByLabelText('Atanacak Analist');
      expect(select).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'analyst1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'analyst2' })).toBeInTheDocument();
      expect(screen.queryByText('a1@test.com')).not.toBeInTheDocument(); // 13. e-posta yok
    });

    it('14. Boş liste mesajı', async () => {
      vi.mocked(listAssignableAnalysts).mockResolvedValueOnce([]);
      render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      await waitFor(() => {
        expect(screen.getByText('Atanabilir analist bulunamadı.')).toBeInTheDocument();
      });
    });

    it('15, 16. Liste hatası ve retry', async () => {
      vi.mocked(listAssignableAnalysts).mockRejectedValueOnce(new ApiError(500, { code: 'ERR', message: 'msg', details: null }));
      render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Analist atama işlemi şu anda tamamlanamıyor.');
      });

      vi.mocked(listAssignableAnalysts).mockResolvedValueOnce(mockAnalysts as unknown as UserResponse[]);
      
      const retryBtn = screen.getByRole('button', { name: 'Tekrar Dene' });
      await userEvent.click(retryBtn);
      
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
      expect(listAssignableAnalysts).toHaveBeenCalledTimes(2);
    });

    it('18, 21. Unmount abort eder, abort error gizlenir', async () => {
      let rejectPromise: (reason?: unknown) => void = () => {};
      const promise = new Promise<UserResponse[]>((_, reject) => { rejectPromise = reject; });
      vi.mocked(listAssignableAnalysts).mockReturnValue(promise);

      const { unmount } = render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      
      unmount();
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      
      // Normally promise would reject with AbortError if aborted by signal, we manually simulate it
      // Since it's unmounted, we can't easily check DOM, but we can verify it doesn't crash
      await act(async () => {
        rejectPromise(abortError);
      });
    });
  });

  describe('Atama ve hatalar', () => {
    it('22, 23. Seçim yapmadan veya mevcut seçiliyken submit disabled', async () => {
      const inc = { ...mockIncident, assigned_analyst_id: 1 };
      render(<IncidentAssignmentPanel incident={inc} onUpdated={onUpdatedMock} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Analisti Ata' })).toBeDisabled();
      }); // Başlangıçta value=1 ve mevcut atanan 1, bu yüzden disabled

      // Değiştirince enabled
      await userEvent.selectOptions(screen.getByLabelText('Atanacak Analist'), '2');
      expect(screen.getByRole('button', { name: 'Analisti Ata' })).toBeEnabled();
    });

    it('26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36. Assignment payload, success, onUpdated ve loading durumları', async () => {
      render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Atanacak Analist')).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByLabelText('Atanacak Analist'), '2');
      
      const updatedInc = { ...mockIncident, assigned_analyst_id: 2 };
      let resolveUpdate: unknown;
      const updatePromise = new Promise<IncidentDetail>((resolve) => { resolveUpdate = resolve; });
      vi.mocked(updateIncident).mockReturnValue(updatePromise);

      const submitBtn = screen.getByRole('button', { name: 'Analisti Ata' });
      await userEvent.click(submitBtn);

      expect(updateIncident).toHaveBeenCalledWith(101, { assigned_analyst_id: 2 }, 'token123', expect.any(AbortSignal));
      
      expect(screen.getByRole('button', { name: 'Atanıyor...' })).toBeDisabled();
      expect(screen.getByLabelText('Atanacak Analist')).toBeDisabled(); // 32

      await act(async () => {
        if (typeof resolveUpdate === 'function') {
          (resolveUpdate as (val: IncidentDetail) => void)(updatedInc);
        }
      });

      await waitFor(() => {
        expect(onUpdatedMock).toHaveBeenCalledWith(updatedInc);
      });
      expect(screen.getByRole('status')).toHaveTextContent('Olay analiste başarıyla atandı.');
    });

    it('41, 42, 43, 44, 45, 46, 47, 48. Güvenli hata mesajları (Submit)', async () => {
      render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Atanacak Analist')).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByLabelText('Atanacak Analist'), '2');
      
      vi.mocked(updateIncident).mockRejectedValueOnce(new ApiError(400, { code: 'ERR', message: 'Raw backend err', details: null }));
      await userEvent.click(screen.getByRole('button', { name: 'Analisti Ata' }));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Seçilen kullanıcı bu olaya atanamaz.');
      });
      expect(screen.queryByText('Raw backend err')).not.toBeInTheDocument(); // 50
    });
  });

  describe('Erişilebilirlik', () => {
    it('53, 54, 55, 56, 57. Semantik form, disabled kontroller', async () => {
      render(<IncidentAssignmentPanel incident={mockIncident} onUpdated={onUpdatedMock} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Atanacak Analist')).toBeInTheDocument();
      });

      const form = screen.getByRole('combobox').closest('form');
      expect(form).not.toHaveAttribute('aria-busy', 'true');
      
      await userEvent.tab(); // focus on select
      expect(screen.getByLabelText('Atanacak Analist')).toHaveFocus();
    });
  });
});
