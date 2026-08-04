import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createIncident,
  listIncidents,
  getIncident,
  updateIncident,
  addIncidentComment,
} from './api';
import { apiClient } from '../../api/client';

vi.mock('../../api/client', () => ({
  apiClient: vi.fn(),
}));

describe('Incidents API', () => {
  const mockToken = 'mock-token';
  const mockSignal = new AbortController().signal;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createIncident', () => {
    const payload = {
      detection_result_id: 10,
      title: '  Test Title  ',
      description: '  Test Description  ',
      severity: 'HIGH' as const,
    };

    const validResponse = {
      id: 1,
      detection_result_id: 10,
      assigned_analyst_id: null,
      status: 'OPEN',
      severity: 'HIGH',
      title: 'Test Title',
      description: 'Test Description',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('calls apiClient with POST and trimmed strings', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(validResponse);
      const result = await createIncident(payload, mockToken, mockSignal);

      expect(apiClient).toHaveBeenCalledWith(
        '/incidents',
        {
          method: 'POST',
          body: {
            detection_result_id: 10,
            title: 'Test Title',
            description: 'Test Description',
            severity: 'HIGH',
          },
          signal: mockSignal,
        },
        mockToken
      );
      expect(result).toEqual(validResponse);
    });

    it('rejects invalid detection ID without calling API', async () => {
      await expect(createIncident({ ...payload, detection_result_id: -1 })).rejects.toThrow('Invalid detection result ID');
      expect(apiClient).not.toHaveBeenCalled();
    });

    it('rejects empty title or description', async () => {
      await expect(createIncident({ ...payload, title: '   ' })).rejects.toThrow('Invalid title');
      await expect(createIncident({ ...payload, description: '   ' })).rejects.toThrow('Invalid description');
    });

    it('rejects invalid severity', async () => {
      // @ts-expect-error Testing invalid runtime severity
      await expect(createIncident({ ...payload, severity: 'INVALID' })).rejects.toThrow('Invalid severity');
    });

    it('rejects if response is invalid', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce({ ...validResponse, status: 'INVALID' });
      await expect(createIncident(payload)).rejects.toThrow('Invalid incident response');
    });
  });

  describe('listIncidents', () => {
    const validResponse = [
      {
        id: 1,
        detection_result_id: 10,
        assigned_analyst_id: 5,
        status: 'OPEN',
        severity: 'HIGH',
        title: 'Title',
        description: 'Desc',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    it('calls without params', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(validResponse);
      const result = await listIncidents(undefined, mockToken, mockSignal);

      expect(apiClient).toHaveBeenCalledWith(
        '/incidents',
        { method: 'GET', signal: mockSignal },
        mockToken
      );
      expect(result).toEqual(validResponse);
    });

    it('converts filters to query params preserving skip: 0', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(validResponse);
      await listIncidents(
        {
          status: 'OPEN',
          severity: 'HIGH',
          assignedAnalystId: 5,
          skip: 0,
          limit: 10,
        },
        mockToken,
        mockSignal
      );

      expect(apiClient).toHaveBeenCalledWith(
        '/incidents?status=OPEN&severity=HIGH&assigned_analyst_id=5&skip=0&limit=10',
        { method: 'GET', signal: mockSignal },
        mockToken
      );
    });

    it('rejects invalid filters without API call', async () => {
      // @ts-expect-error runtime check
      await expect(listIncidents({ status: 'INVALID' })).rejects.toThrow('Invalid status');
      // @ts-expect-error runtime check
      await expect(listIncidents({ severity: 'INVALID' })).rejects.toThrow('Invalid severity');
      await expect(listIncidents({ assignedAnalystId: -1 })).rejects.toThrow('Invalid assigned analyst ID');
      await expect(listIncidents({ skip: -1 })).rejects.toThrow('Invalid skip parameter');
      await expect(listIncidents({ limit: 0 })).rejects.toThrow('Invalid limit parameter');
      await expect(listIncidents({ limit: 101 })).rejects.toThrow('Invalid limit parameter');

      expect(apiClient).not.toHaveBeenCalled();
    });

    it('rejects broken list response', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce([ { ...validResponse[0], id: -1 } ]);
      await expect(listIncidents()).rejects.toThrow('Invalid incident response');
    });
  });

  describe('getIncident', () => {
    const validDetail = {
      id: 1,
      detection_result_id: 10,
      assigned_analyst_id: null,
      status: 'OPEN',
      severity: 'HIGH',
      title: 'Title',
      description: 'Desc',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      comments: [],
    };

    it('calls API with ID and returns valid detail', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(validDetail);
      const result = await getIncident(1, mockToken, mockSignal);

      expect(apiClient).toHaveBeenCalledWith(
        '/incidents/1',
        { method: 'GET', signal: mockSignal },
        mockToken
      );
      expect(result).toEqual(validDetail);
    });

    it('rejects invalid ID', async () => {
      await expect(getIncident(-1)).rejects.toThrow('Invalid incident ID');
      expect(apiClient).not.toHaveBeenCalled();
    });
  });

  describe('updateIncident', () => {
    const validResponse = {
      id: 1,
      detection_result_id: 10,
      assigned_analyst_id: 5,
      status: 'IN_PROGRESS',
      severity: 'HIGH',
      title: 'Title',
      description: 'Desc',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('calls PATCH with payload', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(validResponse);
      const result = await updateIncident(1, { assigned_analyst_id: 5, status: 'IN_PROGRESS' }, mockToken, mockSignal);

      expect(apiClient).toHaveBeenCalledWith(
        '/incidents/1',
        {
          method: 'PATCH',
          body: { assigned_analyst_id: 5, status: 'IN_PROGRESS' },
          signal: mockSignal,
        },
        mockToken
      );
      expect(result).toEqual(validResponse);
    });

    it('rejects empty payload', async () => {
      await expect(updateIncident(1, {})).rejects.toThrow('Empty payload');
    });

    it('rejects null unassign', async () => {
      // @ts-expect-error testing null runtime check
      await expect(updateIncident(1, { assigned_analyst_id: null })).rejects.toThrow('Invalid assigned analyst ID');
    });

    it('rejects invalid ID or invalid analyst ID or status', async () => {
      await expect(updateIncident(-1, { status: 'OPEN' })).rejects.toThrow('Invalid incident ID');
      await expect(updateIncident(1, { assigned_analyst_id: -5 })).rejects.toThrow('Invalid assigned analyst ID');
      // @ts-expect-error runtime check
      await expect(updateIncident(1, { status: 'UNKNOWN' })).rejects.toThrow('Invalid status');
      expect(apiClient).not.toHaveBeenCalled();
    });
  });

  describe('addIncidentComment', () => {
    const validComment = {
      id: 1,
      incident_id: 1,
      user_id: 5,
      comment_text: 'Test Comment',
      created_at: '2024-01-01T00:00:00Z',
    };

    it('calls POST and trims comment', async () => {
      vi.mocked(apiClient).mockResolvedValueOnce(validComment);
      const result = await addIncidentComment(1, { comment_text: '  Test Comment  ' }, mockToken, mockSignal);

      expect(apiClient).toHaveBeenCalledWith(
        '/incidents/1/comments',
        {
          method: 'POST',
          body: { comment_text: 'Test Comment' },
          signal: mockSignal,
        },
        mockToken
      );
      expect(result).toEqual(validComment);
    });

    it('rejects invalid ID or empty comment', async () => {
      await expect(addIncidentComment(-1, { comment_text: 'Hello' })).rejects.toThrow('Invalid incident ID');
      await expect(addIncidentComment(1, { comment_text: '   ' })).rejects.toThrow('Invalid comment text');
      expect(apiClient).not.toHaveBeenCalled();
    });
  });
});
