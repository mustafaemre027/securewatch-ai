import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DashboardSummaryCards } from './DashboardSummaryCards';
import type { DashboardSummaryResponse } from '../types';

const getMockSummary = (): DashboardSummaryResponse => ({
  generated_at: '2026-08-05T12:00:00Z',
  analysis_summary: {
    total_jobs: 1250,
    status_distribution: { PENDING: 10, PROCESSING: 5, COMPLETED: 1200, FAILED: 35 },
    completed_jobs: 1200,
  },
  detection_summary: {
    total_detections: 50000,
    benign_count: 45000,
    attack_count: 5000,
  },
  detection_class_distribution: { benign: 45000, attack: 5000 },
  risk_distribution: { LOW: 1000, MEDIUM: 2000, HIGH: 1500, CRITICAL: 500 },
  incident_summary: {
    total_incidents: 150,
    status_distribution: { OPEN: 20, IN_PROGRESS: 30, RESOLVED: 95, FALSE_POSITIVE: 5 },
    severity_distribution: { LOW: 50, MEDIUM: 50, HIGH: 30, CRITICAL: 20 },
  },
  trend_7_days: [],
  recent_detections: [],
  recent_incidents: [],
});

describe('DashboardSummaryCards', () => {
  it('Kart grubu erişilebilir bir ada sahiptir', () => {
    render(<DashboardSummaryCards summary={getMockSummary()} />);
    const group = screen.getByLabelText('Dashboard Özet Kartları');
    expect(group).toBeInTheDocument();
  });

  it('Tam olarak dört özet kartı gösterilir', () => {
    const { container } = render(<DashboardSummaryCards summary={getMockSummary()} />);
    const headers = container.querySelectorAll('h3');
    expect(headers).toHaveLength(4);
  });

  it('Toplam analiz sayısı gösterilir', () => {
    render(<DashboardSummaryCards summary={getMockSummary()} />);
    expect(screen.getByText('Toplam Analiz')).toBeInTheDocument();
    expect(screen.getByText('1.250')).toBeInTheDocument();
  });

  it('Tamamlanan analiz sayısı gösterilir', () => {
    render(<DashboardSummaryCards summary={getMockSummary()} />);
    expect(screen.getByText('1.200')).toBeInTheDocument();
  });

  it('Toplam tespit sayısı gösterilir', () => {
    render(<DashboardSummaryCards summary={getMockSummary()} />);
    expect(screen.getByText('Toplam Tespit')).toBeInTheDocument();
    expect(screen.getByText('50.000')).toBeInTheDocument();
  });

  it('Normal tespit sayısı gösterilir', () => {
    render(<DashboardSummaryCards summary={getMockSummary()} />);
    expect(screen.getByText('45.000')).toBeInTheDocument();
  });

  it('Saldırı tespit sayısı gösterilir', () => {
    render(<DashboardSummaryCards summary={getMockSummary()} />);
    expect(screen.getByText('Saldırı Tespiti')).toBeInTheDocument();
    expect(screen.getByText('5.000')).toBeInTheDocument();
  });

  it('Toplam olay sayısı gösterilir', () => {
    render(<DashboardSummaryCards summary={getMockSummary()} />);
    expect(screen.getByText('Toplam Olay')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('Açık olay sayısı ikincil bilgiye yansır', () => {
    const summary = getMockSummary();
    summary.incident_summary.status_distribution.OPEN = 20;
    summary.incident_summary.status_distribution.IN_PROGRESS = 0;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('İncelemedeki olay sayısı ikincil bilgiye yansır', () => {
    const summary = getMockSummary();
    summary.incident_summary.status_distribution.OPEN = 0;
    summary.incident_summary.status_distribution.IN_PROGRESS = 30;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('Açık ve incelemedeki olaylar doğru toplanır', () => {
    const summary = getMockSummary();
    summary.incident_summary.status_distribution.OPEN = 20;
    summary.incident_summary.status_distribution.IN_PROGRESS = 30;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('Büyük sayılar tr-TR biçiminde gösterilir', () => {
    const summary = getMockSummary();
    summary.detection_summary.total_detections = 1234567;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.getByText('1.234.567')).toBeInTheDocument();
  });

  it('Saldırı oranı doğru hesaplanır', () => {
    const summary = getMockSummary();
    summary.detection_summary.total_detections = 200;
    summary.detection_summary.attack_count = 50;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.getByText('%25')).toBeInTheDocument();
  });

  it('Saldırı oranı en fazla bir ondalık basamak içerir', () => {
    const summary = getMockSummary();
    summary.detection_summary.total_detections = 300;
    summary.detection_summary.attack_count = 100;
    render(<DashboardSummaryCards summary={summary} />);
    // 100/300 = 33.333... % -> %33,3
    expect(screen.getByText('%33,3')).toBeInTheDocument();
  });

  it('Tam sayı saldırı oranında gereksiz uzun ondalık gösterilmez', () => {
    const summary = getMockSummary();
    summary.detection_summary.total_detections = 200;
    summary.detection_summary.attack_count = 100;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.getByText('%50')).toBeInTheDocument();
    expect(screen.queryByText('%50,0')).not.toBeInTheDocument();
  });

  it('Toplam tespit sıfır olduğunda %0 gösterilir', () => {
    const summary = getMockSummary();
    summary.detection_summary.total_detections = 0;
    summary.detection_summary.attack_count = 0;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.getByText('%0')).toBeInTheDocument();
  });

  it('NaN DOM’da görünmez', () => {
    const summary = getMockSummary();
    summary.detection_summary.total_detections = 0;
    summary.detection_summary.attack_count = 0;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });

  it('Infinity DOM’da görünmez', () => {
    const summary = getMockSummary();
    summary.detection_summary.total_detections = 0;
    summary.detection_summary.attack_count = 1;
    render(<DashboardSummaryCards summary={summary} />);
    expect(screen.queryByText('Infinity')).not.toBeInTheDocument();
  });

  it('Negatif veya tahmini değer component tarafından üretilmez', () => {
    const summary = getMockSummary();
    summary.detection_summary.total_detections = -100;
    render(<DashboardSummaryCards summary={summary} />);
    // Testing formatting of -100 to ensure component doesn't mutate or estimate
    expect(screen.getByText('-100')).toBeInTheDocument();
  });

  it('Props olarak verilen response nesnesi mutate edilmez', () => {
    const summary = getMockSummary();
    const clonedSummary = JSON.parse(JSON.stringify(summary));
    render(<DashboardSummaryCards summary={summary} />);
    expect(summary).toEqual(clonedSummary);
  });

  it('Kartların etiketleri yalnız renge bağlı değildir', () => {
    render(<DashboardSummaryCards summary={getMockSummary()} />);
    const headers = screen.getAllByRole('heading', { level: 3 });
    expect(headers.map(h => h.textContent)).toEqual([
      'Toplam Analiz',
      'Toplam Tespit',
      'Saldırı Tespiti',
      'Toplam Olay'
    ]);
  });

  it('Gereksiz interaktif rol veya tabIndex bulunmaz', () => {
    const { container } = render(<DashboardSummaryCards summary={getMockSummary()} />);
    const elementsWithTabIndex = container.querySelectorAll('[tabindex]');
    expect(elementsWithTabIndex).toHaveLength(0);
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(0);
  });
});
