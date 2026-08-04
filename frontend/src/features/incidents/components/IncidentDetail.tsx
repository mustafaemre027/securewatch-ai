import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getIncident } from '../api';
import type { IncidentDetail as IncidentDetailType, IncidentStatus, IncidentSeverity } from '../types';
import { ApiError } from '../../../api/types';

export interface IncidentDetailProps {
  incidentId: number;
  onBack?: () => void;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({ incidentId, onBack }) => {
  const { isAuthenticated, accessToken, user } = useAuth();

  const [incident, setIncident] = useState<IncidentDetailType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentIncidentIdRef = useRef<number | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!isAuthenticated || !accessToken || !user || !incidentId || incidentId <= 0 || !Number.isInteger(incidentId)) {
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    currentIncidentIdRef.current = incidentId;

    setIsLoading(true);
    setApiError(null);
    setIncident(null); // Clean previous incident info

    try {
      const response = await getIncident(incidentId, accessToken, controller.signal);

      if (abortControllerRef.current === controller) {
        setIncident(response);
        setApiError(null);
      }
    } catch (err: unknown) {
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

        setApiError(errorMessage);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, accessToken, user, incidentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDetail();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDetail]);

  const handleRetry = () => {
    if (!isLoading) {
      fetchDetail();
    }
  };

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
    <section aria-labelledby="incident-detail-heading" className="w-full max-w-4xl mx-auto bg-rich-navy border border-space-blue rounded-xl p-6 text-white min-w-[320px] overflow-hidden">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-space-blue">
        <h2 id="incident-detail-heading" className="text-xl font-bold">Olay Detayı</h2>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-deep-dark border border-space-blue text-white text-sm font-bold rounded-lg hover:bg-space-blue transition-colors"
          >
            Olay Listesine Dön
          </button>
        )}
      </div>

      {apiError ? (
        <div role="alert" className="p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>{apiError}</span>
          {!isLoading && (
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 shrink-0"
            >
              Tekrar Dene
            </button>
          )}
        </div>
      ) : isLoading && !incident ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-12 flex flex-col items-center justify-center text-slate-300 gap-4">
          <svg className="animate-spin h-8 w-8 text-ai-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-semibold text-lg">Olay detayı yükleniyor...</span>
        </div>
      ) : incident ? (
        <div className="flex flex-col gap-8 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-rich-navy/60 z-10 flex items-center justify-center backdrop-blur-[2px] rounded-lg">
              <div role="status" aria-live="polite" aria-busy="true" className="bg-deep-dark p-4 rounded-lg shadow-xl flex items-center gap-3 border border-space-blue">
                <svg className="animate-spin h-5 w-5 text-ai-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-semibold">Olay detayı yükleniyor...</span>
              </div>
            </div>
          )}
          
          <div className="bg-deep-dark p-6 rounded-xl border border-space-blue">
            <h3 className="text-2xl font-bold text-white mb-4 break-words">{incident.title}</h3>
            
            <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-rich-navy rounded-lg border border-space-blue/50">
              <div>
                <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Durum</dt>
                <dd>
                  <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full bg-space-blue text-slate-200">
                    {getStatusLabel(incident.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Önem Seviyesi</dt>
                <dd>
                  <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full text-white ${
                    incident.severity === 'CRITICAL' ? 'bg-red-500' :
                    incident.severity === 'HIGH' ? 'bg-orange-500' :
                    incident.severity === 'MEDIUM' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}>
                    {getSeverityLabel(incident.severity)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Atanan Analist</dt>
                <dd className="font-medium text-slate-200">{renderAnalyst(incident.assigned_analyst_id)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Oluşturulma</dt>
                <dd className="font-medium text-slate-200">{formatDate(incident.created_at)}</dd>
              </div>
            </dl>
            
            <div className="mb-2">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Açıklama</h4>
              <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed break-words">
                {incident.description}
              </p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-space-blue/50">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Son Güncellenme: <span className="font-normal">{formatDate(incident.updated_at)}</span>
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-4">Yorum Geçmişi</h3>
            
            {(!incident.comments || incident.comments.length === 0) ? (
              <div aria-live="polite" className="p-8 text-center text-slate-400 bg-deep-dark border border-space-blue rounded-lg">
                Henüz yorum eklenmemiş.
              </div>
            ) : (
              <ol className="space-y-4">
                {incident.comments.map((comment) => (
                  <li key={comment.id} className="p-4 bg-deep-dark border border-space-blue rounded-lg flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-ai-teal">
                        {renderCommentAuthor(comment.user_id)}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
                      {comment.comment_text}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};
