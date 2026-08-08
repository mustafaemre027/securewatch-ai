import React from 'react';
import type { DashboardSummaryResponse } from '../types';

export interface DashboardSummaryCardsProps {
  summary: DashboardSummaryResponse;
}

export const DashboardSummaryCards: React.FC<DashboardSummaryCardsProps> = ({ summary }) => {
  const numberFormat = new Intl.NumberFormat('tr-TR');
  const formatNum = (num: number) => numberFormat.format(num);

  const totalDetections = summary.detection_summary.total_detections;
  const attackCount = summary.detection_summary.attack_count;
  let attackRatioStr = '%0';
  if (totalDetections > 0) {
    const ratio = (attackCount / totalDetections) * 100;
    attackRatioStr = '%' + new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(ratio);
  }

  const openAndInProgressIncidents = 
    (summary.incident_summary.status_distribution.OPEN || 0) + 
    (summary.incident_summary.status_distribution.IN_PROGRESS || 0);

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" 
      aria-label="Dashboard Özet Kartları"
    >
      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 className="text-xs font-bold text-slate-300 uppercase mb-1">Toplam Analiz</h3>
        <p className="text-2xl font-bold text-white mb-2">{formatNum(summary.analysis_summary.total_jobs)}</p>
        <p className="text-sm text-muted-blue">
          Tamamlanan: <span className="font-semibold text-slate-300">{formatNum(summary.analysis_summary.completed_jobs)}</span>
        </p>
      </div>

      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 className="text-xs font-bold text-slate-300 uppercase mb-1">Toplam Tespit</h3>
        <p className="text-2xl font-bold text-white mb-2">{formatNum(totalDetections)}</p>
        <p className="text-sm text-muted-blue">
          Normal (Benign): <span className="font-semibold text-green-400">{formatNum(summary.detection_summary.benign_count)}</span>
        </p>
      </div>

      <div className="p-4 bg-deep-dark border border-red-500/30 rounded-lg">
        <h3 className="text-xs font-bold text-red-400 uppercase mb-1">Saldırı Tespiti</h3>
        <p className="text-2xl font-bold text-white mb-2">{formatNum(attackCount)}</p>
        <p className="text-sm text-red-400/80">
          Oran: <span className="font-semibold text-red-400">{attackRatioStr}</span>
        </p>
      </div>

      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 className="text-xs font-bold text-slate-300 uppercase mb-1">Toplam Olay</h3>
        <p className="text-2xl font-bold text-white mb-2">{formatNum(summary.incident_summary.total_incidents)}</p>
        <p className="text-sm text-muted-blue">
          Açık & İncelenen: <span className="font-semibold text-yellow-400">{formatNum(openAndInProgressIncidents)}</span>
        </p>
      </div>
    </div>
  );
};
