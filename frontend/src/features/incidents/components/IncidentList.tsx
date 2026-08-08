import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { listIncidents } from '../api';
import type { IncidentListItem, IncidentStatus, IncidentSeverity } from '../types';
import { ApiError } from '../../../api/types';
import { Link } from 'react-router';

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
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-extrabold text-[var(--color-text-primary)]">Olaylar</h2>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">Güvenlik tespitlerinden oluşturulan olay kayıtlarını inceleyin.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-xl items-end">
        <div className="w-full md:flex-1">
          <label htmlFor="status-filter" className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase mb-1.5">Olay Durumu</label>
          <select
            id="status-filter"
            value={statusFilter || ''}
            onChange={handleStatusChange}
            disabled={isLoading}
            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-[var(--color-text-accent)] focus:border-transparent outline-none disabled:opacity-50 transition-shadow"
          >
            <option value="">Tüm Durumlar</option>
            <option value="OPEN">Açık</option>
            <option value="IN_PROGRESS">İnceleniyor</option>
            <option value="RESOLVED">Çözüldü</option>
            <option value="FALSE_POSITIVE">Yanlış Pozitif</option>
          </select>
        </div>
        <div className="w-full md:flex-1">
          <label htmlFor="severity-filter" className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase mb-1.5">Önem Seviyesi</label>
          <select
            id="severity-filter"
            value={severityFilter || ''}
            onChange={handleSeverityChange}
            disabled={isLoading}
            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-[var(--color-text-accent)] focus:border-transparent outline-none disabled:opacity-50 transition-shadow"
          >
            <option value="">Tüm Seviyeler</option>
            <option value="LOW">Düşük</option>
            <option value="MEDIUM">Orta</option>
            <option value="HIGH">Yüksek</option>
            <option value="CRITICAL">Kritik</option>
          </select>
        </div>
        <div className="w-full md:w-auto flex items-center h-[42px]">
          <label className="flex items-center gap-2.5 cursor-pointer group select-none">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={assignedToMeOnly}
                onChange={handleAssignedChange}
                disabled={isLoading}
                className="peer sr-only"
              />
              <div className="w-5 h-5 rounded-md border-2 border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] peer-checked:bg-[var(--color-text-accent)] peer-checked:border-[var(--color-text-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-text-accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-surface-elevated)] peer-disabled:opacity-50 transition-all flex items-center justify-center">
                <svg className={`w-3 h-3 text-[var(--color-surface-base)] transition-opacity ${assignedToMeOnly ? 'opacity-100' : 'opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="text-sm font-bold text-[var(--color-text-primary)] group-disabled:opacity-50 transition-opacity">Yalnız Bana Atananlar</span>
          </label>
        </div>
      </div>

      {apiError ? (
        <div role="alert" className="p-4 bg-[var(--color-semantic-danger)]/10 border border-[var(--color-semantic-danger)]/30 rounded-xl text-[var(--color-semantic-danger)] flex items-center justify-between">
          <span className="text-sm font-medium">{apiError}</span>
          <button
            onClick={handleRetry}
            disabled={isLoading}
            className="px-4 py-2 bg-[var(--color-semantic-danger)] hover:bg-[var(--color-semantic-danger)]/80 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            Tekrar Dene
          </button>
        </div>
      ) : isLoading && !incidents ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-12 flex flex-col items-center justify-center text-[var(--color-text-secondary)] gap-4">
          <svg className="animate-spin h-8 w-8 text-[var(--color-text-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-semibold text-lg">Olaylar yükleniyor...</span>
        </div>
      ) : incidents?.length === 0 ? (
        <div aria-live="polite" className="p-8 text-center text-[var(--color-text-secondary)] font-medium bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-xl">
          {(statusFilter || severityFilter || assignedToMeOnly)
            ? 'Seçilen filtrelerle eşleşen olay bulunamadı.'
            : 'Henüz oluşturulmuş bir olay bulunmuyor.'}
        </div>
      ) : (
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-[var(--color-surface-base)]/60 z-10 flex items-center justify-center backdrop-blur-[2px] rounded-xl">
              <div role="status" aria-live="polite" aria-busy="true" className="bg-[var(--color-surface-elevated)] p-4 rounded-xl shadow-xl flex items-center gap-3 border border-[var(--color-border-subtle)]">
                <svg className="animate-spin h-5 w-5 text-[var(--color-text-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-bold text-[var(--color-text-primary)]">Olaylar yükleniyor...</span>
              </div>
            </div>
          )}

          <ul className="flex flex-col gap-3 mb-6">
            {incidents?.map((incident) => (
              <li key={incident.id} className="group flex flex-col gap-4 p-4 md:p-5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors overflow-hidden">
                <div className="flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center">

                  {/* Sol Kısım: ID ve Başlık */}
                  <div className="md:col-span-3 flex flex-col gap-1 w-full">
                    <span className="text-xs font-mono font-medium text-[var(--color-text-muted)]">#{incident.id}</span>
                    <h3 className="font-bold text-[var(--color-text-primary)] text-sm md:text-base leading-snug break-words line-clamp-2" title={incident.title}>
                      {incident.title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] break-words line-clamp-2 mt-1" title={incident.description}>
                      {incident.description}
                    </p>
                  </div>

                  {/* Orta Kısım: Badges (Severity, Status, Assignee) */}
                  <div className="md:col-span-4 flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 w-full">
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wide border ${
                      incident.severity === 'CRITICAL' ? 'bg-[var(--color-semantic-danger)]/10 text-[var(--color-semantic-danger)] border-[var(--color-semantic-danger)]/20' :
                      incident.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      incident.severity === 'MEDIUM' ? 'bg-[var(--color-semantic-warning)]/10 text-[var(--color-semantic-warning)] border-[var(--color-semantic-warning)]/20' :
                      'bg-[var(--color-semantic-info)]/10 text-[var(--color-semantic-info)] border-[var(--color-semantic-info)]/20'
                    }`}>
                      {getSeverityLabel(incident.severity)}
                    </span>
                    <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-[var(--color-surface-base)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                      {getStatusLabel(incident.status)}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] border-l border-[var(--color-border-subtle)] pl-2 md:pl-3">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {renderAnalyst(incident.assigned_analyst_id)}
                    </div>
                  </div>

                  {/* Tarih / Metadata */}
                  <div className="md:col-span-3 flex flex-col items-start md:items-end gap-1 min-w-0 w-full">
                    <div className="flex items-center justify-between md:justify-end gap-1.5 w-full">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider shrink-0">Oluşturulma</span>
                      <span className="text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
                        {formatDate(incident.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-1.5 w-full">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider shrink-0">Son Güncelleme</span>
                      <span className="text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
                        {formatDate(incident.updated_at)}
                      </span>
                    </div>
                  </div>

                  {/* Aksiyon */}
                  <div className="md:col-span-2 flex items-center justify-start md:justify-end w-full mt-2 md:mt-0">
                    <Link
                      to={`/incidents/${incident.id}`}
                      aria-label={`"${incident.title}" olayının detayını görüntüle`}
                      className="shrink-0 px-4 py-2 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-text-accent)] hover:border-[var(--color-text-accent)] hover:text-slate-900 text-[var(--color-text-primary)] text-xs font-bold rounded-lg transition-all focus:ring-2 focus:ring-[var(--color-text-accent)] focus:outline-none focus:ring-offset-2 focus:ring-offset-[var(--color-surface-elevated)] w-full text-center md:w-auto"
                    >
                      Detayı Gör
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[var(--color-border-subtle)] pt-5 mt-auto">
        <div aria-live="polite" className="text-sm font-medium text-[var(--color-text-muted)] w-full sm:w-auto text-center sm:text-left">
          {incidents && incidents.length > 0
            ? `${skip + 1} - ${skip + incidents.length} arası gösteriliyor`
            : '0 kayıt'}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrevPage}
            disabled={isLoading || skip === 0}
            className="flex-1 sm:flex-none px-4 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm font-bold rounded-lg hover:bg-[var(--color-surface-hover)] focus:ring-2 focus:ring-[var(--color-text-accent)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Önceki
          </button>
          <button
            onClick={handleNextPage}
            disabled={isLoading || !hasNextPage}
            className="flex-1 sm:flex-none px-4 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm font-bold rounded-lg hover:bg-[var(--color-surface-hover)] focus:ring-2 focus:ring-[var(--color-text-accent)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
};
