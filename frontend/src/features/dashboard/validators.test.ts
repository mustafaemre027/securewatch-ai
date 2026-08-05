import { describe, it, expect } from 'vitest';
import { parseDashboardSummary } from './validators';

describe('Dashboard Validators', () => {
  const createValidResponse = () => ({
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
        assigned_analyst_id: null as number | null,
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
    const valid: Record<string, unknown> = { ...createValidResponse() };
    delete valid.generated_at;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects if generated_at is invalid', () => {
    const valid = { ...createValidResponse(), generated_at: 'invalid-date' };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects if analysis summary is missing', () => {
    const valid: Record<string, unknown> = { ...createValidResponse() };
    delete valid.analysis_summary;
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects negative analysis total', () => {
    const base = createValidResponse();
    const valid = { ...base, analysis_summary: { ...base.analysis_summary, total_jobs: -1 } };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects float counters', () => {
    const base = createValidResponse();
    const valid = { ...base, analysis_summary: { ...base.analysis_summary, completed_jobs: 1.5 } };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects unknown analysis status', () => {
    const base = createValidResponse();
    const valid = { 
      ...base, 
      analysis_summary: { 
        ...base.analysis_summary, 
        status_distribution: { ...base.analysis_summary.status_distribution, UNKNOWN: 1 } 
      } 
    };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects missing analysis status category', () => {
    const base = createValidResponse();
    const status_distribution: Record<string, unknown> = { ...base.analysis_summary.status_distribution };
    delete status_distribution.PENDING;
    const valid = { 
      ...base, 
      analysis_summary: { 
        ...base.analysis_summary, 
        status_distribution 
      } 
    };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects negative detection total', () => {
    const base = createValidResponse();
    const valid = { ...base, detection_summary: { ...base.detection_summary, total_detections: -10 } };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts valid normal/attack distribution', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.detection_class_distribution.benign).toBe(80);
    expect(result.detection_class_distribution.attack).toBe(20);
  });

  it('rejects unknown risk level', () => {
    const base = createValidResponse();
    const valid = { ...base, risk_distribution: { ...base.risk_distribution, MEGA_CRITICAL: 1 } };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects missing risk category', () => {
    const base = createValidResponse();
    const risk_distribution: Record<string, unknown> = { ...base.risk_distribution };
    delete risk_distribution.LOW;
    const valid = { ...base, risk_distribution };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects unknown incident status', () => {
    const base = createValidResponse();
    const valid = { 
      ...base, 
      incident_summary: { 
        ...base.incident_summary, 
        status_distribution: { ...base.incident_summary.status_distribution, UNKNOWN: 1 } 
      } 
    };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects unknown incident severity', () => {
    const base = createValidResponse();
    const valid = { 
      ...base, 
      incident_summary: { 
        ...base.incident_summary, 
        severity_distribution: { ...base.incident_summary.severity_distribution, UNKNOWN: 1 } 
      } 
    };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts trend exactly 7 points', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.trend_7_days).toHaveLength(7);
  });

  it('rejects trend with 6 points', () => {
    const base = createValidResponse();
    const valid = { ...base, trend_7_days: base.trend_7_days.slice(0, 6) };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects trend with 8 points', () => {
    const base = createValidResponse();
    const valid = { ...base, trend_7_days: [...base.trend_7_days, { date: '2024-01-08', total: 0, benign: 0, attack: 0 }] };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects trend invalid date', () => {
    const base = createValidResponse();
    const newTrend = [...base.trend_7_days];
    newTrend[0] = { ...newTrend[0], date: 'invalid-date' };
    const valid = { ...base, trend_7_days: newTrend };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects unordered trend', () => {
    const base = createValidResponse();
    const newTrend = [...base.trend_7_days];
    newTrend[0] = { ...newTrend[0], date: '2024-01-08' }; // out of order
    const valid = { ...base, trend_7_days: newTrend };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects duplicated date in trend', () => {
    const base = createValidResponse();
    const newTrend = [...base.trend_7_days];
    newTrend[1] = { ...newTrend[1], date: '2024-01-01' }; // duplicate
    const valid = { ...base, trend_7_days: newTrend };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects bad trend sum', () => {
    const base = createValidResponse();
    const newTrend = [...base.trend_7_days];
    newTrend[0] = { ...newTrend[0], total: 10, benign: 5, attack: 6 }; // sum = 11 != 10
    const valid = { ...base, trend_7_days: newTrend };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts valid recent detection', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.recent_detections[0].risk_level).toBe('CRITICAL');
  });

  it('rejects recent detection array > 5', () => {
    const base = createValidResponse();
    const valid = { ...base, recent_detections: Array(6).fill(base.recent_detections[0]) };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects non-positive detection ID', () => {
    const base = createValidResponse();
    const newDetections = [...base.recent_detections];
    newDetections[0] = { ...newDetections[0], id: 0 };
    const valid = { ...base, recent_detections: newDetections };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects invalid row_index', () => {
    const base = createValidResponse();
    const newDetections = [...base.recent_detections];
    newDetections[0] = { ...newDetections[0], row_index: -1 };
    const valid = { ...base, recent_detections: newDetections };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects negative attack_probability', () => {
    const base = createValidResponse();
    const newDetections = [...base.recent_detections];
    newDetections[0] = { ...newDetections[0], attack_probability: -0.1 };
    const valid = { ...base, recent_detections: newDetections };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects attack_probability > 1', () => {
    const base = createValidResponse();
    const newDetections = [...base.recent_detections];
    newDetections[0] = { ...newDetections[0], attack_probability: 1.1 };
    const valid = { ...base, recent_detections: newDetections };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts valid recent incident', () => {
    const valid = createValidResponse();
    const result = parseDashboardSummary(valid);
    expect(result.recent_incidents[0].status).toBe('OPEN');
  });

  it('rejects recent incident array > 5', () => {
    const base = createValidResponse();
    const valid = { ...base, recent_incidents: Array(6).fill(base.recent_incidents[0]) };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('rejects empty incident title', () => {
    const base = createValidResponse();
    const newIncidents = [...base.recent_incidents];
    newIncidents[0] = { ...newIncidents[0], title: '   ' };
    const valid = { ...base, recent_incidents: newIncidents };
    expect(() => parseDashboardSummary(valid)).toThrow(getInvalidErrorMsg());
  });

  it('accepts nullable analyst field properly', () => {
    const base = createValidResponse();
    const newIncidents1 = [...base.recent_incidents];
    newIncidents1[0] = { ...newIncidents1[0], assigned_analyst_id: null };
    const valid1 = { ...base, recent_incidents: newIncidents1 };
    
    let result = parseDashboardSummary(valid1);
    expect(result.recent_incidents[0].assigned_analyst_id).toBeNull();
    
    const newIncidents2 = [...base.recent_incidents];
    newIncidents2[0] = { ...newIncidents2[0], assigned_analyst_id: 10 };
    const valid2 = { ...base, recent_incidents: newIncidents2 };
    result = parseDashboardSummary(valid2);
    expect(result.recent_incidents[0].assigned_analyst_id).toBe(10);
  });

  it('does not leak unexpected protocol field', () => {
    const base = createValidResponse();
    const valid = { ...base, protocol: 'TCP' };
    const result = parseDashboardSummary(valid);
    expect('protocol' in result).toBe(false);
  });

  it('does not leak password or token in response', () => {
    const base = createValidResponse();
    const valid = { ...base, password: 'supersecret', token: 'mytoken' };
    const result = parseDashboardSummary(valid);
    expect('password' in result).toBe(false);
    expect('token' in result).toBe(false);
  });

  it('rejects null response', () => {
    expect(() => parseDashboardSummary(null)).toThrow(getInvalidErrorMsg());
  });

  it('rejects array response', () => {
    expect(() => parseDashboardSummary([])).toThrow(getInvalidErrorMsg());
  });

  it('does not leak raw payload in error message', () => {
    const base = createValidResponse();
    const valid = { ...base, incident_summary: { ...base.incident_summary, total_incidents: -100 } };
    try {
      parseDashboardSummary(valid);
      expect.fail('Should have thrown');
    } catch (e: unknown) {
      if (e instanceof Error) {
        expect(e.message).toBe(getInvalidErrorMsg());
        expect(e.message).not.toContain('-100');
      } else {
        expect.fail('Thrown object is not an Error');
      }
    }
  });

});
