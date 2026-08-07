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
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[4rem] py-2 sm:py-0 flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-6 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <SecureWatchBrand className="h-6 w-auto sm:h-8 flex-shrink-0" />
              <span className="font-semibold text-lg hidden sm:block truncate">SecureWatch AI</span>
            </div>
            <div className="flex items-center sm:border-l border-space-blue sm:pl-6 gap-1 sm:gap-2">
              <NavLink
                to="/dashboard"
                aria-current={isDashboardActive ? 'page' : undefined}
                className={() =>
                  `px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    isDashboardActive
                      ? 'bg-space-blue text-white'
                      : 'text-muted-blue hover:text-white hover:bg-space-blue/50'
                  }`
                }
              >
                Panel
              </NavLink>
              <NavLink
                to="/analysis"
                aria-current={isAnalysisActive ? 'page' : undefined}
                className={() =>
                  `px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    isAnalysisActive
                      ? 'bg-space-blue text-white'
                      : 'text-muted-blue hover:text-white hover:bg-space-blue/50'
                  }`
                }
              >
                Analiz
              </NavLink>
              <NavLink
                to="/incidents"
                aria-current={isIncidentsActive ? 'page' : undefined}
                className={() =>
                  `px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    isIncidentsActive
                      ? 'bg-space-blue text-white'
                      : 'text-muted-blue hover:text-white hover:bg-space-blue/50'
                  }`
                }
              >
                Olaylar
              </NavLink>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 min-w-0 pt-2 pb-1 sm:p-0 sm:border-0 border-t border-space-blue/30 mt-1 sm:mt-0">
            <div className="flex flex-col items-start sm:items-end min-w-0">
              <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-[200px]" title={user?.username}>
                {user?.username}
              </span>
              <span className="text-xs text-cyber-cyan truncate">
                {getRoleLabel(user?.role)}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex-shrink-0 border border-space-blue hover:bg-space-blue/50 text-gray-300 hover:text-white px-3 py-1 sm:py-1.5 rounded transition-colors text-xs sm:text-sm"
              aria-label="Oturumu kapat"
            >
              Çıkış
            </button>
          </div>
        </nav>
      </header>

      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
