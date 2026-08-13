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

  const getRiskBadgeStyles = (risk: DetectionRiskLevel) => {
    switch (risk) {
      case 'LOW': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'MEDIUM': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'HIGH': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'CRITICAL': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? 'Bilinmiyor' : d.toLocaleString('tr-TR');
  };

  const start = total === 0 ? 0 : skip + 1;
  const end = total === 0 ? 0 : skip + (results ? results.length : 0);

  return (
    <div className="w-full mt-6 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden flex flex-col shadow-sm">
      <div className="p-4 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-text-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          İnceleme Listesi
        </h3>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex w-full sm:w-auto items-center gap-2 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-md px-3 py-1.5 focus-within:ring-2 focus-within:ring-[var(--color-text-accent)] focus-within:border-transparent transition-all">
            <label htmlFor={`attack-filter-${jobId}`} className="text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap uppercase tracking-wider">Tahmin Filtresi</label>
            <select
              id={`attack-filter-${jobId}`}
              className="bg-transparent text-[var(--color-text-primary)] text-sm font-semibold focus:outline-none cursor-pointer py-0.5 w-full sm:w-auto"
              value={isAttackFilter === undefined ? 'ALL' : isAttackFilter ? 'ATTACK' : 'NORMAL'}
              onChange={handleAttackFilterChange}
              disabled={isLoading}
            >
              <option value="ALL">Tümü</option>
              <option value="ATTACK">Saldırı</option>
              <option value="NORMAL">Normal</option>
            </select>
          </div>

          <div className="flex w-full sm:w-auto items-center gap-2 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-md px-3 py-1.5 focus-within:ring-2 focus-within:ring-[var(--color-text-accent)] focus-within:border-transparent transition-all">
            <label htmlFor={`risk-filter-${jobId}`} className="text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap uppercase tracking-wider">Risk Seviyesi</label>
            <select
              id={`risk-filter-${jobId}`}
              className="bg-transparent text-[var(--color-text-primary)] text-sm font-semibold focus:outline-none cursor-pointer py-0.5 w-full sm:w-auto"
              value={riskFilter || 'ALL'}
              onChange={handleRiskFilterChange}
              disabled={isLoading}
            >
              <option value="ALL">Tümü</option>
              <option value="LOW">Düşük</option>
              <option value="MEDIUM">Orta</option>
              <option value="HIGH">Yüksek</option>
              <option value="CRITICAL">Kritik</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 relative min-h-[300px] flex flex-col">
        {apiError && !isLoading && (
          <div className="mb-4 p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-semantic-danger)] border-opacity-50 rounded-lg flex flex-col items-start" role="alert">
            <p className="text-sm text-[var(--color-semantic-danger)] font-bold mb-3">{apiError}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="py-1.5 px-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-semibold rounded-md hover:bg-[var(--color-surface-hover)] focus:ring-2 focus:ring-[var(--color-text-accent)] outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              disabled={isLoading}
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {isLoading && (
          <div role="status" aria-busy="true" className="absolute inset-0 z-10 bg-[var(--color-surface-base)] bg-opacity-80 flex items-center justify-center backdrop-blur-sm">
            <div className="flex items-center text-[var(--color-text-accent)] font-medium">
              <svg aria-hidden="true" className="animate-spin -ml-1 mr-3 h-6 w-6" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sonuçlar yükleniyor...
            </div>
          </div>
        )}

        {!apiError && results && results.length === 0 && (
          <div className="flex flex-1 items-center justify-center p-8 text-center" aria-live="polite">
            <p className="text-[var(--color-text-muted)] font-medium">
              {isAttackFilter !== undefined || riskFilter !== undefined
                ? 'Seçilen filtrelerle eşleşen tespit sonucu bulunamadı.'
                : 'Bu analiz için tespit sonucu bulunmuyor.'}
            </p>
          </div>
        )}

        {!apiError && results && results.length > 0 && (
          <div className="flex-1 flex flex-col" aria-live="polite">
            <ul className="flex flex-col gap-3 mb-6">
              {results.map((result) => {
                const isConverted = convertedDetectionIds.has(result.id);
                const canConvert = result.is_attack && user?.role === 'ANALYST' && accessToken && !isConverted;
                const isConverting = activeConversionDetectionId === result.id;
                
                return (
                <li key={result.id} className="flex flex-col gap-0 relative">
                  <div className={`p-4 md:p-5 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center rounded-xl border transition-colors relative overflow-hidden ${
                    result.is_attack
                      ? 'bg-[var(--color-semantic-danger)]/5 border-[var(--color-semantic-danger)]/30 hover:bg-[var(--color-semantic-danger)]/10'
                      : 'bg-[var(--color-surface-elevated)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]'
                  }`}>
                    {result.is_attack && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-semantic-danger)]"></div>}
                    {!result.is_attack && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-semantic-success)] opacity-50"></div>}

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">CSV Satırı</span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)] font-mono">Satır {result.row_index + 1}</span>
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Tahmin</span>
                      {result.is_attack ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-semantic-danger)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-semantic-danger)]" aria-hidden="true"></span>
                          Saldırı
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-semantic-success)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-semantic-success)]" aria-hidden="true"></span>
                          Normal
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Saldırı Olasılığı</span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)] font-mono">
                        %{(result.attack_probability * 100).toFixed(2).replace(/\.00$/, '')}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Risk Seviyesi</span>
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold border w-max ${getRiskBadgeStyles(result.risk_level)}`}>
                        {getRiskLabel(result.risk_level)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Oluşturulma Zamanı</span>
                      <span className="text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
                        {formatDate(result.created_at)}
                      </span>
                    </div>

                    <div className="flex flex-col md:items-end justify-center md:col-span-2 mt-2 md:mt-0 w-full md:w-auto">
                      {canConvert && !isConverting && (
                        <button
                          ref={(el) => { conversionTriggerRefs.current[result.id] = el; }}
                          type="button"
                          onClick={() => setActiveConversionDetectionId(result.id)}
                          className="w-full md:w-max py-1.5 px-4 bg-teal-400 text-slate-900 text-xs font-extrabold rounded-md hover:bg-teal-300 focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all outline-none shadow-[0_0_10px_rgba(45,212,191,0.15)] hover:shadow-[0_0_15px_rgba(45,212,191,0.3)]"
                        >
                          Olaya Dönüştür
                        </button>
                      )}
                      {isConverted && (
                        <span className="text-[var(--color-semantic-success)] font-bold text-xs flex items-center justify-start md:justify-end gap-1.5 w-full md:w-max" role="status" aria-live="polite">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Dönüştürüldü
                        </span>
                      )}
                    </div>
                  </div>

                  {isConverting && accessToken && (
                    <div className="incident-form-wrapper mt-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-xl p-5 md:p-6 shadow-xl relative z-10 mx-2 mb-2 before:content-[''] before:absolute before:-top-2.5 before:left-8 md:before:left-[calc(100%-120px)] before:border-8 before:border-transparent before:border-b-[var(--color-border-subtle)] after:content-[''] after:absolute after:-top-2 after:left-[33px] md:after:left-[calc(100%-119px)] after:border-[7px] after:border-transparent after:border-b-[var(--color-surface-elevated)]">
                      <style>{`
                        .incident-form-wrapper form button[type="submit"] {
                          background-color: #2dd4bf !important;
                          color: #0f172a !important;
                          font-weight: 800 !important;
                          box-shadow: 0 0 10px rgba(45,212,191,0.15);
                          border: none;
                        }
                        .incident-form-wrapper form button[type="submit"]:hover:not(:disabled) {
                          background-color: #5eead4 !important;
                          box-shadow: 0 0 15px rgba(45,212,191,0.3);
                        }
                        .incident-form-wrapper form button[type="submit"]:focus-visible {
                          outline: 2px solid #2dd4bf !important;
                          outline-offset: 2px !important;
                        }
                        .incident-form-wrapper form button[type="button"] {
                          color: var(--color-text-primary) !important;
                        }
                        .incident-form-wrapper form button[type="button"]:hover:not(:disabled) {
                          background-color: var(--color-surface-hover) !important;
                          border-radius: 0.5rem;
                        }
                      `}</style>
                      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[var(--color-border-subtle)]">
                        <svg className="w-5 h-5 text-[var(--color-text-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h4 className="text-sm font-bold text-[var(--color-text-primary)]">Tespiti Olaya Dönüştür</h4>
                      </div>
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
                    </div>
                  )}
                </li>
              )})}
            </ul>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-primary)] font-bold">{start}–{end}</span> / {total} sonuç
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => { setSkip(Math.max(0, skip - PAGE_SIZE)); setActiveConversionDetectionId(null); }}
              disabled={isLoading || skip === 0}
              className="flex-1 sm:flex-none py-1.5 px-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm font-semibold rounded-md hover:bg-[var(--color-surface-hover)] focus:ring-2 focus:ring-[var(--color-text-accent)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Önceki
            </button>
            <button
              type="button"
              onClick={() => { setSkip(skip + PAGE_SIZE); setActiveConversionDetectionId(null); }}
              disabled={isLoading || (results ? skip + results.length >= total : true)}
              className="flex-1 sm:flex-none py-1.5 px-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm font-semibold rounded-md hover:bg-[var(--color-surface-hover)] focus:ring-2 focus:ring-[var(--color-text-accent)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
