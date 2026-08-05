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
    case 'CRITICAL': return 'bg-red-500 text-white';
    case 'HIGH': return 'bg-orange-500 text-white';
    case 'MEDIUM': return 'bg-yellow-500 text-white';
    case 'LOW': return 'bg-blue-500 text-white';
    default: return 'bg-gray-500 text-white';
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      
      {/* Son Tespitler */}
      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 className="text-lg font-bold text-white mb-4">Son Tespitler</h3>
        
        {recentDetections.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-rich-navy border border-space-blue rounded-lg">
            Henüz görüntülenecek bir tespit bulunmuyor.
          </div>
        ) : (
          <ul className="space-y-3">
            {recentDetections.map(det => (
              <li key={det.id} className="bg-rich-navy border border-space-blue rounded-lg hover:border-ai-teal transition-colors overflow-hidden">
                <Link 
                  to={`/analysis/${det.job_id}/results`} 
                  className="block p-3 focus:outline-none focus:ring-2 focus:ring-ai-teal"
                  aria-label={`Analiz ${det.job_id}, satır ${det.row_index} için tespit detayı`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {det.is_attack ? 'Saldırı Tespit Edildi' : 'Normal Aktivite'}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full shrink-0 ${getRiskColor(det.risk_level)}`}>
                      {getRiskLabel(det.risk_level)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Satır: {det.row_index}</span>
                    <span>{formatDate(det.created_at)}</span>
                  </div>
                  {det.is_attack && det.attack_probability != null && (
                    <div className="mt-2 text-xs font-medium text-red-400">
                      Olasılık: {percentFormatter.format(det.attack_probability)}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Son Olaylar */}
      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 className="text-lg font-bold text-white mb-4">Son Olaylar</h3>

        {recentIncidents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-rich-navy border border-space-blue rounded-lg">
            Henüz görüntülenecek bir olay bulunmuyor.
          </div>
        ) : (
          <ul className="space-y-3">
            {recentIncidents.map(inc => (
              <li key={inc.id} className="bg-rich-navy border border-space-blue rounded-lg hover:border-ai-teal transition-colors overflow-hidden">
                <Link 
                  to={`/incidents/${inc.id}`} 
                  className="block p-3 focus:outline-none focus:ring-2 focus:ring-ai-teal"
                  aria-label={`"${inc.title}" olayı detayları`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-sm font-medium text-slate-200 truncate" title={inc.title}>
                      {inc.title}
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-space-blue text-slate-300">
                        {getStatusLabel(inc.status)}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getRiskColor(inc.severity)}`}>
                        {getRiskLabel(inc.severity)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{inc.assigned_analyst_id ? 'Atandı' : 'Atanmadı'}</span>
                    <span>{formatDate(inc.created_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      
    </div>
  );
};
