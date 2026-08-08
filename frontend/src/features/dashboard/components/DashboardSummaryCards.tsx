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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      aria-label="Dashboard Özet Kartları"
    >
      {/* 1. Toplam Analiz */}
      <div className="sw-surface p-5 flex flex-col justify-between relative overflow-hidden group hover:-translate-y-px transition-transform duration-300">
        <div className="flex justify-between items-start mb-5">
          <h3 className="text-[11px] font-bold text-text-secondary tracking-wider uppercase">
            Toplam Analiz
          </h3>
          <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center border border-border-default/60 shadow-sm">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
        </div>
        <div>
          <p className="text-3xl font-extrabold text-text-primary tracking-tight mb-1">{formatNum(summary.analysis_summary.total_jobs)}</p>
          <p className="text-xs text-text-muted">
            Tamamlanan: <span className="font-medium text-text-secondary">{formatNum(summary.analysis_summary.completed_jobs)}</span>
          </p>
        </div>
        <div className="absolute top-0 left-0 w-full h-0.5 bg-border-subtle group-hover:bg-[var(--color-accent-primary)] transition-colors"></div>
      </div>

      {/* 2. Toplam Tespit */}
      <div className="sw-surface p-5 flex flex-col justify-between relative overflow-hidden group hover:-translate-y-px transition-transform duration-300">
        <div className="flex justify-between items-start mb-5">
          <h3 className="text-[11px] font-bold text-text-secondary tracking-wider uppercase">
            Toplam Tespit
          </h3>
          <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center border border-border-default/60 shadow-sm">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        <div>
          <p className="text-3xl font-extrabold text-text-primary tracking-tight mb-1">{formatNum(totalDetections)}</p>
          <p className="text-xs text-text-muted">
            Normal (Benign): <span className="font-medium text-[var(--color-semantic-success)]">{formatNum(summary.detection_summary.benign_count)}</span>
          </p>
        </div>
        <div className="absolute top-0 left-0 w-full h-0.5 bg-border-subtle group-hover:bg-[var(--color-accent-primary)] transition-colors"></div>
      </div>

      {/* 3. Saldırı Tespiti (ATTACK KPI) */}
      <div className="sw-surface p-5 flex flex-col justify-between relative overflow-hidden group border-[var(--color-semantic-danger)]/30 bg-gradient-to-b from-[var(--color-semantic-danger-bg)] to-transparent">
        <div className="flex justify-between items-start mb-5">
          <h3 className="text-[11px] font-bold text-[var(--color-semantic-danger)] tracking-wider uppercase">
            Saldırı Tespiti
          </h3>
          <div className="w-8 h-8 rounded-full bg-[var(--color-semantic-danger)]/10 flex items-center justify-center border border-[var(--color-semantic-danger)]/20 shadow-sm">
            <svg className="w-4 h-4 text-[var(--color-semantic-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
        </div>
        <div>
          <p className="text-3xl font-extrabold text-text-primary tracking-tight mb-1">{formatNum(attackCount)}</p>
          <p className="text-xs text-[var(--color-semantic-danger)]/80">
            Oran: <span className="font-semibold text-[var(--color-semantic-danger)]">{attackRatioStr}</span>
          </p>
        </div>
        <div className="absolute top-0 left-0 w-full h-0.5 bg-[var(--color-semantic-danger)]/50 group-hover:bg-[var(--color-semantic-danger)] transition-colors"></div>
      </div>

      {/* 4. Toplam Olay */}
      <div className="sw-surface p-5 flex flex-col justify-between relative overflow-hidden group hover:-translate-y-px transition-transform duration-300">
        <div className="flex justify-between items-start mb-5">
          <h3 className="text-[11px] font-bold text-text-secondary tracking-wider uppercase">
            Toplam Olay
          </h3>
          <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center border border-border-default/60 shadow-sm">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
        </div>
        <div>
          <p className="text-3xl font-extrabold text-text-primary tracking-tight mb-1">{formatNum(summary.incident_summary.total_incidents)}</p>
          <p className="text-xs text-text-muted">
            Açık & İncelenen: <span className="font-medium text-[var(--color-semantic-warning)]">{formatNum(openAndInProgressIncidents)}</span>
          </p>
        </div>
        <div className="absolute top-0 left-0 w-full h-0.5 bg-border-subtle group-hover:bg-[var(--color-accent-primary)] transition-colors"></div>
      </div>
    </div>
  );
};
