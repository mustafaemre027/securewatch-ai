import React from 'react';
import { Link } from 'react-router';
import type { RecentDetection, RecentIncident } from '../types';

export interface DashboardRecentActivityProps {
  recentDetections: RecentDetection[];
  recentIncidents: RecentIncident[];
}

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const percentFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'percent',
  maximumFractionDigits: 1
});

const formatDate = (isoString: string) => {
  try {
    return dateFormatter.format(new Date(isoString));
  } catch {
    return isoString;
  }
};

const getRiskLabel = (risk: string) => {
  switch (risk) {
    case 'LOW': return 'Düşük';
    case 'MEDIUM': return 'Orta';
    case 'HIGH': return 'Yüksek';
    case 'CRITICAL': return 'Kritik';
    default: return risk;
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'CRITICAL': return 'bg-[var(--color-semantic-danger-bg)] text-[var(--color-semantic-danger)] border-[var(--color-semantic-danger)]/20 border';
    case 'HIGH': return 'bg-orange-500/10 text-orange-400 border-orange-500/20 border';
    case 'MEDIUM': return 'bg-[var(--color-semantic-warning-bg)] text-[var(--color-semantic-warning)] border-[var(--color-semantic-warning)]/20 border';
    case 'LOW': return 'bg-[var(--color-semantic-info-bg)] text-[var(--color-semantic-info)] border-[var(--color-semantic-info)]/20 border';
    default: return 'bg-surface-hover text-text-muted border-border-default border';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'OPEN': return 'Açık';
    case 'IN_PROGRESS': return 'İnceleniyor';
    case 'RESOLVED': return 'Çözüldü';
    case 'FALSE_POSITIVE': return 'Yanlış Pozitif';
    default: return status;
  }
};

export const DashboardRecentActivity: React.FC<DashboardRecentActivityProps> = ({
  recentDetections,
  recentIncidents
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 items-start">

      {/* Son Tespitler */}
      <div className="sw-surface p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6 shrink-0 border-b border-border-subtle pb-4">
          <h3 className="text-sm font-bold text-text-primary">Son Tespitler</h3>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Feed</span>
        </div>

        {recentDetections.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-border-default rounded-lg">
            <svg className="w-8 h-8 text-text-muted mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="text-sm text-text-muted">Henüz tespit kaydı bulunmuyor.</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[420px] pr-2 scrollbar-thin">
            <ul className="space-y-3">
              {recentDetections.map(det => (
                <li key={det.id} className="bg-surface-base border border-border-default rounded-lg hover:border-[var(--color-accent-primary)]/50 hover:bg-surface-hover transition-all">
                  <Link
                    to={`/analysis/${det.job_id}/results`}
                    className="block p-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/50 rounded-lg"
                    aria-label={`Analiz ${det.job_id}, satır ${det.row_index} için tespit detayı`}
                  >
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex items-center gap-2">
                        {det.is_attack ? (
                          <div className="w-2 h-2 rounded-full bg-[var(--color-semantic-danger)]"></div>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-[var(--color-semantic-success)]"></div>
                        )}
                        <span className="text-sm font-semibold text-text-primary">
                          {det.is_attack ? 'Saldırı Tespit Edildi' : 'Normal Aktivite'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider shrink-0 ${getRiskColor(det.risk_level)}`}>
                        {getRiskLabel(det.risk_level)}
                      </span>
                    </div>
                    <div className="flex justify-between items-end text-xs text-text-secondary">
                      <div className="flex flex-col gap-1">
                        <span>Satır: {det.row_index}</span>
                        {det.is_attack && det.attack_probability != null && (
                          <span className="font-medium text-[var(--color-semantic-danger)]">
                            Olasılık: {percentFormatter.format(det.attack_probability)}
                          </span>
                        )}
                      </div>
                      <span className="text-text-muted text-[11px] whitespace-nowrap">{formatDate(det.created_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Son Olaylar */}
      <div className="sw-surface p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6 shrink-0 border-b border-border-subtle pb-4">
          <h3 className="text-sm font-bold text-text-primary">Son Olaylar</h3>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Queue</span>
        </div>

        {recentIncidents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-border-default rounded-lg">
            <svg className="w-8 h-8 text-text-muted mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="text-sm text-text-muted">Henüz olay kaydı bulunmuyor.</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[420px] pr-2 scrollbar-thin">
            <ul className="space-y-3">
              {recentIncidents.map(inc => (
                <li key={inc.id} className="bg-surface-base border border-border-default rounded-lg hover:border-[var(--color-accent-primary)]/50 hover:bg-surface-hover transition-all">
                  <Link
                    to={`/incidents/${inc.id}`}
                    className="block p-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/50 rounded-lg"
                    aria-label={`"${inc.title}" olayı detayları`}
                  >
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <span className="text-sm font-semibold text-text-primary truncate" title={inc.title}>
                        {inc.title}
                      </span>
                      <div className="flex gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-surface-elevated text-text-secondary border border-border-subtle">
                          {getStatusLabel(inc.status)}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${getRiskColor(inc.severity)}`}>
                          {getRiskLabel(inc.severity)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-end text-xs text-text-secondary">
                      <span className={`font-medium ${inc.assigned_analyst_id ? 'text-[var(--color-accent-primary)]' : 'text-text-muted'}`}>
                        {inc.assigned_analyst_id ? 'Atandı' : 'Atanmadı'}
                      </span>
                      <span className="text-text-muted text-[11px] whitespace-nowrap">{formatDate(inc.created_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </div>
  );
};
