import React from 'react';
import { useParams } from 'react-router';
import { DetectionSummaryPanel } from './components/DetectionSummaryPanel';
import { DetectionResultsList } from './components/DetectionResultsList';

export const DetectionResultsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();

  let parsedJobId: number | null = null;

  if (jobId && /^[1-9][0-9]*$/.test(jobId)) {
    const num = Number(jobId);
    if (Number.isSafeInteger(num) && num > 0) {
      parsedJobId = num;
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Analiz Sonuçları</h1>
      <p className="text-slate-300 mb-8">
        Ağ trafiği üzerinden tespit edilen potansiyel güvenlik tehditleri ve anomalilerin detaylı sonuçları.
      </p>

      {parsedJobId !== null ? (
        <div className="flex flex-col gap-8">
          <section aria-label="Tespit Özeti">
            <DetectionSummaryPanel jobId={parsedJobId} />
          </section>

          <section aria-label="Tespit Sonuç Listesi">
            <DetectionResultsList jobId={parsedJobId} />
          </section>
        </div>
      ) : (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          Geçersiz veya eksik analiz ID parametresi. Lütfen geçerli bir bağlantı kullandığınızdan emin olun.
        </div>
      )}
    </div>
  );
};
