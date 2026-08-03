import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    let label = 'Bilinmeyen';
    let colorClass = 'bg-gray-500';
    let textClass = 'text-gray-400';

    switch (status) {
      case 'PENDING':
        label = 'Bekliyor';
        colorClass = 'bg-yellow-500';
        textClass = 'text-yellow-400';
        break;
      case 'PROCESSING':
        label = 'İşleniyor';
        colorClass = 'bg-cyber-cyan animate-pulse';
        textClass = 'text-cyan-400';
        break;
      case 'COMPLETED':
        label = 'Tamamlandı';
        colorClass = 'bg-green-500';
        textClass = 'text-green-400';
        break;
      case 'FAILED':
        label = 'Başarısız';
        colorClass = 'bg-red-500';
        textClass = 'text-red-400';
        break;
    }

    return (
      <div className="flex items-center">
        <span className={`w-2 h-2 rounded-full mr-2 ${colorClass}`}></span>
        <span className={`text-sm font-bold ${textClass}`}>{label}</span>
      </div>
    );
  };

  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;
  const isPrevDisabled = skip === 0 || loading;
  const isNextDisabled = jobs.length < PAGE_SIZE || loading;
  const isEmpty = jobs.length === 0 && !loading && !error;

  return (
    <div className="w-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-rich-navy p-4 rounded-xl border-2 border-space-blue">
        <h2 className="text-xl font-bold text-white">Analiz Geçmişi</h2>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none flex items-center">
            <label htmlFor="status-filter" className="sr-only">Durum Filtresi</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={handleStatusChange}
              disabled={loading}
              className="w-full bg-deep-dark border border-space-blue text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ai-teal disabled:opacity-50"
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
            className="p-2 bg-space-blue text-white rounded-lg hover:bg-muted-blue transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ai-teal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="w-full" aria-busy={loading}>
        {error && (
          <div className="p-4 bg-deep-dark border border-red-500/50 rounded-lg mb-4" role="alert">
            <p className="text-sm text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {loading && !error && (
          <div className="p-8 text-center" role="status" aria-live="polite">
            <svg className="animate-spin h-8 w-8 text-ai-teal mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-semibold text-muted-blue">Analiz geçmişi yükleniyor...</p>
          </div>
        )}

        {isEmpty && (
          <div className="p-8 text-center bg-deep-dark rounded-xl border border-space-blue">
            <p className="text-muted-blue font-medium">
              {statusFilter === 'ALL'
                ? 'Henüz analiz kaydı bulunmuyor.'
                : 'Seçili filtreye uygun kayıt bulunmuyor.'}
            </p>
          </div>
        )}

        {!loading && !error && !isEmpty && (
          <ul className="space-y-4" role="list">
            {jobs.map(job => (
              <li key={job.id} className="p-4 bg-rich-navy border border-space-blue rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-muted-blue transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-muted-blue uppercase">#{job.id}</span>
                  </div>
                  <p className="text-base font-semibold text-white truncate" title={job.file_name}>{job.file_name}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-blue">
                    <span>Oluşturulma: {formatDate(job.created_at)}</span>
                    {job.completed_at && (
                       <span>Tamamlanma: {formatDate(job.completed_at)}</span>
                    )}
                    <span>Boyut: {formatBytes(job.file_size)}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-deep-dark p-3 rounded-lg border border-space-blue">
                  {renderStatus(job.status)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-between p-4 bg-deep-dark rounded-xl border border-space-blue">
          <button
            onClick={handlePrevPage}
            disabled={isPrevDisabled}
            className="px-4 py-2 bg-space-blue text-white text-sm font-bold rounded-lg hover:bg-muted-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Önceki
          </button>

          <span className="text-sm font-medium text-muted-blue">
            Sayfa {currentPage}
          </span>

          <button
            onClick={handleNextPage}
            disabled={isNextDisabled}
            className="px-4 py-2 bg-space-blue text-white text-sm font-bold rounded-lg hover:bg-muted-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
}
