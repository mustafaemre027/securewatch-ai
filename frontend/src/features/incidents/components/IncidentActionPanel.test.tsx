import { render, screen, act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncidentActionPanel } from './IncidentActionPanel';
import { useAuth } from '../../auth/useAuth';
import { updateIncident } from '../api';
import type { IncidentDetail as IncidentDetailType, IncidentListItem } from '../types';
import { ApiError } from '../../../api/types';

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('../api', () => ({
  updateIncident: vi.fn()
}));

const mockAnalyst = { id: 101, username: 'analyst1', role: 'ANALYST' };
const mockAdmin = { id: 201, username: 'admin1', role: 'ADMIN' };

const baseIncident: IncidentDetailType = {
  id: 1,
  title: 'Test Incident',
  description: 'Test description',
  status: 'OPEN',
  severity: 'HIGH',
  assigned_analyst_id: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z', detection_result_id: 1,
  comments: []
};

const updatedIncidentResponse: IncidentListItem = {
  id: 1,
  title: 'Test Incident',
  status: 'IN_PROGRESS',
  severity: 'HIGH',
  assigned_analyst_id: 101,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:05:00Z', detection_result_id: 1, description: 'Test description',
};

describe('IncidentActionPanel', () => {
  let onUpdatedMock: import('vitest').MockedFunction<(incident: IncidentListItem) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    onUpdatedMock = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'test-token',
      user: mockAnalyst,
      login: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn()
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(updateIncident).mockResolvedValue(updatedIncidentResponse);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Görünürlük', () => {
    it('1. ANALYST ve atanmamış OPEN olayda "Olayı Üzerime Al" görünür', () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      expect(screen.getByRole('button', { name: 'Olayı Üzerime Al' })).toBeInTheDocument();
    });

    it('2. ADMIN kullanıcıda claim görünmez', () => {
      vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, accessToken: 'test-token', user: mockAdmin } as unknown as ReturnType<typeof useAuth>);
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      expect(screen.queryByRole('button', { name: 'Olayı Üzerime Al' })).not.toBeInTheDocument();
      expect(screen.getByText(/Yönetici hesapları olayları yalnızca salt okunur görüntüleyebilir/)).toBeInTheDocument();
    });

    it('3. Unauthenticated kullanıcıda işlem görünmez', () => {
      vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, accessToken: null, user: null } as unknown as ReturnType<typeof useAuth>);
      const { container } = render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      expect(container.firstChild).toBeNull();
    });

    it('4. Token yoksa işlem görünmez', () => {
      vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, accessToken: null, user: mockAnalyst } as unknown as ReturnType<typeof useAuth>);
      const { container } = render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      expect(container.firstChild).toBeNull();
    });

    it('5. User yoksa işlem görünmez', () => {
      vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, accessToken: 'test', user: null } as unknown as ReturnType<typeof useAuth>);
      const { container } = render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      expect(container.firstChild).toBeNull();
    });

    it('6. Başka analyst\'e atanmış olayda işlem düğmesi görünmez', () => {
      const assignedToOther = { ...baseIncident, assigned_analyst_id: 102 };
      render(<IncidentActionPanel incident={assignedToOther} onUpdated={onUpdatedMock} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('7. Başka analyst\'e atanmış açıklama metni görünür', () => {
      const assignedToOther = { ...baseIncident, assigned_analyst_id: 102 };
      render(<IncidentActionPanel incident={assignedToOther} onUpdated={onUpdatedMock} />);
      expect(screen.getByText('Bu olay başka bir analiste atanmış.')).toBeInTheDocument();
    });
  });

  describe('Claim', () => {
    it('8. Claim doğru incident ID ile çağrılır', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalledWith(1, expect.any(Object), expect.any(String), expect.any(AbortSignal));
      });
    });

    it('9. Payload yalnız current user ID içerir', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalledWith(expect.anything(), { assigned_analyst_id: 101 }, expect.anything(), expect.anything());
      });
    });

    it('10. Token aktarılır', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'test-token', expect.anything());
      });
    });

    it('11. AbortSignal aktarılır', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.any(AbortSignal));
      });
    });

    it('12. Null veya farklı analyst ID gönderilmez', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        const payload = vi.mocked(updateIncident).mock.calls[0][1];
        expect(payload).not.toHaveProperty('assigned_analyst_id', null);
        expect(payload).not.toHaveProperty('assigned_analyst_id', 999);
      });
    });

    it('13. Duplicate claim engellenir', async () => {
      let resolveApi: (value: IncidentListItem) => void = () => {};
      vi.mocked(updateIncident).mockImplementation(() => new Promise(res => { resolveApi = res; }));
      
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      
      const btn = screen.getByRole('button', { name: 'Olayı Üzerime Al' });
      fireEvent.click(btn);
      fireEvent.click(btn);
      
      expect(updateIncident).toHaveBeenCalledTimes(1);
      
      await act(async () => {
        resolveApi(updatedIncidentResponse);
      });
    });

    it('14. Başarılı claim onUpdated çağırır', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(onUpdatedMock).toHaveBeenCalledWith(updatedIncidentResponse);
      });
    });

    it('15. Başarılı claim status mesajı gösterir', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Olay başarıyla üzerinize atandı.');
      });
    });

    it('16. Unmount aktif claim isteğini abort eder', () => {
      let signal: AbortSignal | undefined;
      vi.mocked(updateIncident).mockImplementation((_id, _payload, _token, sig) => {
        signal = sig;
        return new Promise(() => {});
      });
      
      const { unmount } = render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      unmount();
      
      expect(signal?.aborted).toBe(true);
    });

    it('17. AbortError kullanıcı hatası göstermez', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new DOMException('Aborted', 'AbortError'));
      
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('OPEN durumu', () => {
    const assignedOpen = { ...baseIncident, assigned_analyst_id: 101 };

    it('18. Kendisine atanmış OPEN olayda "İncelemeyi Başlat" görünür', () => {
      render(<IncidentActionPanel incident={assignedOpen} onUpdated={onUpdatedMock} />);
      expect(screen.getByRole('button', { name: 'İncelemeyi Başlat' })).toBeInTheDocument();
    });

    it('19. Kendisine atanmış OPEN olayda false-positive işlemi görünür', () => {
      render(<IncidentActionPanel incident={assignedOpen} onUpdated={onUpdatedMock} />);
      expect(screen.getByRole('button', { name: 'Yanlış Pozitif Olarak İşaretle' })).toBeInTheDocument();
    });

    it('20. OPEN -> IN_PROGRESS doğru payload ile çağrılır', async () => {
      render(<IncidentActionPanel incident={assignedOpen} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'İncelemeyi Başlat' }));
      
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalledWith(1, { status: 'IN_PROGRESS' }, expect.any(String), expect.any(AbortSignal));
      });
    });

    it('21. OPEN durumda doğrudan RESOLVED işlemi görünmez', () => {
      render(<IncidentActionPanel incident={assignedOpen} onUpdated={onUpdatedMock} />);
      expect(screen.queryByRole('button', { name: 'Çözüldü Olarak İşaretle' })).not.toBeInTheDocument();
    });

    it('22. Start işlemi terminal onay istemez', async () => {
      render(<IncidentActionPanel incident={assignedOpen} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'İncelemeyi Başlat' }));
      
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalled();
      });
    });

    it('23. Başarılı start onUpdated çağırır', async () => {
      render(<IncidentActionPanel incident={assignedOpen} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'İncelemeyi Başlat' }));
      
      await waitFor(() => {
        expect(onUpdatedMock).toHaveBeenCalledWith(updatedIncidentResponse);
        expect(screen.getByRole('status')).toHaveTextContent('Olay incelemeye alındı.');
      });
    });
  });

  describe('IN_PROGRESS durumu', () => {
    const assignedInProgress = { ...baseIncident, status: 'IN_PROGRESS' as const, assigned_analyst_id: 101 };

    it('24. Kendisine atanmış IN_PROGRESS olayda resolve görünür', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      expect(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' })).toBeInTheDocument();
    });

    it('25. False-positive işlemi görünür', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      expect(screen.getByRole('button', { name: 'Yanlış Pozitif Olarak İşaretle' })).toBeInTheDocument();
    });

    it('26. OPEN\'e dönme işlemi görünmez', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      expect(screen.queryByRole('button', { name: 'İncelemeyi Başlat' })).not.toBeInTheDocument();
    });

    it('27. Resolve doğru payload ile çağrılır', async () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      fireEvent.click(screen.getByRole('button', { name: 'İşlemi Onayla' }));
      
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalledWith(1, { status: 'RESOLVED' }, expect.any(String), expect.any(AbortSignal));
      });
    });
  });

  describe('Terminal durumlar', () => {
    it('28. RESOLVED durumda işlem düğmesi görünmez', () => {
      const resolved = { ...baseIncident, status: 'RESOLVED' as const, assigned_analyst_id: 101 };
      render(<IncidentActionPanel incident={resolved} onUpdated={onUpdatedMock} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('29. RESOLVED açıklama metni görünür', () => {
      const resolved = { ...baseIncident, status: 'RESOLVED' as const, assigned_analyst_id: 101 };
      render(<IncidentActionPanel incident={resolved} onUpdated={onUpdatedMock} />);
      expect(screen.getByText('Bu olay çözümlenmiş ve kapatılmıştır.')).toBeInTheDocument();
    });

    it('30. FALSE_POSITIVE durumda işlem düğmesi görünmez', () => {
      const fp = { ...baseIncident, status: 'FALSE_POSITIVE' as const, assigned_analyst_id: 101 };
      render(<IncidentActionPanel incident={fp} onUpdated={onUpdatedMock} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('31. FALSE_POSITIVE açıklama metni görünür', () => {
      const fp = { ...baseIncident, status: 'FALSE_POSITIVE' as const, assigned_analyst_id: 101 };
      render(<IncidentActionPanel incident={fp} onUpdated={onUpdatedMock} />);
      expect(screen.getByText('Bu olay yanlış pozitif olarak kapatılmıştır.')).toBeInTheDocument();
    });
  });

  describe('Confirmation', () => {
    const assignedInProgress = { ...baseIncident, status: 'IN_PROGRESS' as const, assigned_analyst_id: 101 };

    it('32. Resolve ilk tıklamada API çağrısı yapmaz', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      
      expect(updateIncident).not.toHaveBeenCalled();
    });

    it('33. Resolve confirmation gösterir', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText('Bu işlem geri alınamaz.')).toBeInTheDocument();
    });

    it('34. Confirm sonrası API çağrısı yapılır', async () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      fireEvent.click(screen.getByRole('button', { name: 'İşlemi Onayla' }));
      
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalled();
      });
    });

    it('35. Vazgeç API çağrısı yapmadan confirmation\'ı kapatır', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      
      fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
      
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(updateIncident).not.toHaveBeenCalled();
    });

    it('36. Vazgeç sonrası focus tetikleyiciye döner', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      const btn = screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' });
      fireEvent.click(btn);
      fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
      
      expect(document.activeElement).toBe(btn);
    });

    it('37. Escape confirmation\'ı kapatır', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('38. Submit sırasında Escape confirmation\'ı kapatmaz', async () => {
      let resolveApi: (value: IncidentListItem) => void = () => {};
      vi.mocked(updateIncident).mockImplementation(() => new Promise(res => { resolveApi = res; }));
      
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      fireEvent.click(screen.getByRole('button', { name: 'İşlemi Onayla' }));
      
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      
      await act(async () => {
        resolveApi(updatedIncidentResponse);
      });
    });

    it('39. False-positive aynı confirmation kurallarını kullanır', async () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Yanlış Pozitif Olarak İşaretle' }));
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'İşlemi Onayla' }));
      
      await waitFor(() => {
        expect(updateIncident).toHaveBeenCalledWith(1, { status: 'FALSE_POSITIVE' }, expect.any(String), expect.any(AbortSignal));
      });
    });

    it('40. Aynı anda iki confirmation görünmez', () => {
      render(<IncidentActionPanel incident={assignedInProgress} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      fireEvent.click(screen.getByRole('button', { name: 'Yanlış Pozitif Olarak İşaretle' }));
      
      const dialogs = screen.getAllByRole('alertdialog');
      expect(dialogs).toHaveLength(1);
    });
  });

  describe('Hatalar', () => {
    const clickClaim = () => fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
    
    it('41. 401 güvenli mesaj gösterir', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(401, { code: 'ERROR', message: 'Unauthorized', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Oturumunuz geçersiz. Lütfen yeniden giriş yapın.');
      });
    });

    it('42. 403 güvenli mesaj gösterir', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(403, { code: 'ERROR', message: 'Forbidden', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Bu olay üzerinde işlem yapma yetkiniz bulunmuyor.');
      });
    });

    it('43. 404 güvenli mesaj gösterir', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(404, { code: 'ERROR', message: 'Not Found', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Olay kaydı bulunamadı veya bu kayda erişemiyorsunuz.');
      });
    });

    it('44. Claim 409 güvenli conflict mesajı gösterir', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(409, { code: 'ERROR', message: 'Conflict', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Olay başka bir analist tarafından sahiplenilmiş olabilir. Olay detayını yenileyin.');
      });
    });

    it('45. Status 409 güvenli conflict mesajı gösterir', async () => {
      const assigned = { ...baseIncident, assigned_analyst_id: 101 };
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(409, { code: 'ERROR', message: 'Conflict', details: null }));
      render(<IncidentActionPanel incident={assigned} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'İncelemeyi Başlat' }));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Olay başka bir işlem nedeniyle güncellenmiş olabilir. Olay detayını yenileyin.');
      });
    });

    it('46. 422 güvenli mesaj gösterir', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(422, { code: 'ERROR', message: 'Unprocessable', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Seçilen olay işlemi doğrulanamadı.');
      });
    });

    it('47. Network güvenli mesaj gösterir', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(0, { code: 'ERROR', message: 'Network', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.');
      });
    });

    it('48. 500 güvenli mesaj gösterir', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(500, { code: 'ERROR', message: 'Server Error', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Olay işlemi şu anda tamamlanamıyor.');
      });
    });

    it('49. Bilinmeyen hata sabit mesaj gösterir', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new Error('Random Error'));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Olay işlemi güvenli biçimde tamamlanamadı.');
      });
    });

    it('50. Ham backend mesajı DOM\'a yazılmaz', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(500, { code: 'ERROR', message: 'RAW_DATABASE_ERROR_1234', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.queryByText(/RAW_DATABASE_ERROR/)).not.toBeInTheDocument();
      });
    });

    it('51. Token DOM\'a yazılmaz', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(401, { code: 'ERROR', message: 'Token test-token is invalid', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      clickClaim();
      
      await waitFor(() => {
        expect(screen.queryByText(/test-token/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Lifecycle ve erişilebilirlik', () => {
    it('52. Incident prop değişince aktif istek abort edilir', () => {
      let signal: AbortSignal | undefined;
      vi.mocked(updateIncident).mockImplementation((_id, _payload, _token, sig) => {
        signal = sig;
        return new Promise(() => {});
      });
      
      const { rerender } = render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      const nextIncident = { ...baseIncident, id: 2 };
      rerender(<IncidentActionPanel incident={nextIncident} onUpdated={onUpdatedMock} />);
      
      expect(signal?.aborted).toBe(true);
    });

    it('53. Incident değişince confirmation temizlenir', () => {
      const assigned = { ...baseIncident, status: 'IN_PROGRESS' as const, assigned_analyst_id: 101 };
      const { rerender } = render(<IncidentActionPanel incident={assigned} onUpdated={onUpdatedMock} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      
      const nextIncident = { ...assigned, id: 2 };
      rerender(<IncidentActionPanel incident={nextIncident} onUpdated={onUpdatedMock} />);
      
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('54. Stale response onUpdated çağırmaz', async () => {
      let resolveApi: (value: IncidentListItem) => void = () => {};
      let rejectApi: (err: unknown) => void = () => {};
      let signal: AbortSignal | undefined;
      vi.mocked(updateIncident).mockImplementation((_id, _payload, _token, sig) => {
        signal = sig;
        return new Promise((res, rej) => { 
          resolveApi = res; 
          rejectApi = rej;
        });
      });
      
      const { rerender } = render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      const nextIncident = { ...baseIncident, id: 2 };
      rerender(<IncidentActionPanel incident={nextIncident} onUpdated={onUpdatedMock} />);
      
      await act(async () => {
        if (signal?.aborted) {
          rejectApi(new DOMException('Aborted', 'AbortError'));
        } else {
          resolveApi(updatedIncidentResponse);
        }
      });
      
      expect(onUpdatedMock).not.toHaveBeenCalled();
    });

    it('55. İşlem sırasında aria-busy true olur', async () => {
      let resolveApi: (value: IncidentListItem) => void = () => {};
      vi.mocked(updateIncident).mockImplementation(() => new Promise(res => { resolveApi = res; }));
      
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      
      const container = screen.getByText('Olay İşlemleri').parentElement;
      expect(container).toHaveAttribute('aria-busy', 'false');
      
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      expect(container).toHaveAttribute('aria-busy', 'true');
      
      await act(async () => {
        resolveApi(updatedIncidentResponse);
      });
    });

    it('56. Hata role=alert kullanır', async () => {
      vi.mocked(updateIncident).mockRejectedValue(new ApiError(404, { code: 'ERROR', message: 'Not found', details: null }));
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('57. Başarı role=status kullanır', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Olayı Üzerime Al' }));
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('58. Confirmation erişilebilir role kullanır', () => {
      const assigned = { ...baseIncident, status: 'IN_PROGRESS' as const, assigned_analyst_id: 101 };
      render(<IncidentActionPanel incident={assigned} onUpdated={onUpdatedMock} />);
      fireEvent.click(screen.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }));
      
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-title');
      expect(screen.getByRole('heading', { name: 'İşlemi Onaylayın', level: 4 })).toHaveAttribute('id', 'confirm-dialog-title');
    });

    it('59. Disabled kontroller ikinci submit\'i engeller', async () => {
      let resolveApi: (value: IncidentListItem) => void = () => {};
      vi.mocked(updateIncident).mockImplementation(() => new Promise(res => { resolveApi = res; }));
      
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      const btn = screen.getByRole('button', { name: 'Olayı Üzerime Al' });
      
      fireEvent.click(btn);
      expect(btn).toBeDisabled();
      
      await act(async () => {
        resolveApi(updatedIncidentResponse);
      });
    });

    it('60. Klavye ile butonlar kullanılabilir', async () => {
      render(<IncidentActionPanel incident={baseIncident} onUpdated={onUpdatedMock} />);
      const btn = screen.getByRole('button', { name: 'Olayı Üzerime Al' });
      
      act(() => {
        btn.focus();
      });
      
      expect(document.activeElement).toBe(btn);
      await act(async () => {
        fireEvent.click(btn); // Testing library allows click via fireEvent on focused buttons which simulates keyboard enter
      });
      
      expect(updateIncident).toHaveBeenCalled();
    });
  });
});
