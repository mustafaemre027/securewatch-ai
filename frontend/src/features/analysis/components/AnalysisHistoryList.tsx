import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/useAuth';
import { listAnalysisJobs } from '../api';
import type { AnalysisJobListItem, AnalysisJobStatus } from '../types';
import { ApiError } from '../../../api/types';

const PAGE_SIZE = 20;

function formatBytes(bytes: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return 'Bilinmiyor';
  }
  if (bytes === 0) return '0 Byte';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Bilinmiyor';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Bilinmiyor';
  return date.toLocaleString('tr-TR');
}

export function AnalysisHistoryList() {
  const { accessToken, isAuthenticated } = useAuth();

  const [jobs, setJobs] = useState<AnalysisJobListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<AnalysisJobStatus | 'ALL'>('ALL');
  const [skip, setSkip] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  const fetchJobs = useCallback(async (currentSkip: number, currentStatus: AnalysisJobStatus | 'ALL') => {
    if (!isAuthenticated || !accessToken) {
      if (isMountedRef.current) setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    isFetchingRef.current = true;

    try {
      const params = {
        skip: currentSkip,
        limit: PAGE_SIZE,
        ...(currentStatus !== 'ALL' && { status: currentStatus })
      };

      const response = await listAnalysisJobs(params, accessToken, controller.signal);

      if (!isMountedRef.current || abortControllerRef.current !== controller) return;

      setJobs(response);
    } catch (err: unknown) {
      if (!isMountedRef.current || abortControllerRef.current !== controller) return;

      if (err instanceof Error && err.name === 'AbortError') return;

      let errorMessage = 'Analiz geçmişi güvenli biçimde yüklenemedi.';

      if (err instanceof ApiError) {
        switch (err.status) {
          case 400:
          case 422:
            errorMessage = 'İstek doğrulanamadı.';
            break;
          case 401:
            errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
            break;
          case 403:
            errorMessage = 'Analiz geçmişini görüntüleme yetkiniz bulunmuyor.';
            break;
          case 404:
            errorMessage = 'Analiz geçmişi bulunamadı.';
            break;
          default:
            if (err.status >= 500 && err.status <= 599) {
              errorMessage = 'Analiz geçmişi servisi geçici olarak kullanılamıyor.';
            } else if (err.status === 0) {
              errorMessage = 'Sunucuya şu anda ulaşılamıyor.';
            }
            break;
        }
      }

      setError(errorMessage);
    } finally {
      if (abortControllerRef.current === controller) {
        isFetchingRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
          abortControllerRef.current = null;
        }
      }
    }
  }, [accessToken, isAuthenticated]);

  useEffect(() => {
    isMountedRef.current = true;
    const load = async () => {
      await fetchJobs(skip, statusFilter);
    };
    void load();
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchJobs, skip, statusFilter]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as AnalysisJobStatus | 'ALL');
    setSkip(0);
  };

  const handleNextPage = () => {
    setSkip(prev => prev + PAGE_SIZE);
  };

  const handlePrevPage = () => {
    setSkip(prev => Math.max(0, prev - PAGE_SIZE));
  };

  const handleRefresh = () => {
    if (isFetchingRef.current) return;
    fetchJobs(skip, statusFilter);
  };

  const renderStatus = (status: AnalysisJobStatus | string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--color-semantic-success-bg)] border border-[var(--color-semantic-success)]">
            <svg className="w-3 h-3 text-[var(--color-semantic-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            <span className="text-xs font-bold text-[var(--color-semantic-success)]">Tamamlandı</span>
          </div>
        );
      case 'FAILED':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--color-semantic-danger-bg)] border border-[var(--color-semantic-danger)]">
            <svg className="w-3 h-3 text-[var(--color-semantic-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            <span className="text-xs font-bold text-[var(--color-semantic-danger)]">Başarısız</span>
          </div>
        );
      case 'PROCESSING':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--color-semantic-warning-bg)] border border-[var(--color-semantic-warning)]">
             <svg className="animate-spin w-3 h-3 text-[var(--color-semantic-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
             <span className="text-xs font-bold text-[var(--color-semantic-warning)]">İşleniyor</span>
          </div>
        );
      case 'PENDING':
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--color-semantic-info-bg)] border border-[var(--color-semantic-info)]">
            <svg className="w-3 h-3 text-[var(--color-semantic-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-xs font-bold text-[var(--color-semantic-info)]">Bekliyor</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border-default)]">
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">Bilinmeyen</span>
          </div>
        );
    }
  };

  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;
  const isPrevDisabled = skip === 0 || loading;
  const isNextDisabled = jobs.length < PAGE_SIZE || loading;
  const isEmpty = jobs.length === 0 && !loading && !error;

  return (
    <div className="w-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-subtle)]">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Analiz Geçmişi</h2>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none flex items-center">
            <label htmlFor="status-filter" className="sr-only">Durum Filtresi</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={handleStatusChange}
              disabled={loading}
              className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent-primary)] disabled:opacity-50"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="PENDING">Bekliyor</option>
              <option value="PROCESSING">İşleniyor</option>
              <option value="COMPLETED">Tamamlandı</option>
              <option value="FAILED">Başarısız</option>
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Listeyi Yenile"
            className="p-2 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="w-full relative min-h-[12rem] flex flex-col" aria-busy={loading}>
        {error && (
          <div className="p-4 bg-[var(--color-semantic-danger-bg)] border-l-4 border-[var(--color-semantic-danger)] rounded-r-lg mb-4" role="alert">
            <p className="text-sm text-[var(--color-semantic-danger)] font-medium">{error}</p>
          </div>
        )}

        {loading && !error && (
          <div className="absolute inset-0 z-10 bg-[var(--color-bg-base)]/50 backdrop-blur-sm flex items-center justify-center rounded-xl" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-6 w-6 text-[var(--color-accent-primary)] mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Analiz geçmişi yükleniyor...</p>
            </div>
          </div>
        )}

        {isEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] border-dashed rounded-xl">
            <p className="text-[var(--color-text-muted)] text-sm font-medium">
              {statusFilter === 'ALL'
                ? 'Henüz analiz kaydı bulunmuyor.'
                : 'Seçili filtreye uygun kayıt bulunmuyor.'}
            </p>
          </div>
        )}

        {!loading && !error && !isEmpty && (
          <div className="flex-1 flex flex-col">
            <div className="w-full">
              {/* Desktop Header */}
              <div className="hidden lg:grid grid-cols-[80px_1fr_120px_160px_140px_160px] gap-4 px-4 py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-t-xl text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                <span>Job ID</span>
                <span>Dosya Adı</span>
                <span>Boyut</span>
                <span>Oluşturulma</span>
                <span>Durum</span>
                <span className="text-right">Aksiyon</span>
              </div>

              <ul className="flex flex-col w-full gap-4 lg:gap-0" role="list">
                {jobs.map(job => (
                  <li key={job.id} className="relative flex flex-col gap-2 lg:grid lg:grid-cols-[80px_1fr_120px_160px_140px_160px] lg:items-center lg:gap-4 p-4 lg:py-3 lg:px-4 bg-[var(--color-surface-elevated)] lg:bg-transparent border lg:border-x lg:border-b border-[var(--color-border-subtle)] lg:border-t-0 rounded-xl lg:rounded-none lg:last:rounded-b-xl hover:bg-[var(--color-surface-hover)] transition-colors group">

                    {/* File Name */}
                    <div className="order-1 lg:order-2 flex min-w-0 w-full">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)] lg:font-medium lg:truncate break-all line-clamp-2 lg:line-clamp-none" title={job.file_name}>
                        {job.file_name}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="order-2 lg:order-5 flex items-center justify-start">
                      {renderStatus(job.status)}
                    </div>

                    {/* Job ID */}
                    <div className="order-3 lg:order-1 flex items-center gap-2">
                      <span className="lg:hidden text-xs font-semibold text-[var(--color-text-muted)] w-16">Job</span>
                      <span className="text-xs lg:text-sm font-bold text-[var(--color-accent-primary)] lg:font-semibold lg:text-[var(--color-text-secondary)]">
                        #{job.id}
                      </span>
                    </div>

                    {/* Size */}
                    <div className="order-4 lg:order-3 flex items-center gap-2">
                      <span className="lg:hidden text-xs font-semibold text-[var(--color-text-muted)] w-16">Boyut</span>
                      <span className="text-xs lg:text-sm text-[var(--color-text-secondary)]">
                        {formatBytes(job.file_size)}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="order-5 lg:order-4 flex items-center gap-2 lg:flex-col lg:items-start lg:gap-0 lg:min-w-0">
                      <span className="lg:hidden text-xs font-semibold text-[var(--color-text-muted)] w-16">Tarih</span>
                      <span className="text-xs lg:text-sm text-[var(--color-text-secondary)] truncate">
                        {formatDate(job.created_at)}
                      </span>
                      {job.completed_at && (
                        <span className="hidden lg:inline text-xs text-[var(--color-text-muted)] truncate">
                          {formatDate(job.completed_at)}
                        </span>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="order-6 flex justify-start lg:justify-end w-full lg:w-auto mt-2 lg:mt-0">
                      {job.status === 'COMPLETED' && typeof job.id === 'number' && Number.isSafeInteger(job.id) && job.id > 0 && (
                        <Link
                          to={`/analysis/${job.id}/results`}
                          aria-label={`Analiz #${job.id} sonuçlarını görüntüle`}
                          className="w-full lg:w-auto text-center px-4 py-2 lg:px-3 lg:py-1 bg-[var(--color-accent-primary)] lg:bg-[var(--color-surface-base)] text-[var(--color-bg-base)] lg:text-[var(--color-text-primary)] border lg:border-[var(--color-border-subtle)] lg:hover:border-[var(--color-accent-primary)] rounded-lg text-sm lg:text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] lg:opacity-0 group-hover:opacity-[1]"
                        >
                          Sonuçları görüntüle
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 py-3 border-t border-[var(--color-border-subtle)]">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] order-2 sm:order-1">
            Sayfa {currentPage}
          </span>
          <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto">
            <button
              onClick={handlePrevPage}
              disabled={isPrevDisabled}
              className="flex-1 sm:flex-none justify-center px-4 py-2 sm:px-3 sm:py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm sm:text-xs font-medium rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Önceki
            </button>
            <button
              onClick={handleNextPage}
              disabled={isNextDisabled}
              className="flex-1 sm:flex-none justify-center px-4 py-2 sm:px-3 sm:py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm sm:text-xs font-medium rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
