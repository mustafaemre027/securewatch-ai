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
    <div className="min-h-screen bg-deep-dark flex flex-col text-white">
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 bg-cyber-cyan text-deep-dark px-4 py-2 rounded font-bold"
      >
        Ana içeriğe atla
      </a>

      <header className="bg-rich-navy border-b border-space-blue sticky top-0 z-40">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[4rem] py-3 sm:py-0 flex flex-wrap items-center justify-between gap-y-3 sm:gap-y-0">

          {/* 1. Logo */}
          <div className="flex items-center flex-none shrink-0 order-1">
            <SecureWatchBrand variant="dark" compact className="h-8 w-auto sm:hidden" ariaHidden />
            <SecureWatchBrand variant="dark" className="hidden sm:block h-10 w-auto" ariaHidden />
            <span className="sr-only">SecureWatch AI</span>
          </div>

          {/* 2. User & Logout (Order 2 on mobile to sit next to logo, Order 3 on desktop) */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 min-w-0 order-2 sm:order-3">
            <div className="flex flex-col items-end min-w-0">
              <span className="text-sm font-medium truncate max-w-[120px] sm:max-w-[200px]" title={user?.username}>
                {user?.username}
              </span>
              <span className="text-xs text-cyber-cyan truncate">
                {getRoleLabel(user?.role)}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 border border-space-blue hover:bg-space-blue/50 text-gray-300 hover:text-white px-3 py-1.5 rounded transition-colors text-xs sm:text-sm"
              aria-label="Oturumu kapat"
            >
              Çıkış
            </button>
          </div>

          {/* 3. Navigation Links (Order 3 on mobile -> takes full width, Order 2 on desktop) */}
          <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto order-3 sm:order-2 sm:flex-1 sm:border-l border-space-blue sm:ml-6 sm:pl-6 gap-1 sm:gap-2">
            <NavLink
              to="/dashboard"
              aria-current={isDashboardActive ? 'page' : undefined}
              className={() =>
                `flex-1 sm:flex-none text-center px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isDashboardActive
                    ? 'bg-space-blue text-white'
                    : 'text-slate-300 hover:text-white hover:bg-space-blue/50'
                }`
              }
            >
              Panel
            </NavLink>
            <NavLink
              to="/analysis"
              aria-current={isAnalysisActive ? 'page' : undefined}
              className={() =>
                `flex-1 sm:flex-none text-center px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isAnalysisActive
                    ? 'bg-space-blue text-white'
                    : 'text-slate-300 hover:text-white hover:bg-space-blue/50'
                }`
              }
            >
              Analiz
            </NavLink>
            <NavLink
              to="/incidents"
              aria-current={isIncidentsActive ? 'page' : undefined}
              className={() =>
                `flex-1 sm:flex-none text-center px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isIncidentsActive
                    ? 'bg-space-blue text-white'
                    : 'text-slate-300 hover:text-white hover:bg-space-blue/50'
                }`
              }
            >
              Olaylar
            </NavLink>
          </div>

        </nav>
      </header>

      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
