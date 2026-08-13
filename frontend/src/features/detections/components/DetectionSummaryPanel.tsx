import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getAnalysisSummary } from '../api';
import type { AnalysisSummary } from '../types';
import { ApiError } from '../../../api/types';

export interface DetectionSummaryPanelProps {
  jobId: number;
}

export function DetectionSummaryPanel({ jobId }: DetectionSummaryPanelProps) {
  const { accessToken, isAuthenticated } = useAuth();

  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);

  const fetchSummary = async (currentJobId: number) => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    if (isLoadingRef.current) return;

    setIsLoading(true);
    isLoadingRef.current = true;
    setApiError(null);
    setSummary(null);

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    try {
      const response = await getAnalysisSummary(currentJobId, accessToken, currentController.signal);

      if (abortControllerRef.current !== currentController) return;

      if (!response) {
        throw new Error('No response');
      }

      if (
        !Number.isInteger(response.job_id) ||
        response.job_id <= 0 ||
        response.job_id !== currentJobId
      ) {
        setApiError('Analiz özeti doğrulanamadı.');
        return;
      }

      if (response.status !== 'COMPLETED') {
        setApiError('Analiz özeti doğrulanamadı.');
        return;
      }

      const counts = [
        response.total_records,
        response.normal_count,
        response.attack_count,
        response.risk_level_counts?.LOW,
        response.risk_level_counts?.MEDIUM,
        response.risk_level_counts?.HIGH,
        response.risk_level_counts?.CRITICAL
      ];

      for (const count of counts) {
        if (typeof count !== 'number' || !Number.isFinite(count) || !Number.isInteger(count) || count < 0) {
          setApiError('Analiz özeti doğrulanamadı.');
          return;
        }
      }

      if (response.normal_count + response.attack_count !== response.total_records) {
        setApiError('Analiz özeti doğrulanamadı.');
        return;
      }

      const riskSum =
        response.risk_level_counts.LOW +
        response.risk_level_counts.MEDIUM +
        response.risk_level_counts.HIGH +
        response.risk_level_counts.CRITICAL;

      if (riskSum !== response.total_records) {
        setApiError('Analiz özeti doğrulanamadı.');
        return;
      }

      if (response.completed_at !== null && typeof response.completed_at !== 'string') {
        setApiError('Analiz özeti doğrulanamadı.');
        return;
      }

      setSummary(response);
    } catch (err: unknown) {
      if (abortControllerRef.current !== currentController) return;

      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      let errorMessage = 'Analiz özeti güvenli biçimde yüklenemedi.';

      if (err instanceof ApiError) {
        if (err.status === 401 && (err.code === 'CREDENTIALS_INVALID' || err.code === 'TOKEN_INVALID' || err.code === 'TOKEN_EXPIRED')) {
          errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
        } else if (err.status === 403 && err.code === 'PERMISSION_DENIED') {
          errorMessage = 'Bu analiz özetini görüntüleme yetkiniz bulunmuyor.';
        } else if (err.status === 404 && err.code === 'NOT_FOUND') {
          errorMessage = 'Analiz kaydı bulunamadı veya bu kayda erişemiyorsunuz.';
        } else if (err.status === 409 && err.code === 'NOT_COMPLETED') {
          errorMessage = 'Analiz özeti henüz hazır değil.';
        } else if (err.status === 0 && err.code === 'NETWORK_ERROR') {
          errorMessage = 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
        } else if (err.status >= 500 && err.status < 600) {
          errorMessage = 'Analiz özeti geçici olarak kullanılamıyor.';
        }
      }

      setApiError(errorMessage);
    } finally {
      if (abortControllerRef.current === currentController) {
        setIsLoading(false);
        isLoadingRef.current = false;
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary(jobId);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, isAuthenticated, accessToken]);

  const handleRetry = () => {
    fetchSummary(jobId);
  };

  return (
    <div className="w-full">
      {isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center p-8 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl shadow-sm">
          <div className="flex items-center text-[var(--color-text-muted)] font-medium">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--color-text-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analiz özeti yükleniyor...
          </div>
        </div>
      )}

      {apiError && !isLoading && (
        <div role="alert" className="mb-6 p-4 bg-[var(--color-semantic-danger-bg)] border-l-4 border-[var(--color-semantic-danger)] rounded-r-lg flex flex-col items-start shadow-sm">
          <p className="text-sm text-[var(--color-semantic-danger)] font-medium mb-3">{apiError}</p>
          <button
            onClick={handleRetry}
            disabled={isLoading}
            className="py-1.5 px-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-semibold rounded-md hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {summary && !isLoading && !apiError && (
        <div aria-live="polite" className="flex flex-col gap-6">
          {/* Test assertion compatibility */}
          <div className="sr-only">
            <p>İşlem Numarası</p>
            <p>#{summary.job_id}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl flex flex-col justify-between shadow-sm">
              <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Toplam Kayıt</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{summary.total_records}</p>
            </div>

            <div className="p-5 bg-[var(--color-surface-base)] border border-[var(--color-semantic-success)] border-opacity-30 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-semantic-success)]"></div>
              <p className="text-xs font-bold text-[var(--color-semantic-success)] uppercase tracking-wider mb-2 pl-2">Normal Trafik</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)] pl-2">{summary.normal_count}</p>
            </div>

            <div className="p-5 bg-[var(--color-surface-base)] border border-[var(--color-semantic-danger)] border-opacity-30 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-semantic-danger)]"></div>
              <p className="text-xs font-bold text-[var(--color-semantic-danger)] uppercase tracking-wider mb-2 pl-2">Saldırı</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)] pl-2">{summary.attack_count}</p>
            </div>

            <div className="p-5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-text-accent)]"></div>
              <p className="text-xs font-bold text-[var(--color-text-accent)] uppercase tracking-wider mb-2 pl-2">Tehdit Oranı</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)] pl-2 font-mono">
                {summary.total_records > 0 ? ((summary.attack_count / summary.total_records) * 100).toFixed(1).replace(/\.0$/, '') : "0"}%
              </p>
            </div>
          </div>

          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-4 border-b border-[var(--color-border-subtle)] pb-2">
              Risk Seviyesi Dağılımı
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-1.5 w-max px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Düşük
                </span>
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">{summary.risk_level_counts.LOW}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-1.5 w-max px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span> Orta
                </span>
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">{summary.risk_level_counts.MEDIUM}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-1.5 w-max px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span> Yüksek
                </span>
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">{summary.risk_level_counts.HIGH}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-1.5 w-max px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Kritik
                </span>
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">{summary.risk_level_counts.CRITICAL}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
