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
      <div className="p-4 bg-rich-navy border border-space-blue rounded-lg text-center" role="alert">
        <p className="text-white">CSV yüklemek için geçerli bir oturum gereklidir.</p>
      </div>
    );
  }

  if (user?.role === 'ADMIN') {
    return (
      <div className="p-4 bg-rich-navy border border-space-blue rounded-lg text-center" role="alert">
        <p className="text-white">CSV yükleme işlemi yalnızca güvenlik analistleri tarafından gerçekleştirilebilir.</p>
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
      setValidationError('CSV dosyası en fazla 50 MB olabilir.');
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
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-white mb-2">Ağ Trafiği Veri Yükleme</h2>
        <p className="text-muted-blue">
          Karar destek modelinin analiz etmesi için CIC-IDS2017 veri seti formatında bir CSV dosyası yükleyin.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className={`flex flex-col items-center justify-center p-10 bg-rich-navy border-2 border-dashed rounded-xl transition-colors ${isDragOver ? 'border-cyber-cyan bg-space-blue' : 'border-muted-blue'}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          data-testid="dropzone"
        >
          <div className="text-muted-blue mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-cyber-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-lg font-bold text-white mb-2 text-center">
            Trafik CSV dosyasını buraya sürükleyin
          </p>
          <p className="text-sm text-muted-blue mb-6 text-center">
            veya göz atmak için bilgisayarınızdan seçin
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
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isSubmitting}
            className="px-6 py-2 bg-space-blue text-white rounded-lg hover:bg-muted-blue transition-colors disabled:opacity-50"
          >
            Dosya Seç
          </button>

          <div className="mt-6 px-4 py-2 bg-deep-dark rounded-full">
            <p className="text-xs font-semibold text-muted-blue text-center">
              Maksimum dosya boyutu: 50MB | Sadece .csv uzantısı
            </p>
          </div>
        </div>

        <div className="p-6 bg-rich-navy border-2 border-space-blue rounded-xl flex flex-col">
          <h2 className="text-lg font-bold text-white mb-4">Yüklenen Dosya Bilgileri</h2>

          <div className="flex-1">
            {file ? (
              <div className="p-4 bg-deep-dark border border-space-blue rounded-lg mb-6 flex items-center">
                <div className="w-10 h-12 bg-muted-blue rounded-md flex items-center justify-center mr-4 shrink-0">
                  <span className="text-xs font-bold text-ai-teal">CSV</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate" title={file.name}>{file.name}</p>
                  <p className="text-xs text-muted-blue mt-1">Boyut: {formatBytes(file.size)}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-deep-dark border border-space-blue rounded-lg mb-6 flex items-center justify-center min-h-[5rem]">
                <p className="text-sm text-muted-blue">Henüz dosya seçilmedi</p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-bold text-white mb-3">Şema Doğrulama Durumu</h3>
              <ul className="space-y-3">
                <li className="flex items-center text-sm text-white font-semibold">
                  {file ? (
                    <svg className="w-5 h-5 text-green-500 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-blue mr-2 shrink-0"></div>
                  )}
                  Dosya Yapısı ve Kodlama (UTF-8) Doğrulandı
                </li>
                <li className="flex items-center text-sm text-white font-semibold">
                   {file ? (
                    <svg className="w-5 h-5 text-green-500 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-blue mr-2 shrink-0"></div>
                  )}
                  Sütun Eşleşmesi ve Format Denetlendi
                </li>
              </ul>
            </div>

            {(validationError || apiError) && (
              <div className="mb-4 p-3 bg-deep-dark border border-red-500/50 rounded-lg" role="alert">
                <p className="text-sm text-red-400 font-semibold">{validationError || apiError}</p>
              </div>
            )}

            {successMessage && !validationError && !apiError && (
              <div className="mb-4 p-3 bg-deep-dark border border-green-500/50 rounded-lg" role="status" aria-live="polite">
                <p className="text-sm text-green-400 font-semibold">{successMessage}</p>
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="mt-auto">
            <button
              type="submit"
              disabled={!file || isSubmitting}
              className="w-full py-3 bg-ai-teal text-deep-dark font-bold rounded-lg hover:bg-cyber-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-deep-dark" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
  );
}
