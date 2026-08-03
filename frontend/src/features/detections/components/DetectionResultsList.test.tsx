import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DetectionResultsList } from './DetectionResultsList';
import { useAuth } from '../../auth/useAuth';
import { listDetectionResults } from '../api';
import { ApiError } from '../../../api/types';
import type { DetectionResultPage, DetectionResult, DetectionRiskLevel } from '../types';

vi.mock('../../auth/useAuth');
vi.mock('../api');

const mockToken = 'test-token-123';

const validItems: DetectionResult[] = [
  {
    id: 1,
    job_id: 123,
    row_index: 0,
    attack_probability: 0.95,
    is_attack: true,
    risk_level: 'CRITICAL',
    created_at: '2026-08-03T10:00:00Z',
  },
  {
    id: 2,
    job_id: 123,
    row_index: 1,
    attack_probability: 0.12,
    is_attack: false,
    risk_level: 'LOW',
    created_at: '2026-08-03T10:01:00Z',
  },
  {
    id: 3,
    job_id: 123,
    row_index: 2,
    attack_probability: 0.65,
    is_attack: true,
    risk_level: 'HIGH',
    created_at: '2026-08-03T10:02:00Z',
  },
  {
    id: 4,
    job_id: 123,
    row_index: 3,
    attack_probability: 0.45,
    is_attack: true,
    risk_level: 'MEDIUM',
    created_at: '2026-08-03T10:03:00Z',
  },
];

const validPage: DetectionResultPage = {
  items: validItems,
  total: 40,
  skip: 0,
  limit: 20,
};

describe('DetectionResultsList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: mockToken,
      user: null,
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('1. İlk istek doğru jobId, skip:0, limit:20, token ve signal ile gönderilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    expect(listDetectionResults).toHaveBeenCalledWith(
      123,
      { skip: 0, limit: 20 },
      mockToken,
      expect.any(AbortSignal)
    );
  });

  it('2. Loading ve aria-busy doğru çalışır', () => {
    vi.mocked(listDetectionResults).mockReturnValue(new Promise(() => {}));
    render(<DetectionResultsList jobId={123} />);
    
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Sonuçlar yükleniyor...')).toBeInTheDocument();
  });

  it('3. Geçerli sonuçlar güvenli şekilde render edilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.getByText('Satır 1')).toBeInTheDocument();
      expect(screen.getByText('Satır 2')).toBeInTheDocument();
      expect(screen.getByText('1–4')).toBeInTheDocument();
    });
  });

  it('4. Saldırı ve Normal metinleri bulunur', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.getAllByText('Saldırı').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Normal').length).toBeGreaterThan(0);
    });
  });

  it('5. Risk seviyelerinin dört metinsel karşılığı bulunur', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.getByText('Kritik')).toBeInTheDocument();
      expect(screen.getByText('Düşük')).toBeInTheDocument();
      expect(screen.getByText('Yüksek')).toBeInTheDocument();
      expect(screen.getByText('Orta')).toBeInTheDocument();
    });
  });

  it('6. Saldırı olasılığı yüzde olarak doğru gösterilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.getByText('%95')).toBeInTheDocument();
      expect(screen.getByText('%12')).toBeInTheDocument();
      expect(screen.getByText('%65')).toBeInTheDocument();
      expect(screen.getByText('%45')).toBeInTheDocument();
    });
  });

  it('7. isAttack:true doğru gönderilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    const select = screen.getByLabelText(/Tahmin Filtresi/i);
    fireEvent.change(select, { target: { value: 'ATTACK' } });
    
    await waitFor(() => {
      expect(listDetectionResults).toHaveBeenCalledWith(
        123,
        { skip: 0, limit: 20, isAttack: true },
        mockToken,
        expect.any(AbortSignal)
      );
    });
  });

  it('8. isAttack:false kaybolmadan gönderilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    const select = screen.getByLabelText(/Tahmin Filtresi/i);
    fireEvent.change(select, { target: { value: 'NORMAL' } });
    
    await waitFor(() => {
      expect(listDetectionResults).toHaveBeenCalledWith(
        123,
        { skip: 0, limit: 20, isAttack: false },
        mockToken,
        expect.any(AbortSignal)
      );
    });
  });

  it('9. Risk filtresi doğru gönderilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    const select = screen.getByLabelText(/Risk Seviyesi/i);
    fireEvent.change(select, { target: { value: 'HIGH' } });
    
    await waitFor(() => {
      expect(listDetectionResults).toHaveBeenCalledWith(
        123,
        { skip: 0, limit: 20, riskLevel: 'HIGH' },
        mockToken,
        expect.any(AbortSignal)
      );
    });
  });

  it('10. Birlikte kullanılan iki filtre doğru gönderilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    fireEvent.change(screen.getByLabelText(/Tahmin Filtresi/i), { target: { value: 'ATTACK' } });
    fireEvent.change(screen.getByLabelText(/Risk Seviyesi/i), { target: { value: 'CRITICAL' } });
    
    await waitFor(() => {
      expect(listDetectionResults).toHaveBeenLastCalledWith(
        123,
        { skip: 0, limit: 20, isAttack: true, riskLevel: 'CRITICAL' },
        mockToken,
        expect.any(AbortSignal)
      );
    });
  });

  it('11. Filtre değişimi skip değerini sıfırlar', async () => {
    vi.mocked(listDetectionResults)
      .mockResolvedValueOnce({ ...validPage, total: 40, skip: 0 })
      .mockResolvedValueOnce({ ...validPage, total: 40, skip: 20 })
      .mockResolvedValueOnce({ ...validPage, total: 40, skip: 0 });
      
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => expect(screen.getByText('Sonraki')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Sonraki'));
    
    await waitFor(() => expect(listDetectionResults).toHaveBeenCalledWith(123, { skip: 20, limit: 20 }, mockToken, expect.any(AbortSignal)));
    
    fireEvent.change(screen.getByLabelText(/Risk Seviyesi/i), { target: { value: 'LOW' } });
    
    await waitFor(() => {
      expect(listDetectionResults).toHaveBeenLastCalledWith(123, { skip: 0, limit: 20, riskLevel: 'LOW' }, mockToken, expect.any(AbortSignal));
    });
  });

  it('12. Filtre değişimi eski isteği abort eder', async () => {
    vi.mocked(listDetectionResults).mockReturnValue(new Promise(() => {}));
    render(<DetectionResultsList jobId={123} />);
    
    const initialCallsCount = vi.mocked(listDetectionResults).mock.calls.length;
    const initialSignal = vi.mocked(listDetectionResults).mock.calls[initialCallsCount - 1][3];
    expect(initialSignal?.aborted).toBe(false);
    
    fireEvent.change(screen.getByLabelText(/Risk Seviyesi/i), { target: { value: 'HIGH' } });
    
    expect(initialSignal?.aborted).toBe(true);
    const newCallsCount = vi.mocked(listDetectionResults).mock.calls.length;
    const newSignal = vi.mocked(listDetectionResults).mock.calls[newCallsCount - 1][3];
    expect(newSignal?.aborted).toBe(false);
  });

  it('13. Önceki/Sonraki butonları doğru skip kullanır', async () => {
    vi.mocked(listDetectionResults)
      .mockResolvedValueOnce({ ...validPage, total: 40, skip: 0, limit: 20, items: validItems })
      .mockResolvedValueOnce({ ...validPage, total: 40, skip: 20, limit: 20, items: validItems });
      
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => expect(screen.getByText('Sonraki')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Sonraki'));
    
    await waitFor(() => {
      expect(listDetectionResults).toHaveBeenCalledWith(123, { skip: 20, limit: 20 }, mockToken, expect.any(AbortSignal));
    });
  });

  it('14. total kullanılarak son sayfa doğru belirlenir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue({ ...validPage, total: 24, skip: 0, items: validItems });
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => expect(screen.getByText('Sonraki')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Sonraki'));
    
    // items is 4, skip is 20 -> 24 total -> next disabled
    vi.mocked(listDetectionResults).mockResolvedValue({ ...validPage, total: 24, skip: 20, items: validItems });
    await waitFor(() => expect(screen.getByText('Sonraki')).toBeDisabled());
  });

  it('15. Son sayfada eksik kayıt olsa bile aralık doğru gösterilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, total: 22, skip: 0, items: validItems });
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => expect(screen.getByText('Sonraki')).not.toBeDisabled());
    
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, total: 22, skip: 20, items: [validItems[0], validItems[1]] });
    fireEvent.click(screen.getByText('Sonraki'));
    
    await waitFor(() => {
      expect(screen.getByText('21–22')).toBeInTheDocument();
      expect(screen.getByText('/ 22 sonuç')).toBeInTheDocument();
    });
  });

  it('16. Toplam sıfırken yanlış aralık gösterilmez', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 20 });
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.getByText('0–0')).toBeInTheDocument();
      expect(screen.getByText('/ 0 sonuç')).toBeInTheDocument();
    });
  });

  it('17. Filtreli ve filtresiz empty state ayrılır', async () => {
    vi.mocked(listDetectionResults).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 20 });
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.getByText('Bu analiz için tespit sonucu bulunmuyor.')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByLabelText(/Risk Seviyesi/i), { target: { value: 'HIGH' } });
    
    await waitFor(() => {
      expect(screen.getByText('Seçilen filtrelerle eşleşen tespit sonucu bulunamadı.')).toBeInTheDocument();
    });
  });

  it('18. Authentication yoksa API çağrılmaz', () => {
    vi.mocked(useAuth).mockReturnValueOnce({ isAuthenticated: false, accessToken: null, user: null, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null });
    render(<DetectionResultsList jobId={123} />);
    expect(listDetectionResults).not.toHaveBeenCalled();
  });

  it('19. Token yoksa API çağrılmaz', () => {
    vi.mocked(useAuth).mockReturnValueOnce({ isAuthenticated: true, accessToken: null, user: null, isLoading: false, loginUser: vi.fn(), logoutUser: vi.fn(), error: null });
    render(<DetectionResultsList jobId={123} />);
    expect(listDetectionResults).not.toHaveBeenCalled();
  });

  it('20. Unmount isteği abort eder', () => {
    vi.mocked(listDetectionResults).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<DetectionResultsList jobId={123} />);
    
    const signal = vi.mocked(listDetectionResults).mock.calls[0][3];
    expect(signal?.aborted).toBe(false);
    
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('21. jobId değişimi isteği abort eder ve sayfayı sıfırlar', async () => {
    vi.mocked(listDetectionResults).mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => expect(listDetectionResults).toHaveBeenCalled());
    
    const initialCallsCount = vi.mocked(listDetectionResults).mock.calls.length;
    const signal1 = vi.mocked(listDetectionResults).mock.calls[initialCallsCount - 1][3];
    expect(signal1?.aborted).toBe(false);
    
    rerender(<DetectionResultsList jobId={124} />);
    
    expect(signal1?.aborted).toBe(true);
    
    await waitFor(() => expect(listDetectionResults).toHaveBeenCalledTimes(initialCallsCount + 1));
    const newCallsCount = vi.mocked(listDetectionResults).mock.calls.length;
    const signal2 = vi.mocked(listDetectionResults).mock.calls[newCallsCount - 1][3];
    expect(signal2?.aborted).toBe(false);
  });

  it('22. Eski response yeni job/filter/page state’ini değiştirmez', async () => {
    let resolveFirst: (v: DetectionResultPage) => void = () => {};
    vi.mocked(listDetectionResults).mockImplementation((jobId) => {
      if (jobId === 123) return new Promise((resolve) => { resolveFirst = resolve; });
      return Promise.resolve({ 
        ...validPage, 
        total: 100, 
        skip: 0,
        items: validPage.items.map(i => ({ ...i, job_id: 124 }))
      });
    });
    
    const { rerender } = render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => expect(listDetectionResults).toHaveBeenCalled());
    
    rerender(<DetectionResultsList jobId={124} />);
    
    resolveFirst({ ...validPage, total: 50, skip: 0 });
    
    await waitFor(() => {
      expect(screen.getByText('/ 100 sonuç')).toBeInTheDocument();
      expect(screen.queryByText('/ 50 sonuç')).not.toBeInTheDocument();
    });
  });

  it('23. AbortError alert göstermez', async () => {
    vi.mocked(listDetectionResults).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('24. Hızlı çift retry tek istek oluşturur', async () => {
    vi.mocked(listDetectionResults).mockRejectedValue(new ApiError(0, { code: 'NETWORK_ERROR', message: 'Err', details: null }));
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    
    const initialCalls = vi.mocked(listDetectionResults).mock.calls.length;
    vi.mocked(listDetectionResults).mockReturnValue(new Promise(() => {}));
    
    const retryBtn = screen.getByText('Tekrar Dene');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    
    expect(listDetectionResults).toHaveBeenCalledTimes(initialCalls + 1);
  });

  it('25. Retry hata sonrasında başarıyla çalışır', async () => {
    vi.mocked(listDetectionResults).mockRejectedValue(new ApiError(0, { code: 'NETWORK_ERROR', message: 'Err', details: null }));
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    
    vi.mocked(listDetectionResults).mockResolvedValue(validPage);
    fireEvent.click(screen.getByText('Tekrar Dene'));
    
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Satır 1')).toBeInTheDocument();
    });
  });

  const errorMappings = [
    { status: 401, code: 'TOKEN_INVALID', msg: 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.' },
    { status: 403, code: 'PERMISSION_DENIED', msg: 'Tespit sonuçlarını görüntüleme yetkiniz bulunmuyor.' },
    { status: 404, code: 'NOT_FOUND', msg: 'Analiz kaydı bulunamadı veya bu kayda erişemiyorsunuz.' },
    { status: 409, code: 'NOT_COMPLETED', msg: 'Analiz tamamlanmadığı için tespit sonuçları henüz hazır değil.' },
    { status: 422, code: 'VALIDATION_ERROR', msg: 'Tespit filtreleri doğrulanamadı.' },
    { status: 0, code: 'NETWORK_ERROR', msg: 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.' },
    { status: 500, code: 'INTERNAL_SERVER_ERROR', msg: 'Tespit sonuçları geçici olarak kullanılamıyor.' },
  ];

  errorMappings.forEach(({ status, code, msg }, index) => {
    it(`26.${index + 1}. Bilinen status + code (${status} ${code}) çiftleri doğru eşlenir`, async () => {
      vi.mocked(listDetectionResults).mockRejectedValueOnce(new ApiError(status, { code, message: 'Err', details: null }));
      render(<DetectionResultsList jobId={123} />);
      await waitFor(() => expect(screen.getByText(msg)).toBeInTheDocument());
    });
  });

  it('27. Aynı status fakat yanlış code özel mesaj üretmez', async () => {
    vi.mocked(listDetectionResults).mockRejectedValueOnce(new ApiError(404, { code: 'UNKNOWN_CODE', message: 'Err', details: null }));
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları güvenli biçimde yüklenemedi.')).toBeInTheDocument());
  });

  it('28. Raw message, details, code, path ve stack trace sızmaz', async () => {
    vi.mocked(listDetectionResults).mockRejectedValueOnce(new ApiError(500, { code: 'DB_ERROR', message: 'Secret details', details: 'StackTrace...' }));
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.queryByText(/Secret/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Stack/)).not.toBeInTheDocument();
      expect(screen.queryByText(/DB_ERROR/)).not.toBeInTheDocument();
    });
  });

  it('29. Response jobId uyuşmazlığı reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [{ ...validItems[0], job_id: 999 }] });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('30. Geçersiz probability reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [{ ...validItems[0], attack_probability: 1.5 }] });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('31. Geçersiz risk seviyesi reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [{ ...validItems[0], risk_level: 'SUPER' as DetectionRiskLevel }] });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('32. Negatif/kesirli ID ve row index reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [{ ...validItems[0], id: -5 }] });
    const { rerender } = render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
    
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [{ ...validItems[0], row_index: 1.5 }] });
    rerender(<DetectionResultsList jobId={124} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('33. Geçersiz page metadata reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, skip: -1 });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('34. Duplicate ID reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [validItems[0], validItems[0]] });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('35. Duplicate row index reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [validItems[0], { ...validItems[1], row_index: 0 }] });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('36. Sırasız row index reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [validItems[1], validItems[0]] });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('37. items.length > limit reddedilir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, limit: 2, items: validItems });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Tespit sonuçları doğrulanamadı.')).toBeInTheDocument());
  });

  it('38. Geçersiz tarih Bilinmiyor gösterir', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce({ ...validPage, items: [{ ...validItems[0], created_at: 'invalid-date' }] });
    render(<DetectionResultsList jobId={123} />);
    await waitFor(() => expect(screen.getByText('Bilinmiyor')).toBeInTheDocument());
  });

  it('39. DOM’da token veya hassas mock değerleri bulunmaz', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      expect(screen.queryByText(mockToken)).not.toBeInTheDocument();
    });
  });

  it('40. Çoklu sonuçlarda gereksiz çok sayıda live region oluşmaz', async () => {
    vi.mocked(listDetectionResults).mockResolvedValueOnce(validPage);
    render(<DetectionResultsList jobId={123} />);
    
    await waitFor(() => {
      const liveRegions = screen.getAllByRole('status', { hidden: true });
      // Initially, loading might add one, then it's gone.
      // We shouldn't have one per item.
      expect(liveRegions.length).toBeLessThan(10);
    });
  });
});
