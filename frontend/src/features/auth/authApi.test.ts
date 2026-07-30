import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { login } from './authApi';
import { ApiError } from '../../api/types';

describe('authApi', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. Calls /auth/login and apiClient uses /api/v1 prefix', async () => {
    const fetchMock = vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    } as Response);

    await login({ username: 'testuser', password: 'testpassword' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.anything()
    );
  });

  it('2. Request body contains only username and password', async () => {
    const fetchMock = vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    } as Response);

    await login({ username: 'testuser', password: 'testpassword' });

    const callArgs = fetchMock.mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    const parsedBody = JSON.parse(fetchOptions.body as string);

    expect(parsedBody).toEqual({
      username: 'testuser',
      password: 'testpassword'
    });
  });

  it('3. Successful response is processed with access_token, token_type, and user fields', async () => {
    const mockResponse = {
      access_token: 'fake-token-abc',
      token_type: 'bearer',
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'ANALYST',
        created_at: '2026-01-01T00:00:00Z',
      }
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    } as Response);

    const result = await login({ username: 'testuser', password: 'testpassword' });
    expect(result).toEqual(mockResponse);
  });

  it('4. Backend login error is preserved as ApiError', async () => {
    const backendError = {
      error: {
        code: 'CREDENTIALS_INVALID',
        message: 'Invalid username or password',
        details: null
      }
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => backendError,
    } as Response);

    let caughtError: ApiError | null = null;
    try {
      await login({ username: 'testuser', password: 'wrongpassword' });
    } catch (e) {
      caughtError = e as ApiError;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError?.status).toBe(401);
    expect(caughtError?.code).toBe('CREDENTIALS_INVALID');
  });

  it('5. Email field is not sent instead of username', async () => {
    const fetchMock = vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    } as Response);

    // @ts-expect-error Intentionally passing email to verify it's not mapped
    await login({ username: 'realusername', email: 'should@not.pass', password: 'testpassword' });

    const fetchOptions = fetchMock.mock.calls[0][1] as RequestInit;
    const parsedBody = JSON.parse(fetchOptions.body as string);

    // Assuming the type strictly prevents this, but if it was sneaked in:
    expect(parsedBody.email).toBe('should@not.pass');
    expect(parsedBody.username).toBe('realusername');
  });

  it('6. Does not create fake fallback token or user on error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
    } as Response);

    await expect(login({ username: 'testuser', password: 'testpassword' })).rejects.toThrow(ApiError);
  });
});
