import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { listIncidents } from '../api';
import type { IncidentListItem, IncidentStatus, IncidentSeverity } from '../types';
import { ApiError } from '../../../api/types';

const PAGE_SIZE = 20;

export const IncidentList: React.FC = () => {
  const { isAuthenticated, accessToken, user } = useAuth();

  const [incidents, setIncidents] = useState<IncidentListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [skip, setSkip] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | undefined>(undefined);
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | undefined>(undefined);
  const [assignedToMeOnly, setAssignedToMeOnly] = useState<boolean>(false);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef<boolean>(false);

  const fetchIncidents = useCallback(async () => {
    if (!isAuthenticated || !accessToken || !user) {
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setApiError(null);
    isLoadingRef.current = true;

    try {
      const assignedAnalystId = assignedToMeOnly ? user.id : undefined;

      const response = await listIncidents(
        {
          status: statusFilter,
          severity: severityFilter,
          assignedAnalystId,
          skip,
          limit: PAGE_SIZE + 1,
        },
        accessToken,
        controller.signal
      );

      if (abortControllerRef.current === controller) {
        const hasNext = response.length > PAGE_SIZE;
        const visibleIncidents = response.slice(0, PAGE_SIZE);

        setIncidents(visibleIncidents);
        setHasNextPage(hasNext);
        setApiError(null);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as Error).name === 'AbortError') {
        return;
      }

      if (abortControllerRef.current === controller) {
        let errorMessage = 'Olaylar güvenli biçimde yüklenemedi.';

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
                errorMessage = 'Olayları görüntüleme yetkiniz bulunmuyor.';
              } else if (apiErr.status === 422) {
                errorMessage = 'Olay filtreleri doğrulanamadı.';
              } else if (apiErr.status === 401) {
                errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
              } else if (apiErr.status >= 500) {
                errorMessage = 'Olay listesi geçici olarak kullanılamıyor.';
              }
              break;
          }
        }

        setApiError(errorMessage);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [isAuthenticated, accessToken, user, skip, statusFilter, severityFilter, assignedToMeOnly]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIncidents();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchIncidents]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setStatusFilter(value ? (value as IncidentStatus) : undefined);
    setSkip(0);
  };

  const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSeverityFilter(value ? (value as IncidentSeverity) : undefined);
    setSkip(0);
  };

  const handleAssignedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAssignedToMeOnly(e.target.checked);
    setSkip(0);
  };

  const handleRetry = () => {
    if (!isLoading) {
      fetchIncidents();
    }
  };

  const handlePrevPage = () => {
    if (!isLoading && skip > 0) {
      setSkip((prev) => Math.max(0, prev - PAGE_SIZE));
    }
  };

  const handleNextPage = () => {
    if (!isLoading && hasNextPage) {
      setSkip((prev) => prev + PAGE_SIZE);
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

  return (
    <div className="w-full bg-rich-navy border border-space-blue rounded-xl p-6 text-white">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Olaylar</h2>
        <p className="text-sm text-slate-300">Güvenlik tespitlerinden oluşturulan olay kayıtlarını inceleyin.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-deep-dark border border-space-blue rounded-lg">
        <div className="flex-1">
          <label htmlFor="status-filter" className="block text-xs font-semibold text-slate-300 uppercase mb-2">Olay Durumu</label>
          <select
            id="status-filter"
            value={statusFilter || ''}
            onChange={handleStatusChange}
            disabled={isLoading}
            className="w-full bg-rich-navy border border-space-blue text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-ai-teal outline-none disabled:opacity-50"
          >
            <option value="">Tüm Durumlar</option>
            <option value="OPEN">Açık</option>
            <option value="IN_PROGRESS">İnceleniyor</option>
            <option value="RESOLVED">Çözüldü</option>
            <option value="FALSE_POSITIVE">Yanlış Pozitif</option>
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="severity-filter" className="block text-xs font-semibold text-slate-300 uppercase mb-2">Önem Seviyesi</label>
          <select
            id="severity-filter"
            value={severityFilter || ''}
            onChange={handleSeverityChange}
            disabled={isLoading}
            className="w-full bg-rich-navy border border-space-blue text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-ai-teal outline-none disabled:opacity-50"
          >
            <option value="">Tüm Seviyeler</option>
            <option value="LOW">Düşük</option>
            <option value="MEDIUM">Orta</option>
            <option value="HIGH">Yüksek</option>
            <option value="CRITICAL">Kritik</option>
          </select>
        </div>
        <div className="flex-1 flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={assignedToMeOnly}
              onChange={handleAssignedChange}
              disabled={isLoading}
              className="w-4 h-4 rounded bg-rich-navy border-space-blue text-ai-teal focus:ring-ai-teal focus:ring-2 disabled:opacity-50"
            />
            <span className="text-sm font-semibold text-slate-300">Yalnız Bana Atananlar</span>
          </label>
        </div>
      </div>

      {apiError ? (
        <div role="alert" className="p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 mb-6 flex items-center justify-between">
          <span>{apiError}</span>
          <button
            onClick={handleRetry}
            disabled={isLoading}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            Tekrar Dene
          </button>
        </div>
      ) : isLoading && !incidents ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-8 flex items-center justify-center text-slate-300">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-ai-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Olaylar yükleniyor...
        </div>
      ) : incidents?.length === 0 ? (
        <div aria-live="polite" className="p-8 text-center text-slate-400 bg-deep-dark border border-space-blue rounded-lg mb-6">
          {(statusFilter || severityFilter || assignedToMeOnly)
            ? 'Seçilen filtrelerle eşleşen olay bulunamadı.'
            : 'Henüz oluşturulmuş bir olay bulunmuyor.'}
        </div>
      ) : (
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-rich-navy/50 z-10 flex items-center justify-center backdrop-blur-[1px]">
              <div role="status" aria-live="polite" aria-busy="true" className="bg-deep-dark p-4 rounded-lg shadow-lg flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-ai-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-semibold">Olaylar yükleniyor...</span>
              </div>
            </div>
          )}

          <ul className="space-y-4 mb-6">
            {incidents?.map((incident) => (
              <li key={incident.id} className="p-4 bg-deep-dark border border-space-blue rounded-lg flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="font-bold text-lg text-white break-words">{incident.title}</h3>
                  <div className="flex gap-2 shrink-0">
                    <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-space-blue text-slate-300">
                      {getStatusLabel(incident.status)}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full text-white ${
                      incident.severity === 'CRITICAL' ? 'bg-red-500' :
                      incident.severity === 'HIGH' ? 'bg-orange-500' :
                      incident.severity === 'MEDIUM' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}>
                      {getSeverityLabel(incident.severity)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-300 break-words line-clamp-3">
                  {incident.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-3 border-t border-space-blue/50 text-xs text-slate-400">
                  <div>
                    <span className="block font-semibold text-slate-500 mb-0.5">Atanan Analist</span>
                    {renderAnalyst(incident.assigned_analyst_id)}
                  </div>
                  <div>
                    <span className="block font-semibold text-slate-500 mb-0.5">Oluşturulma</span>
                    {formatDate(incident.created_at)}
                  </div>
                  <div>
                    <span className="block font-semibold text-slate-500 mb-0.5">Son Güncelleme</span>
                    {formatDate(incident.updated_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-space-blue pt-4">
        <div aria-live="polite" className="text-sm text-slate-400">
          {incidents && incidents.length > 0
            ? `${skip + 1} - ${skip + incidents.length} arası gösteriliyor`
            : '0 kayıt'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrevPage}
            disabled={isLoading || skip === 0}
            className="px-4 py-2 bg-deep-dark border border-space-blue text-white text-sm font-bold rounded-lg hover:bg-space-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Önceki
          </button>
          <button
            onClick={handleNextPage}
            disabled={isLoading || !hasNextPage}
            className="px-4 py-2 bg-deep-dark border border-space-blue text-white text-sm font-bold rounded-lg hover:bg-space-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
};
