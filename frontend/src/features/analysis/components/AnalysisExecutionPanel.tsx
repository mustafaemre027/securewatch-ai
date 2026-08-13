import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/useAuth';
import { processAnalysisJob } from '../api';
import type { AnalysisUploadResponse, AnalysisProcessingResponse, AnalysisJobStatus } from '../types';
import { ApiError } from '../../../api/types';

interface AnalysisExecutionPanelProps {
  job: AnalysisUploadResponse;
  onSuccess?: (result: AnalysisProcessingResponse) => void;
  onReset?: () => void;
}

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

function AnalysisExecutionPanelInternal({ job, onSuccess, onReset }: AnalysisExecutionPanelProps) {
  const { accessToken, isAuthenticated } = useAuth();

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<AnalysisJobStatus>(job.status);
  const [recordsProcessed, setRecordsProcessed] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleProcess = async () => {
    if (!isAuthenticated || !accessToken) {
      setApiError('Oturumunuz geçersiz. Lütfen yeniden giriş yapın.');
      return;
    }
    if (isProcessingRef.current) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const currentController = new AbortController();
    abortControllerRef.current = currentController;

    setIsProcessing(true);
    isProcessingRef.current = true;
    setCurrentStatus('PROCESSING');
    setApiError(null);

    try {
      const response = await processAnalysisJob(job.job_id, accessToken, currentController.signal);

      if (!isMountedRef.current || abortControllerRef.current !== currentController) return;

      if (response.job_id !== job.job_id) {
         setCurrentStatus('FAILED');
         setApiError('Analiz sonucu doğrulanamadı.');
         return;
      }

      const finalStatus = response.final_status;
      if (finalStatus === 'PENDING' || finalStatus === 'PROCESSING') {
        setCurrentStatus('FAILED');
        setApiError('Analiz sonucu doğrulanamadı.');
      } else {
        setCurrentStatus(finalStatus);

        if (
          finalStatus === 'COMPLETED' &&
          typeof response.records_processed === 'number' &&
          Number.isFinite(response.records_processed) &&
          Number.isInteger(response.records_processed) &&
          response.records_processed >= 0
        ) {
          setRecordsProcessed(response.records_processed);
        }

        if (finalStatus === 'COMPLETED' && onSuccess) {
          onSuccess(response);
        }
      }
    } catch (err: unknown) {
      if (!isMountedRef.current || abortControllerRef.current !== currentController) return;
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      setCurrentStatus('PENDING');

      let errorMessage = 'Analiz işlemi güvenli biçimde tamamlanamadı.';

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
            errorMessage = 'Bu işlem için yetkiniz bulunmuyor.';
            break;
          case 404:
            if (err.code === 'MODEL_NOT_FOUND') {
              errorMessage = 'Analiz modeli şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.';
            } else {
              errorMessage = 'Kayıt bulunamadı veya bu kayda erişemiyorsunuz.';
            }
            break;
          case 409:
            errorMessage = 'Analiz mevcut durumunda başlatılamıyor.';
            break;
          default:
            if (err.status >= 500 && err.status <= 599) {
              errorMessage = 'Analiz servisi geçici olarak kullanılamıyor.';
            } else if (err.status === 0) {
              errorMessage = 'Sunucuya ulaşılamıyor.';
            }
            break;
        }
      }
      setApiError(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
      isProcessingRef.current = false;
      if (abortControllerRef.current === currentController) {
        abortControllerRef.current = null;
      }
    }
  };

  const statusConfig = {
    PENDING: {
      label: 'Bekliyor',
      icon: (
        <svg className="w-5 h-5 text-[var(--color-semantic-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgClass: 'bg-[var(--color-semantic-warning-bg)]',
      borderClass: 'border-[var(--color-semantic-warning)]',
      textClass: 'text-[var(--color-semantic-warning)]',
    },
    PROCESSING: {
      label: 'İşleniyor',
      icon: (
        <svg className="w-5 h-5 text-[var(--color-semantic-info)] animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      bgClass: 'bg-[var(--color-semantic-info-bg)]',
      borderClass: 'border-[var(--color-semantic-info)]',
      textClass: 'text-[var(--color-semantic-info)]',
    },
    COMPLETED: {
      label: 'Tamamlandı',
      icon: (
        <svg className="w-5 h-5 text-[var(--color-semantic-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      ),
      bgClass: 'bg-[var(--color-semantic-success-bg)]',
      borderClass: 'border-[var(--color-semantic-success)]',
      textClass: 'text-[var(--color-semantic-success)]',
    },
    FAILED: {
      label: 'Başarısız',
      icon: (
        <svg className="w-5 h-5 text-[var(--color-semantic-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      bgClass: 'bg-[var(--color-semantic-danger-bg)]',
      borderClass: 'border-[var(--color-semantic-danger)]',
      textClass: 'text-[var(--color-semantic-danger)]',
    },
  };

  const currentConfig = statusConfig[currentStatus] || statusConfig.PENDING;

  return (
    <div className="w-full" aria-busy={isProcessing}>
      <div className="sw-panel p-8 rounded-xl flex flex-col">

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 border-b border-[var(--color-border-subtle)] pb-8">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
              Analiz Dosyası Hazır
            </h3>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] break-all truncate max-w-xl" title={job.file_name}>
              {job.file_name}
            </h2>
            <div className="flex items-center gap-4 mt-3">
              <span className="sw-badge sw-badge-neutral text-xs">ID: <span>#{job.job_id}</span></span>
              <span className="sw-badge sw-badge-neutral text-xs">{formatBytes(job.file_size)}</span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3 px-4 py-2 rounded-lg border bg-[var(--color-surface-base)] shadow-sm">
            <span className="text-sm font-bold text-[var(--color-text-secondary)]">Durum:</span>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-md border ${currentConfig.bgClass} ${currentConfig.borderClass}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {currentConfig.icon}
              <span className={`text-sm font-bold ${currentConfig.textClass}`}>
                {currentConfig.label}
              </span>
              {currentStatus === 'COMPLETED' && recordsProcessed !== null && (
                <span className="sr-only">İşlenen Kayıt Sayısı: {recordsProcessed}</span>
              )}
            </div>
          </div>
        </div>

        {apiError && (
          <div className="mb-6 p-4 bg-[var(--color-semantic-danger-bg)] border-l-4 border-[var(--color-semantic-danger)] rounded-r-lg" role="alert">
            <p className="text-sm font-semibold text-[var(--color-semantic-danger)]">{apiError}</p>
          </div>
        )}

        {currentStatus === 'COMPLETED' && recordsProcessed !== null && (
          <div className="mb-8 p-6 bg-[var(--color-surface-base)] border border-[var(--color-border-default)] rounded-xl flex flex-col items-center justify-center">
            <span className="text-[var(--color-text-secondary)] text-sm font-bold uppercase tracking-wider mb-2">İşlenen Kayıt</span>
            <span className="text-4xl font-extrabold text-[var(--color-text-primary)]">
              {new Intl.NumberFormat('tr-TR').format(recordsProcessed)}
            </span>
          </div>
        )}

        <div className="mt-auto flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full sm:w-auto flex flex-col sm:flex-row gap-4 items-center">
            <button
              type="button"
              onClick={handleProcess}
              disabled={isProcessing || currentStatus === 'COMPLETED' || currentStatus === 'PROCESSING' || currentStatus === 'FAILED'}
              className="sw-button-primary w-full sm:w-auto justify-center py-3 px-8 text-sm"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analiz İşleniyor...
                </>
              ) : (
                'Doğrulanmış Analizi Başlat'
              )}
            </button>

            {currentStatus === 'COMPLETED' && typeof job.job_id === 'number' && Number.isSafeInteger(job.job_id) && job.job_id > 0 && (
              <Link
                to={`/analysis/${job.job_id}/results`}
                aria-label={`Analiz #${job.job_id} sonuçlarını görüntüle`}
                className="sw-button-secondary w-full sm:w-auto justify-center py-3 px-8 text-sm"
              >
                Sonuçları görüntüle
              </Link>
            )}
          </div>

          {onReset && (
            <div className="w-full sm:w-auto">
              <button
                type="button"
                onClick={onReset}
                disabled={isProcessing}
                className="sw-button-secondary w-full sm:w-auto justify-center py-3 px-6 text-sm opacity-80 hover:opacity-[1]"
              >
                Yeni CSV Yükle
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export function AnalysisExecutionPanel(props: AnalysisExecutionPanelProps) {
  return <AnalysisExecutionPanelInternal key={`${props.job.job_id}-${props.job.status}`} {...props} />;
}
