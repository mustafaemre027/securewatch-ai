import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import * as authApi from './authApi';
import { ApiError } from '../../api/types';

vi.mock('./authApi', () => ({
  login: vi.fn(),
}));

describe('AuthProvider and useAuth', () => {
  const originalLocalStorageSet = Storage.prototype.setItem;

  beforeEach(() => {
    Storage.prototype.setItem = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Storage.prototype.setItem = originalLocalStorageSet;
    vi.restoreAllMocks();
  });

  function TestHarness() {
    const auth = useAuth();
    return (
      <div>
        <div data-testid="is-auth">{auth.isAuthenticated.toString()}</div>
        <div data-testid="is-loading">{auth.isLoading.toString()}</div>
        <div data-testid="has-user">{(!!auth.user).toString()}</div>
        <div data-testid="has-token">{(!!auth.accessToken).toString()}</div>

        <button
          data-testid="login-btn"
          onClick={() => auth.loginUser({ username: 'test', password: 'pw' }).catch(() => {})}
        >
          Login
        </button>
        <button
          data-testid="logout-btn"
          onClick={() => auth.logoutUser()}
        >
          Logout
        </button>
      </div>
    );
  }

  it('1, 2. Initial state is unauthenticated with no user and token', () => {
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    expect(screen.getByTestId('is-auth').textContent).toBe('false');
    expect(screen.getByTestId('has-user').textContent).toBe('false');
    expect(screen.getByTestId('has-token').textContent).toBe('false');
  });

  it('3. Successful login updates user and token state in memory', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'fake-token',
      token_type: 'bearer',
      user: { id: 1, username: 'test', email: 't@t.com', role: 'ANALYST', created_at: '2026-01-01' }
    });

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('true');
    expect(screen.getByTestId('has-user').textContent).toBe('true');
    expect(screen.getByTestId('has-token').textContent).toBe('true');
  });

  it('4. Loading state changes correctly during login', async () => {
    let resolveLogin: (val: unknown) => void = () => {};
    const promise = new Promise<unknown>((res) => {
      resolveLogin = res;
    });

    vi.mocked(authApi.login).mockReturnValueOnce(promise);

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    expect(screen.getByTestId('is-loading').textContent).toBe('false');

    act(() => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('is-loading').textContent).toBe('true');

    await act(async () => {
      resolveLogin({
        access_token: 't',
        token_type: 'bearer',
        user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
      });
    });

    expect(screen.getByTestId('is-loading').textContent).toBe('false');
  });

  it('5, 6. Failed login does not create authenticated state, keeps user/token safe', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new ApiError(401, { code: 'ERR', message: 'err', details: null }));

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('false');
    expect(screen.getByTestId('has-user').textContent).toBe('false');
    expect(screen.getByTestId('has-token').textContent).toBe('false');
  });

  it('7. Logout completely clears user and token state', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'fake', token_type: 'b',
      user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('true');

    act(() => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('false');
    expect(screen.getByTestId('has-user').textContent).toBe('false');
    expect(screen.getByTestId('has-token').textContent).toBe('false');
  });

  it('8. useAuth outside provider throws clear developer error', () => {
    function BrokenComponent() {
      useAuth();
      return <div>Broken</div>;
    }

    expect(() => render(<BrokenComponent />)).toThrow('useAuth must be used within an AuthProvider');
  });

  it('9. Token is not persistent when provider is unmounted/remounted', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'fake', token_type: 'b',
      user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    const { unmount } = render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('true');

    unmount();

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    expect(screen.getByTestId('is-auth').textContent).toBe('false');
  });

  it('10, 11. Does not call localStorage.setItem or sessionStorage.setItem', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'fake', token_type: 'b',
      user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(Storage.prototype.setItem).not.toHaveBeenCalled();
  });

  it('12. Does not create cookies', async () => {
    const initialCookies = document.cookie;

    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'fake', token_type: 'b',
      user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(document.cookie).toBe(initialCookies);
  });

  it('13. Token is not rendered to DOM, URL, or console', async () => {
    const fakeToken = 'super-secret-token-12345';
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: fakeToken, token_type: 'b',
      user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    const consoleSpy = vi.spyOn(console, 'log');

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    const domHTML = document.body.innerHTML;
    expect(domHTML).not.toContain(fakeToken);
    expect(window.location.href).not.toContain(fakeToken);

    consoleSpy.mock.calls.forEach(call => {
      call.forEach(arg => {
        if (typeof arg === 'string') {
          expect(arg).not.toContain(fakeToken);
        }
      });
    });
  });

  it('14. Password is not stored in provider state', async () => {
    let capturedCredentials: Record<string, string> = {};

    vi.mocked(authApi.login).mockImplementationOnce(async (creds) => {
      capturedCredentials = creds;
      return {
        access_token: 't', token_type: 'b',
        user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
      };
    });

    function PasswordCheckHarness() {
      const auth = useAuth();
      // stringify state to ensure password is not inside
      return <div data-testid="state-dump">{JSON.stringify(auth)}</div>;
    }

    render(
      <AuthProvider>
        <PasswordCheckHarness />
        <TestHarness />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(capturedCredentials.password).toBe('pw');

    const stateDump = screen.getByTestId('state-dump').textContent || '';
    expect(stateDump).not.toContain('pw');
    expect(stateDump).not.toContain('password');
  });
});
