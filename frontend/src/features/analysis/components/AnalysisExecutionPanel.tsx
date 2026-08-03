import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/useAuth';
import { processAnalysisJob } from '../api';
import type { AnalysisUploadResponse, AnalysisProcessingResponse, AnalysisJobStatus } from '../types';
import { ApiError } from '../../../api/types';

export interface AnalysisExecutionPanelProps {
  job: AnalysisUploadResponse;
  onSuccess?: (response: AnalysisProcessingResponse) => void;
  onReset?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Byte';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function AnalysisExecutionPanelInternal({ job, onSuccess, onReset }: AnalysisExecutionPanelProps) {
  const { accessToken, isAuthenticated } = useAuth();

  const [currentStatus, setCurrentStatus] = useState<AnalysisJobStatus>(job.status);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordsProcessed, setRecordsProcessed] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    if (isProcessingRef.current || currentStatus === 'COMPLETED' || currentStatus === 'PROCESSING' || currentStatus === 'FAILED') {
      return;
    }

    setApiError(null);
    setIsProcessing(true);
    isProcessingRef.current = true;
    setCurrentStatus('PROCESSING');

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

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

  return (
    <div className="w-full" aria-busy={isProcessing}>
      <div className="p-6 bg-rich-navy border-2 border-space-blue rounded-xl flex flex-col">
        <h2 className="text-xl font-bold text-white mb-6">Analiz Yürütme Paneli</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
            <p className="text-xs font-bold text-muted-blue uppercase mb-1">İşlem Numarası (Job ID)</p>
            <p className="text-sm font-semibold text-white">#{job.job_id}</p>
          </div>

          <div className="p-4 bg-deep-dark border border-space-blue rounded-lg" role="status" aria-live="polite" aria-atomic="true">
            <p className="text-xs font-bold text-muted-blue uppercase mb-1">Durum</p>
            <div className="flex items-center">
              {currentStatus === 'COMPLETED' && <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>}
              {currentStatus === 'PROCESSING' && <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse mr-2"></span>}
              {currentStatus === 'FAILED' && <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>}
              {currentStatus === 'PENDING' && <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>}
              <p className="text-sm font-bold text-white">
                {currentStatus === 'PENDING' && 'Bekliyor'}
                {currentStatus === 'PROCESSING' && 'İşleniyor'}
                {currentStatus === 'COMPLETED' && <span className="text-green-400">Tamamlandı</span>}
                {currentStatus === 'FAILED' && <span className="text-red-400">Başarısız</span>}
              </p>
            </div>
            {currentStatus === 'COMPLETED' && recordsProcessed !== null && (
              <p className="text-xs text-green-300 mt-2">İşlenen Kayıt Sayısı: {recordsProcessed}</p>
            )}
            {currentStatus === 'COMPLETED' && typeof job.job_id === 'number' && Number.isSafeInteger(job.job_id) && job.job_id > 0 && (
              <div className="mt-3">
                <Link
                  to={`/analysis/${job.job_id}/results`}
                  aria-label={`Analiz #${job.job_id} sonuçlarını görüntüle`}
                  className="inline-block px-4 py-2 bg-ai-teal text-deep-dark text-sm font-bold rounded-lg hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-rich-navy focus:ring-ai-teal truncate max-w-[200px] text-center"
                >
                  Sonuçları görüntüle
                </Link>
              </div>
            )}
          </div>

          <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
            <p className="text-xs font-bold text-muted-blue uppercase mb-1">Dosya Adı</p>
            <p className="text-sm font-semibold text-white truncate" title={job.file_name}>{job.file_name}</p>
          </div>

          <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
            <p className="text-xs font-bold text-muted-blue uppercase mb-1">Dosya Boyutu</p>
            <p className="text-sm font-semibold text-white">{formatBytes(job.file_size)}</p>
          </div>
        </div>

        {apiError && (
          <div className="mb-6 p-4 bg-deep-dark border border-red-500/50 rounded-lg" role="alert">
            <p className="text-sm text-red-400 font-semibold">{apiError}</p>
          </div>
        )}

        <div className="mt-auto flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing || currentStatus === 'COMPLETED' || currentStatus === 'PROCESSING' || currentStatus === 'FAILED'}
            className="flex-1 py-3 px-4 bg-ai-teal text-deep-dark font-bold rounded-lg hover:bg-cyber-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-deep-dark" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                İşleniyor...
              </>
            ) : (
              'Doğrulanmış Analizi Başlat'
            )}
          </button>

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              disabled={isProcessing}
              className="py-3 px-6 bg-space-blue text-white font-bold rounded-lg hover:bg-muted-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Yeni CSV Yükle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnalysisExecutionPanel(props: AnalysisExecutionPanelProps) {
  return <AnalysisExecutionPanelInternal key={`${props.job.job_id}-${props.job.status}`} {...props} />;
}
