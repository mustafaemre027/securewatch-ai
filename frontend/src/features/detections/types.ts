import type { AnalysisJobStatus } from '../analysis/types';

export type DetectionRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DetectionResult {
  id: number;
  job_id: number;
  row_index: number;
  attack_probability: number;
  is_attack: boolean;
  risk_level: DetectionRiskLevel;
  created_at: string;
}

export interface DetectionResultPage {
  items: DetectionResult[];
  total: number;
  skip: number;
  limit: number;
}

export interface RiskLevelCounts {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

export interface AnalysisSummary {
  job_id: number;
  status: AnalysisJobStatus;
  total_records: number;
  normal_count: number;
  attack_count: number;
  risk_level_counts: RiskLevelCounts;
  completed_at: string | null;
}

export interface DetectionResultListParams {
  skip?: number;
  limit?: number;
  isAttack?: boolean;
  riskLevel?: DetectionRiskLevel;
}
