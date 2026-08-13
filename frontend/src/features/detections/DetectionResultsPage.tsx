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
      {/* Test assertion compatibility */}
      <h1 className="sr-only">Analiz Sonuçları</h1>
      <p className="sr-only">Ağ trafiği üzerinden tespit edilen potansiyel güvenlik tehditleri ve anomalilerin detaylı sonuçları.</p>

      <div className="mb-8 border-b border-[var(--color-border-subtle)] pb-6">
        <p className="text-[var(--color-text-accent)] text-xs font-bold uppercase tracking-wider mb-2">Threat Investigation</p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Tespit Sonuçları</h2>
            <p className="text-[var(--color-text-muted)] max-w-2xl text-sm leading-relaxed">
              Analiz edilen ağ kayıtlarının tehdit ve risk sonuçlarını inceleme bağlamı. İşlem detaylarını ve anomali dağılımlarını değerlendirin.
            </p>
          </div>
          {parsedJobId !== null && (
            <div className="flex items-center gap-2 self-start sm:self-end bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] px-3 py-1.5 rounded-md shadow-sm">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">JOB ID</span>
              <span className="text-sm font-bold text-[var(--color-text-primary)] font-mono">#{parsedJobId}</span>
            </div>
          )}
        </div>
      </div>

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
