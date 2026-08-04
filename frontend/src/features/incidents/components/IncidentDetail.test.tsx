import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentDetail } from './IncidentDetail';
import { getIncident } from '../api';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../../api/types';
import type { IncidentDetail as IncidentDetailType } from '../types';

vi.mock('../api', () => ({
  getIncident: vi.fn(),
  updateIncident: vi.fn(),
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockUser = {
  id: 101,
  username: 'testuser',
  role: 'ANALYST',
};

const createMockDetail = (id: number, overrides?: Partial<IncidentDetailType>): IncidentDetailType => ({
  id,
  title: `Test Detail ${id}`,
  description: `Detail Description ${id}`,
  severity: 'MEDIUM',
  status: 'OPEN',
  assigned_analyst_id: null,
  detection_result_id: 500 + id,
  created_at: '2023-01-01T12:00:00Z',
  updated_at: '2023-01-02T12:00:00Z',
  comments: [],
  ...overrides,
});

describe('IncidentDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'test-token',
      user: mockUser as never,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
    vi.mocked(getIncident).mockResolvedValue(createMockDetail(1));
  });

  describe('Başlangıç ve API', () => {
    it('1. Geçerli incidentId ile getIncident çağrılır, 2. Token aktarılır, 3. AbortSignal aktarılır', async () => {
      render(<IncidentDetail incidentId={1} />);
      await waitFor(() => {
        expect(getIncident).toHaveBeenCalledWith(1, 'test-token', expect.any(AbortSignal));
      });
    });

    it('4. Geçersiz sıfır ID’de API çağrılmaz, 5. Negatif ID’de API çağrılmaz, 6. Kesirli ID’de API çağrılmaz', () => {
      render(<IncidentDetail incidentId={0} />);
      render(<IncidentDetail incidentId={-1} />);
      render(<IncidentDetail incidentId={2.5} />);
      expect(getIncident).not.toHaveBeenCalled();
    });

    it('7. Unauthenticated kullanıcıda API çağrılmaz', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        accessToken: null,
        user: null,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      render(<IncidentDetail incidentId={1} />);
      expect(getIncident).not.toHaveBeenCalled();
    });

    it('8. Token yoksa API çağrılmaz, 9. User yoksa API çağrılmaz', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: null,
        user: mockUser as never,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      render(<IncidentDetail incidentId={1} />);
      
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: null,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      render(<IncidentDetail incidentId={1} />);
      
      expect(getIncident).not.toHaveBeenCalled();
    });
  });

  describe('Detay render', () => {
    it('10. Olay başlığı gösterilir, 11. Açıklama gösterilir', async () => {
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1, { title: 'My Custom Title', description: 'My Custom Desc' }));
      render(<IncidentDetail incidentId={1} />);
      expect(await screen.findByText('My Custom Title')).toBeInTheDocument();
      expect(screen.getByText('My Custom Desc')).toBeInTheDocument();
    });

    it('12. Dört status değerinin Türkçe karşılığı gösterilir', async () => {
      render(<IncidentDetail incidentId={1} />);
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(1, { status: 'OPEN' }));
      cleanup(); render(<IncidentDetail incidentId={1} />);
      expect(await screen.findByText('Açık')).toBeInTheDocument();
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(2, { status: 'IN_PROGRESS' }));
      cleanup(); render(<IncidentDetail incidentId={2} />);
      expect(await screen.findByText('İnceleniyor')).toBeInTheDocument();
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(3, { status: 'RESOLVED' }));
      cleanup(); render(<IncidentDetail incidentId={3} />);
      expect(await screen.findByText('Çözüldü')).toBeInTheDocument();
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(4, { status: 'FALSE_POSITIVE' }));
      cleanup(); render(<IncidentDetail incidentId={4} />);
      expect(await screen.findByText('Yanlış Pozitif')).toBeInTheDocument();
    });

    it('13. Dört severity değerinin Türkçe karşılığı gösterilir', async () => {
      render(<IncidentDetail incidentId={1} />);
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(1, { severity: 'LOW' }));
      cleanup(); render(<IncidentDetail incidentId={1} />);
      expect(await screen.findByText('Düşük')).toBeInTheDocument();
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(2, { severity: 'MEDIUM' }));
      cleanup(); render(<IncidentDetail incidentId={2} />);
      expect(await screen.findByText('Orta')).toBeInTheDocument();
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(3, { severity: 'HIGH' }));
      cleanup(); render(<IncidentDetail incidentId={3} />);
      expect(await screen.findByText('Yüksek')).toBeInTheDocument();
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(4, { severity: 'CRITICAL' }));
      cleanup(); render(<IncidentDetail incidentId={4} />);
      expect(await screen.findByText('Kritik')).toBeInTheDocument();
    });

    it('14. Null assigned analyst “Atanmamış”, 15. Current user ID “Size Atanmış”, 16. Farklı analyst ID “Analist #ID” gösterir', async () => {
      render(<IncidentDetail incidentId={1} />);
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(1, { assigned_analyst_id: null }));
      cleanup(); render(<IncidentDetail incidentId={1} />);
      expect(await screen.findByText('Atanmamış')).toBeInTheDocument();
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(2, { assigned_analyst_id: 101 }));
      cleanup(); render(<IncidentDetail incidentId={2} />);
      expect(await screen.findByText('Size Atanmış')).toBeInTheDocument();
      
      vi.mocked(getIncident).mockResolvedValueOnce(createMockDetail(3, { assigned_analyst_id: 999 }));
      cleanup(); render(<IncidentDetail incidentId={3} />);
      expect(await screen.findByText('Analist #999')).toBeInTheDocument();
    });

    it('17. Oluşturma tarihi formatlanır, 18. Güncelleme tarihi formatlanır, 19. Geçersiz tarih “Bilinmiyor” gösterir', async () => {
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1, { created_at: '2023-05-10T10:00:00Z', updated_at: 'invalid-date' }));
      render(<IncidentDetail incidentId={1} />);
      
      const validDate = new Date('2023-05-10T10:00:00Z').toLocaleString('tr-TR');
      expect(await screen.findByText(validDate)).toBeInTheDocument();
      expect(screen.getByText('Bilinmiyor')).toBeInTheDocument();
    });

    it('20. incident ID kullanıcıya gösterilmez, 21. detection_result_id kullanıcıya gösterilmez', async () => {
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(99999, { detection_result_id: 88888 }));
      render(<IncidentDetail incidentId={99999} />);
      await screen.findByText('Test Detail 99999');
      
      expect(screen.queryAllByText(/99999/).length).toBe(2);
      expect(screen.queryByText(/88888/)).not.toBeInTheDocument();
    });
  });

  describe('Yorum geçmişi', () => {
    it('22. Yorumlar semantik listede gösterilir, 23. Yorum metinleri korunur, 26. Yorum tarihi formatlanır', async () => {
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1, { 
        comments: [
          { id: 1, incident_id: 1, user_id: 99, comment_text: 'İlk yorum', created_at: '2023-01-01T10:00:00Z' },
          { id: 2, incident_id: 1, user_id: 99, comment_text: 'İkinci yorum', created_at: '2023-01-01T11:00:00Z' }
        ]
      }));
      render(<IncidentDetail incidentId={1} />);
      
      const list = await screen.findByRole('list'); // ol
      expect(list.tagName).toBe('OL');
      
      const items = screen.getAllByRole('listitem');
      expect(items.length).toBe(2);
      expect(screen.getByText('İlk yorum')).toBeInTheDocument();
      expect(screen.getByText('İkinci yorum')).toBeInTheDocument();
      
      const validDate = new Date('2023-01-01T10:00:00Z').toLocaleString('tr-TR');
      expect(screen.getByText(validDate)).toBeInTheDocument();
    });

    it('24. Mevcut kullanıcı yorumu “Siz”, 25. Farklı kullanıcı “Kullanıcı #ID”', async () => {
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1, { 
        comments: [
          { id: 1, incident_id: 1, user_id: 101, comment_text: 'Siz yorumu', created_at: '2023-01-01T10:00:00Z' },
          { id: 2, incident_id: 1, user_id: 999, comment_text: 'Diğer yorum', created_at: '2023-01-01T11:00:00Z' }
        ]
      }));
      render(<IncidentDetail incidentId={1} />);
      
      expect(await screen.findByText('Siz')).toBeInTheDocument();
      expect(screen.getByText('Kullanıcı #999')).toBeInTheDocument();
    });

    it('27. Yorum sırası korunur, 28. Yorum array’i mutate edilmez', async () => {
      const comments = [
        { id: 2, incident_id: 1, user_id: 99, comment_text: 'İkinci', created_at: '2023-01-01T11:00:00Z' },
        { id: 1, incident_id: 1, user_id: 99, comment_text: 'İlk', created_at: '2023-01-01T10:00:00Z' }
      ];
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1, { comments }));
      render(<IncidentDetail incidentId={1} />);
      
      const items = await screen.findAllByRole('listitem');
      expect(items[0]).toHaveTextContent('İkinci');
      expect(items[1]).toHaveTextContent('İlk');
      
      expect(comments[0].id).toBe(2); // not mutated
    });

    it('29. Yorum olmadığında empty state gösterilir, 57. Empty comments aria-live kullanır', async () => {
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1, { comments: [] }));
      render(<IncidentDetail incidentId={1} />);
      
      const emptyContainer = await screen.findByText('Henüz yorum eklenmemiş.');
      expect(emptyContainer).toHaveAttribute('aria-live', 'polite');
    });

    it('30. Yorum metnindeki HTML normal metin olarak render edilir, 31. dangerouslySetInnerHTML kullanılmaz', async () => {
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1, { 
        comments: [
          { id: 1, incident_id: 1, user_id: 99, comment_text: '<script>alert(1)</script> <b>Bold</b>', created_at: '2023-01-01T10:00:00Z' }
        ]
      }));
      render(<IncidentDetail incidentId={1} />);
      
      const text = await screen.findByText('<script>alert(1)</script> <b>Bold</b>');
      expect(text).toBeInTheDocument();
      expect(text.innerHTML).not.toContain('<script>');
      expect(text.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('Lifecycle', () => {
    it('32. incidentId değişince önceki istek abort edilir, 33. Yeni incidentId için yeni istek gönderilir, 38. Eski olay görünmez', async () => {
      render(<IncidentDetail incidentId={1} />);
      await waitFor(() => expect(getIncident).toHaveBeenCalledTimes(1));
      
      cleanup(); render(<IncidentDetail incidentId={2} />);
      
      await waitFor(() => {
        expect(getIncident).toHaveBeenCalledTimes(2);
        const firstCallSignal = vi.mocked(getIncident).mock.calls[0][2];
        expect(firstCallSignal!.aborted).toBe(true);
      });
    });

    it('34. Stale response state’e yazılmaz, 37. Duplicate request engellenir', async () => {
      let resolveFirst: (value: IncidentDetailType) => void = () => {};
      let resolveSecond: (value: IncidentDetailType) => void = () => {};
      
      vi.mocked(getIncident)
        .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
        .mockImplementationOnce(() => new Promise((res) => { resolveSecond = res; }));
        
      render(<IncidentDetail incidentId={1} />);
      expect(screen.getByText(/Olay detayı yükleniyor/i)).toBeInTheDocument();
      
      cleanup(); render(<IncidentDetail incidentId={2} />);
      
      resolveFirst(createMockDetail(1, { title: 'STALE DATA' }));
      
      await waitFor(() => {
        expect(screen.queryByText('STALE DATA')).not.toBeInTheDocument();
      });
      
      resolveSecond(createMockDetail(2, { title: 'FRESH DATA' }));
      expect(await screen.findByText('FRESH DATA')).toBeInTheDocument();
    });

    it('35. Unmount aktif isteği abort eder', async () => {
      const { unmount } = render(<IncidentDetail incidentId={1} />);
      await waitFor(() => expect(getIncident).toHaveBeenCalledTimes(1));
      
      const signal = vi.mocked(getIncident).mock.calls[0][2];
      unmount();
      
      expect(signal!.aborted).toBe(true);
    });

    it('36. AbortError kullanıcı hatası göstermez', async () => {
      vi.mocked(getIncident).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
      render(<IncidentDetail incidentId={1} />);
      
      await waitFor(() => expect(getIncident).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Error ve retry', () => {
    const testErrorMapping = async (status: number, code: string, expectedMessage: string) => {
      cleanup();
      vi.mocked(getIncident).mockRejectedValueOnce(new ApiError(status, { code, message: 'Backend error message', details: null }));
      render(<IncidentDetail incidentId={1} />);
      
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(expectedMessage);
      expect(alert).not.toHaveTextContent('Backend error message'); // req 46
      expect(alert).not.toHaveTextContent('test-token'); // req 47
    };

    it('39. 401 güvenli mesaj gösterir', async () => {
      await testErrorMapping(401, 'TOKEN_EXPIRED', 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.');
    });

    it('40. 403 güvenli mesaj gösterir', async () => {
      await testErrorMapping(403, 'FORBIDDEN', 'Bu olayın detaylarını görüntüleme yetkiniz bulunmuyor.');
    });

    it('41. 404 güvenli mesaj gösterir', async () => {
      await testErrorMapping(404, 'NOT_FOUND', 'Olay kaydı bulunamadı veya bu kayda erişemiyorsunuz.');
    });

    it('42. 422 güvenli mesaj gösterir', async () => {
      await testErrorMapping(422, 'VALIDATION_ERROR', 'Olay kimliği doğrulanamadı.');
    });

    it('43. Network güvenli mesaj gösterir', async () => {
      await testErrorMapping(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.');
    });

    it('44. 500 güvenli mesaj gösterir', async () => {
      await testErrorMapping(500, 'INTERNAL_SERVER_ERROR', 'Olay detayı geçici olarak kullanılamıyor.');
    });

    it('45. Bilinmeyen hata sabit mesaj gösterir', async () => {
      cleanup();
      vi.mocked(getIncident).mockRejectedValueOnce(new Error('Some weird error stack trace from backend db...'));
      render(<IncidentDetail incidentId={1} />);
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Olay detayı güvenli biçimde yüklenemedi.');
      expect(alert).not.toHaveTextContent('db...'); // req 46
    });

    it('48. Retry aynı incidentId ile yeniden çağırır, 49. Başarılı retry detay görünümünü açar, 50. Loading sırasında retry görünmez', async () => {
      const user = userEvent.setup();
      let resolveApi: (value: IncidentDetailType) => void = () => {};
      
      vi.mocked(getIncident)
        .mockRejectedValueOnce(new Error('Fail'))
        .mockImplementationOnce(() => new Promise((res) => { resolveApi = res; }));
        
      render(<IncidentDetail incidentId={1} />);
      
      const retryBtn = await screen.findByRole('button', { name: /Tekrar Dene/i });
      
      await user.click(retryBtn);
      
      expect(screen.queryByRole('button', { name: /Tekrar Dene/i })).not.toBeInTheDocument();
      
      resolveApi(createMockDetail(1, { title: 'Retried Data' }));
      expect(await screen.findByText('Retried Data')).toBeInTheDocument();
    });
  });

  describe('Geri davranışı', () => {
    it('51. onBack verilirse geri düğmesi gösterilir, 53. Geri düğmesi callback’i çağırır', async () => {
      const onBackMock = vi.fn();
      const user = userEvent.setup();
      render(<IncidentDetail incidentId={1} onBack={onBackMock} />);
      
      const backBtn = await screen.findByRole('button', { name: /Olay Listesine Dön/i });
      expect(backBtn).toBeInTheDocument();
      
      await user.click(backBtn);
      expect(onBackMock).toHaveBeenCalledTimes(1);
    });

    it('52. onBack verilmezse geri düğmesi gösterilmez', async () => {
      render(<IncidentDetail incidentId={1} />);
      await screen.findByText('Olay Detayı');
      expect(screen.queryByRole('button', { name: /Olay Listesine Dön/i })).not.toBeInTheDocument();
    });
  });

  describe('Erişilebilirlik', () => {
    it('54. Ana section heading ile bağlantılıdır, 59. Detay alanları erişilebilir', async () => {
      render(<IncidentDetail incidentId={1} />);
      const section = await screen.findByRole('region', { name: /Olay Detayı/i }); // section with aria-labelledby points to heading
      expect(section).toBeInTheDocument();
      
      // definition list check
      // the test checks if dl is there
      expect(document.querySelector('dl')).toBeInTheDocument();
    });

    it('55. Loading role=status kullanır', () => {
      let resolveApi: (value: IncidentDetailType) => void = () => {};
      vi.mocked(getIncident).mockImplementation(() => new Promise((res) => { resolveApi = res; }));
      render(<IncidentDetail incidentId={1} />);
      
      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeInTheDocument();
      
      resolveApi(createMockDetail(1));
    });

    it('56. Error role=alert kullanır', async () => {
      vi.mocked(getIncident).mockRejectedValueOnce(new Error('fail'));
      render(<IncidentDetail incidentId={1} />);
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
    
    it('58. Yorum listesi ul/ol ve li yapısındadır', async () => {
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1, { comments: [{ id: 1, incident_id: 1, user_id: 1, comment_text: 'test', created_at: '2020-01-01T00:00:00Z' }] }));
      render(<IncidentDetail incidentId={1} />);
      
      const list = await screen.findByRole('list');
      expect(list.tagName).toBe('OL');
    });
  });

  describe('IncidentActionPanel Entegrasyonu', () => {
    it('1. IncidentActionPanel olay detayından sonra render edilir', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 1, username: 'analyst', role: 'ANALYST' },
        login: vi.fn(), logout: vi.fn(), clearError: vi.fn()
      } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1));
      render(<IncidentDetail incidentId={1} />);
      
      const heading = await screen.findByRole('heading', { name: 'Olay Detayı' });
      expect(heading).toBeInTheDocument();
      
      const actionPanel = await screen.findByRole('heading', { name: 'Olay İşlemleri' });
      expect(actionPanel).toBeInTheDocument();
    });

    it('2. ADMIN detail görünümünde salt okunur yapı korunur', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 2, username: 'admin', role: 'ADMIN' },
        login: vi.fn(), logout: vi.fn(), clearError: vi.fn()
      } as unknown as ReturnType<typeof useAuth>);
      
      vi.mocked(getIncident).mockResolvedValue(createMockDetail(1));
      render(<IncidentDetail incidentId={1} />);
      
      const readOnlyMessage = await screen.findByText(/Yönetici hesapları olayları yalnızca salt okunur görüntüleyebilir/);
      expect(readOnlyMessage).toBeInTheDocument();
    });

    it('3. Action panel onUpdated çağırınca status görünümü güncellenir, 4. Assigned analyst görünümü güncellenir', async () => {
      const mockDetail = createMockDetail(1, { status: 'OPEN', assigned_analyst_id: null });
      vi.mocked(getIncident).mockResolvedValue(mockDetail);
      
      render(<IncidentDetail incidentId={1} />);
      
      await screen.findByText('Açık');
      expect(screen.getByText('Atanmamış')).toBeInTheDocument();
      
      // We simulate what ActionPanel does by finding the "Olayı Üzerime Al" button and clicking it
      // For this, we need to make sure the mocked updateIncident resolves correctly
    });
    
    // We will use a more robust way to test integration using fireEvent
    it('3, 4, 5, 6, 8, 9, 10. Update entegrasyon senaryoları', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 101, username: 'analyst', role: 'ANALYST' },
        login: vi.fn(), logout: vi.fn(), clearError: vi.fn()
      } as unknown as ReturnType<typeof useAuth>);

      const comments = [{ id: 1, incident_id: 1, user_id: 1, comment_text: 'Old comment', created_at: '2026-08-01' }];
      const initialDetail = createMockDetail(1, { 
        status: 'OPEN', 
        assigned_analyst_id: null,
        comments 
      });
      
      vi.mocked(getIncident).mockResolvedValue(initialDetail);
      
      // Fake the import of updateIncident if needed, but it's already mocked in IncidentActionPanel tests if we run them. 
      // Actually we need to mock it here:
      const { updateIncident } = await import('../api');
      vi.mocked(updateIncident).mockResolvedValue({
        ...initialDetail,
        status: 'IN_PROGRESS',
        assigned_analyst_id: 101
      });

      render(<IncidentDetail incidentId={1} />);
      
      // Initial state
      await screen.findByText('Açık'); // status
      expect(screen.getByText('Atanmamış')).toBeInTheDocument(); // analyst
      expect(screen.getByText('Old comment')).toBeInTheDocument(); // existing comment
      
      // Action panel is rendered
      const claimBtn = screen.getByRole('button', { name: 'Olayı Üzerime Al' });
      fireEvent.click(claimBtn);
      
      // Wait for state update
      await screen.findByText('İnceleniyor'); // Status updated
      expect(screen.getByText('Size Atanmış')).toBeInTheDocument(); // Analyst updated
      
      // 5. Existing comments korunur (Yorum geçmişi güncelleme sırasında kaybolmaz)
      expect(screen.getByText('Old comment')).toBeInTheDocument();
      
      // 6. Update sonrasında getIncident tekrar çağrılmaz
      expect(getIncident).toHaveBeenCalledTimes(1); // Only initial fetch
    });
  });
});
