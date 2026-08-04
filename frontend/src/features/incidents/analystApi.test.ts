import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listAssignableAnalysts } from './analystApi';
import { apiClient } from '../../api/client';
import { ApiError } from '../../api/types';

vi.mock('../../api/client');

describe('analystApi', () => {
  const mockToken = 'mock-token';
  const abortController = new AbortController();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1-5. Doğru endpoint, method, token, signal kullanılır ve body gönderilmez', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([]);

    await listAssignableAnalysts(mockToken, abortController.signal);

    expect(apiClient).toHaveBeenCalledTimes(1);
    expect(apiClient).toHaveBeenCalledWith('/users?skip=0&limit=100', {
      method: 'GET',
      headers: { Authorization: `Bearer ${mockToken}` },
      signal: abortController.signal,
    });
  });

  it('6, 7, 8. Geçerli listeyi doğrular, yalnız ANALYST döndürür, ADMIN filtrelenir', async () => {
    const mockData = [
      { id: 1, username: 'admin1', email: 'admin@test.com', role: 'ADMIN', created_at: '2023-01-01' },
      { id: 2, username: 'analyst1', email: 'a1@test.com', role: 'ANALYST', created_at: '2023-01-01' },
    ];
    vi.mocked(apiClient).mockResolvedValueOnce(mockData);

    const result = await listAssignableAnalysts(mockToken, abortController.signal);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
    expect(result[0].username).toBe('analyst1');
  });

  it('9, 10. Kararlı alfabetik sıralama ve id ile fallback', async () => {
    const mockData = [
      { id: 3, username: 'Zeta', email: 'zeta@test.com', role: 'ANALYST', created_at: '2023-01-01' },
      { id: 1, username: 'alpha', email: 'alpha@test.com', role: 'ANALYST', created_at: '2023-01-01' },
      { id: 5, username: 'Alpha', email: 'alpha2@test.com', role: 'ANALYST', created_at: '2023-01-01' },
      { id: 2, username: 'beta', email: 'beta@test.com', role: 'ANALYST', created_at: '2023-01-01' },
    ];
    vi.mocked(apiClient).mockResolvedValueOnce(mockData);

    const result = await listAssignableAnalysts(mockToken, abortController.signal);

    expect(result).toHaveLength(4);
    // Alpha (id: 1) -> Alpha (id: 5) -> beta (id: 2) -> Zeta (id: 3)
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(5);
    expect(result[2].id).toBe(2);
    expect(result[3].id).toBe(3);
  });

  it('11. Input array mutate edilmez', async () => {
    const mockData = [
      { id: 2, username: 'zeta', email: 'z@test.com', role: 'ANALYST', created_at: '2023-01-01' },
      { id: 1, username: 'alpha', email: 'a@test.com', role: 'ANALYST', created_at: '2023-01-01' },
    ];
    const originalData = JSON.parse(JSON.stringify(mockData));
    vi.mocked(apiClient).mockResolvedValueOnce(mockData);

    await listAssignableAnalysts(mockToken, abortController.signal);

    expect(mockData).toEqual(originalData); // Referans ve içerik bozulmamalı
  });

  it('12. Response array değilse reddedilir', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({ id: 1, username: 'test' });
    await expect(listAssignableAnalysts(mockToken, abortController.signal)).rejects.toThrow(ApiError);
  });

  it('13. ID pozitif integer değilse reddedilir', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([{ id: 0, username: 'a', email: 'a@a.com', role: 'ANALYST', created_at: 'd' }]);
    await expect(listAssignableAnalysts(mockToken, abortController.signal)).rejects.toThrow(ApiError);

    vi.mocked(apiClient).mockResolvedValueOnce([{ id: 1.5, username: 'a', email: 'a@a.com', role: 'ANALYST', created_at: 'd' }]);
    await expect(listAssignableAnalysts(mockToken, abortController.signal)).rejects.toThrow(ApiError);
  });

  it('14. Username geçersizse reddedilir', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([{ id: 1, username: '   ', email: 'a@a.com', role: 'ANALYST', created_at: 'd' }]);
    await expect(listAssignableAnalysts(mockToken, abortController.signal)).rejects.toThrow(ApiError);
  });

  it('15. Email geçersiz tipteyse reddedilir', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([{ id: 1, username: 'a', email: 123, role: 'ANALYST', created_at: 'd' }]);
    await expect(listAssignableAnalysts(mockToken, abortController.signal)).rejects.toThrow(ApiError);
  });

  it('16. Role geçersizse reddedilir', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([{ id: 1, username: 'a', email: 'a@a.com', role: 'USER', created_at: 'd' }]);
    await expect(listAssignableAnalysts(mockToken, abortController.signal)).rejects.toThrow(ApiError);
  });

  it('17. created_at geçersiz tipteyse reddedilir', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([{ id: 1, username: 'a', email: 'a@a.com', role: 'ANALYST', created_at: null }]);
    await expect(listAssignableAnalysts(mockToken, abortController.signal)).rejects.toThrow(ApiError);
  });

  it('18. Duplicate user ID reddedilir', async () => {
    const mockData = [
      { id: 1, username: 'a', email: 'a@a.com', role: 'ANALYST', created_at: '2023-01-01' },
      { id: 1, username: 'b', email: 'b@b.com', role: 'ANALYST', created_at: '2023-01-01' },
    ];
    vi.mocked(apiClient).mockResolvedValueOnce(mockData);
    await expect(listAssignableAnalysts(mockToken, abortController.signal)).rejects.toThrow(ApiError);
  });

  it('19. Boş array kabul edilir', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([]);
    const result = await listAssignableAnalysts(mockToken, abortController.signal);
    expect(result).toEqual([]);
  });
});
