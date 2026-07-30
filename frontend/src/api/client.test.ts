import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './client';
import { ApiError } from './types';

describe('apiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. Returns successful JSON response', async () => {
    const mockData = { success: true };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    } as Response);

    const result = await apiClient('/test');
    expect(result).toEqual(mockData);
  });

  it('2. Appends /api/v1 prefix to path', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
    } as Response);

    await apiClient('/some/endpoint');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/some/endpoint',
      expect.anything()
    );
  });

  it('3. Serializes body and sets Content-Type to application/json', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
    } as Response);

    const bodyData = { key: 'value' };
    await apiClient('/test', { method: 'POST', body: bodyData });

    const callArgs = (vi.mocked(globalThis.fetch)).mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;

    expect(fetchOptions.body).toBe(JSON.stringify(bodyData));
    const headers = fetchOptions.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('4. Adds Authorization header if token is provided', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
    } as Response);

    await apiClient('/test', {}, 'fake-token-123');

    const fetchOptions = (vi.mocked(globalThis.fetch)).mock.calls[0][1] as RequestInit;
    const headers = fetchOptions.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer fake-token-123');
  });

  it('5. Does not add Authorization header if token is not provided', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
    } as Response);

    await apiClient('/test', {});

    const fetchOptions = (vi.mocked(globalThis.fetch)).mock.calls[0][1] as RequestInit;
    const headers = fetchOptions.headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
  });

  it('6. Handles 204 No Content safely', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
    } as Response);

    const result = await apiClient('/test');
    expect(result).toBeUndefined();
  });

  it('7. Normalizes nested backend error with correct code, message, details', async () => {
    const backendError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'username' }
      }
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => backendError,
    } as Response);

    let caughtError: ApiError | null = null;
    try {
      await apiClient('/test');
    } catch (e) {
      caughtError = e as ApiError;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError?.status).toBe(422);
    expect(caughtError?.code).toBe('VALIDATION_ERROR');
    expect(caughtError?.message).toBe('Invalid input');
    expect(caughtError?.details).toEqual({ field: 'username' });
  });

  it('8. Handles non-JSON errors safely', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html><body>Bad Gateway</body></html>',
    } as unknown as Response);

    let caughtError: ApiError | null = null;
    try {
      await apiClient('/test');
    } catch (e) {
      caughtError = e as ApiError;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError?.status).toBe(502);
    expect(caughtError?.code).toBe('UNKNOWN_ERROR');
    expect(caughtError?.message).toBe('HTTP Error 502: Bad Gateway');
    expect(caughtError?.details).toBeNull();
  });

  it('9. Converts network error to ApiError behavior safely', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network offline'));

    let caughtError: ApiError | null = null;
    try {
      await apiClient('/test');
    } catch (e) {
      caughtError = e as ApiError;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError?.status).toBe(0);
    expect(caughtError?.code).toBe('NETWORK_ERROR');
    expect(caughtError?.message).toBe('A network error occurred while communicating with the server.');
  });

  it('10. Error message does not leak sensitive information (token, password, raw body, stack)', async () => {
    const sensitiveBody = { password: 'my-super-secret-password' };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers(),
    } as Response);

    let caughtError: ApiError | null = null;
    try {
      await apiClient('/test', { method: 'POST', body: sensitiveBody }, 'secret-token-123');
    } catch (e) {
      caughtError = e as ApiError;
    }

    const message = caughtError?.message || '';
    expect(message).not.toContain('my-super-secret-password');
    expect(message).not.toContain('secret-token-123');
    expect(message).not.toContain('password');
  });

  it('11. Forwards AbortSignal to fetch call', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
    } as Response);

    const controller = new AbortController();
    await apiClient('/test', { signal: controller.signal });

    const fetchOptions = (vi.mocked(globalThis.fetch)).mock.calls[0][1] as RequestInit;
    expect(fetchOptions.signal).toBe(controller.signal);
  });
});
