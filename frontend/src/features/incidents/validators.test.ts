import { describe, it, expect } from 'vitest';
import {
  isIncidentStatus,
  isIncidentSeverity,
  parseIncidentComment,
  parseIncidentListItem,
  parseIncidentDetail,
  parseIncidentList,
} from './validators';

describe('validators', () => {
  describe('isIncidentStatus', () => {
    it('accepts valid statuses', () => {
      expect(isIncidentStatus('OPEN')).toBe(true);
      expect(isIncidentStatus('IN_PROGRESS')).toBe(true);
      expect(isIncidentStatus('RESOLVED')).toBe(true);
      expect(isIncidentStatus('FALSE_POSITIVE')).toBe(true);
    });

    it('rejects invalid statuses', () => {
      expect(isIncidentStatus('CLOSED')).toBe(false);
      expect(isIncidentStatus('')).toBe(false);
      expect(isIncidentStatus(null)).toBe(false);
      expect(isIncidentStatus(123)).toBe(false);
    });
  });

  describe('isIncidentSeverity', () => {
    it('accepts valid severities', () => {
      expect(isIncidentSeverity('LOW')).toBe(true);
      expect(isIncidentSeverity('MEDIUM')).toBe(true);
      expect(isIncidentSeverity('HIGH')).toBe(true);
      expect(isIncidentSeverity('CRITICAL')).toBe(true);
    });

    it('rejects invalid severities', () => {
      expect(isIncidentSeverity('UNKNOWN')).toBe(false);
      expect(isIncidentSeverity('')).toBe(false);
      expect(isIncidentSeverity(null)).toBe(false);
    });
  });

  const validComment = {
    id: 1,
    incident_id: 2,
    user_id: 3,
    comment_text: 'Test comment',
    created_at: '2024-01-01T00:00:00Z',
  };

  const validListItem = {
    id: 1,
    detection_result_id: 10,
    assigned_analyst_id: null,
    status: 'OPEN',
    severity: 'HIGH',
    title: 'Test Incident',
    description: 'Test Description',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  describe('parseIncidentComment', () => {
    it('parses a valid comment', () => {
      const result = parseIncidentComment(validComment);
      expect(result).toEqual(validComment);
    });

    it('rejects negative or missing IDs', () => {
      expect(() => parseIncidentComment({ ...validComment, id: -1 })).toThrow('Invalid incident response');
      expect(() => parseIncidentComment({ ...validComment, user_id: '3' })).toThrow('Invalid incident response');
    });

    it('rejects empty text or invalid date', () => {
      expect(() => parseIncidentComment({ ...validComment, comment_text: '  ' })).toThrow('Invalid incident response');
      expect(() => parseIncidentComment({ ...validComment, created_at: 'invalid date' })).toThrow('Invalid incident response');
    });

    it('does not mutate input', () => {
      const input = { ...validComment };
      parseIncidentComment(input);
      expect(input).toEqual(validComment);
    });
  });

  describe('parseIncidentListItem', () => {
    it('parses a valid list item', () => {
      const result = parseIncidentListItem(validListItem);
      expect(result).toEqual(validListItem);
    });

    it('accepts valid assigned_analyst_id', () => {
      const item = { ...validListItem, assigned_analyst_id: 5 };
      expect(parseIncidentListItem(item)).toEqual(item);
    });

    it('rejects invalid assigned_analyst_id', () => {
      expect(() => parseIncidentListItem({ ...validListItem, assigned_analyst_id: -1 })).toThrow('Invalid incident response');
      expect(() => parseIncidentListItem({ ...validListItem, assigned_analyst_id: '5' })).toThrow('Invalid incident response');
    });

    it('rejects missing or empty title/description', () => {
      expect(() => parseIncidentListItem({ ...validListItem, title: '' })).toThrow('Invalid incident response');
      expect(() => parseIncidentListItem({ ...validListItem, description: '   ' })).toThrow('Invalid incident response');
    });

    it('rejects invalid status or severity', () => {
      expect(() => parseIncidentListItem({ ...validListItem, status: 'CLOSED' })).toThrow('Invalid incident response');
      expect(() => parseIncidentListItem({ ...validListItem, severity: 'MINOR' })).toThrow('Invalid incident response');
    });
  });

  describe('parseIncidentDetail', () => {
    const validDetail = {
      ...validListItem,
      comments: [validComment],
    };

    it('parses a valid detail object', () => {
      const result = parseIncidentDetail(validDetail);
      expect(result).toEqual(validDetail);
    });

    it('rejects if comments is not an array', () => {
      expect(() => parseIncidentDetail({ ...validListItem, comments: null })).toThrow('Invalid incident response');
      expect(() => parseIncidentDetail({ ...validListItem, comments: {} })).toThrow('Invalid incident response');
    });

    it('rejects if a comment inside detail is invalid', () => {
      expect(() => parseIncidentDetail({ ...validListItem, comments: [{ ...validComment, id: -1 }] })).toThrow('Invalid incident response');
    });
  });

  describe('parseIncidentList', () => {
    it('parses a valid list of items', () => {
      const list = [validListItem, { ...validListItem, id: 2 }];
      const result = parseIncidentList(list);
      expect(result).toEqual(list);
    });

    it('rejects non-arrays', () => {
      expect(() => parseIncidentList({})).toThrow('Invalid incident response');
      expect(() => parseIncidentList(null)).toThrow('Invalid incident response');
    });

    it('rejects if any item in the list is invalid', () => {
      const list = [validListItem, { ...validListItem, status: 'UNKNOWN' }];
      expect(() => parseIncidentList(list)).toThrow('Invalid incident response');
    });
  });
});
