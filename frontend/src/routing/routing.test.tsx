import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { getSafeRedirect } from './utils';
import { useAuth } from '../features/auth/useAuth';

vi.mock('../features/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('getSafeRedirect', () => {
  it('5. Default target is /', () => {
    expect(getSafeRedirect(undefined)).toBe('/');
    expect(getSafeRedirect(null)).toBe('/');
    expect(getSafeRedirect('')).toBe('/');
  });

  it('6. Allows internal relative path', () => {
    expect(getSafeRedirect('/dashboard')).toBe('/dashboard');
    expect(getSafeRedirect('/some/deep/path?q=1')).toBe('/some/deep/path?q=1');
  });

  it('7. Rejects protocol-relative target', () => {
    expect(getSafeRedirect('//evil.example')).toBe('/');
    expect(getSafeRedirect('\\\\evil.example')).toBe('/');
  });

  it('8. Rejects external targets', () => {
    expect(getSafeRedirect('https://evil.example')).toBe('/');
    expect(getSafeRedirect('http://evil.example')).toBe('/');
  });

  it('9. Rejects javascript targets', () => {
    expect(getSafeRedirect('javascript:alert(1)')).toBe('/');
  });

  it('17. Removes sensitive query params', () => {
    expect(getSafeRedirect('/app?token=123')).toBe('/app');
    expect(getSafeRedirect('/app?access_token=123')).toBe('/app');
    expect(getSafeRedirect('/app?password=123')).toBe('/app');
  });
});

describe('Routing Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Unauthenticated user is redirected from / to /login', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page Mock</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('2. Authenticated user can see protected / content', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('3. Unauthenticated user can see /login page', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login Page Mock</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
  });

  it('4. Authenticated user is redirected from /login to /', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<div>Login Page Mock</div>} />
          </Route>
          <Route path="/" element={<div>Home Mock</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home Mock')).toBeInTheDocument();
    expect(screen.queryByText('Login Page Mock')).not.toBeInTheDocument();
  });
});
