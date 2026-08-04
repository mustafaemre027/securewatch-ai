import { Outlet, useNavigate, NavLink, useLocation } from 'react-router';
import { useAuth } from '../features/auth/useAuth';
import { SecureWatchBrand } from '../components/brand/SecureWatchBrand';

export function AppLayout() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <div className="flex items-center gap-3">
              <SecureWatchBrand className="h-8 w-auto flex-shrink-0" />
              <span className="font-semibold text-lg hidden sm:block truncate">SecureWatch AI</span>
            </div>
            <div className="flex items-center sm:border-l border-space-blue sm:pl-6 gap-2">
              <NavLink
                to="/analysis"
                aria-current={isAnalysisActive ? 'page' : undefined}
                className={() =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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

          <div className="flex items-center gap-4 min-w-0">
            <div className="flex flex-col items-end min-w-0">
              <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-[200px]" title={user?.username}>
                {user?.username}
              </span>
              <span className="text-xs text-cyber-cyan truncate">
                {getRoleLabel(user?.role)}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex-shrink-0 border border-space-blue hover:bg-space-blue/50 text-gray-300 hover:text-white px-3 py-1.5 rounded transition-colors text-sm"
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
