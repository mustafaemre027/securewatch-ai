import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AppLayout } from './AppLayout';
import { useAuth } from '../features/auth/useAuth';

vi.mock('../features/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('AppLayout', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLayout = (user: unknown) => {
    vi.mocked(useAuth).mockReturnValue({
      user,
      logoutUser: mockLogout,
      isAuthenticated: true
    } as unknown as ReturnType<typeof useAuth>);

    return render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div data-testid="main-mock">Main Content</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-mock">Login Route</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('14. Shows the username securely', () => {
    renderLayout({ username: 'testuser123', role: 'ADMIN' });
    expect(screen.getByText('testuser123')).toBeInTheDocument();
  });

  it('15. Shows the correct readable Turkish role label for ADMIN', () => {
    renderLayout({ username: 'u', role: 'ADMIN' });
    expect(screen.getByText('Yönetici')).toBeInTheDocument();
  });

  it('15. Shows the correct readable Turkish role label for ANALYST', () => {
    renderLayout({ username: 'u', role: 'ANALYST' });
    expect(screen.getByText('Güvenlik Analisti')).toBeInTheDocument();
  });

  it('18. Includes semantic skip link and main content area', () => {
    renderLayout({ username: 'u', role: 'ADMIN' });
    const skipLink = screen.getByText('Ana içeriğe atla');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');

    const mainArea = screen.getByRole('main');
    expect(mainArea).toHaveAttribute('id', 'main-content');
    expect(mainArea).toHaveAttribute('tabIndex', '-1');
    expect(screen.getByTestId('main-mock')).toBeInTheDocument();
  });

  it('16. Logout clears state and redirects to /login', async () => {
    const user = userEvent.setup();
    renderLayout({ username: 'u', role: 'ADMIN' });

    const logoutBtn = screen.getByRole('button', { name: /oturumu kapat/i });
    await user.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('login-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('main-mock')).not.toBeInTheDocument();
  });

  it('19. Long username does not break render', () => {
    const longName = 'a'.repeat(300);
    renderLayout({ username: longName, role: 'ADMIN' });
    expect(screen.getByText(longName)).toBeInTheDocument();
  });

  it('20. Navigation link for Analysis has correct href and aria-current when active', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { username: 'u', role: 'ANALYST' },
      logoutUser: mockLogout,
      isAuthenticated: true
    } as unknown as ReturnType<typeof useAuth>);

    const { unmount } = render(
      <MemoryRouter initialEntries={['/analysis']}>
        <Routes>
          <Route element={<AppLayout />}>
             <Route path="/analysis" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const navLink = screen.getByRole('link', { name: 'Analiz' });
    expect(navLink).toHaveAttribute('href', '/analysis');
    expect(navLink).toHaveAttribute('aria-current', 'page');
    unmount();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
             <Route path="/" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const inactiveNavLink = screen.getByRole('link', { name: 'Analiz' });
    expect(inactiveNavLink).toHaveAttribute('href', '/analysis');
    expect(inactiveNavLink).not.toHaveAttribute('aria-current');
  });
});
