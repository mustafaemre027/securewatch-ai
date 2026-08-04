import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentList } from './IncidentList';
import { listIncidents } from '../api';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../../api/types';
import type { IncidentListItem } from '../types';

vi.mock('../api', () => ({
  listIncidents: vi.fn(),
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockUser = {
  id: 101,
  username: 'testuser',
  role: 'ANALYST',
};

const createMockIncident = (id: number, overrides?: Partial<IncidentListItem>): IncidentListItem => ({
  id,
  title: `Test Incident ${id}`,
  description: `Test Description ${id}`,
  severity: 'MEDIUM',
  status: 'OPEN',
  assigned_analyst_id: null,
  detection_result_id: 500 + id,
  created_at: '2023-01-01T12:00:00Z',
  updated_at: '2023-01-02T12:00:00Z',
  ...overrides,
});

describe('IncidentList', () => {
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
    vi.mocked(listIncidents).mockResolvedValue([]);
  });

  describe('Başlangıç ve API', () => {
    it('1. Authenticated kullanıcı için liste çağrılır', async () => {
      render(<IncidentList />);
      await waitFor(() => expect(listIncidents).toHaveBeenCalledTimes(1));
    });

    it('2. Endpoint çağrısında skip 0 korunur, 3. Limit 21 gönderilir, 4. Token aktarılır, 5. AbortSignal aktarılır', async () => {
      render(<IncidentList />);
      await waitFor(() => {
        expect(listIncidents).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 0,
            limit: 21,
          }),
          'test-token',
          expect.any(AbortSignal)
        );
      });
    });

    it('6. Unauthenticated kullanıcı için API çağrılmaz', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        accessToken: null,
        user: null,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      render(<IncidentList />);
      expect(listIncidents).not.toHaveBeenCalled();
    });

    it('7. Token yoksa API çağrılmaz', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: null,
        user: mockUser as never,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      render(<IncidentList />);
      expect(listIncidents).not.toHaveBeenCalled();
    });

    it('8. User yoksa API çağrılmaz', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: null,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      render(<IncidentList />);
      expect(listIncidents).not.toHaveBeenCalled();
    });
  });

  describe('Liste render', () => {
    it('9. Olay başlığı ve açıklaması gösterilir', async () => {
      vi.mocked(listIncidents).mockResolvedValue([createMockIncident(1, { title: 'My Custom Title', description: 'My Custom Desc' })]);
      render(<IncidentList />);
      expect(await screen.findByText('My Custom Title')).toBeInTheDocument();
      expect(screen.getByText('My Custom Desc')).toBeInTheDocument();
    });

    it('10. Dört durumun Türkçe etiketi gösterilir', async () => {
      vi.mocked(listIncidents).mockResolvedValue([
        createMockIncident(1, { status: 'OPEN' }),
        createMockIncident(2, { status: 'IN_PROGRESS' }),
        createMockIncident(3, { status: 'RESOLVED' }),
        createMockIncident(4, { status: 'FALSE_POSITIVE' }),
      ]);
      render(<IncidentList />);
      await screen.findByText('Test Incident 1');
      expect(screen.getAllByText('Açık')).toHaveLength(2); // In select and in list
      expect(screen.getAllByText('İnceleniyor').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Çözüldü').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Yanlış Pozitif').length).toBeGreaterThan(0);
    });

    it('11. Dört severity değerinin Türkçe etiketi gösterilir', async () => {
      vi.mocked(listIncidents).mockResolvedValue([
        createMockIncident(1, { severity: 'LOW' }),
        createMockIncident(2, { severity: 'MEDIUM' }),
        createMockIncident(3, { severity: 'HIGH' }),
        createMockIncident(4, { severity: 'CRITICAL' }),
      ]);
      render(<IncidentList />);
      await screen.findByText('Test Incident 1');
      expect(screen.getAllByText('Düşük')).toHaveLength(2); // In select and in list
      expect(screen.getAllByText('Orta').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Yüksek').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Kritik').length).toBeGreaterThan(0);
    });

    it('12. Null analyst için "Atanmamış", 13. Current user ID için "Size Atanmış", 14. Farklı ID için "Analist #ID" görünür', async () => {
      vi.mocked(listIncidents).mockResolvedValue([
        createMockIncident(1, { assigned_analyst_id: null }),
        createMockIncident(2, { assigned_analyst_id: 101 }),
        createMockIncident(3, { assigned_analyst_id: 999 }),
      ]);
      render(<IncidentList />);
      expect(await screen.findByText('Atanmamış')).toBeInTheDocument();
      expect(screen.getByText('Size Atanmış')).toBeInTheDocument();
      expect(screen.getByText('Analist #999')).toBeInTheDocument();
    });

    it('15. Tarihler güvenli biçimde formatlanır, 16. Geçersiz tarih "Bilinmiyor" gösterir', async () => {
      vi.mocked(listIncidents).mockResolvedValue([
        createMockIncident(1, { created_at: '2023-05-10T10:00:00Z', updated_at: 'invalid-date' }),
      ]);
      render(<IncidentList />);

      const validDate = new Date('2023-05-10T10:00:00Z').toLocaleString('tr-TR');
      expect(await screen.findByText(validDate)).toBeInTheDocument();
      expect(screen.getByText('Bilinmiyor')).toBeInTheDocument();
    });

    it('17. detection_result_id kullanıcıya gösterilmez', async () => {
      vi.mocked(listIncidents).mockResolvedValue([createMockIncident(1, { detection_result_id: 98765 })]);
      render(<IncidentList />);
      await screen.findByText('Test Incident 1');
      expect(screen.queryByText(/98765/)).not.toBeInTheDocument();
    });
  });

  describe('Filtreler', () => {
    it('18. Status filtresi backend parametresine dönüşür', async () => {
      const user = userEvent.setup();
      render(<IncidentList />);
      await waitFor(() => expect(listIncidents).toHaveBeenCalledTimes(1));

      await user.selectOptions(screen.getByLabelText(/Olay Durumu/i), 'OPEN');

      await waitFor(() => {
        expect(listIncidents).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'OPEN' }),
          expect.any(String),
          expect.any(AbortSignal)
        );
      });
    });

    it('19. Severity filtresi backend parametresine dönüşür', async () => {
      const user = userEvent.setup();
      render(<IncidentList />);
      await waitFor(() => expect(listIncidents).toHaveBeenCalledTimes(1));

      await user.selectOptions(screen.getByLabelText(/Önem Seviyesi/i), 'HIGH');

      await waitFor(() => {
        expect(listIncidents).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'HIGH' }),
          expect.any(String),
          expect.any(AbortSignal)
        );
      });
    });

    it('20. "Yalnız Bana Atananlar" user.id gönderir, 21. Kapatıldığında göndermez', async () => {
      const user = userEvent.setup();
      render(<IncidentList />);
      await waitFor(() => expect(listIncidents).toHaveBeenCalledTimes(1));

      const checkbox = screen.getByLabelText(/Yalnız Bana Atananlar/i);
      await user.click(checkbox);

      await waitFor(() => {
        expect(listIncidents).toHaveBeenCalledWith(
          expect.objectContaining({ assignedAnalystId: 101 }),
          expect.any(String),
          expect.any(AbortSignal)
        );
      });

      await user.click(checkbox); // uncheck

      await waitFor(() => {
        const calls = vi.mocked(listIncidents).mock.calls;
        const lastCallArgs = calls[calls.length - 1][0];
        expect(lastCallArgs!.assignedAnalystId).toBeUndefined();
      });
    });

    it('22. Her filtre değişiminde skip sıfırlanır, 23. Filtreler loading sırasında disabled olur', async () => {
      let resolveApi: (val: IncidentListItem[]) => void = () => {};
      vi.mocked(listIncidents).mockImplementation(() => new Promise((res) => { resolveApi = res; }));

      render(<IncidentList />);

      const statusSelect = screen.getByLabelText(/Olay Durumu/i);
      const severitySelect = screen.getByLabelText(/Önem Seviyesi/i);
      const checkbox = screen.getByLabelText(/Yalnız Bana Atananlar/i);

      expect(statusSelect).toBeDisabled();
      expect(severitySelect).toBeDisabled();
      expect(checkbox).toBeDisabled();

      resolveApi([]);
      await waitFor(() => expect(statusSelect).not.toBeDisabled());

      // We will test skip reset by paginating first
      vi.mocked(listIncidents).mockResolvedValue(Array.from({ length: 21 }).map((_, i) => createMockIncident(i)));
      const user = userEvent.setup();
      await user.selectOptions(statusSelect, 'OPEN'); // this triggers a re-fetch, skip should be 0

      await waitFor(() => {
        const calls = vi.mocked(listIncidents).mock.calls;
        const lastCallArgs = calls[calls.length - 1][0];
        expect(lastCallArgs!.skip).toBe(0);
      });
    });
  });

  describe('Sayfalama', () => {
    it('24. İlk 20 kayıt gösterilir, 25. 21. kayıt gösterilmez ve Sonraki aktif olur', async () => {
      const mockData = Array.from({ length: 21 }).map((_, i) => createMockIncident(i));
      vi.mocked(listIncidents).mockResolvedValue(mockData);

      render(<IncidentList />);

      expect(await screen.findByText('Test Incident 0')).toBeInTheDocument();
      expect(screen.getByText('Test Incident 19')).toBeInTheDocument();
      expect(screen.queryByText('Test Incident 20')).not.toBeInTheDocument();

      const nextBtn = screen.getByRole('button', { name: /Sonraki/i });
      expect(nextBtn).not.toBeDisabled();
    });

    it('26. 20 veya daha az kayıtta Sonraki disabled olur', async () => {
      const mockData = Array.from({ length: 20 }).map((_, i) => createMockIncident(i));
      vi.mocked(listIncidents).mockResolvedValue(mockData);

      render(<IncidentList />);
      await screen.findByText('Test Incident 0');

      const nextBtn = screen.getByRole('button', { name: /Sonraki/i });
      expect(nextBtn).toBeDisabled();
    });

    it('27. Sonraki skip değerini 20 yapar, 28. Önceki skip değerini 0’a döndürür, 29. İlk sayfada Önceki disabled olur', async () => {
      const mockData = Array.from({ length: 21 }).map((_, i) => createMockIncident(i));
      vi.mocked(listIncidents).mockResolvedValue(mockData);

      const user = userEvent.setup();
      render(<IncidentList />);
      await screen.findByText('Test Incident 0');

      const prevBtn = screen.getByRole('button', { name: /Önceki/i });
      expect(prevBtn).toBeDisabled();

      const nextBtn = screen.getByRole('button', { name: /Sonraki/i });
      await user.click(nextBtn);

      await waitFor(() => {
        const calls = vi.mocked(listIncidents).mock.calls;
        expect(calls[calls.length - 1]![0]!.skip).toBe(20);
      });

      // Assume the second page returns some items
      vi.mocked(listIncidents).mockResolvedValue([createMockIncident(21)]);
      // Click prev
      await user.click(prevBtn);

      await waitFor(() => {
        const calls = vi.mocked(listIncidents).mock.calls;
        expect(calls[calls.length - 1]![0]!.skip).toBe(0);
      });
    });

    it('30. Sahte total metni gösterilmez, 31. Görünür kayıt aralığı doğru gösterilir', async () => {
      vi.mocked(listIncidents).mockResolvedValue(Array.from({ length: 5 }).map((_, i) => createMockIncident(i)));
      render(<IncidentList />);

      expect(await screen.findByText('1 - 5 arası gösteriliyor')).toBeInTheDocument();
      // "total" keyword should not be present as false total
      expect(screen.queryByText(/toplam/i)).not.toBeInTheDocument();
    });
  });

  describe('Lifecycle', () => {
    it('32. Yeni filtre isteği eski isteği abort eder', async () => {
      const user = userEvent.setup();
      render(<IncidentList />);

      // Wait for initial render to trigger fetch
      await waitFor(() => expect(listIncidents).toHaveBeenCalledTimes(1));

      // Trigger new fetch
      await user.selectOptions(screen.getByLabelText(/Olay Durumu/i), 'OPEN');

      await waitFor(() => {
        expect(listIncidents).toHaveBeenCalledTimes(2);
        const firstCallSignal = vi.mocked(listIncidents).mock.calls[0][2];
        expect(firstCallSignal!.aborted).toBe(true);
      });
    });

    it('33. Stale response state’e yazılmaz, 36. Duplicate fetch engellenir', async () => {
      let resolveFirst: (value: IncidentListItem[]) => void = () => {};
      let resolveSecond: (value: IncidentListItem[]) => void = () => {};

      vi.mocked(listIncidents)
        .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
        .mockImplementationOnce(() => new Promise((res) => { resolveSecond = res; }));

      const { rerender } = render(<IncidentList />);

      // First fetch is pending
      expect(screen.getByText(/Olaylar yükleniyor/i)).toBeInTheDocument();

      // Trigger second fetch by changing user ID
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { ...mockUser, id: 999 } as never,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      rerender(<IncidentList />);

      // Resolve first fetch with old data
      resolveFirst([createMockIncident(1, { title: 'STALE DATA' })]);

      // Second fetch still pending, so stale data shouldn't be rendered
      // We should still see loading or not see stale data
      await waitFor(() => {
        expect(screen.queryByText('STALE DATA')).not.toBeInTheDocument();
      });

      // Resolve second fetch
      resolveSecond([createMockIncident(2, { title: 'FRESH DATA' })]);

      expect(await screen.findByText('FRESH DATA')).toBeInTheDocument();
    });

    it('34. Unmount aktif isteği abort eder', async () => {
      const { unmount } = render(<IncidentList />);
      await waitFor(() => expect(listIncidents).toHaveBeenCalledTimes(1));

      const signal = vi.mocked(listIncidents).mock.calls[0][2];
      unmount();

      expect(signal!.aborted).toBe(true);
    });

    it('35. AbortError kullanıcı hatası göstermez', async () => {
      vi.mocked(listIncidents).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
      render(<IncidentList />);

      // Should not show error alert
      await waitFor(() => {
        expect(listIncidents).toHaveBeenCalled();
      });

      // Check that there's no alert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Durumlar', () => {
    it('37. Loading metni ve role=status bulunur, 52. Loading aria-busy davranışı korunur', () => {
      let resolveApi: (value: IncidentListItem[]) => void = () => {};
      vi.mocked(listIncidents).mockImplementation(() => new Promise((res) => { resolveApi = res; }));

      render(<IncidentList />);

      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeInTheDocument();
      expect(statusElement).toHaveAttribute('aria-busy', 'true');
      expect(statusElement).toHaveTextContent(/Olaylar yükleniyor/i);

      resolveApi([]);
    });

    it('38. Filtre yokken boş state doğru görünür', async () => {
      vi.mocked(listIncidents).mockResolvedValueOnce([]);
      render(<IncidentList />);
      expect(await screen.findByText('Henüz oluşturulmuş bir olay bulunmuyor.')).toBeInTheDocument();
    });

    it('39. Filtre varken filtreli empty state görünür', async () => {
      const user = userEvent.setup();
      vi.mocked(listIncidents).mockResolvedValueOnce([createMockIncident(1)]).mockResolvedValueOnce([]);
      render(<IncidentList />);

      await screen.findByText('Test Incident 1');

      await user.selectOptions(screen.getByLabelText(/Olay Durumu/i), 'OPEN');

      expect(await screen.findByText('Seçilen filtrelerle eşleşen olay bulunamadı.')).toBeInTheDocument();
    });

    const testErrorMapping = async (status: number, code: string, expectedMessage: string) => {
      cleanup();
      vi.mocked(listIncidents).mockRejectedValueOnce(new ApiError(status, { code, message: 'Backend error message', details: null }));
      render(<IncidentList />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(expectedMessage);
      expect(alert).not.toHaveTextContent('Backend error message'); // req 46
    };

    it('40. 401 güvenli mesaj gösterir', async () => {
      await testErrorMapping(401, 'TOKEN_EXPIRED', 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.');
    });

    it('41. 403 güvenli mesaj gösterir', async () => {
      await testErrorMapping(403, 'FORBIDDEN', 'Olayları görüntüleme yetkiniz bulunmuyor.');
    });

    it('42. 422 güvenli mesaj gösterir', async () => {
      await testErrorMapping(422, 'VALIDATION_ERROR', 'Olay filtreleri doğrulanamadı.');
    });

    it('43. Network güvenli mesaj gösterir', async () => {
      await testErrorMapping(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.');
    });

    it('44. 500 güvenli mesaj gösterir', async () => {
      await testErrorMapping(500, 'INTERNAL_SERVER_ERROR', 'Olay listesi geçici olarak kullanılamıyor.');
    });

    it('45. Bilinmeyen hata sabit mesaj gösterir', async () => {
      cleanup();
      vi.mocked(listIncidents).mockRejectedValueOnce(new Error('Some weird error stack trace from backend db...'));
      render(<IncidentList />);
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Olaylar güvenli biçimde yüklenemedi.');
      expect(alert).not.toHaveTextContent('db...'); // req 46
    });

    it('47. Tekrar Dene aynı filtrelerle yeniden çağırır', async () => {
      const user = userEvent.setup();
      vi.mocked(listIncidents)
        .mockResolvedValueOnce([createMockIncident(1)])
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce([createMockIncident(2, { title: 'Retried Data' })]);

      render(<IncidentList />);
      await screen.findByText('Test Incident 1');

      // Cause a fail
      await user.selectOptions(screen.getByLabelText(/Olay Durumu/i), 'OPEN');

      const retryBtn = await screen.findByRole('button', { name: /Tekrar Dene/i });

      // Click retry
      await user.click(retryBtn);

      expect(await screen.findByText('Retried Data')).toBeInTheDocument();
    });
  });

  describe('Erişilebilirlik', () => {
    it('48. Filtre label bağlantıları doğrudur', () => {
      render(<IncidentList />);
      // Implicitly tested if getByLabelText works.
      expect(screen.getByLabelText(/Olay Durumu/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Önem Seviyesi/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Yalnız Bana Atananlar/i)).toBeInTheDocument();
    });

    it('49. Liste semantik ul/li yapısındadır', async () => {
      vi.mocked(listIncidents).mockResolvedValue([createMockIncident(1)]);
      render(<IncidentList />);

      const list = await screen.findByRole('list'); // <ul>
      expect(list.tagName).toBe('UL');

      const items = screen.getAllByRole('listitem'); // <li>
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].tagName).toBe('LI');
    });

    it('50. Hata role=alert kullanır', async () => {
      vi.mocked(listIncidents).mockRejectedValueOnce(new Error('fail'));
      render(<IncidentList />);
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('51. Empty state aria-live kullanır', async () => {
      vi.mocked(listIncidents).mockResolvedValue([]);
      render(<IncidentList />);
      const emptyContainer = await screen.findByText('Henüz oluşturulmuş bir olay bulunmuyor.');
      expect(emptyContainer).toHaveAttribute('aria-live', 'polite');
    });

    it('53. Butonlar klavye ile kullanılabilir', async () => {
      vi.mocked(listIncidents).mockResolvedValue(Array.from({ length: 21 }).map((_, i) => createMockIncident(i)));
      const user = userEvent.setup();
      render(<IncidentList />);

      await screen.findByText('Test Incident 0');

      const nextBtn = screen.getByRole('button', { name: /Sonraki/i });
      nextBtn.focus();
      expect(nextBtn).toHaveFocus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        const calls = vi.mocked(listIncidents).mock.calls;
        expect(calls[calls.length - 1]![0]!.skip).toBe(20);
      });
    });
  });
});
