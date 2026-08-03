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
      <div className="p-6 bg-rich-navy border-2 border-space-blue rounded-xl flex flex-col">
        <h2 className="text-xl font-bold text-white mb-6">
          <a href={`#summary-panel-${jobId}`} id={`summary-panel-${jobId}`} className="hover:underline focus:outline-none focus:ring-2 focus:ring-ai-teal rounded">
            Tespit Özeti
          </a>
        </h2>

        {isLoading && (
          <div role="status" aria-live="polite" aria-busy="true" className="flex items-center text-muted-blue">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-ai-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analiz özeti yükleniyor...
          </div>
        )}

        {apiError && !isLoading && (
          <div role="alert" className="mb-4 p-4 bg-deep-dark border border-red-500/50 rounded-lg flex flex-col items-start">
            <p className="text-sm text-red-400 font-semibold mb-3">{apiError}</p>
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className="py-2 px-4 bg-space-blue text-white font-bold rounded-lg hover:bg-muted-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {summary && !isLoading && !apiError && (
          <div aria-live="polite" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
              <p className="text-xs font-bold text-muted-blue uppercase mb-1">İşlem Numarası</p>
              <p className="text-lg font-bold text-white">#{summary.job_id}</p>
            </div>
            <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
              <p className="text-xs font-bold text-muted-blue uppercase mb-1">Toplam Kayıt</p>
              <p className="text-lg font-bold text-white">{summary.total_records}</p>
            </div>
            <div className="p-4 bg-deep-dark border border-green-500/30 rounded-lg">
              <p className="text-xs font-bold text-green-400 uppercase mb-1">Normal Trafik</p>
              <p className="text-lg font-bold text-white">{summary.normal_count}</p>
            </div>
            <div className="p-4 bg-deep-dark border border-red-500/30 rounded-lg">
              <p className="text-xs font-bold text-red-400 uppercase mb-1">Saldırı</p>
              <p className="text-lg font-bold text-white">{summary.attack_count}</p>
            </div>

            <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
              <p className="text-xs font-bold text-blue-400 uppercase mb-1">Düşük</p>
              <p className="text-lg font-bold text-white">{summary.risk_level_counts.LOW}</p>
            </div>
            <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
              <p className="text-xs font-bold text-yellow-400 uppercase mb-1">Orta</p>
              <p className="text-lg font-bold text-white">{summary.risk_level_counts.MEDIUM}</p>
            </div>
            <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
              <p className="text-xs font-bold text-orange-400 uppercase mb-1">Yüksek</p>
              <p className="text-lg font-bold text-white">{summary.risk_level_counts.HIGH}</p>
            </div>
            <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
              <p className="text-xs font-bold text-red-500 uppercase mb-1">Kritik</p>
              <p className="text-lg font-bold text-white">{summary.risk_level_counts.CRITICAL}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
