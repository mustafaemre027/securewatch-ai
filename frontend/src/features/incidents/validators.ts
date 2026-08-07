import type {
  IncidentStatus,
  IncidentSeverity,
  IncidentComment,
  IncidentListItem,
  IncidentDetail,
} from './types';

const VALID_STATUSES = new Set<IncidentStatus>(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE']);
const VALID_SEVERITIES = new Set<IncidentSeverity>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export function isIncidentStatus(val: unknown): val is IncidentStatus {
  return typeof val === 'string' && VALID_STATUSES.has(val as IncidentStatus);
}

export function isIncidentSeverity(val: unknown): val is IncidentSeverity {
  return typeof val === 'string' && VALID_SEVERITIES.has(val as IncidentSeverity);
}

function isPositiveInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val > 0;
}

function isValidString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isValidDateString(val: unknown): val is string {
  return typeof val === 'string' && !isNaN(Date.parse(val));
}

export function parseIncidentComment(data: unknown): IncidentComment {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid incident response');
  }

  const obj = data as Record<string, unknown>;

  if (!isPositiveInteger(obj.id) ||
      !isPositiveInteger(obj.incident_id) ||
      !isPositiveInteger(obj.user_id) ||
      !isValidString(obj.comment_text) ||
      !isValidDateString(obj.created_at)) {
    throw new Error('Invalid incident response');
  }

  return {
    id: obj.id,
    incident_id: obj.incident_id,
    user_id: obj.user_id,
    comment_text: obj.comment_text,
    created_at: obj.created_at,
  };
}

export function parseIncidentListItem(data: unknown): IncidentListItem {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid incident response');
  }

  const obj = data as Record<string, unknown>;

  const assignedAnalystId = obj.assigned_analyst_id;
  if (assignedAnalystId !== null && assignedAnalystId !== undefined && !isPositiveInteger(assignedAnalystId)) {
    throw new Error('Invalid incident response');
  }

  if (!isPositiveInteger(obj.id) ||
      !isPositiveInteger(obj.detection_result_id) ||
      !isIncidentStatus(obj.status) ||
      !isIncidentSeverity(obj.severity) ||
      !isValidString(obj.title) ||
      !isValidString(obj.description) ||
      !isValidDateString(obj.created_at) ||
      !isValidDateString(obj.updated_at)) {
    throw new Error('Invalid incident response');
  }

  return {
    id: obj.id,
    detection_result_id: obj.detection_result_id,
    assigned_analyst_id: assignedAnalystId === undefined ? null : assignedAnalystId,
    status: obj.status,
    severity: obj.severity,
    title: obj.title,
    description: obj.description,
    created_at: obj.created_at,
    updated_at: obj.updated_at,
  };
}

export function parseIncidentDetail(data: unknown): IncidentDetail {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid incident response');
  }

  const base = parseIncidentListItem(data);
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.comments)) {
    throw new Error('Invalid incident response');
  }

  const comments: IncidentComment[] = [];
  for (const item of obj.comments) {
    comments.push(parseIncidentComment(item));
  }

  return {
    ...base,
    comments,
  };
}

export function parseIncidentList(data: unknown): IncidentListItem[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid incident response');
  }

  const items: IncidentListItem[] = [];
  for (const item of data) {
    items.push(parseIncidentListItem(item));
  }
  return items;
}
