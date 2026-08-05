import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import { getDashboardSummary } from './api';
import type { DashboardSummaryResponse } from './types';
import { ApiError } from '../../api/types';
import { DashboardSummaryCards } from './components/DashboardSummaryCards';
import './dashboard.css';

export const DashboardPage: React.FC = () => {
  const { accessToken, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSummary = async () => {
    if (!isAuthenticated || !accessToken) {
      setError('Oturum bilgisi bulunamadı.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummary(null);

    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    try {
      const response = await getDashboardSummary(accessToken, currentController.signal);
      
      if (abortControllerRef.current !== currentController) return;

      setSummary(response);
    } catch (err: unknown) {
      if (abortControllerRef.current !== currentController) return;

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
      if (abortControllerRef.current === currentController) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    fetchSummary();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  const handleRetry = () => {
    fetchSummary();
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 dashboard-page">
      <div className="mb-2">
        <h1 className="text-3xl font-extrabold text-white mb-2">Genel Özet</h1>
        <p className="text-muted-blue">
          Sistem üzerindeki tüm ağ analizleri, güvenlik tespitleri ve olay raporlarının özet görünümü.
        </p>
      </div>

      {isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center p-12 text-muted-blue">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-ai-teal" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg">Dashboard verileri yükleniyor...</span>
        </div>
      )}

      {error && !isLoading && (
        <div role="alert" className="p-6 bg-deep-dark border-2 border-red-500/50 rounded-xl flex flex-col items-center justify-center text-center">
          <p className="text-lg text-red-400 font-bold mb-4">{error}</p>
          <button
            onClick={handleRetry}
            disabled={isLoading}
            className="py-2 px-6 bg-space-blue text-white font-bold rounded-lg hover:bg-muted-blue transition-colors focus:outline-none focus:ring-2 focus:ring-ai-teal focus:ring-offset-2 focus:ring-offset-deep-dark"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {summary && !isLoading && !error && (
        <section aria-labelledby="summary-cards-heading">
          <h2 id="summary-cards-heading" className="sr-only">Özet İstatistikler</h2>
          <DashboardSummaryCards summary={summary} />
        </section>
      )}
    </div>
  );
};
