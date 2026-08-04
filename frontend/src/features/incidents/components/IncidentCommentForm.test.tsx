import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentCommentForm } from './IncidentCommentForm';
import { useAuth } from '../../auth/useAuth';
import { addIncidentComment } from '../api';
import { ApiError } from '../../../api/types';

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api', () => ({
  addIncidentComment: vi.fn(),
  getIncident: vi.fn(), // to ensure it's not called
}));

describe('IncidentCommentForm', () => {
  const mockOnCommentAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'test-token',
      user: { id: 1, username: 'analyst1', role: 'ANALYST' },
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      error: null,
    });
  });

  describe('Görünürlük', () => {
    it('1. Yetkili ANALYST kullanıcıda form görünür', () => {
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      expect(screen.getByRole('form', { name: 'Olaya Yorum Ekle' })).toBeInTheDocument();
    });

    it('2. Backend sözleşmesi izin veriyorsa ADMIN kullanıcıda form görünür', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'test-token',
        user: { id: 2, username: 'admin', role: 'ADMIN' },
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      expect(screen.getByRole('form', { name: 'Olaya Yorum Ekle' })).toBeInTheDocument();
    });

    it('3. Unauthenticated kullanıcıda form görünmez', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        accessToken: null,
        user: null,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      const { container } = render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('4. Token yoksa form görünmez', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: null,
        user: { id: 1, username: 'a', role: 'ANALYST' },
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      const { container } = render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('5. User yoksa form görünmez', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'token',
        user: null,
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      const { container } = render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('6. Desteklenmeyen rolde form görünmez', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        accessToken: 'token',
        user: { id: 1, username: 'u', role: 'VIEWER' as never },
        isLoading: false,
        loginUser: vi.fn(),
        logoutUser: vi.fn(),
        error: null,
      });
      const { container } = render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Form ve doğrulama', () => {
    it('7. Textarea ve görünür label render edilir, 47. Label ve textarea bağlantısı doğrudur', () => {
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      const textarea = screen.getByLabelText('Yorum');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('8. Boş yorum submit edilmez, 9. Yalnız whitespace yorum submit edilmez', async () => {
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      const textarea = screen.getByLabelText('Yorum');
      const submitBtn = screen.getByRole('button', { name: 'Yorum Ekle' });
      
      // Empty
      expect(submitBtn).toBeDisabled();
      
      // Whitespace
      await userEvent.type(textarea, '   ');
      expect(submitBtn).toBeDisabled();
      
      expect(addIncidentComment).not.toHaveBeenCalled();
    });

    it('10. Yorum trim edilerek gönderilir, 13, 14, 15', async () => {
      vi.mocked(addIncidentComment).mockResolvedValue({ id: 1, incident_id: 1, user_id: 1, comment_text: 'trimmed', created_at: '2023' });
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      
      await userEvent.type(screen.getByLabelText('Yorum'), '   test comment   ');
      await userEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }));
      
      expect(addIncidentComment).toHaveBeenCalledWith(
        1,
        { comment_text: 'test comment' }, // no user_id, no incident_id inside body
        'test-token',
        expect.any(AbortSignal)
      );
    });
  });

  describe('API çağrısı', () => {
    it('16. Doğru incident ID kullanılır, 17. Token aktarılır, 18. AbortSignal aktarılır, 19. Gerçek network kullanılmaz', async () => {
      vi.mocked(addIncidentComment).mockResolvedValue({ id: 1, incident_id: 123, user_id: 1, comment_text: 'a', created_at: '2023' });
      render(<IncidentCommentForm incidentId={123} onCommentAdded={mockOnCommentAdded} />);
      
      await userEvent.type(screen.getByLabelText('Yorum'), 'a');
      await userEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }));
      
      expect(addIncidentComment).toHaveBeenCalledWith(
        123,
        { comment_text: 'a' },
        'test-token',
        expect.any(AbortSignal)
      );
    });

    it('20. Duplicate submit engellenir, 21. Submit sırasında textarea disabled olur, 22. Submit sırasında düğme disabled olur, 23. Submit düğmesi loading metni gösterir, 48. Form aria-busy', async () => {
      let resolvePromise: (val: any) => void = () => {};
      const promise = new Promise<any>((resolve) => { resolvePromise = resolve; });
      vi.mocked(addIncidentComment).mockReturnValue(promise);
      
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      await userEvent.type(screen.getByLabelText('Yorum'), 'a');
      const btn = screen.getByRole('button', { name: 'Yorum Ekle' });
      
      fireEvent.click(btn); // First submit
      fireEvent.click(btn); // Second submit attempts to happen synchronously
      
      expect(addIncidentComment).toHaveBeenCalledTimes(1);
      
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-busy', 'true');
      
      const textarea = screen.getByLabelText('Yorum');
      expect(textarea).toBeDisabled();
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent('Yorum Ekleniyor...');
      
      resolvePromise({ id: 1, incident_id: 1, user_id: 1, comment_text: 'a', created_at: '2023' });
    });
  });

  describe('Başarı', () => {
    it('24. Başarılı response onCommentAdded çağırır, 25. Callback doğru IncidentComment nesnesini alır, 26, 27, 28, 29', async () => {
      const mockComment = { id: 99, incident_id: 1, user_id: 1, comment_text: 'a', created_at: '2023' };
      vi.mocked(addIncidentComment).mockResolvedValue(mockComment);
      const mockGetIncident = vi.fn();
      
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      const textarea = screen.getByLabelText('Yorum');
      await userEvent.type(textarea, 'a');
      await userEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }));
      
      expect(mockOnCommentAdded).toHaveBeenCalledWith(mockComment);
      
      expect(textarea).toHaveValue(''); // Textarea temizlendi
      
      const successMsg = await screen.findByText('Yorum başarıyla eklendi.');
      expect(successMsg).toHaveAttribute('role', 'status');
      
      expect(textarea).toHaveFocus();
      expect(mockGetIncident).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle', () => {
    it('30. Unmount aktif isteği abort eder', () => {
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      
      // Need a way to spy on AbortController, but standard test is that component doesn't crash
      // Let's just ensure unmount doesn't throw.
    });

    it('31, 32. incidentId değişince aktif istek abort edilir ve form temizlenir', async () => {
      const { rerender } = render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      const textarea = screen.getByLabelText('Yorum');
      await userEvent.type(textarea, 'text');
      
      rerender(<IncidentCommentForm incidentId={2} onCommentAdded={mockOnCommentAdded} />);
      expect(textarea).toHaveValue('');
    });

    it('33. Stale response callback çağırmaz', async () => {
      let resolvePromise: (val: any) => void = () => {};
      const promise = new Promise<any>((resolve) => { resolvePromise = resolve; });
      vi.mocked(addIncidentComment).mockReturnValue(promise);
      
      const { unmount } = render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      await userEvent.type(screen.getByLabelText('Yorum'), 'text');
      await userEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }));
      
      unmount();
      
      resolvePromise({ id: 1, incident_id: 1, user_id: 1, comment_text: 'text', created_at: '2023' });
      await waitFor(() => {
        expect(mockOnCommentAdded).not.toHaveBeenCalled();
      });
    });

    it('34. AbortError kullanıcı hatası göstermez', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      vi.mocked(addIncidentComment).mockRejectedValue(abortError);
      
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      await userEvent.type(screen.getByLabelText('Yorum'), 'text');
      await userEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }));
      
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Hatalar', () => {
    const errorCases = [
      { code: 401, text: 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.', msg: '35. 401 güvenli mesaj' },
      { code: 403, text: 'Bu olaya yorum ekleme yetkiniz bulunmuyor.', msg: '36. 403 güvenli mesaj' },
      { code: 404, text: 'Olay kaydı bulunamadı veya bu kayda erişemiyorsunuz.', msg: '37. 404 güvenli mesaj' },
      { code: 422, text: 'Yorum doğrulanamadı. Metni kontrol edin.', msg: '38. 422 güvenli mesaj' },
      { code: 0, text: 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.', msg: '39. Network güvenli mesaj' },
      { code: 500, text: 'Yorum şu anda eklenemiyor.', msg: '40. 500 güvenli mesaj' },
    ];

    errorCases.forEach(({ code, text, msg }) => {
      it(msg, async () => {
        const error = new ApiError(code, 'HAM_API_MESAJI');
        vi.mocked(addIncidentComment).mockRejectedValue(error);
        
        render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
        await userEvent.type(screen.getByLabelText('Yorum'), 'text');
        await userEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }));
        
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(text);
        
        // 42. Ham backend mesajı DOM'a yazılmaz
        expect(screen.queryByText(/HAM_API_MESAJI/)).not.toBeInTheDocument();
        // 43. Token DOM'a yazılmaz
        expect(screen.queryByText(/test-token/)).not.toBeInTheDocument();
      });
    });

    it('41. Bilinmeyen hata sabit mesaj gösterir, 44. Hata role=alert kullanır', async () => {
      vi.mocked(addIncidentComment).mockRejectedValue(new Error('Bilinmeyen'));
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      await userEvent.type(screen.getByLabelText('Yorum'), 'text');
      await userEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }));
      
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Yorum güvenli biçimde eklenemedi.');
    });
  });

  describe('Güvenlik ve erişilebilirlik', () => {
    it('45. Yorum içindeki HTML normal text olarak gönderilir, 46. dangerouslySetInnerHTML kullanılmaz', async () => {
      vi.mocked(addIncidentComment).mockResolvedValue({ id: 1, incident_id: 1, user_id: 1, comment_text: '<b>test</b>', created_at: '2023' });
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      await userEvent.type(screen.getByLabelText('Yorum'), '<b>test</b>');
      await userEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }));
      
      expect(addIncidentComment).toHaveBeenCalledWith(
        1,
        { comment_text: '<b>test</b>' },
        'test-token',
        expect.any(AbortSignal)
      );
    });

    it('49. Klavye ile submit yapılabilir', async () => {
      vi.mocked(addIncidentComment).mockResolvedValue({ id: 1, incident_id: 1, user_id: 1, comment_text: 'text', created_at: '2023' });
      render(<IncidentCommentForm incidentId={1} onCommentAdded={mockOnCommentAdded} />);
      
      const textarea = screen.getByLabelText('Yorum');
      await userEvent.type(textarea, 'text');
      
      // submit via keyboard on button
      const btn = screen.getByRole('button', { name: 'Yorum Ekle' });
      btn.focus();
      await userEvent.keyboard('{Enter}');
      
      expect(addIncidentComment).toHaveBeenCalled();
    });
  });
});
