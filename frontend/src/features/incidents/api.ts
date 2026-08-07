import { apiClient } from '../../api/client';
import type {
  IncidentListItem,
  IncidentDetail,
  IncidentCreatePayload,
  IncidentUpdatePayload,
  IncidentCommentPayload,
  IncidentListParams,
  IncidentComment,
} from './types';
import {
  isIncidentStatus,
  isIncidentSeverity,
  parseIncidentListItem,
  parseIncidentDetail,
  parseIncidentList,
  parseIncidentComment,
} from './validators';

export const createIncident = async (
  payload: IncidentCreatePayload,
  token?: string | null,
  signal?: AbortSignal
): Promise<IncidentListItem> => {
  if (!Number.isInteger(payload.detection_result_id) || payload.detection_result_id <= 0) {
    return Promise.reject(new Error('Invalid detection result ID'));
  }

  const title = payload.title.trim();
  const description = payload.description.trim();

  if (!title || title.length > 150) {
    return Promise.reject(new Error('Invalid title'));
  }

  if (!description) {
    return Promise.reject(new Error('Invalid description'));
  }

  if (!isIncidentSeverity(payload.severity)) {
    return Promise.reject(new Error('Invalid severity'));
  }

  const data = await apiClient<unknown>(
    '/incidents',
    {
      method: 'POST',
      body: {
        ...payload,
        title,
        description,
      },
      signal,
    },
    token
  );

  return parseIncidentListItem(data);
};

export const listIncidents = async (
  params?: IncidentListParams,
  token?: string | null,
  signal?: AbortSignal
): Promise<IncidentListItem[]> => {
  const searchParams = new URLSearchParams();

  if (params) {
    if (params.status !== undefined) {
      if (!isIncidentStatus(params.status)) {
        return Promise.reject(new Error('Invalid status'));
      }
      searchParams.append('status', params.status);
    }
    if (params.severity !== undefined) {
      if (!isIncidentSeverity(params.severity)) {
        return Promise.reject(new Error('Invalid severity'));
      }
      searchParams.append('severity', params.severity);
    }
    if (params.assignedAnalystId !== undefined) {
      if (!Number.isInteger(params.assignedAnalystId) || params.assignedAnalystId <= 0) {
        return Promise.reject(new Error('Invalid assigned analyst ID'));
      }
      searchParams.append('assigned_analyst_id', params.assignedAnalystId.toString());
    }
    if (params.skip !== undefined) {
      if (!Number.isInteger(params.skip) || params.skip < 0) {
        return Promise.reject(new Error('Invalid skip parameter'));
      }
      searchParams.append('skip', params.skip.toString());
    }
    if (params.limit !== undefined) {
      if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100) {
        return Promise.reject(new Error('Invalid limit parameter'));
      }
      searchParams.append('limit', params.limit.toString());
    }
  }

  const queryString = searchParams.toString();
  const path = queryString ? `/incidents?${queryString}` : '/incidents';

  const data = await apiClient<unknown>(
    path,
    {
      method: 'GET',
      signal,
    },
    token
  );

  return parseIncidentList(data);
};

export const getIncident = async (
  incidentId: number,
  token?: string | null,
  signal?: AbortSignal
): Promise<IncidentDetail> => {
  if (!Number.isInteger(incidentId) || incidentId <= 0) {
    return Promise.reject(new Error('Invalid incident ID'));
  }

  const data = await apiClient<unknown>(
    `/incidents/${incidentId}`,
    {
      method: 'GET',
      signal,
    },
    token
  );

  return parseIncidentDetail(data);
};

export const updateIncident = async (
  incidentId: number,
  payload: IncidentUpdatePayload,
  token?: string | null,
  signal?: AbortSignal
): Promise<IncidentListItem> => {
  if (!Number.isInteger(incidentId) || incidentId <= 0) {
    return Promise.reject(new Error('Invalid incident ID'));
  }

  if (!payload || Object.keys(payload).length === 0) {
    return Promise.reject(new Error('Empty payload'));
  }

  const updateBody: Record<string, unknown> = {};

  if (payload.assigned_analyst_id !== undefined) {
    if (payload.assigned_analyst_id === null || !Number.isInteger(payload.assigned_analyst_id) || payload.assigned_analyst_id <= 0) {
      return Promise.reject(new Error('Invalid assigned analyst ID'));
    }
    updateBody.assigned_analyst_id = payload.assigned_analyst_id;
  }

  if (payload.status !== undefined) {
    if (!isIncidentStatus(payload.status)) {
      return Promise.reject(new Error('Invalid status'));
    }
    updateBody.status = payload.status;
  }

  const data = await apiClient<unknown>(
    `/incidents/${incidentId}`,
    {
      method: 'PATCH',
      body: updateBody,
      signal,
    },
    token
  );

  return parseIncidentListItem(data);
};

export const addIncidentComment = async (
  incidentId: number,
  payload: IncidentCommentPayload,
  token?: string | null,
  signal?: AbortSignal
): Promise<IncidentComment> => {
  if (!Number.isInteger(incidentId) || incidentId <= 0) {
    return Promise.reject(new Error('Invalid incident ID'));
  }

  const comment_text = payload.comment_text.trim();
  if (!comment_text) {
    return Promise.reject(new Error('Invalid comment text'));
  }

  const data = await apiClient<unknown>(
    `/incidents/${incidentId}/comments`,
    {
      method: 'POST',
      body: { comment_text },
      signal,
    },
    token
  );

  return parseIncidentComment(data);
};
