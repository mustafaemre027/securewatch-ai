import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { CsvUploadForm } from './components/CsvUploadForm';
import { AnalysisExecutionPanel } from './components/AnalysisExecutionPanel';
import { AnalysisHistoryList } from './components/AnalysisHistoryList';
import type { AnalysisUploadResponse } from './types';

export function AnalysisPage() {
  const { user } = useAuth();
  const [activeJob, setActiveJob] = useState<AnalysisUploadResponse | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const handleUploadSuccess = (job: AnalysisUploadResponse) => {
    setActiveJob(job);
  };

  const handleProcessSuccess = () => {
    setHistoryKey(prev => prev + 1);
  };

  const handleReset = () => {
    setActiveJob(null);
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="mb-2">
        <h1 className="text-3xl font-extrabold text-white mb-2">Analiz İşlemleri</h1>
        <p className="text-muted-blue">
          {!activeJob && user?.role === 'ADMIN' && 'Güvenlik analiz kayıtlarını inceleyin.'}
          {!activeJob && user?.role !== 'ADMIN' && 'Yeni ağ trafiği verilerini yükleyin veya geçmiş kayıtları inceleyin.'}
          {activeJob && 'Yüklenen dosyanız üzerinde analiz işlemini yürütün.'}
        </p>
      </div>

      <section aria-labelledby="upload-process-section">
        <h2 id="upload-process-section" className="sr-only">Veri Yükleme ve İşleme</h2>
        {!activeJob ? (
          <CsvUploadForm onUploaded={handleUploadSuccess} />
        ) : (
          <AnalysisExecutionPanel
            job={activeJob}
            onSuccess={handleProcessSuccess}
            onReset={handleReset}
          />
        )}
      </section>

      <section aria-labelledby="history-section">
        <h2 id="history-section" className="sr-only">Analiz Geçmişi Bölümü</h2>
        <AnalysisHistoryList key={historyKey} />
      </section>
    </div>
  );
}
