import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { useAuthStore } from './stores/useAuthStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// 인증된 사용자만 접근 가능한 라우트
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const bIsAuthenticated = useAuthStore((state) => state.bIsAuthenticated);
  const bIsLoading = useAuthStore((state) => state.bIsLoading);

  if (bIsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!bIsAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 이미 로그인된 사용자는 대시보드로 리다이렉트
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const bIsAuthenticated = useAuthStore((state) => state.bIsAuthenticated);

  if (bIsAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  const fnVerifyToken = useAuthStore((state) => state.fnVerifyToken);

  // 앱 시작 시 토큰 검증 (자동 로그인)
  useEffect(() => {
    fnVerifyToken();
  }, [fnVerifyToken]);

  return (
    <ConfigProvider locale={koKR}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          {/* 존재하지 않는 경로는 메인으로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
