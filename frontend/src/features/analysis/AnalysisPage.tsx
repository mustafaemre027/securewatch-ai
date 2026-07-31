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
      <section aria-labelledby="upload-process-section">
        <h2 id="upload-process-section" className="sr-only">Veri Yükleme ve İşleme</h2>
        {!activeJob ? (
          <>
            {user?.role === 'ADMIN' && (
              <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-white mb-2">Ağ Trafiği Analizi</h1>
                <p className="text-muted-blue">Güvenlik analiz kayıtlarını inceleyin.</p>
              </div>
            )}
            <CsvUploadForm onUploaded={handleUploadSuccess} />
          </>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-white mb-2">Ağ Trafiği Analiz İşlemi</h1>
              <p className="text-muted-blue">Yüklenen dosyanız üzerinde analiz işlemini yürütün.</p>
            </div>
            <AnalysisExecutionPanel 
              job={activeJob} 
              onSuccess={handleProcessSuccess}
              onReset={handleReset} 
            />
          </>
        )}
      </section>

      <section aria-labelledby="history-section">
        <h2 id="history-section" className="sr-only">Analiz Geçmişi Bölümü</h2>
        <AnalysisHistoryList key={historyKey} />
      </section>
    </div>
  );
}
