import { Outlet, useNavigate, NavLink, useLocation } from 'react-router';
import { useAuth } from '../features/auth/useAuth';
import { SecureWatchBrand } from '../components/brand/SecureWatchBrand';

export function AppLayout() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboardActive = location.pathname.startsWith('/dashboard');
  const isAnalysisActive = location.pathname.startsWith('/analysis');
  const isIncidentsActive = location.pathname.startsWith('/incidents');

  const handleLogout = () => {
    logoutUser();
    navigate('/login', { replace: true });
  };

  const getRoleLabel = (role: string | undefined) => {
    if (role === 'ADMIN') return 'Yönetici';
    if (role === 'ANALYST') return 'Güvenlik Analisti';
    return role || 'Kullanıcı';
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col text-text-primary">
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 bg-accent-primary text-deep-dark px-4 py-2 rounded font-bold"
      >
        Ana içeriğe atla
      </a>

      {/* HEADER SHELL */}
      <header className="bg-bg-elevated border-b border-border-subtle sticky top-0 z-40 shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto sm:h-16 py-3 sm:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-4 sm:gap-y-0">

          {/* 1. BRAND ZONE */}
          <div className="flex items-center flex-none shrink-0 order-1">
            <SecureWatchBrand variant="dark" compact className="h-8 w-auto sm:hidden" ariaHidden />
            <SecureWatchBrand variant="dark" className="hidden sm:block h-9 w-auto" ariaHidden />
            <span className="sr-only">SecureWatch AI</span>
          </div>

          {/* 2. USER IDENTITY BLOCK & LOGOUT (Mobile: Order 2, Desktop: Order 3) */}
          <div className="flex items-center justify-end gap-4 min-w-0 order-2 sm:order-3 shrink-0">
            <div className="flex flex-col items-end min-w-0">
              <span className="text-sm font-medium text-text-primary truncate max-w-[120px] sm:max-w-[200px]" title={user?.username}>
                {user?.username}
              </span>
              <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-secondary truncate">
                {getRoleLabel(user?.role)}
              </span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-8 bg-border-default"></div>

            <button
              onClick={handleLogout}
              className="sw-button-secondary py-1.5 px-3 text-xs sm:text-sm whitespace-nowrap"
              aria-label="Oturumu kapat"
            >
              Çıkış
            </button>
          </div>

          {/* 3. NAVIGATION - PREMIUM COMMAND GROUP (Mobile: Order 3, takes full width, grid-cols-3. Desktop: Order 2) */}
          <div className="w-full sm:w-auto order-3 sm:order-2 sm:flex-1 sm:ml-8 sm:mr-4">
            <div className="grid grid-cols-3 sm:flex items-center sm:justify-start gap-1 p-1 rounded-lg bg-surface-base border border-border-subtle">
              <NavLink
                to="/dashboard"
                aria-current={isDashboardActive ? 'page' : undefined}
                className={() =>
                  `text-center px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isDashboardActive
                      ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] font-medium shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover font-medium'
                  }`
                }
              >
                Panel
              </NavLink>
              <NavLink
                to="/analysis"
                aria-current={isAnalysisActive ? 'page' : undefined}
                className={() =>
                  `text-center px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isAnalysisActive
                      ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] font-medium shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover font-medium'
                  }`
                }
              >
                Analiz
              </NavLink>
              <NavLink
                to="/incidents"
                aria-current={isIncidentsActive ? 'page' : undefined}
                className={() =>
                  `text-center px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isIncidentsActive
                      ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] font-medium shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover font-medium'
                  }`
                }
              >
                Olaylar
              </NavLink>
            </div>
          </div>

        </nav>
      </header>

      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
