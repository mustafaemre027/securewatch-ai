import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../auth/useAuth';
import { addIncidentComment } from '../api';
import type { IncidentComment } from '../types';
import { ApiError } from '../../../api/types';

export interface IncidentCommentFormProps {
  incidentId: number;
  onCommentAdded: (comment: IncidentComment) => void;
}

export const IncidentCommentForm: React.FC<IncidentCommentFormProps> = ({ incidentId, onCommentAdded }) => {
  const { isAuthenticated, accessToken, user } = useAuth();
  
  const [prevIncidentId, setPrevIncidentId] = useState(incidentId);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (incidentId !== prevIncidentId) {
    setPrevIncidentId(incidentId);
    setCommentText('');
    setFormError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
  }
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cancel any ongoing request if incidentId or token changes, or on unmount
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [incidentId, accessToken]);

  if (!isAuthenticated || !accessToken || !user) {
    return null;
  }

  if (user.role !== 'ADMIN' && user.role !== 'ANALYST') {
    return null;
  }

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.name === 'AbortError') {
      return '';
    }
    if (error instanceof ApiError) {
      switch (error.status) {
        case 401: return 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
        case 403: return 'Bu olaya yorum ekleme yetkiniz bulunmuyor.';
        case 404: return 'Olay kaydı bulunamadı veya bu kayda erişemiyorsunuz.';
        case 422: return 'Yorum doğrulanamadı. Metni kontrol edin.';
        case 500: return 'Yorum şu anda eklenemiyor.';
        case 0: return 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
        default: return 'Yorum güvenli biçimde eklenemedi.';
      }
    }
    return 'Yorum güvenli biçimde eklenemedi.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !accessToken) return;

    const trimmedComment = commentText.trim();
    if (!trimmedComment) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const newComment = await addIncidentComment(
        incidentId,
        { comment_text: trimmedComment },
        accessToken,
        abortControllerRef.current.signal
      );
      
      onCommentAdded(newComment);
      setCommentText('');
      setSuccessMessage('Yorum başarıyla eklendi.');
      setIsSubmitting(false); // Enable before focus
      
      // Use setTimeout to ensure DOM has re-rendered and textarea is not disabled anymore
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 0);
    } catch (err) {
      setIsSubmitting(false);
      if (err instanceof Error && err.name === 'AbortError') {
        // Ignore abort errors
        return;
      }
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      aria-labelledby="comment-form-heading"
      aria-busy={isSubmitting}
      className="flex flex-col gap-4 mt-6 pt-6 border-t border-[var(--color-border-subtle)]"
    >
      <h3 id="comment-form-heading" className="text-base font-bold text-[var(--color-text-primary)]">Olaya Yorum Ekle</h3>
      
      {formError && (
        <div role="alert" className="bg-[var(--color-semantic-danger)]/10 border border-[var(--color-semantic-danger)]/20 text-[var(--color-semantic-danger)] px-4 py-3 rounded-lg text-sm font-medium">
          {formError}
        </div>
      )}

      {successMessage && (
        <div role="status" aria-live="polite" className="bg-[var(--color-semantic-success)]/10 border border-[var(--color-semantic-success)]/20 text-[var(--color-semantic-success)] px-4 py-3 rounded-lg text-sm font-medium">
          {successMessage}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="comment_text" className="text-sm font-bold text-[var(--color-text-secondary)]">
          Yorum
        </label>
        <textarea
          id="comment_text"
          ref={textareaRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          disabled={isSubmitting}
          required
          aria-describedby={formError ? 'comment-error' : undefined}
          className="w-full min-h-[120px] resize-y rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] px-4 py-3 text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          placeholder="Olay incelemesiyle ilgili notunuzu yazın."
        />
        {formError && <span id="comment-error" className="sr-only">{formError}</span>}
      </div>

      <button 
        type="submit" 
        disabled={isSubmitting || !commentText.trim()}
        className="self-start sm:w-auto w-full bg-[var(--color-accent-primary)] hover:opacity-90 text-[var(--color-surface-base)] font-bold py-2.5 px-6 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface-elevated)]"
      >
        {isSubmitting ? 'Yorum Ekleniyor...' : 'Yorum Ekle'}
      </button>
    </form>
  );
};
