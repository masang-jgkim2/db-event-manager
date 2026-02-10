import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, Result } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { useAuthStore } from './stores/useAuthStore';
import { useProductStore } from './stores/useProductStore';
import { useEventStore } from './stores/useEventStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductPage from './pages/ProductPage';
import EventPage from './pages/EventPage';
import QueryPage from './pages/QueryPage';
import UserPage from './pages/UserPage';
import MyDashboardPage from './pages/MyDashboardPage';
import DbaDashboardPage from './pages/DbaDashboardPage';
import MainLayout from './components/MainLayout';

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

// 관리자 전용 라우트 가드
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);

  if (user?.strRole !== 'admin') {
    return (
      <Result
        status="403"
        title="접근 권한 없음"
        subTitle="관리자만 접근할 수 있는 페이지입니다."
      />
    );
  }

  return <>{children}</>;
};

// 이미 로그인된 사용자는 적절한 페이지로 리다이렉트
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const bIsAuthenticated = useAuthStore((state) => state.bIsAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (bIsAuthenticated) {
    // 역할별 기본 페이지
    let strRedirect = '/query';
    if (user?.strRole === 'admin') strRedirect = '/';
    else if (user?.strRole === 'dba') strRedirect = '/dba-dashboard';
    else strRedirect = '/my-dashboard';
    return <Navigate to={strRedirect} replace />;
  }

  return <>{children}</>;
};

// 기본 리다이렉트 (역할에 따라 다른 페이지로)
const DefaultRedirect = () => {
  const user = useAuthStore((state) => state.user);
  let strRedirect = '/my-dashboard';
  if (user?.strRole === 'admin') strRedirect = '/';
  else if (user?.strRole === 'dba') strRedirect = '/dba-dashboard';
  return <Navigate to={strRedirect} replace />;
};

const App = () => {
  const fnVerifyToken = useAuthStore((state) => state.fnVerifyToken);
  const bIsAuthenticated = useAuthStore((state) => state.bIsAuthenticated);
  const fnFetchProducts = useProductStore((state) => state.fnFetchProducts);
  const fnFetchEvents = useEventStore((state) => state.fnFetchEvents);

  // 앱 시작 시 토큰 검증 (자동 로그인)
  useEffect(() => {
    fnVerifyToken();
  }, [fnVerifyToken]);

  // 인증 완료 후 프로덕트/이벤트 데이터 서버에서 로드
  useEffect(() => {
    if (bIsAuthenticated) {
      fnFetchProducts();
      fnFetchEvents();
    }
  }, [bIsAuthenticated, fnFetchProducts, fnFetchEvents]);

  return (
    <ConfigProvider locale={koKR}>
      <BrowserRouter>
        <Routes>
          {/* 로그인 (비인증 전용) */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          {/* 메인 레이아웃 (인증 필수) */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* 관리자 전용 페이지 */}
            <Route
              path="/"
              element={
                <AdminRoute>
                  <DashboardPage />
                </AdminRoute>
              }
            />
            <Route
              path="/products"
              element={
                <AdminRoute>
                  <ProductPage />
                </AdminRoute>
              }
            />
            <Route
              path="/events"
              element={
                <AdminRoute>
                  <EventPage />
                </AdminRoute>
              }
            />
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <UserPage />
                </AdminRoute>
              }
            />

            {/* 운영자/관리자 공통 */}
            <Route path="/my-dashboard" element={<MyDashboardPage />} />
            <Route path="/query" element={<QueryPage />} />

            {/* DBA 전용 */}
            <Route path="/dba-dashboard" element={<DbaDashboardPage />} />
          </Route>

          {/* 존재하지 않는 경로 → 역할에 맞는 페이지로 */}
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
