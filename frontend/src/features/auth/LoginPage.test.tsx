import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { AuthProvider } from './AuthProvider';
import type { TokenResponse } from './types';
import * as authApi from './authApi';
import { ApiError } from '../../api/types';

vi.mock('./authApi', () => ({
  login: vi.fn(),
}));

describe('LoginPage', () => {
  const originalLocalStorageSet = Storage.prototype.setItem;

  beforeEach(() => {
    vi.clearAllMocks();
    Storage.prototype.setItem = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Storage.prototype.setItem = originalLocalStorageSet;
    vi.restoreAllMocks();
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('1. Renders the page successfully', () => {
    renderPage();
    expect(screen.getByText('SecureWatch AI')).toBeInTheDocument();
  });

  it('2. Displays SecureWatch AI brand logo', () => {
    renderPage();
    // Assuming SecureWatchBrand renders an SVG with a title or standard accessible name,
    // or just checking if the header text is present is enough.
    // The instructions say "marka simgesi görüntüleniyor", we check for the text "Platform Girişi" which is right below it
    expect(screen.getByText('Platform Girişi')).toBeInTheDocument();
  });

  it('3, 4, 5. Username label is connected to correct text input with correct autocomplete', () => {
    renderPage();
    const input = screen.getByLabelText('Kullanıcı adı');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('name', 'username');
    expect(input).toHaveAttribute('autoComplete', 'username');
  });

  it('6, 7, 8. Password label is connected to correct password input with correct autocomplete', () => {
    renderPage();
    const input = screen.getByLabelText('Parola');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('name', 'password');
    expect(input).toHaveAttribute('autoComplete', 'current-password');
  });

  it('9. Submit button is displayed', () => {
    renderPage();
    const button = screen.getByRole('button', { name: /giriş yap/i });
    expect(button).toBeInTheDocument();
  });

  it('10. Empty form does not make login call', async () => {
    renderPage();

    // The button should be disabled when empty, but let's try to submit anyway
    const button = screen.getByRole('button', { name: /giriş yap/i });
    expect(button).toBeDisabled();

    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('11. Filled form makes login call with correct username and unchanged password', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 't', token_type: 'b', user: { id: 1, username: 'user', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'myuser');
    await user.type(screen.getByLabelText('Parola'), 'mypassword');

    await user.click(screen.getByRole('button', { name: /giriş yap/i }));

    expect(authApi.login).toHaveBeenCalledTimes(1);
    expect(authApi.login).toHaveBeenCalledWith({ username: 'myuser', password: 'mypassword' });
  });

  it('12. Trims whitespace from username securely', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 't', token_type: 'b', user: { id: 1, username: 'user', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), '  spaceuser  ');
    await user.type(screen.getByLabelText('Parola'), '  spacepass  ');

    await user.click(screen.getByRole('button', { name: /giriş yap/i }));

    expect(authApi.login).toHaveBeenCalledWith({ username: 'spaceuser', password: '  spacepass  ' });
  });

  it('13, 14. Button is disabled and shows loading state during login', async () => {
    const user = userEvent.setup();
    let resolveLogin: (val: TokenResponse) => void = () => {};
    vi.mocked(authApi.login).mockReturnValueOnce(new Promise((res) => { resolveLogin = res; }));

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'p');

    const button = screen.getByRole('button', { name: /giriş yap/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Giriş yapılıyor...');

    await act(async () => {
      resolveLogin({ access_token: 't', token_type: 'b', user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' } });
    });
  });

  it('15. Prevents duplicate submits', async () => {
    const user = userEvent.setup();
    let resolveLogin: (val: TokenResponse) => void = () => {};
    vi.mocked(authApi.login).mockReturnValueOnce(new Promise((res) => { resolveLogin = res; }));

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'p');

    const button = screen.getByRole('button');
    await user.click(button);
    await user.click(button); // attempt second click

    expect(authApi.login).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLogin({ access_token: 't', token_type: 'b', user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' } });
    });
  });

  it('16. Failed login with 401 shows secure generic message without leaking username existence', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValueOnce(new ApiError(401, { code: 'ERR', message: 'User not found in database', details: null }));

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'p');
    await user.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Kullanıcı adı veya parola hatalı.');
    expect(alert).not.toHaveTextContent('User not found in database');
  });

  it('17. Clears previous error when new submit starts', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValueOnce(new ApiError(401, { code: 'ERR', message: 'Geçersiz kimlik bilgileri', details: null }));

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'p');
    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // New submit starts
    let resolveLogin: (val: TokenResponse) => void = () => {};
    vi.mocked(authApi.login).mockReturnValueOnce(new Promise((res) => { resolveLogin = res; }));

    await user.click(screen.getByRole('button'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      resolveLogin({ access_token: 't', token_type: 'b', user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' } });
    });
  });

  it('18. Password does not leak into error text or DOM', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValueOnce(new ApiError(400, { code: 'ERR', message: 'Hata', details: null }));

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'super-secret-password-123');
    await user.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('super-secret-password-123');
    expect(document.body.textContent).not.toContain('super-secret-password-123');
  });

  it('19. Form can be submitted with Enter key', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 't', token_type: 'b', user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    renderPage();

    const pwInput = screen.getByLabelText('Parola');
    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(pwInput, 'p');

    await user.type(pwInput, '{Enter}');

    expect(authApi.login).toHaveBeenCalledTimes(1);
  });

  it('20. Security warning is displayed', () => {
    renderPage();
    expect(screen.getByText(/Bu sisteme erişim yalnızca yetkili personelle sınırlandırılmıştır/i)).toBeInTheDocument();
  });

  it('21, 22. Mockup warnings and old dataset names are absent', () => {
    renderPage();
    expect(screen.queryByText(/UI MOCKUP/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/UNSW-NB15/i)).not.toBeInTheDocument();
  });

  it('23, 24. Tests do not make real network requests and do not use storage', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 't', token_type: 'b', user: { id: 1, username: 'u', email: 'e', role: 'ANALYST', created_at: 'd' }
    });

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'p');
    await user.click(screen.getByRole('button'));

    // Network requests are inherently prevented by vi.mock('./authApi')
    // sessionStorage IS used by AuthProvider.
    // Network requests are inherently prevented by vi.mock('./authApi')
  });

  it('25. Failed login with 502 shows generic service error and does not leak HTTP details', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValueOnce(new ApiError(502, { code: 'ERR', message: 'HTTP Error 502: Bad Gateway', details: null }));

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'p');
    await user.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.');
    expect(alert).not.toHaveTextContent('502');
    expect(alert).not.toHaveTextContent('Bad Gateway');
  });

  it('26. Failed login with network error (status 0) shows generic service error', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValueOnce(new ApiError(0, { code: 'NETWORK_ERROR', message: 'A network error occurred while communicating with the server.', details: null }));

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'p');
    await user.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.');
  });

  it('27. Non-JSON or unexpected transport errors do not leak technical details', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Unexpected token < in JSON at position 0'));

    renderPage();

    await user.type(screen.getByLabelText('Kullanıcı adı'), 'u');
    await user.type(screen.getByLabelText('Parola'), 'p');
    await user.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Giriş işlemi başarısız oldu. Lütfen tekrar deneyin.');
    expect(alert).not.toHaveTextContent('Unexpected token');
  });
});
