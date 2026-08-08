import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import type { DashboardSummaryResponse } from '../types';

export interface DashboardChartsProps {
  summary: DashboardSummaryResponse;
}

const COLORS = {
  normal: 'var(--color-semantic-success)',
  attack: 'var(--color-semantic-danger)',
  low: 'var(--color-semantic-info)',
  medium: 'var(--color-semantic-warning)',
  high: '#f97316', // tailwind orange-500
  critical: 'var(--color-semantic-danger)',
  open: 'var(--color-semantic-danger)',
  inProgress: 'var(--color-semantic-warning)',
  resolved: 'var(--color-semantic-success)',
  falsePositive: 'var(--color-semantic-info)',
  total: 'var(--color-accent-primary)'
};

const numberFormatter = new Intl.NumberFormat('tr-TR');

/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg p-3 shadow-lg min-w-[160px] max-w-[240px]">
        {label && <p className="text-xs font-bold text-[var(--color-text-primary)] mb-2 border-b border-[var(--color-border-subtle)] pb-1.5">{label}</p>}
        <div className="flex flex-col gap-2">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                <span className="text-[var(--color-text-secondary)] font-medium">{entry.name}</span>
              </div>
              <span className="font-bold text-[var(--color-text-primary)] ml-4">
                {typeof entry.value === 'number' ? numberFormatter.format(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const renderLegend = (props: any) => {
  const { payload } = props;
  return (
    <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2">
      {payload.map((entry: any, index: number) => (
        <li key={`item-${index}`} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ summary }) => {
  const { detection_class_distribution, risk_distribution, incident_summary, trend_7_days } = summary;

  const detectionData = [
    { name: 'Normal', value: detection_class_distribution.benign },
    { name: 'Saldırı', value: detection_class_distribution.attack }
  ];
  const isDetectionEmpty = detectionData.every(d => d.value === 0);
  const totalDetections = detectionData.reduce((acc, curr) => acc + curr.value, 0);

  const riskData = [
    { name: 'Düşük', value: risk_distribution.LOW || 0 },
    { name: 'Orta', value: risk_distribution.MEDIUM || 0 },
    { name: 'Yüksek', value: risk_distribution.HIGH || 0 },
    { name: 'Kritik', value: risk_distribution.CRITICAL || 0 }
  ];
  const isRiskEmpty = riskData.every(d => d.value === 0);

  const statusData = [
    { name: 'Açık', value: incident_summary.status_distribution.OPEN || 0 },
    { name: 'İnceleniyor', value: incident_summary.status_distribution.IN_PROGRESS || 0 },
    { name: 'Çözüldü', value: incident_summary.status_distribution.RESOLVED || 0 },
    { name: 'Yanlış Pozitif', value: incident_summary.status_distribution.FALSE_POSITIVE || 0 }
  ];
  const isStatusEmpty = statusData.every(d => d.value === 0);

  const severityData = [
    { name: 'Düşük', value: incident_summary.severity_distribution.LOW || 0 },
    { name: 'Orta', value: incident_summary.severity_distribution.MEDIUM || 0 },
    { name: 'Yüksek', value: incident_summary.severity_distribution.HIGH || 0 },
    { name: 'Kritik', value: incident_summary.severity_distribution.CRITICAL || 0 }
  ];
  const isSeverityEmpty = severityData.every(d => d.value === 0);

  const trendData = trend_7_days.map(item => {
    const parts = item.date.split('-');
    const label = parts.length === 3 ? `${parts[2]}.${parts[1]}` : item.date;
    return {
      dateLabel: label,
      Toplam: item.total,
      Normal: item.benign,
      Saldırı: item.attack
    };
  });
  const isTrendEmpty = trendData.every(d => d.Toplam === 0 && d.Normal === 0 && d.Saldırı === 0) || trendData.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      
      {/* 1. Detection Distribution */}
      <div className="sw-surface p-6 flex flex-col relative overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border-default)] to-transparent opacity-50"></div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle/50 shrink-0">
          <h3 id="chart-detection-title" className="text-sm font-bold text-text-primary tracking-wide">Tespit Dağılımı</h3>
        </div>
        <div className="sr-only">
          Tespit Dağılımı Özeti: {detectionData.map(d => `${d.name}: ${numberFormatter.format(d.value)}`).join(', ')}
        </div>
        <div 
          className="h-64 w-full relative"
          role="img" 
          aria-label="Tespit dağılımı grafik bölgesi" 
          aria-labelledby="chart-detection-title"
        >
          {isDetectionEmpty ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm border border-dashed border-border-default/50 rounded-lg">
              Tespit dağılımı için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <Pie
                  data={detectionData}
                  cx="50%"
                  cy="45%"
                  innerRadius={68}
                  outerRadius={88}
                  paddingAngle={4}
                  dataKey="value"
                  isAnimationActive={false}
                  stroke="none"
                  cornerRadius={3}
                >
                  <Cell fill={COLORS.normal} />
                  <Cell fill={COLORS.attack} />
                </Pie>
                <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle">
                  <tspan x="50%" dy="-2" fontSize="22" fontWeight="800" fill="var(--color-text-primary)">
                    {numberFormatter.format(totalDetections)}
                  </tspan>
                  <tspan x="50%" dy="20" fontSize="10" fill="var(--color-text-muted)" fontWeight="600" className="uppercase tracking-wider">
                    Toplam
                  </tspan>
                </text>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={renderLegend} verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2. Risk Distribution */}
      <div className="sw-surface p-6 flex flex-col relative overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border-default)] to-transparent opacity-50"></div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle/50 shrink-0">
          <h3 id="chart-risk-title" className="text-sm font-bold text-text-primary tracking-wide">Risk Seviyesi Dağılımı</h3>
        </div>
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
            <div className="flex items-center justify-center h-full text-text-muted text-sm border border-dashed border-border-default/50 rounded-lg">
              Risk dağılımı için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRiskLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.low} stopOpacity={1}/>
                    <stop offset="95%" stopColor={COLORS.low} stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorRiskMedium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.medium} stopOpacity={1}/>
                    <stop offset="95%" stopColor={COLORS.medium} stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorRiskHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.high} stopOpacity={1}/>
                    <stop offset="95%" stopColor={COLORS.high} stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorRiskCritical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.critical} stopOpacity={1}/>
                    <stop offset="95%" stopColor={COLORS.critical} stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border-default)" vertical={false} strokeOpacity={0.4} />
                <XAxis dataKey="name" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: 'var(--color-border-default)', strokeOpacity: 0.5 }} tickLine={false} dy={12} />
                <YAxis stroke="var(--color-text-muted)" allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--color-surface-hover)', opacity: 0.8}} />
                <Bar dataKey="value" name="Risk Seviyesi" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={28}>
                  <Cell fill="url(#colorRiskLow)" />
                  <Cell fill="url(#colorRiskMedium)" />
                  <Cell fill="url(#colorRiskHigh)" />
                  <Cell fill="url(#colorRiskCritical)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 3. Incident Status Distribution */}
      <div className="sw-surface p-6 flex flex-col relative overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border-default)] to-transparent opacity-50"></div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle/50 shrink-0">
          <h3 id="chart-status-title" className="text-sm font-bold text-text-primary tracking-wide">Olay Durumu Dağılımı</h3>
        </div>
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
            <div className="flex items-center justify-center h-full text-text-muted text-sm border border-dashed border-border-default/50 rounded-lg">
              Olay durumu için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="45%"
                  outerRadius={88}
                  dataKey="value"
                  isAnimationActive={false}
                  stroke="var(--color-bg-base)"
                  strokeWidth={2}
                >
                  <Cell fill={COLORS.open} />
                  <Cell fill={COLORS.inProgress} />
                  <Cell fill={COLORS.resolved} />
                  <Cell fill={COLORS.falsePositive} />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={renderLegend} verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. Incident Severity Distribution */}
      <div className="sw-surface p-6 flex flex-col relative overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border-default)] to-transparent opacity-50"></div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle/50 shrink-0">
          <h3 id="chart-severity-title" className="text-sm font-bold text-text-primary tracking-wide">Olay Önem Seviyesi Dağılımı</h3>
        </div>
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
            <div className="flex items-center justify-center h-full text-text-muted text-sm border border-dashed border-border-default/50 rounded-lg">
              Önem seviyesi için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorSevLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.low} stopOpacity={1}/>
                    <stop offset="95%" stopColor={COLORS.low} stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorSevMedium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.medium} stopOpacity={1}/>
                    <stop offset="95%" stopColor={COLORS.medium} stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorSevHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.high} stopOpacity={1}/>
                    <stop offset="95%" stopColor={COLORS.high} stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorSevCritical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.critical} stopOpacity={1}/>
                    <stop offset="95%" stopColor={COLORS.critical} stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border-default)" vertical={false} strokeOpacity={0.4} />
                <XAxis dataKey="name" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: 'var(--color-border-default)', strokeOpacity: 0.5 }} tickLine={false} dy={12} />
                <YAxis stroke="var(--color-text-muted)" allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--color-surface-hover)', opacity: 0.8}} />
                <Bar dataKey="value" name="Önem Seviyesi" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={28}>
                  <Cell fill="url(#colorSevLow)" />
                  <Cell fill="url(#colorSevMedium)" />
                  <Cell fill="url(#colorSevHigh)" />
                  <Cell fill="url(#colorSevCritical)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 5. Trend 7 Days (Full width panel) */}
      <div className="sw-surface p-6 flex flex-col lg:col-span-2 shadow-sm border-[var(--color-accent-primary)]/20 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent-primary)]/40 to-transparent"></div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle/50 shrink-0">
          <h3 id="chart-trend-title" className="text-sm font-bold text-text-primary tracking-wide">Son 7 Günlük Tespit Eğilimi</h3>
        </div>
        <div className="sr-only">
          Son 7 Günlük Eğilim Özeti: {trendData.map(d => `${d.dateLabel} - Toplam: ${numberFormatter.format(d.Toplam)}, Normal: ${numberFormatter.format(d.Normal)}, Saldırı: ${numberFormatter.format(d.Saldırı)}`).join('; ')}
        </div>
        <div 
          className="h-80 w-full"
          role="img" 
          aria-label="Son yedi günlük eğilim grafik bölgesi" 
          aria-labelledby="chart-trend-title"
        >
          {isTrendEmpty ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm border border-dashed border-border-default/50 rounded-lg">
              Son yedi günlük eğilim için henüz veri bulunmuyor.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 15, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border-default)" vertical={false} strokeOpacity={0.4} />
                <XAxis dataKey="dateLabel" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 500 }} axisLine={{ stroke: 'var(--color-border-default)', strokeOpacity: 0.5 }} tickLine={false} dy={12} />
                <YAxis stroke="var(--color-text-muted)" allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={renderLegend} verticalAlign="bottom" height={36} />
                <Line type="monotone" dataKey="Toplam" stroke={COLORS.total} activeDot={{ r: 6, fill: COLORS.total, stroke: 'var(--color-bg-base)', strokeWidth: 3 }} isAnimationActive={false} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Normal" stroke={COLORS.normal} activeDot={{ r: 5, fill: COLORS.normal, stroke: 'var(--color-bg-base)', strokeWidth: 2 }} isAnimationActive={false} strokeWidth={2} dot={false} strokeOpacity={0.8} />
                <Line type="monotone" dataKey="Saldırı" stroke={COLORS.attack} activeDot={{ r: 5, fill: COLORS.attack, stroke: 'var(--color-bg-base)', strokeWidth: 2 }} isAnimationActive={false} strokeWidth={2.25} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
