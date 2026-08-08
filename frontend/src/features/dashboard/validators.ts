import type {
  AnalysisJobStatus,
  IncidentStatus,
  IncidentSeverity,
  TrendDataPoint,
  RecentDetection,
  RecentIncident,
  DashboardSummaryResponse,
} from './types';

const VALID_ANALYSIS_STATUSES = new Set<AnalysisJobStatus>(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
const VALID_INCIDENT_STATUSES = new Set<IncidentStatus>(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE']);
const VALID_INCIDENT_SEVERITIES = new Set<IncidentSeverity>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const VALID_RISK_LEVELS = new Set<string>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function isNonNegativeInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && Number.isInteger(val) && val >= 0;
}

function isPositiveInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && Number.isInteger(val) && val > 0;
}

function isValidString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isValidDateString(val: unknown): val is string {
  return typeof val === 'string' && !isNaN(Date.parse(val));
}

function isDateOnlyString(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

export function parseDashboardSummary(data: unknown): DashboardSummaryResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid dashboard response');
  }

  const obj = data as Record<string, unknown>;

  if (!isValidDateString(obj.generated_at)) {
    throw new Error('Invalid dashboard response');
  }

  // Parse Analysis Summary
  const analysisObj = obj.analysis_summary as Record<string, unknown>;
  if (!analysisObj || typeof analysisObj !== 'object' || Array.isArray(analysisObj)) {
    throw new Error('Invalid dashboard response');
  }
  if (!isNonNegativeInteger(analysisObj.total_jobs) || !isNonNegativeInteger(analysisObj.completed_jobs)) {
    throw new Error('Invalid dashboard response');
  }
  const analysisDist = analysisObj.status_distribution as Record<string, unknown>;
  if (!analysisDist || typeof analysisDist !== 'object' || Array.isArray(analysisDist)) {
    throw new Error('Invalid dashboard response');
  }
  for (const key of VALID_ANALYSIS_STATUSES) {
    if (!isNonNegativeInteger(analysisDist[key])) {
      throw new Error('Invalid dashboard response');
    }
  }
  if (Object.keys(analysisDist).some(k => !VALID_ANALYSIS_STATUSES.has(k as AnalysisJobStatus))) {
    throw new Error('Invalid dashboard response');
  }

  // Parse Detection Summary
  const detectionObj = obj.detection_summary as Record<string, unknown>;
  if (!detectionObj || typeof detectionObj !== 'object' || Array.isArray(detectionObj)) {
    throw new Error('Invalid dashboard response');
  }
  if (!isNonNegativeInteger(detectionObj.total_detections) || 
      !isNonNegativeInteger(detectionObj.benign_count) || 
      !isNonNegativeInteger(detectionObj.attack_count)) {
    throw new Error('Invalid dashboard response');
  }

  // Parse Detection Class Distribution
  const classDistObj = obj.detection_class_distribution as Record<string, unknown>;
  if (!classDistObj || typeof classDistObj !== 'object' || Array.isArray(classDistObj)) {
    throw new Error('Invalid dashboard response');
  }
  if (!isNonNegativeInteger(classDistObj.benign) || !isNonNegativeInteger(classDistObj.attack)) {
    throw new Error('Invalid dashboard response');
  }

  // Parse Risk Distribution
  const riskDistObj = obj.risk_distribution as Record<string, unknown>;
  if (!riskDistObj || typeof riskDistObj !== 'object' || Array.isArray(riskDistObj)) {
    throw new Error('Invalid dashboard response');
  }
  for (const key of VALID_RISK_LEVELS) {
    if (!isNonNegativeInteger(riskDistObj[key])) {
      throw new Error('Invalid dashboard response');
    }
  }
  if (Object.keys(riskDistObj).some(k => !VALID_RISK_LEVELS.has(k))) {
    throw new Error('Invalid dashboard response');
  }

  // Parse Incident Summary
  const incidentObj = obj.incident_summary as Record<string, unknown>;
  if (!incidentObj || typeof incidentObj !== 'object' || Array.isArray(incidentObj)) {
    throw new Error('Invalid dashboard response');
  }
  if (!isNonNegativeInteger(incidentObj.total_incidents)) {
    throw new Error('Invalid dashboard response');
  }
  
  const incidentStatusDist = incidentObj.status_distribution as Record<string, unknown>;
  if (!incidentStatusDist || typeof incidentStatusDist !== 'object' || Array.isArray(incidentStatusDist)) {
    throw new Error('Invalid dashboard response');
  }
  for (const key of VALID_INCIDENT_STATUSES) {
    if (!isNonNegativeInteger(incidentStatusDist[key])) {
      throw new Error('Invalid dashboard response');
    }
  }
  if (Object.keys(incidentStatusDist).some(k => !VALID_INCIDENT_STATUSES.has(k as IncidentStatus))) {
    throw new Error('Invalid dashboard response');
  }

  const incidentSevDist = incidentObj.severity_distribution as Record<string, unknown>;
  if (!incidentSevDist || typeof incidentSevDist !== 'object' || Array.isArray(incidentSevDist)) {
    throw new Error('Invalid dashboard response');
  }
  for (const key of VALID_INCIDENT_SEVERITIES) {
    if (!isNonNegativeInteger(incidentSevDist[key])) {
      throw new Error('Invalid dashboard response');
    }
  }
  if (Object.keys(incidentSevDist).some(k => !VALID_INCIDENT_SEVERITIES.has(k as IncidentSeverity))) {
    throw new Error('Invalid dashboard response');
  }

  // Parse Trend
  const trendArr = obj.trend_7_days;
  if (!Array.isArray(trendArr) || trendArr.length !== 7) {
    throw new Error('Invalid dashboard response');
  }
  const parsedTrend: TrendDataPoint[] = [];
  let lastDateStr = '';
  for (const item of trendArr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Invalid dashboard response');
    }
    const tItem = item as Record<string, unknown>;
    if (!isDateOnlyString(tItem.date)) {
      throw new Error('Invalid dashboard response');
    }
    if (!isNonNegativeInteger(tItem.total) || !isNonNegativeInteger(tItem.benign) || !isNonNegativeInteger(tItem.attack)) {
      throw new Error('Invalid dashboard response');
    }
    if (tItem.total !== tItem.benign + tItem.attack) {
      throw new Error('Invalid dashboard response');
    }
    if (lastDateStr && tItem.date <= lastDateStr) {
      throw new Error('Invalid dashboard response');
    }
    lastDateStr = tItem.date;
    parsedTrend.push({
      date: tItem.date,
      total: tItem.total,
      benign: tItem.benign,
      attack: tItem.attack
    });
  }

  // Parse Recent Detections
  const recentDetArr = obj.recent_detections;
  if (!Array.isArray(recentDetArr) || recentDetArr.length > 5) {
    throw new Error('Invalid dashboard response');
  }
  const parsedRecentDet: RecentDetection[] = [];
  for (const item of recentDetArr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Invalid dashboard response');
    }
    const dItem = item as Record<string, unknown>;
    if (!isPositiveInteger(dItem.id) || !isPositiveInteger(dItem.job_id) || !isNonNegativeInteger(dItem.row_index)) {
      throw new Error('Invalid dashboard response');
    }
    if (typeof dItem.is_attack !== 'boolean') {
      throw new Error('Invalid dashboard response');
    }
    if (typeof dItem.attack_probability !== 'number' || !Number.isFinite(dItem.attack_probability) || dItem.attack_probability < 0 || dItem.attack_probability > 1) {
      throw new Error('Invalid dashboard response');
    }
    if (typeof dItem.risk_level !== 'string' || !VALID_RISK_LEVELS.has(dItem.risk_level)) {
      throw new Error('Invalid dashboard response');
    }
    if (!isValidDateString(dItem.created_at)) {
      throw new Error('Invalid dashboard response');
    }
    parsedRecentDet.push({
      id: dItem.id,
      job_id: dItem.job_id,
      row_index: dItem.row_index,
      is_attack: dItem.is_attack,
      attack_probability: dItem.attack_probability,
      risk_level: dItem.risk_level,
      created_at: dItem.created_at,
    });
  }

  // Parse Recent Incidents
  const recentIncArr = obj.recent_incidents;
  if (!Array.isArray(recentIncArr) || recentIncArr.length > 5) {
    throw new Error('Invalid dashboard response');
  }
  const parsedRecentInc: RecentIncident[] = [];
  for (const item of recentIncArr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Invalid dashboard response');
    }
    const iItem = item as Record<string, unknown>;
    if (!isPositiveInteger(iItem.id) || !isValidString(iItem.title)) {
      throw new Error('Invalid dashboard response');
    }
    if (typeof iItem.status !== 'string' || !VALID_INCIDENT_STATUSES.has(iItem.status as IncidentStatus)) {
      throw new Error('Invalid dashboard response');
    }
    if (typeof iItem.severity !== 'string' || !VALID_INCIDENT_SEVERITIES.has(iItem.severity as IncidentSeverity)) {
      throw new Error('Invalid dashboard response');
    }
    if (!isValidDateString(iItem.created_at) || !isValidDateString(iItem.updated_at)) {
      throw new Error('Invalid dashboard response');
    }
    const assignedAnalystId = iItem.assigned_analyst_id;
    if (assignedAnalystId !== null && !isPositiveInteger(assignedAnalystId)) {
      throw new Error('Invalid dashboard response');
    }
    parsedRecentInc.push({
      id: iItem.id,
      title: iItem.title,
      status: iItem.status as IncidentStatus,
      severity: iItem.severity as IncidentSeverity,
      assigned_analyst_id: assignedAnalystId === null ? null : assignedAnalystId as number,
      created_at: iItem.created_at,
      updated_at: iItem.updated_at,
    });
  }

  return {
    generated_at: obj.generated_at as string,
    analysis_summary: {
      total_jobs: analysisObj.total_jobs as number,
      completed_jobs: analysisObj.completed_jobs as number,
      status_distribution: analysisDist as Record<AnalysisJobStatus, number>,
    },
    detection_summary: {
      total_detections: detectionObj.total_detections as number,
      benign_count: detectionObj.benign_count as number,
      attack_count: detectionObj.attack_count as number,
    },
    detection_class_distribution: {
      benign: classDistObj.benign as number,
      attack: classDistObj.attack as number,
    },
    risk_distribution: riskDistObj as Record<string, number>,
    incident_summary: {
      total_incidents: incidentObj.total_incidents as number,
      status_distribution: incidentStatusDist as Record<IncidentStatus, number>,
      severity_distribution: incidentSevDist as Record<IncidentSeverity, number>,
    },
    trend_7_days: parsedTrend,
    recent_detections: parsedRecentDet,
    recent_incidents: parsedRecentInc,
  };
}
