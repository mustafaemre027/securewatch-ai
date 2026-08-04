import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/useAuth';
import { listDetectionResults } from '../api';
import type { DetectionResult, DetectionRiskLevel, DetectionResultListParams } from '../types';
import { ApiError } from '../../../api/types';
import { IncidentCreateForm } from '../../incidents/components/IncidentCreateForm';

interface DetectionResultsListProps {
  jobId: number;
}

const PAGE_SIZE = 20;

export const DetectionResultsList: React.FC<DetectionResultsListProps> = ({ jobId }) => {
  const { isAuthenticated, accessToken, user } = useAuth();

  const [results, setResults] = useState<DetectionResult[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [skip, setSkip] = useState<number>(0);
  const [isAttackFilter, setIsAttackFilter] = useState<boolean | undefined>(undefined);
  const [riskFilter, setRiskFilter] = useState<DetectionRiskLevel | undefined>(undefined);

  const [activeConversionDetectionId, setActiveConversionDetectionId] = useState<number | null>(null);
  const [convertedDetectionIds, setConvertedDetectionIds] = useState<Set<number>>(new Set());
  const conversionTriggerRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef<boolean>(false);

  const fetchResults = useCallback(async (currentJobId: number, currentSkip: number, currentIsAttack: boolean | undefined, currentRisk: DetectionRiskLevel | undefined) => {
    if (!isAuthenticated || !accessToken) return;
    if (isLoadingRef.current) return;

    setIsLoading(true);
    isLoadingRef.current = true;
    setApiError(null);
    setResults(null);

    const currentController = new AbortController();
    abortControllerRef.current = currentController;

    try {
      const params: DetectionResultListParams = {
        skip: currentSkip,
        limit: PAGE_SIZE,
      };
      if (currentIsAttack !== undefined) params.isAttack = currentIsAttack;
      if (currentRisk !== undefined) params.riskLevel = currentRisk;

      const response = await listDetectionResults(currentJobId, params, accessToken, currentController.signal);

      if (abortControllerRef.current !== currentController) return;

      // Validate response
      if (typeof response !== 'object' || response === null || !Array.isArray(response.items)) {
        setApiError('Tespit sonuçları doğrulanamadı.');
        return;
      }

      if (!Number.isFinite(response.total) || !Number.isInteger(response.total) || response.total < 0) {
        setApiError('Tespit sonuçları doğrulanamadı.');
        return;
      }
      if (!Number.isFinite(response.skip) || !Number.isInteger(response.skip) || response.skip < 0 || response.skip !== currentSkip) {
        setApiError('Tespit sonuçları doğrulanamadı.');
        return;
      }
      if (!Number.isFinite(response.limit) || !Number.isInteger(response.limit) || response.limit < 1 || response.limit > 100 || response.limit !== PAGE_SIZE) {
        setApiError('Tespit sonuçları doğrulanamadı.');
        return;
      }

      if (response.items.length > response.limit || response.items.length > response.total || response.skip + response.items.length > response.total) {
        setApiError('Tespit sonuçları doğrulanamadı.');
        return;
      }

      let lastRowIndex = -1;
      const seenIds = new Set<number>();
      const seenRowIndices = new Set<number>();

      for (const item of response.items) {
        if (typeof item !== 'object' || item === null) {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }

        if (!Number.isFinite(item.id) || !Number.isInteger(item.id) || item.id <= 0 || seenIds.has(item.id)) {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }
        seenIds.add(item.id);

        if (!Number.isFinite(item.job_id) || !Number.isInteger(item.job_id) || item.job_id <= 0 || item.job_id !== currentJobId) {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }

        if (!Number.isFinite(item.row_index) || !Number.isInteger(item.row_index) || item.row_index < 0 || seenRowIndices.has(item.row_index)) {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }
        if (item.row_index <= lastRowIndex) {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }
        lastRowIndex = item.row_index;
        seenRowIndices.add(item.row_index);

        if (!Number.isFinite(item.attack_probability) || item.attack_probability < 0 || item.attack_probability > 1) {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }

        if (typeof item.is_attack !== 'boolean') {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }

        if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(item.risk_level)) {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }

        if (typeof item.created_at !== 'string') {
          setApiError('Tespit sonuçları doğrulanamadı.');
          return;
        }
      }

      setResults(response.items);
      setTotal(response.total);

    } catch (err: unknown) {
      if (abortControllerRef.current !== currentController) return;

      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      let errorMessage = 'Tespit sonuçları güvenli biçimde yüklenemedi.';

      if (err instanceof ApiError) {
        const statusCode = `${err.status}_${err.code}`;
        switch (statusCode) {
          case '401_CREDENTIALS_INVALID':
          case '401_TOKEN_INVALID':
          case '401_TOKEN_EXPIRED':
            errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
            break;
          case '403_PERMISSION_DENIED':
            errorMessage = 'Tespit sonuçlarını görüntüleme yetkiniz bulunmuyor.';
            break;
          case '404_NOT_FOUND':
            errorMessage = 'Analiz kaydı bulunamadı veya bu kayda erişemiyorsunuz.';
            break;
          case '409_NOT_COMPLETED':
            errorMessage = 'Analiz tamamlanmadığı için tespit sonuçları henüz hazır değil.';
            break;
          case '422_VALIDATION_ERROR':
            errorMessage = 'Tespit filtreleri doğrulanamadı.';
            break;
          case '0_NETWORK_ERROR':
            errorMessage = 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
            break;
          case '500_INTERNAL_SERVER_ERROR':
            errorMessage = 'Tespit sonuçları geçici olarak kullanılamıyor.';
            break;
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
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSkip(0);
    setIsAttackFilter(undefined);
    setRiskFilter(undefined);
    setResults(null);
    setTotal(0);
    setApiError(null);
    setActiveConversionDetectionId(null);
    setConvertedDetectionIds(new Set());

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isLoadingRef.current = false;
      setIsLoading(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [jobId]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isLoadingRef.current = false;
      setIsLoading(false);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResults(jobId, skip, isAttackFilter, riskFilter);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, skip, isAttackFilter, riskFilter, isAuthenticated, accessToken]);

  const handleRetry = () => {
    fetchResults(jobId, skip, isAttackFilter, riskFilter);
  };

  const handleAttackFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSkip(0);
    setActiveConversionDetectionId(null);
    if (val === 'ALL') setIsAttackFilter(undefined);
    else if (val === 'ATTACK') setIsAttackFilter(true);
    else setIsAttackFilter(false);
  };

  const handleRiskFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSkip(0);
    setActiveConversionDetectionId(null);
    if (val === 'ALL') setRiskFilter(undefined);
    else setRiskFilter(val as DetectionRiskLevel);
  };

  const getRiskLabel = (risk: DetectionRiskLevel) => {
    switch (risk) {
      case 'LOW': return 'Düşük';
      case 'MEDIUM': return 'Orta';
      case 'HIGH': return 'Yüksek';
      case 'CRITICAL': return 'Kritik';
      default: return 'Bilinmiyor';
    }
  };

  const getRiskColor = (risk: DetectionRiskLevel) => {
    switch (risk) {
      case 'LOW': return 'text-blue-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'HIGH': return 'text-orange-400';
      case 'CRITICAL': return 'text-red-500';
      default: return 'text-white';
    }
  };

  const getRiskBorder = (risk: DetectionRiskLevel) => {
    switch (risk) {
      case 'LOW': return 'border-blue-500/30';
      case 'MEDIUM': return 'border-yellow-500/30';
      case 'HIGH': return 'border-orange-500/30';
      case 'CRITICAL': return 'border-red-500/50';
      default: return 'border-space-blue';
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? 'Bilinmiyor' : d.toLocaleString('tr-TR');
  };

  const start = total === 0 ? 0 : skip + 1;
  const end = total === 0 ? 0 : skip + (results ? results.length : 0);

  return (
    <div className="w-full mt-6 bg-rich-navy border border-space-blue rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 bg-deep-dark border-b border-space-blue flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-white">Tespit Sonuçları</h3>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex flex-col">
            <label htmlFor={`attack-filter-${jobId}`} className="text-xs text-slate-300 mb-1 font-semibold uppercase">Tahmin Filtresi</label>
            <select
              id={`attack-filter-${jobId}`}
              className="bg-rich-navy border border-space-blue text-white text-sm rounded-lg p-2 focus:ring-2 focus:ring-ai-teal focus:border-transparent outline-none"
              value={isAttackFilter === undefined ? 'ALL' : isAttackFilter ? 'ATTACK' : 'NORMAL'}
              onChange={handleAttackFilterChange}
              disabled={isLoading}
            >
              <option value="ALL">Tüm Tahminler</option>
              <option value="ATTACK">Saldırı</option>
              <option value="NORMAL">Normal</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor={`risk-filter-${jobId}`} className="text-xs text-slate-300 mb-1 font-semibold uppercase">Risk Seviyesi</label>
            <select
              id={`risk-filter-${jobId}`}
              className="bg-rich-navy border border-space-blue text-white text-sm rounded-lg p-2 focus:ring-2 focus:ring-ai-teal focus:border-transparent outline-none"
              value={riskFilter || 'ALL'}
              onChange={handleRiskFilterChange}
              disabled={isLoading}
            >
              <option value="ALL">Tüm Risk Seviyeleri</option>
              <option value="LOW">Düşük</option>
              <option value="MEDIUM">Orta</option>
              <option value="HIGH">Yüksek</option>
              <option value="CRITICAL">Kritik</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-6 relative min-h-[300px] flex flex-col">
        {apiError && !isLoading && (
          <div className="mb-4 p-4 bg-deep-dark border border-red-500/50 rounded-lg flex flex-col items-start" role="alert">
            <p className="text-sm text-red-400 font-semibold mb-3">{apiError}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="py-2 px-4 bg-space-blue text-white font-bold rounded-lg hover:bg-muted-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              disabled={isLoading}
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {isLoading && (
          <div role="status" aria-busy="true" className="absolute inset-0 z-10 bg-rich-navy/80 flex items-center justify-center backdrop-blur-sm">
            <div className="flex items-center text-ai-teal font-medium">
              <svg aria-hidden="true" className="animate-spin -ml-1 mr-3 h-6 w-6 text-ai-teal" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sonuçlar yükleniyor...
            </div>
          </div>
        )}

        {!apiError && results && results.length === 0 && (
          <div className="flex flex-1 items-center justify-center p-8 text-center" aria-live="polite">
            <p className="text-muted-blue">
              {isAttackFilter !== undefined || riskFilter !== undefined
                ? 'Seçilen filtrelerle eşleşen tespit sonucu bulunamadı.'
                : 'Bu analiz için tespit sonucu bulunmuyor.'}
            </p>
          </div>
        )}

        {!apiError && results && results.length > 0 && (
          <div className="flex-1 flex flex-col" aria-live="polite">
            <ul className="grid grid-cols-1 gap-4 mb-6">
              {results.map((result) => {
                const isConverted = convertedDetectionIds.has(result.id);
                const canConvert = result.is_attack && user?.role === 'ANALYST' && accessToken && !isConverted;
                const isConverting = activeConversionDetectionId === result.id;
                
                return (
                <li key={result.id} className={`bg-deep-dark border rounded-xl p-4 flex flex-col gap-4 transition-colors ${getRiskBorder(result.risk_level)}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-300 uppercase">CSV Satırı</span>
                      <span className="text-lg font-bold text-white">Satır {result.row_index + 1}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-300 uppercase">Tahmin</span>
                      <span className={`text-base font-bold ${result.is_attack ? 'text-red-400' : 'text-green-400'}`}>
                        {result.is_attack ? 'Saldırı' : 'Normal'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-300 uppercase">Saldırı Olasılığı</span>
                      <span className="text-base font-bold text-white">
                        %{(result.attack_probability * 100).toFixed(2).replace(/\.00$/, '')}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-300 uppercase">Risk Seviyesi</span>
                      <span className={`text-base font-bold ${getRiskColor(result.risk_level)}`}>
                        {getRiskLabel(result.risk_level)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-300 uppercase">Oluşturulma Zamanı</span>
                      <span className="text-sm font-medium text-gray-300">
                        {formatDate(result.created_at)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 justify-center min-w-[120px]">
                      {canConvert && !isConverting && (
                        <button
                          ref={(el) => { conversionTriggerRefs.current[result.id] = el; }}
                          type="button"
                          onClick={() => setActiveConversionDetectionId(result.id)}
                          className="py-1.5 px-3 bg-ai-teal text-white text-xs font-bold rounded hover:bg-teal-500 transition-colors self-start md:self-end"
                        >
                          Olaya Dönüştür
                        </button>
                      )}
                      {isConverted && (
                        <span className="text-ai-teal font-bold text-sm flex items-center justify-start md:justify-end gap-1 self-start md:self-end" role="status" aria-live="polite">
                          Olaya Dönüştürüldü
                        </span>
                      )}
                    </div>
                  </div>
                  {isConverting && accessToken && (
                    <IncidentCreateForm
                      detectionResult={result}
                      accessToken={accessToken}
                      onCreated={() => {
                        setConvertedDetectionIds((prev) => new Set(prev).add(result.id));
                        setActiveConversionDetectionId(null);
                        setTimeout(() => conversionTriggerRefs.current[result.id]?.focus(), 0);
                      }}
                      onCancel={() => {
                        setActiveConversionDetectionId(null);
                        setTimeout(() => conversionTriggerRefs.current[result.id]?.focus(), 0);
                      }}
                    />
                  )}
                </li>
              )})}
            </ul>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-space-blue flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-medium text-slate-300">
            <span className="text-white">{start}–{end}</span> / {total} sonuç
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setSkip(Math.max(0, skip - PAGE_SIZE)); setActiveConversionDetectionId(null); }}
              disabled={isLoading || skip === 0}
              className="py-1.5 px-3 bg-space-blue text-white text-sm font-semibold rounded hover:bg-muted-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Önceki
            </button>
            <button
              type="button"
              onClick={() => { setSkip(skip + PAGE_SIZE); setActiveConversionDetectionId(null); }}
              disabled={isLoading || (results ? skip + results.length >= total : true)}
              className="py-1.5 px-3 bg-space-blue text-white text-sm font-semibold rounded hover:bg-muted-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
