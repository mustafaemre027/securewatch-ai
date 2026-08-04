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
  });
});

import { App } from '../App';

vi.mock('../features/detections/DetectionResultsPage', () => ({
  DetectionResultsPage: vi.fn(() => <div data-testid="mock-detection-results">Detection Results Page Mock</div>)
}));
vi.mock('../features/analysis/AnalysisPage', () => ({
  AnalysisPage: vi.fn(() => <div data-testid="mock-analysis-page">Analysis Page Mock</div>)
}));
vi.mock('../pages/HomePage', () => ({
  HomePage: vi.fn(() => <div data-testid="mock-home-page">Home Page Mock</div>)
}));
vi.mock('../features/auth/LoginPage', () => ({
  LoginPage: vi.fn(() => <div data-testid="mock-login-page">Login Page Mock</div>)
}));
vi.mock('../features/incidents/components/IncidentList', () => ({
  IncidentList: vi.fn(() => <div data-testid="mock-incident-list">Incident List Mock</div>)
}));
vi.mock('../features/incidents/IncidentDetailPage', () => ({
  IncidentDetailPage: vi.fn(() => <div data-testid="mock-incident-detail-page">Incident Detail Page Mock</div>)
}));

describe('App Route Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderApp = (initialRoute: string) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    );
  };

  it('1. Authentication bulunmayan kullanıcı /analysis/123/results adresinden güvenli login akışına yönlendirilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    renderApp('/analysis/123/results');
    expect(screen.getByTestId('mock-login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-detection-results')).not.toBeInTheDocument();
  });

  it('2. Authenticated ANALYST, /analysis/123/results route’unu açabilir ve uygulama kabuğu içinde render edilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ANALYST', username: 'analyst1' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/analysis/123/results');

    expect(screen.getByTestId('mock-detection-results')).toBeInTheDocument();
    expect(document.querySelector('main')).toBeInTheDocument();
  });

  it('3. Authenticated ADMIN, /analysis/123/results route’unu açabilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ADMIN', username: 'admin1' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/analysis/456/results');
    expect(screen.getByTestId('mock-detection-results')).toBeInTheDocument();
  });

  it('4. Route URL’sinde token veya kullanıcı bilgisi bulunmaz ve yeni frontend role engeli oluşmaz.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ANALYST', username: 'analyst1' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/analysis/789/results');
    expect(screen.getByTestId('mock-detection-results')).toBeInTheDocument();
  });

  it('5. Mevcut /analysis route’u çalışmaya devam eder.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ANALYST', username: 'analyst1' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/analysis');
    expect(screen.getByTestId('mock-analysis-page')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-detection-results')).not.toBeInTheDocument();
  });

  it('1. Unauthenticated kullanıcı /incidents rotasından login’e yönlendirilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    renderApp('/incidents');
    expect(screen.getByTestId('mock-login-page')).toBeInTheDocument();
  });

  it('2. Unauthenticated kullanıcı /incidents/12 rotasından login’e yönlendirilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    renderApp('/incidents/12');
    expect(screen.getByTestId('mock-login-page')).toBeInTheDocument();
  });

  it('3. Authenticated ANALYST /incidents listesini açabilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ANALYST', username: 'analyst1' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/incidents');
    expect(screen.getByTestId('mock-incident-list')).toBeInTheDocument();
  });

  it('4. Authenticated ADMIN /incidents listesini açabilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ADMIN', username: 'admin1' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/incidents');
    expect(screen.getByTestId('mock-incident-list')).toBeInTheDocument();
  });

  it('5. Authenticated ANALYST geçerli detail rotasını açabilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ANALYST', username: 'analyst1' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/incidents/12');
    expect(screen.getByTestId('mock-incident-detail-page')).toBeInTheDocument();
  });

  it('6. Authenticated ADMIN geçerli detail rotasını açabilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ADMIN', username: 'admin1' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/incidents/12');
    expect(screen.getByTestId('mock-incident-detail-page')).toBeInTheDocument();
  });

  it('7. Incident rotaları AppLayout içindeki main alanında render edilir.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ANALYST', username: 'a' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/incidents/12');
    expect(screen.getByTestId('mock-incident-detail-page')).toBeInTheDocument();
    expect(document.querySelector('main')).toBeInTheDocument();
  });

  it('10. Bilinmeyen URL fallback davranışı korunur.', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ANALYST', username: 'a' }
    } as unknown as ReturnType<typeof useAuth>);
    renderApp('/unknown-route-123');
    expect(screen.getByTestId('mock-home-page')).toBeInTheDocument();
  });
});
