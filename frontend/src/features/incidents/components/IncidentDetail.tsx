import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getIncident } from '../api';
import type { IncidentDetail as IncidentDetailType, IncidentStatus, IncidentSeverity, IncidentListItem } from '../types';
import { ApiError } from '../../../api/types';
import { IncidentActionPanel } from './IncidentActionPanel';
import { IncidentCommentForm } from './IncidentCommentForm';
import { IncidentAssignmentPanel } from './IncidentAssignmentPanel';
import type { IncidentComment } from '../types';

export interface IncidentDetailProps {
  incidentId: number;
  onBack?: () => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({ incidentId, onBack }) => {
  const { isAuthenticated, accessToken, user } = useAuth();

  const [incidentData, setIncidentData] = useState<{ id: number; data: IncidentDetailType } | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [apiErrorData, setApiErrorData] = useState<{ id: number; error: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchDetail = useCallback(() => {
    if (!isAuthenticated || !accessToken || !user || !incidentId || incidentId <= 0 || !Number.isInteger(incidentId)) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const fetchId = incidentId;

    getIncident(fetchId, accessToken, controller.signal)
      .then((response) => {
        if (abortControllerRef.current === controller) {
          setIncidentData({ id: fetchId, data: response });
          setApiErrorData(null);
          setIsRetrying(false);
        }
      })
      .catch((err: unknown) => {
        if (err && typeof err === 'object' && 'name' in err && (err as Error).name === 'AbortError') {
          return;
        }
        
        if (abortControllerRef.current === controller) {
          let errorMessage = 'Olay detayı güvenli biçimde yüklenemedi.';

          const isApiError = err instanceof ApiError || (err && typeof err === 'object' && 'status' in err && 'code' in err);

          if (isApiError) {
            const apiErr = err as ApiError;
            const statusCode = `${apiErr.status}_${apiErr.code}`;
            
            switch (statusCode) {
              case '401_CREDENTIALS_INVALID':
              case '401_TOKEN_INVALID':
              case '401_TOKEN_EXPIRED':
                errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
                break;
              case '0_NETWORK_ERROR':
                errorMessage = 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
                break;
              default:
                if (apiErr.status === 403) {
                  errorMessage = 'Bu olayın detaylarını görüntüleme yetkiniz bulunmuyor.';
                } else if (apiErr.status === 404) {
                  errorMessage = 'Olay kaydı bulunamadı veya bu kayda erişemiyorsunuz.';
                } else if (apiErr.status === 422) {
                  errorMessage = 'Olay kimliği doğrulanamadı.';
                } else if (apiErr.status === 401) {
                  errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
                } else if (apiErr.status >= 500) {
                  errorMessage = 'Olay detayı geçici olarak kullanılamıyor.';
                }
                break;
            }
          }

          setApiErrorData({ id: fetchId, error: errorMessage });
          setIsRetrying(false);
        }
      });
  }, [isAuthenticated, accessToken, user, incidentId]);

  useEffect(() => {
    fetchDetail();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDetail]);

  const isInvalidId = !incidentId || incidentId <= 0 || !Number.isInteger(incidentId);
  const hasData = incidentData && incidentData.id === incidentId;
  const hasError = apiErrorData && apiErrorData.id === incidentId;
  
  const isLoading = isRetrying || (!hasData && !hasError && !isInvalidId);
  const apiError = hasError ? apiErrorData.error : null;
  const incident = hasData ? incidentData.data : null;

  const handleRetry = () => {
    if (!isLoading) {
      setIsRetrying(true);
      setApiErrorData(null);
      fetchDetail();
    }
  };

  const handleIncidentUpdate = useCallback((updatedIncident: IncidentListItem) => {
    setIncidentData((current) => {
      if (!current || !current.data) {
        return current;
      }
      return {
        id: current.id,
        data: {
          ...current.data,
          ...updatedIncident,
          comments: current.data.comments,
        }
      };
    });
  }, []);

  const handleCommentAdded = useCallback((addedComment: IncidentComment) => {
    setIncidentData((current) => {
      if (!current || !current.data) {
        return current;
      }

      if (current.data.comments.some((item) => item.id === addedComment.id)) {
        return current;
      }

      return {
        id: current.id,
        data: {
          ...current.data,
          comments: [...current.data.comments, addedComment],
        }
      };
    });
  }, []);

  const getStatusLabel = (status: IncidentStatus) => {
    switch (status) {
      case 'OPEN':
        return 'Açık';
      case 'IN_PROGRESS':
        return 'İnceleniyor';
      case 'RESOLVED':
        return 'Çözüldü';
      case 'FALSE_POSITIVE':
        return 'Yanlış Pozitif';
      default:
        return status;
    }
  };

  const getSeverityLabel = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'LOW':
        return 'Düşük';
      case 'MEDIUM':
        return 'Orta';
      case 'HIGH':
        return 'Yüksek';
      case 'CRITICAL':
        return 'Kritik';
      default:
        return severity;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return 'Bilinmiyor';
      return d.toLocaleString('tr-TR');
    } catch {
      return 'Bilinmiyor';
    }
  };

  const renderAnalyst = (assignedId: number | null) => {
    if (assignedId === null) {
      return 'Atanmamış';
    }
    if (user && assignedId === user.id) {
      return 'Size Atanmış';
    }
    return `Analist #${assignedId}`;
  };
  
  const renderCommentAuthor = (authorId: number) => {
    if (user && authorId === user.id) {
      return 'Siz';
    }
    return `Kullanıcı #${authorId}`;
  };

  return (
    <section aria-labelledby="incident-detail-heading" className="w-full max-w-5xl mx-auto bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl p-4 md:p-6 text-[var(--color-text-primary)] min-w-[320px] overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <h2 id="incident-detail-heading" className="text-lg md:text-xl font-bold text-[var(--color-text-primary)]">Olay Detayı</h2>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-4 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-bold rounded-lg hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors focus:ring-2 focus:ring-[var(--color-text-accent)] focus:outline-none shrink-0"
          >
            Olay Listesine Dön
          </button>
        )}
      </div>

      {apiError ? (
        <div role="alert" className="p-4 bg-[var(--color-semantic-danger)]/10 border border-[var(--color-semantic-danger)]/20 rounded-lg text-[var(--color-semantic-danger)] mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-medium text-sm">{apiError}</span>
          {!isLoading && (
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className="px-4 py-2 bg-[var(--color-semantic-danger)] text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0 w-full sm:w-auto"
            >
              Tekrar Dene
            </button>
          )}
        </div>
      ) : isLoading && !incident ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-12 flex flex-col items-center justify-center text-[var(--color-text-secondary)] gap-4">
          <svg className="animate-spin h-8 w-8 text-[var(--color-text-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-bold text-sm">Olay detayı yükleniyor...</span>
        </div>
      ) : incident ? (
        <div className="flex flex-col gap-8 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-[var(--color-surface-base)]/60 z-10 flex items-center justify-center backdrop-blur-[2px] rounded-lg">
              <div role="status" aria-live="polite" aria-busy="true" className="bg-[var(--color-surface-elevated)] p-4 rounded-lg shadow-xl flex items-center gap-3 border border-[var(--color-border-subtle)]">
                <svg className="animate-spin h-5 w-5 text-[var(--color-text-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-bold text-[var(--color-text-primary)]">Olay detayı yükleniyor...</span>
              </div>
            </div>
          )}
          
          <div className="bg-[var(--color-surface-elevated)] p-5 md:p-6 rounded-xl border border-[var(--color-border-subtle)] flex flex-col gap-6">
            <h3 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] break-words leading-snug">{incident.title}</h3>
            
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 md:p-5 bg-[var(--color-surface-base)] rounded-xl border border-[var(--color-border-subtle)] w-full">
              <div className="flex flex-col gap-1.5">
                <dt className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Durum</dt>
                <dd>
                  <span className="inline-flex px-2.5 py-1 text-[11px] font-bold rounded-md bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                    {getStatusLabel(incident.status)}
                  </span>
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Önem Seviyesi</dt>
                <dd>
                  <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wide border ${
                    incident.severity === 'CRITICAL' ? 'bg-[var(--color-semantic-danger)]/10 text-[var(--color-semantic-danger)] border-[var(--color-semantic-danger)]/20' :
                    incident.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    incident.severity === 'MEDIUM' ? 'bg-[var(--color-semantic-warning)]/10 text-[var(--color-semantic-warning)] border-[var(--color-semantic-warning)]/20' :
                    'bg-[var(--color-semantic-info)]/10 text-[var(--color-semantic-info)] border-[var(--color-semantic-info)]/20'
                  }`}>
                    {getSeverityLabel(incident.severity)}
                  </span>
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Atanan Analist</dt>
                <dd className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {renderAnalyst(incident.assigned_analyst_id)}
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Oluşturulma</dt>
                <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                  {formatDate(incident.created_at)}
                </dd>
              </div>
            </dl>
            
            <div className="pt-2 border-t border-[var(--color-border-subtle)]">
              <h4 className="text-xs font-bold text-[var(--color-text-primary)] mb-3">Açıklama</h4>
              <p className="text-[var(--color-text-secondary)] text-sm whitespace-pre-wrap leading-relaxed break-words bg-[var(--color-surface-base)] p-4 rounded-xl border border-[var(--color-border-subtle)]">
                {incident.description}
              </p>
            </div>
            
            <div className="mt-1 pt-4 border-t border-[var(--color-border-subtle)]">
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                Son Güncellenme: <span className="font-medium text-[var(--color-text-primary)] normal-case">{formatDate(incident.updated_at)}</span>
              </span>
            </div>
          </div>

          <IncidentAssignmentPanel key={incident.id} incident={incident} onUpdated={handleIncidentUpdate} />
          <IncidentActionPanel incident={incident} onUpdated={handleIncidentUpdate} />

          <div className="bg-[var(--color-surface-elevated)] p-5 md:p-6 rounded-xl border border-[var(--color-border-subtle)]">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-5">Yorum Geçmişi</h3>
            
            {(!incident.comments || incident.comments.length === 0) ? (
              <div aria-live="polite" className="p-8 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl text-sm font-medium">
                Henüz yorum eklenmemiş.
              </div>
            ) : (
              <ol className="relative border-l border-[var(--color-border-subtle)] ml-3 sm:ml-4 space-y-6">
                {incident.comments.map((comment) => (
                  <li key={comment.id} className="pl-6 relative">
                    <span className="absolute -left-[5px] top-1.5 w-[9px] h-[9px] bg-[var(--color-surface-base)] border-2 border-[var(--color-text-accent)] rounded-full"></span>
                    <div className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl p-4 flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-1">
                        <span className="font-bold text-sm text-[var(--color-text-primary)] flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {renderCommentAuthor(comment.user_id)}
                        </span>
                        <span className="text-xs font-mono font-medium text-[var(--color-text-muted)]">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap break-words leading-relaxed">
                        {comment.comment_text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <IncidentCommentForm key={incident.id} incidentId={incident.id} onCommentAdded={handleCommentAdded} />
          </div>
        </div>
      ) : null}
    </section>
  );
};
