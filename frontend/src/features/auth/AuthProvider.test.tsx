import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import * as authApi from './authApi';
import type { TokenResponse, LoginRequest, UserRole } from './types';
import { ApiError } from '../../api/types';

vi.mock('./authApi', () => ({
  login: vi.fn(),
}));

describe('AuthProvider and useAuth', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
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

  it('3. Successful login updates user and token state in memory and sessionStorage', async () => {
    const fakeUser = { id: 1, username: 'test', email: 't@t.com', role: 'ANALYST' as UserRole, created_at: '2026-01-01' };
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'fake-token',
      token_type: 'bearer',
      user: fakeUser
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
    expect(sessionStorage.getItem('securewatch.accessToken')).toBe('fake-token');
    expect(sessionStorage.getItem('securewatch.user')).toBe(JSON.stringify(fakeUser));
  });

  it('4. AuthProvider yeniden mount edildiÄŸinde geÃ§erli session geri yÃ¼kleniyor', () => {
    sessionStorage.setItem('securewatch.accessToken', 'token123');
    sessionStorage.setItem('securewatch.user', JSON.stringify({ id: 1, username: 'u', role: 'ADMIN' as UserRole }));

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    expect(screen.getByTestId('is-auth').textContent).toBe('true');
    expect(screen.getByTestId('has-user').textContent).toBe('true');
    expect(screen.getByTestId('has-token').textContent).toBe('true');
  });

  it('5. YalnÄ±zca token varsa authenticated olunmuyor ve temizleniyor', () => {
    sessionStorage.setItem('securewatch.accessToken', 'token123');

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    expect(screen.getByTestId('is-auth').textContent).toBe('false');
    expect(sessionStorage.getItem('securewatch.accessToken')).toBeNull();
  });

  it('6. YalnÄ±zca kullanÄ±cÄ± varsa authenticated olunmuyor ve temizleniyor', () => {
    sessionStorage.setItem('securewatch.user', JSON.stringify({ id: 1, username: 'u', role: 'ADMIN' as UserRole }));

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    expect(screen.getByTestId('is-auth').textContent).toBe('false');
    expect(sessionStorage.getItem('securewatch.user')).toBeNull();
  });

  it('7. Bozuk kullanÄ±cÄ± JSON verisi uygulamayÄ± Ã§Ã¶kertmiyor ve temizliyor', () => {
    sessionStorage.setItem('securewatch.accessToken', 'token123');
    sessionStorage.setItem('securewatch.user', '{bad-json');

    expect(() => {
      render(
        <AuthProvider>
          <TestHarness />
        </AuthProvider>
      );
    }).not.toThrow();

    expect(screen.getByTestId('is-auth').textContent).toBe('false');
    expect(sessionStorage.getItem('securewatch.accessToken')).toBeNull();
    expect(sessionStorage.getItem('securewatch.user')).toBeNull();
  });

  it('8. Logout sonrasÄ±nda state ve sessionStorage temizleniyor', async () => {
    sessionStorage.setItem('securewatch.accessToken', 'token123');
    sessionStorage.setItem('securewatch.user', JSON.stringify({ id: 1, username: 'u', role: 'ADMIN' as UserRole }));

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    act(() => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('is-auth').textContent).toBe('false');
    expect(sessionStorage.getItem('securewatch.accessToken')).toBeNull();
    expect(sessionStorage.getItem('securewatch.user')).toBeNull();
  });

  it('9. Failed login does not create authenticated state, keeps user/token safe', async () => {
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
    expect(sessionStorage.getItem('securewatch.accessToken')).toBeNull();
  });

  it('10. Does not create cookies', async () => {
    const initialCookies = document.cookie;

    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'fake', token_type: 'b',
      user: { id: 1, username: 'u', email: 'e', role: 'ANALYST' as UserRole, created_at: 'd' }
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

  it('11. Token is not rendered to DOM, URL, or console', async () => {
    const fakeToken = 'super-secret-token-12345';
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: fakeToken, token_type: 'b',
      user: { id: 1, username: 'u', email: 'e', role: 'ANALYST' as UserRole, created_at: 'd' }
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

  it('12. Password is not stored in provider state', async () => {
    let capturedCredentials: LoginRequest | undefined;

    vi.mocked(authApi.login).mockImplementationOnce(async (creds) => {
      capturedCredentials = creds;
      return {
        access_token: 't', token_type: 'b',
        user: { id: 1, username: 'u', email: 'e', role: 'ANALYST' as UserRole, created_at: 'd' }
      };
    });

    function PasswordCheckHarness() {
      const auth = useAuth();
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

    expect(capturedCredentials?.password).toBe('pw');

    const stateDump = screen.getByTestId('state-dump').textContent || '';
    expect(stateDump).not.toContain('pw');
    expect(stateDump).not.toContain('password');
  });

  it('13. Loading state changes correctly during login', async () => {
    let resolveLogin: (val: TokenResponse) => void = () => {};
    const promise = new Promise<TokenResponse>((res) => {
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
        user: { id: 1, username: 'u', email: 'e', role: 'ANALYST' as UserRole, created_at: 'd' }
      });
    });

    expect(screen.getByTestId('is-loading').textContent).toBe('false');
  });
});
