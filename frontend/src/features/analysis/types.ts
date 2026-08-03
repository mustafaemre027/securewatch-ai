export type AnalysisJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AnalysisUploadResponse {
  job_id: number;
  file_name: string;
  file_hash: string;
  file_size: number;
  status: AnalysisJobStatus;
  created_at: string;
}

export interface AnalysisJobListItem {
  id: number;
  file_name: string;
  file_size: number;
  status: AnalysisJobStatus;
  created_at: string;
  completed_at: string | null;
}

export interface AnalysisJobDetail {
  id: number;
  user_id: number;
  file_name: string;
  file_hash: string;
  file_size: number;
  status: AnalysisJobStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AnalysisProcessingResponse {
  job_id: number;
  records_processed: number;
  final_status: AnalysisJobStatus;
}

export interface AnalysisJobListParams {
  status?: AnalysisJobStatus;
  skip?: number;
  limit?: number;
}
