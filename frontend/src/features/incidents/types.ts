export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_POSITIVE';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IncidentComment {
  id: number;
  incident_id: number;
  user_id: number;
  comment_text: string;
  created_at: string;
}

export interface IncidentListItem {
  id: number;
  detection_result_id: number;
  assigned_analyst_id: number | null;
  status: IncidentStatus;
  severity: IncidentSeverity;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentDetail extends IncidentListItem {
  comments: IncidentComment[];
}

export interface IncidentCreatePayload {
  detection_result_id: number;
  title: string;
  description: string;
  severity: IncidentSeverity;
}

export interface IncidentUpdatePayload {
  assigned_analyst_id?: number;
  status?: IncidentStatus;
}

export interface IncidentCommentPayload {
  comment_text: string;
}

export interface IncidentListParams {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  assignedAnalystId?: number;
  skip?: number;
  limit?: number;
}
