import { useState, useCallback } from 'react';
import { CsvUploadForm } from './components/CsvUploadForm';
import { AnalysisExecutionPanel } from './components/AnalysisExecutionPanel';
import { AnalysisHistoryList } from './components/AnalysisHistoryList';
import { useAuth } from '../auth/useAuth';
import type { AnalysisUploadResponse } from './types';

export function AnalysisPage() {
  const { user } = useAuth();

  const [activeJob, setActiveJob] = useState<AnalysisUploadResponse | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const handleCsvUploaded = useCallback((job: AnalysisUploadResponse) => {
    setActiveJob(job);
  }, []);

  const handleAnalysisSuccess = useCallback(() => {
    setHistoryKey(prev => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setActiveJob(null);
  }, []);

  return (
    <div className="w-full flex flex-col gap-8 max-w-[1400px] mx-auto px-4 md:px-8 pb-12">

      <header className="pt-6 pb-2 border-b border-[var(--color-border-subtle)]">
        <div className="text-[10px] font-bold tracking-wider text-[var(--color-accent-primary)] uppercase mb-1">
          Network Analysis
        </div>
        <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Analiz İşlemleri</h1>
        <p className="mt-2 text-[var(--color-text-secondary)] text-sm md:text-base max-w-3xl">
          {!activeJob && user?.role === 'ADMIN' && 'Güvenlik analiz kayıtlarını inceleyin.'}
          {!activeJob && user?.role !== 'ADMIN' && 'Yeni ağ trafiği verilerini yükleyin veya geçmiş kayıtları inceleyin.'}
          {activeJob && 'Yüklenen dosyanız üzerinde analiz işlemini yürütün.'}
        </p>
      </header>

      <section aria-labelledby="analysis-workspace" className="w-full">
        <h2 id="analysis-workspace" className="sr-only">Veri Yükleme ve İşleme</h2>
        {!activeJob ? (
          <div className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] shadow-lg rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-[var(--color-border-strong)]">
            <CsvUploadForm onUploaded={handleCsvUploaded} />
          </div>
        ) : (
          <div className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] shadow-lg rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AnalysisExecutionPanel
              job={activeJob}
              onSuccess={handleAnalysisSuccess}
              onReset={handleReset}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="history-heading" className="w-full mt-4">
        <h2 id="history-heading" className="sr-only">Analiz Geçmişi Bölümü</h2>
        <div className="sw-panel p-6 sm:p-8 rounded-xl shadow-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]">
          <AnalysisHistoryList key={historyKey} />
        </div>
      </section>
    </div>
  );
}
