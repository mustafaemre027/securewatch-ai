import { Routes, Route, Navigate } from 'react-router';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './routing/ProtectedRoute';
import { PublicOnlyRoute } from './routing/PublicOnlyRoute';
import { AppLayout } from './layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { DetectionResultsPage } from './features/detections/DetectionResultsPage';
import { useAuth } from './features/auth/useAuth';

export function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/analysis/:jobId/results" element={<DetectionResultsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default App
