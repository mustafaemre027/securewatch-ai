export type AnalysisJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_POSITIVE';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AnalysisSummary {
  total_jobs: number;
  status_distribution: Record<AnalysisJobStatus, number>;
  completed_jobs: number;
}

export interface DetectionSummary {
  total_detections: number;
  benign_count: number;
  attack_count: number;
}

export interface DetectionClassDistribution {
  benign: number;
  attack: number;
}

export interface IncidentSummary {
  total_incidents: number;
  status_distribution: Record<IncidentStatus, number>;
  severity_distribution: Record<IncidentSeverity, number>;
}

export interface TrendDataPoint {
  date: string;
  total: number;
  benign: number;
  attack: number;
}

export interface RecentDetection {
  id: number;
  job_id: number;
  row_index: number;
  is_attack: boolean;
  attack_probability: number;
  risk_level: string;
  created_at: string;
}

export interface RecentIncident {
  id: number;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  assigned_analyst_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummaryResponse {
  generated_at: string;
  analysis_summary: AnalysisSummary;
  detection_summary: DetectionSummary;
  detection_class_distribution: DetectionClassDistribution;
  risk_distribution: Record<string, number>;
  incident_summary: IncidentSummary;
  trend_7_days: TrendDataPoint[];
  recent_detections: RecentDetection[];
  recent_incidents: RecentIncident[];
}
