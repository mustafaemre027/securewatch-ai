import { useState, useRef, useEffect } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { useAuth } from '../../auth/useAuth';
import { uploadAnalysisCsv } from '../api';
import type { AnalysisUploadResponse } from '../types';
import { ApiError } from '../../../api/types';

interface CsvUploadFormProps {
  onUploaded: (job: AnalysisUploadResponse) => void;
}

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Byte';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function CsvUploadForm({ onUploaded }: CsvUploadFormProps) {
  const { user, accessToken, isAuthenticated } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="p-4 bg-[var(--color-semantic-danger-bg)] border border-[var(--color-semantic-danger)] rounded-lg text-center" role="alert">
        <p className="text-[var(--color-semantic-danger)] font-medium">CSV yüklemek için geçerli bir oturum gereklidir.</p>
      </div>
    );
  }

  if (user?.role === 'ADMIN') {
    return (
      <div className="p-4 bg-[var(--color-semantic-warning-bg)] border border-[var(--color-semantic-warning)] rounded-lg text-center" role="alert">
        <p className="text-[var(--color-semantic-warning)] font-medium">CSV yükleme işlemi yalnızca güvenlik analistleri tarafından gerçekleştirilebilir.</p>
      </div>
    );
  }

  const validateFile = (selectedFile: File): boolean => {
    setValidationError(null);
    setApiError(null);
    setSuccessMessage(null);

    if (!selectedFile) {
      setValidationError('Lütfen bir CSV dosyası seçin.');
      return false;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setValidationError('Yalnızca CSV dosyaları yüklenebilir.');
      return false;
    }

    if (selectedFile.size === 0) {
      setValidationError('Boş CSV dosyaları yüklenemez.');
      return false;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setValidationError(`CSV dosyası en fazla ${MAX_SIZE_MB} MB olabilir.`);
      return false;
    }

    return true;
  };

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
    } else {
      setFile(null);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isSubmitting || isSubmittingRef.current) return;

    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    handleFileSelect(selectedFile);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSubmittingRef.current) return;
    if (!file) {
      setValidationError('Lütfen bir CSV dosyası seçin.');
      return;
    }

    setApiError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    try {
      const response = await uploadAnalysisCsv(file, accessToken, currentController.signal);
      if (!isMountedRef.current) return;
      onUploaded(response);
      setSuccessMessage('CSV dosyası başarıyla yüklendi.');
      setFile(null);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      let errorMessage = 'CSV yükleme işlemi başarısız oldu. Lütfen tekrar deneyin.';

      if (err instanceof ApiError) {
        switch (err.status) {
          case 400:
            if (err.code === 'DUPLICATE_FILE') {
              errorMessage = 'Bu CSV dosyası daha önce yüklenmiş.';
            } else {
              errorMessage = 'CSV dosyası doğrulanamadı. Dosya biçimini kontrol edin.';
            }
            break;
          case 422:
            errorMessage = 'CSV dosyası doğrulanamadı. Dosya biçimini kontrol edin.';
            break;
          case 401:
            errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
            break;
          case 403:
            errorMessage = 'Bu işlem için yetkiniz bulunmuyor.';
            break;
          case 409:
            errorMessage = 'Bu CSV dosyası daha önce yüklenmiş.';
            break;
          case 413:
            errorMessage = 'CSV dosyası izin verilen boyut sınırını aşıyor.';
            break;
          default:
            if (err.status >= 500 && err.status <= 599) {
              errorMessage = 'Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.';
            } else if (err.status === 0) {
              errorMessage = 'Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.';
            }
            break;
        }
      }
      setApiError(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
      isSubmittingRef.current = false;
      if (abortControllerRef.current === currentController) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">

        {/* DROPZONE */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <div
            className={`sw-panel flex flex-col items-center justify-center p-12 h-full rounded-xl transition-all duration-200 cursor-pointer ${
              isDragOver
                ? 'border-cyber-cyan bg-[var(--color-surface-hover)]'
                : 'border-dashed hover:border-[var(--color-border-strong)]'
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => { if (!isSubmitting) inputRef.current?.click(); }}
            data-testid="dropzone"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!isSubmitting) inputRef.current?.click();
              }
            }}
          >
            <div className="mb-6 rounded-full p-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)]">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[var(--color-accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2 text-center">
              Trafik CSV dosyasını buraya sürükleyin
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-8 text-center max-w-sm">
              Analiz motorumuzun işlemesi için CIC-IDS2017 formatına uygun veri setini seçin.
            </p>

            <label htmlFor="csv-file-input" className="sr-only">CSV dosyası seçin</label>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              ref={inputRef}
              onChange={onInputChange}
              disabled={isSubmitting}
              aria-label="CSV dosyası seçin"
              data-testid="file-input"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              disabled={isSubmitting}
              className="sw-button-secondary"
            >
              Dosya Seç
            </button>

            <div className="mt-8 flex items-center justify-center gap-4">
              <span className="sw-badge sw-badge-neutral text-xs">
                Maksimum {MAX_SIZE_MB} MB
              </span>
              <span className="sw-badge sw-badge-neutral text-xs">
                Sadece .csv
              </span>
            </div>
          </div>
        </div>

        {/* FEEDBACK & ACTION */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <div className="sw-panel p-6 flex flex-col h-full rounded-xl">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-5">
              Acquisition Status
            </h3>

            <div className="flex-1 flex flex-col">
              {file ? (
                <div className="mb-6 p-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-lg">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-[var(--color-accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--color-text-primary)] truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[var(--color-border-subtle)]">
                    <div className="flex items-center text-sm">
                      <svg className="w-4 h-4 text-[var(--color-semantic-success)] mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[var(--color-text-secondary)]">Dosya boyutu ve format doğrulandı</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <svg className="w-4 h-4 text-[var(--color-semantic-success)] mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[var(--color-text-secondary)]">Sütun eşleşmesi (UTF-8) hazır</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] border-dashed rounded-lg mb-6 min-h-[12rem]">
                  <p className="text-sm text-[var(--color-text-muted)] font-medium">Henüz dosya seçilmedi</p>
                </div>
              )}

              {(validationError || apiError) && (
                <div className="mb-4 p-4 bg-[var(--color-semantic-danger-bg)] border-l-4 border-[var(--color-semantic-danger)] rounded-r-lg" role="alert">
                  <p className="text-sm text-[var(--color-semantic-danger)] font-medium">{validationError || apiError}</p>
                </div>
              )}

              {successMessage && !validationError && !apiError && (
                <div className="mb-4 p-4 bg-[var(--color-semantic-success-bg)] border-l-4 border-[var(--color-semantic-success)] rounded-r-lg" role="status" aria-live="polite">
                  <p className="text-sm text-[var(--color-semantic-success)] font-medium">{successMessage}</p>
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="mt-auto pt-4 border-t border-[var(--color-border-subtle)]">
              <button
                type="submit"
                disabled={!file || isSubmitting}
                className="sw-button-primary w-full justify-center py-3 text-sm"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Yükleniyor...
                  </>
                ) : (
                  'Doğrulanmış Analizi Başlat ve Karar Desteği Üret'
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
