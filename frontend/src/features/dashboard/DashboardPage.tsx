import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import { getDashboardSummary } from './api';
import type { DashboardSummaryResponse } from './types';
import { ApiError } from '../../api/types';
import { DashboardSummaryCards } from './components/DashboardSummaryCards';
import { DashboardCharts } from './components/DashboardCharts';
import { DashboardRecentActivity } from './components/DashboardRecentActivity';
import './dashboard.css';

export const DashboardPage: React.FC = () => {
  const { accessToken, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const executeFetch = async () => {
      try {
        const response = await getDashboardSummary(accessToken, controller.signal);

        if (abortControllerRef.current !== controller) return;

        setSummary(response);
      } catch (err: unknown) {
        if (abortControllerRef.current !== controller) return;

        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        let errorMessage = 'Dashboard verileri yüklenirken beklenmeyen bir hata oluştu.';

        if (err instanceof ApiError) {
          if (err.status === 401) {
            errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
          } else if (err.status === 403) {
            errorMessage = 'Dashboard verilerini görüntüleme yetkiniz bulunmuyor.';
          } else if (err.status === 0 || err.code === 'NETWORK_ERROR') {
            errorMessage = 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
          } else if (err.status >= 500) {
            errorMessage = 'Dashboard hizmeti geçici olarak kullanılamıyor.';
          } else {
            errorMessage = 'Dashboard verileri doğrulanamadı.';
          }
        } else if (err instanceof Error) {
          errorMessage = 'Dashboard verileri doğrulanamadı.';
        }

        setError(errorMessage);
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
          abortControllerRef.current = null;
        }
      }
    };

    executeFetch();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isAuthenticated, accessToken, retryCount]);

  const handleRetry = () => {
    if (!isAuthenticated || !accessToken) return;

    setIsLoading(true);
    setError(null);
    setSummary(null);
    setRetryCount(c => c + 1);
  };

  const isDashboardEmpty = summary
    ? summary.analysis_summary.total_jobs === 0 &&
      summary.detection_summary.total_detections === 0 &&
      summary.incident_summary.total_incidents === 0
    : false;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto dashboard-page pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <div className="text-[10px] font-bold tracking-wider text-[var(--color-accent-primary)] uppercase mb-1">
            Security Command Center
          </div>
          <h1 className="text-3xl font-extrabold text-text-primary mb-1 tracking-tight">Genel Özet</h1>
          <p className="text-sm text-text-secondary max-w-2xl">
            Sistem üzerindeki tüm ağ analizleri, güvenlik tespitleri ve olay raporlarının özet görünümü.
          </p>
        </div>

        {summary && !isLoading && !error && (
          <div className="text-xs font-medium text-text-muted bg-surface-base px-3 py-1.5 rounded border border-border-subtle inline-flex items-center gap-2 self-start md:self-auto">
            <span className="w-2 h-2 rounded-full bg-[var(--color-semantic-success)] animate-pulse"></span>
            Son güncelleme: {new Date(summary.generated_at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
      </div>

      {isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col items-center justify-center p-20 sw-surface-elevated text-text-muted">
          <svg className="animate-spin mb-4 h-10 w-10 text-[var(--color-accent-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-medium tracking-wide">Dashboard verileri yükleniyor...</span>
        </div>
      )}

      {error && !isLoading && (
        <div role="alert" className="p-8 bg-[var(--color-semantic-danger-bg)] border border-[var(--color-semantic-danger)]/30 rounded-xl flex flex-col items-center justify-center text-center">
          <p className="text-base text-[var(--color-semantic-danger)] font-medium mb-6 max-w-md">{error}</p>
          <button
            onClick={handleRetry}
            disabled={isLoading}
            className="sw-button-primary"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {summary && !isLoading && !error && (
        <section aria-labelledby="summary-cards-heading" className="flex flex-col gap-6">
          <h2 id="summary-cards-heading" className="sr-only">Özet İstatistikler</h2>

          {isDashboardEmpty && (
            <div className="p-8 sw-surface text-center text-text-muted border-dashed border-2 border-border-default">
              Henüz sistemde gösterilecek veri bulunmuyor.
            </div>
          )}

          <DashboardSummaryCards summary={summary} />

          {!isDashboardEmpty && (
            <DashboardCharts summary={summary} />
          )}

          {!isDashboardEmpty && (
            <DashboardRecentActivity
              recentDetections={summary.recent_detections}
              recentIncidents={summary.recent_incidents}
            />
          )}
        </section>
      )}
    </div>
  );
};
