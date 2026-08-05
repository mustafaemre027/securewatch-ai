import { describe, it, expect } from 'vitest';
import { parseDashboardSummary } from './validators';

describe('Dashboard Validators', () => {
  const createValidResponse = (): unknown => ({
    generated_at: '2024-01-01T12:00:00.000Z',
    analysis_summary: {
      total_jobs: 10,
      completed_jobs: 8,
      status_distribution: {
        PENDING: 1,
        PROCESSING: 1,
        COMPLETED: 8,
        FAILED: 0,
      }
    },
    detection_summary: {
      total_detections: 100,
      benign_count: 80,
      attack_count: 20,
    },
    detection_class_distribution: {
      benign: 80,
      attack: 20,
    },
    risk_distribution: {
      LOW: 50,
      MEDIUM: 30,
      HIGH: 15,
      CRITICAL: 5,
    },
    incident_summary: {
      total_incidents: 5,
      status_distribution: {
        OPEN: 2,
        IN_PROGRESS: 1,
        RESOLVED: 2,
        FALSE_POSITIVE: 0,
      },
      severity_distribution: {
        LOW: 1,
        MEDIUM: 2,
        HIGH: 1,
        CRITICAL: 1,
      }
    },
    trend_7_days: [
      { date: '2024-01-01', total: 10, benign: 8, attack: 2 },
      { date: '2024-01-02', total: 15, benign: 10, attack: 5 },
      { date: '2024-01-03', total: 5, benign: 5, attack: 0 },
      { date: '2024-01-04', total: 20, benign: 15, attack: 5 },
      { date: '2024-01-05', total: 10, benign: 8, attack: 2 },
      { date: '2024-01-06', total: 10, benign: 8, attack: 2 },
      { date: '2024-01-07', total: 10, benign: 8, attack: 2 },
    ],
    recent_detections: [
      {
        id: 1,
        job_id: 1,
        row_index: 0,
        is_attack: true,
        attack_probability: 0.95,
        risk_level: 'CRITICAL',
        created_at: '2024-01-01T12:00:00.000Z',
      }
    ],
    recent_incidents: [
      {
        id: 1,
        title: 'High Risk Incident',
        status: 'OPEN',
        severity: 'CRITICAL',
        assigned_analyst_id: null,
        created_at: '2024-01-01T12:00:00.000Z',
        updated_at: '2024-01-01T12:00:00.000Z',
      }
    ]
  });

  const getInvalidErrorMsg = () => 'Invalid dashboard response';

  it('accepts full valid dashboard response', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.generated_at).toBe('2024-01-01T12:00:00.000Z');
    expect(result.analysis_summary.total_jobs).toBe(10);
    expect(result.trend_7_days).toHaveLength(7);
  });

  it('rejects if generated_at is missing', () => {
    const valid = createValidResponse() as any;
    delete valid.generated_at;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects if generated_at is invalid', () => {
    const valid = createValidResponse() as any;
    valid.generated_at = 'invalid-date';
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects if analysis summary is missing', () => {
    const valid = createValidResponse() as any;
    delete valid.analysis_summary;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects negative analysis total', () => {
    const valid = createValidResponse() as any;
    valid.analysis_summary.total_jobs = -1;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects float counters', () => {
    const valid = createValidResponse() as any;
    valid.analysis_summary.completed_jobs = 1.5;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects unknown analysis status', () => {
    const valid = createValidResponse() as any;
    valid.analysis_summary.status_distribution['UNKNOWN'] = 1;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects missing analysis status category', () => {
    const valid = createValidResponse() as any;
    delete valid.analysis_summary.status_distribution['PENDING'];
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects negative detection total', () => {
    const valid = createValidResponse() as any;
    valid.detection_summary.total_detections = -10;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts valid normal/attack distribution', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.detection_class_distribution.benign).toBe(80);
    expect(result.detection_class_distribution.attack).toBe(20);
  });

  it('rejects unknown risk level', () => {
    const valid = createValidResponse() as any;
    valid.risk_distribution['MEGA_CRITICAL'] = 1;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects missing risk category', () => {
    const valid = createValidResponse() as any;
    delete valid.risk_distribution['LOW'];
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects unknown incident status', () => {
    const valid = createValidResponse() as any;
    valid.incident_summary.status_distribution['UNKNOWN'] = 1;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects unknown incident severity', () => {
    const valid = createValidResponse() as any;
    valid.incident_summary.severity_distribution['UNKNOWN'] = 1;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts trend exactly 7 points', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.trend_7_days).toHaveLength(7);
  });

  it('rejects trend with 6 points', () => {
    const valid = createValidResponse() as any;
    valid.trend_7_days.pop();
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects trend with 8 points', () => {
    const valid = createValidResponse() as any;
    valid.trend_7_days.push({ date: '2024-01-08', total: 0, benign: 0, attack: 0 });
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects trend invalid date', () => {
    const valid = createValidResponse() as any;
    valid.trend_7_days[0].date = 'invalid-date';
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects unordered trend', () => {
    const valid = createValidResponse() as any;
    valid.trend_7_days[0].date = '2024-01-08'; // out of order
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects duplicated date in trend', () => {
    const valid = createValidResponse() as any;
    valid.trend_7_days[1].date = '2024-01-01'; // duplicate
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects bad trend sum', () => {
    const valid = createValidResponse() as any;
    valid.trend_7_days[0].total = 10;
    valid.trend_7_days[0].benign = 5;
    valid.trend_7_days[0].attack = 6; // sum = 11 != 10
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts valid recent detection', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.recent_detections[0].risk_level).toBe('CRITICAL');
  });

  it('rejects recent detection array > 5', () => {
    const valid = createValidResponse() as any;
    valid.recent_detections = Array(6).fill(valid.recent_detections[0]);
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects non-positive detection ID', () => {
    const valid = createValidResponse() as any;
    valid.recent_detections[0].id = 0;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects invalid row_index', () => {
    const valid = createValidResponse() as any;
    valid.recent_detections[0].row_index = -1;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects negative attack_probability', () => {
    const valid = createValidResponse() as any;
    valid.recent_detections[0].attack_probability = -0.1;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects attack_probability > 1', () => {
    const valid = createValidResponse() as any;
    valid.recent_detections[0].attack_probability = 1.1;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts valid recent incident', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.recent_incidents[0].status).toBe('OPEN');
  });

  it('rejects recent incident array > 5', () => {
    const valid = createValidResponse() as any;
    valid.recent_incidents = Array(6).fill(valid.recent_incidents[0]);
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects empty incident title', () => {
    const valid = createValidResponse() as any;
    valid.recent_incidents[0].title = '   ';
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts nullable analyst field properly', () => {
    const valid = createValidResponse() as any;
    valid.recent_incidents[0].assigned_analyst_id = null;
    let result = parseDashboardSummary(valid);
    expect(result.recent_incidents[0].assigned_analyst_id).toBeNull();
    
    valid.recent_incidents[0].assigned_analyst_id = 10;
    result = parseDashboardSummary(valid);
    expect(result.recent_incidents[0].assigned_analyst_id).toBe(10);
  });

  it('does not leak unexpected protocol field', () => {
    const valid = createValidResponse() as any;
    valid.protocol = 'TCP';
    const result = parseDashboardSummary(valid);
    expect((result as any).protocol).toBeUndefined();
  });

  it('does not leak password or token in response', () => {
    const valid = createValidResponse() as any;
    valid.password = 'supersecret';
    valid.token = 'mytoken';
    const result = parseDashboardSummary(valid);
    expect((result as any).password).toBeUndefined();
    expect((result as any).token).toBeUndefined();
  });

  it('rejects null response', () => {
    expect(() => parseDashboardSummary(null)).toThrow(getInvalidErrorMsg());
  });

  it('rejects array response', () => {
    expect(() => parseDashboardSummary([])).toThrow(getInvalidErrorMsg());
  });

  it('does not leak raw payload in error message', () => {
    const valid = createValidResponse() as any;
    valid.incident_summary.total_incidents = -100;
    try {
      parseDashboardSummary(valid);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).toBe(getInvalidErrorMsg());
      expect(e.message).not.toContain('-100');
    }
  });

});
