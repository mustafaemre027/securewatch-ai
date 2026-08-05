import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DashboardSummaryCards } from './DashboardSummaryCards';
import type { DashboardSummaryResponse } from '../types';

const mockSummary: DashboardSummaryResponse = {
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
};

describe('DashboardSummaryCards', () => {
  it('renders correctly and shows formatted values', () => {
    render(<DashboardSummaryCards summary={mockSummary} />);

    expect(screen.getByText('Toplam Analiz')).toBeInTheDocument();
    expect(screen.getByText('1.250')).toBeInTheDocument();
    expect(screen.getByText('1.200')).toBeInTheDocument(); // completed_jobs

    expect(screen.getByText('Toplam Tespit')).toBeInTheDocument();
    expect(screen.getByText('50.000')).toBeInTheDocument();
    expect(screen.getByText('45.000')).toBeInTheDocument(); // benign_count

    expect(screen.getByText('Saldırı Tespiti')).toBeInTheDocument();
    expect(screen.getByText('5.000')).toBeInTheDocument();
    expect(screen.getByText('%10')).toBeInTheDocument(); // attackRatio

    expect(screen.getByText('Toplam Olay')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument(); // OPEN (20) + IN_PROGRESS (30)
  });

  it('renders correctly with 0 total detections to prevent division by zero', () => {
    const zeroDetectionsSummary: DashboardSummaryResponse = {
      ...mockSummary,
      detection_summary: { total_detections: 0, benign_count: 0, attack_count: 0 },
    };
    render(<DashboardSummaryCards summary={zeroDetectionsSummary} />);

    expect(screen.getByText('%0')).toBeInTheDocument();
  });
});
