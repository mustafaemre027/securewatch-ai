import React from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import type { DashboardSummaryResponse } from '../types';

export interface DashboardChartsProps {
  summary: DashboardSummaryResponse;
}

const COLORS = {
  normal: '#10b981', // emerald-500
  attack: '#ef4444', // red-500
  low: '#3b82f6', // blue-500
  medium: '#eab308', // yellow-500
  high: '#f97316', // orange-500
  critical: '#dc2626', // red-600
  open: '#3b82f6', // blue-500
  inProgress: '#eab308', // yellow-500
  resolved: '#10b981', // emerald-500
  falsePositive: '#6b7280', // gray-500
  total: '#8b5cf6', // violet-500
};

const numberFormatter = new Intl.NumberFormat('tr-TR');
const formatTooltipValue = (value: any) => typeof value === 'number' ? numberFormatter.format(value) : value;

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ summary }) => {
  // 1. Detection Distribution
  const detectionData = [
    { name: 'Normal', value: summary.detection_class_distribution.benign },
    { name: 'Saldırı', value: summary.detection_class_distribution.attack }
  ];
  const isDetectionEmpty = detectionData.every(d => d.value === 0);

  // 2. Risk Distribution
  const riskData = [
    { name: 'Düşük', value: summary.risk_distribution.LOW || 0 },
    { name: 'Orta', value: summary.risk_distribution.MEDIUM || 0 },
    { name: 'Yüksek', value: summary.risk_distribution.HIGH || 0 },
    { name: 'Kritik', value: summary.risk_distribution.CRITICAL || 0 }
  ];
  const isRiskEmpty = riskData.every(d => d.value === 0);

  // 3. Incident Status Distribution
  const statusData = [
    { name: 'Açık', value: summary.incident_summary.status_distribution.OPEN || 0 },
    { name: 'İnceleniyor', value: summary.incident_summary.status_distribution.IN_PROGRESS || 0 },
    { name: 'Çözüldü', value: summary.incident_summary.status_distribution.RESOLVED || 0 },
    { name: 'Yanlış Pozitif', value: summary.incident_summary.status_distribution.FALSE_POSITIVE || 0 }
  ];
  const isStatusEmpty = statusData.every(d => d.value === 0);

  // 4. Incident Severity Distribution
  const severityData = [
    { name: 'Düşük', value: summary.incident_summary.severity_distribution.LOW || 0 },
    { name: 'Orta', value: summary.incident_summary.severity_distribution.MEDIUM || 0 },
    { name: 'Yüksek', value: summary.incident_summary.severity_distribution.HIGH || 0 },
    { name: 'Kritik', value: summary.incident_summary.severity_distribution.CRITICAL || 0 }
  ];
  const isSeverityEmpty = severityData.every(d => d.value === 0);

  // 5. Trend 7 Days
  const trendData = summary.trend_7_days.map(d => {
    const parts = d.date.split('-');
    const label = parts.length === 3 ? `${parts[2]}.${parts[1]}` : d.date;
    return {
      dateLabel: label,
      Toplam: d.total,
      Normal: d.benign,
      Saldırı: d.attack
    };
  });
  const isTrendEmpty = trendData.every(d => d.Toplam === 0 && d.Normal === 0 && d.Saldırı === 0) || trendData.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      
      {/* Detection Class Distribution */}
      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 id="chart-detection-title" className="text-lg font-bold text-white mb-4">Tespit Dağılımı</h3>
        <div className="sr-only">
          Tespit Dağılımı Özeti: Normal: {numberFormatter.format(detectionData[0].value)}, Saldırı: {numberFormatter.format(detectionData[1].value)}
        </div>
        <div 
          className="h-64 w-full"
          role="img" 
          aria-label="Tespit dağılımı grafik bölgesi" 
          aria-labelledby="chart-detection-title"
        >
          {isDetectionEmpty ? (
            <div className="flex items-center justify-center h-full text-muted-blue">
              Tespit dağılımı için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={detectionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  <Cell fill={COLORS.normal} />
                  <Cell fill={COLORS.attack} />
                </Pie>
                <Tooltip formatter={formatTooltipValue} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 id="chart-risk-title" className="text-lg font-bold text-white mb-4">Risk Seviyesi Dağılımı</h3>
        <div className="sr-only">
          Risk Seviyesi Dağılımı Özeti: {riskData.map(d => `${d.name}: ${numberFormatter.format(d.value)}`).join(', ')}
        </div>
        <div 
          className="h-64 w-full"
          role="img" 
          aria-label="Risk dağılımı grafik bölgesi" 
          aria-labelledby="chart-risk-title"
        >
          {isRiskEmpty ? (
            <div className="flex items-center justify-center h-full text-muted-blue">
              Risk dağılımı için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip formatter={formatTooltipValue} cursor={{fill: '#334155', opacity: 0.4}} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }} />
                <Bar dataKey="value" name="Risk Seviyesi" isAnimationActive={false}>
                  <Cell fill={COLORS.low} />
                  <Cell fill={COLORS.medium} />
                  <Cell fill={COLORS.high} />
                  <Cell fill={COLORS.critical} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Incident Status Distribution */}
      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 id="chart-status-title" className="text-lg font-bold text-white mb-4">Olay Durumu Dağılımı</h3>
        <div className="sr-only">
          Olay Durumu Dağılımı Özeti: {statusData.map(d => `${d.name}: ${numberFormatter.format(d.value)}`).join(', ')}
        </div>
        <div 
          className="h-64 w-full"
          role="img" 
          aria-label="Olay durumu grafik bölgesi" 
          aria-labelledby="chart-status-title"
        >
          {isStatusEmpty ? (
            <div className="flex items-center justify-center h-full text-muted-blue">
              Olay durumu için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  <Cell fill={COLORS.open} />
                  <Cell fill={COLORS.inProgress} />
                  <Cell fill={COLORS.resolved} />
                  <Cell fill={COLORS.falsePositive} />
                </Pie>
                <Tooltip formatter={formatTooltipValue} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Incident Severity Distribution */}
      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg">
        <h3 id="chart-severity-title" className="text-lg font-bold text-white mb-4">Olay Önem Seviyesi Dağılımı</h3>
        <div className="sr-only">
          Olay Önem Seviyesi Dağılımı Özeti: {severityData.map(d => `${d.name}: ${numberFormatter.format(d.value)}`).join(', ')}
        </div>
        <div 
          className="h-64 w-full"
          role="img" 
          aria-label="Olay önem seviyesi grafik bölgesi" 
          aria-labelledby="chart-severity-title"
        >
          {isSeverityEmpty ? (
            <div className="flex items-center justify-center h-full text-muted-blue">
              Önem seviyesi için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip formatter={formatTooltipValue} cursor={{fill: '#334155', opacity: 0.4}} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }} />
                <Bar dataKey="value" name="Önem Seviyesi" isAnimationActive={false}>
                  <Cell fill={COLORS.low} />
                  <Cell fill={COLORS.medium} />
                  <Cell fill={COLORS.high} />
                  <Cell fill={COLORS.critical} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Trend 7 Days */}
      <div className="p-4 bg-deep-dark border border-space-blue rounded-lg lg:col-span-2">
        <h3 id="chart-trend-title" className="text-lg font-bold text-white mb-4">Son 7 Günlük Tespit Eğilimi</h3>
        <div className="sr-only">
          Son 7 Günlük Eğilim Özeti: {trendData.map(d => `${d.dateLabel} - Toplam: ${numberFormatter.format(d.Toplam)}, Normal: ${numberFormatter.format(d.Normal)}, Saldırı: ${numberFormatter.format(d.Saldırı)}`).join('; ')}
        </div>
        <div 
          className="h-72 w-full"
          role="img" 
          aria-label="Son yedi günlük eğilim grafik bölgesi" 
          aria-labelledby="chart-trend-title"
        >
          {isTrendEmpty ? (
            <div className="flex items-center justify-center h-full text-muted-blue">
              Son yedi günlük eğilim için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dateLabel" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip formatter={formatTooltipValue} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }} />
                <Legend verticalAlign="bottom" height={36} />
                <Line type="monotone" dataKey="Toplam" stroke={COLORS.total} activeDot={{ r: 8 }} isAnimationActive={false} strokeWidth={2} />
                <Line type="monotone" dataKey="Normal" stroke={COLORS.normal} isAnimationActive={false} strokeWidth={2} />
                <Line type="monotone" dataKey="Saldırı" stroke={COLORS.attack} isAnimationActive={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
