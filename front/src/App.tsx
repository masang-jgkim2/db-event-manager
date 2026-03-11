import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, Result, theme as antdTheme } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { useAuthStore } from './stores/useAuthStore';
import { useThemeStore } from './stores/useThemeStore';
import { useProductStore } from './stores/useProductStore';
import { useEventStore } from './stores/useEventStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductPage from './pages/ProductPage';
import EventPage from './pages/EventPage';
import QueryPage from './pages/QueryPage';
import UserPage from './pages/UserPage';
import MyDashboardPage from './pages/MyDashboardPage';
import DbConnectionPage from './pages/DbConnectionPage';
import RolePage from './pages/RolePage';
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
  const arrRoles = user?.arrRoles || [];

  if (!arrRoles.includes('admin')) {
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

// 특정 권한 기반 라우트 가드 (하나라도 보유하면 통과)
const PermissionRoute = ({
  children,
  arrRequiredPerms,
}: {
  children: React.ReactNode;
  arrRequiredPerms: string[];
}) => {
  const user = useAuthStore((state) => state.user);
  const arrPerms = user?.arrPermissions || [];
  const bHas = arrRequiredPerms.some((p) => arrPerms.includes(p));

  if (!bHas) {
    return (
      <Result
        status="403"
        title="접근 권한 없음"
        subTitle="해당 페이지에 접근할 권한이 없습니다."
      />
    );
  }

  return <>{children}</>;
};

// 이미 로그인된 사용자는 적절한 페이지로 리다이렉트
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const bIsAuthenticated = useAuthStore((state) => state.bIsAuthenticated);
  const user = useAuthStore((state) => state.user);
  const arrRoles = user?.arrRoles || [];

  if (bIsAuthenticated) {
    // 관리자는 대시보드, 그 외는 나의 대시보드
    const strRedirect = arrRoles.includes('admin') ? '/' : '/my-dashboard';
    return <Navigate to={strRedirect} replace />;
  }

  return <>{children}</>;
};

// 기본 리다이렉트 (역할에 따라 다른 페이지로)
const DefaultRedirect = () => {
  const user = useAuthStore((state) => state.user);
  const arrRoles = user?.arrRoles || [];
  const strRedirect = arrRoles.includes('admin') ? '/' : '/my-dashboard';
  return <Navigate to={strRedirect} replace />;
};

const App = () => {
  const fnVerifyToken = useAuthStore((state) => state.fnVerifyToken);
  const bIsAuthenticated = useAuthStore((state) => state.bIsAuthenticated);
  const fnFetchProducts = useProductStore((state) => state.fnFetchProducts);
  const fnFetchEvents = useEventStore((state) => state.fnFetchEvents);

  // 테마 스토어
  const fnGetIsDark = useThemeStore((state) => state.fnGetIsDark);
  const nFontSize = useThemeStore((state) => state.nFontSize);
  const bCompact = useThemeStore((state) => state.bCompact);
  const strPrimaryColor = useThemeStore((state) => state.strPrimaryColor);
  const strMode = useThemeStore((state) => state.strMode);

  // system 모드일 때 OS 변경 감지하여 리렌더 유도
  useEffect(() => {
    if (strMode !== 'system') return;
    const objMq = window.matchMedia('(prefers-color-scheme: dark)');
    const fnHandler = () => {
      // 리렌더 트리거: 스토어 액션 없이 강제 재평가를 위해 임시 상태 변경
      useThemeStore.setState((s) => ({ ...s }));
    };
    objMq.addEventListener('change', fnHandler);
    return () => objMq.removeEventListener('change', fnHandler);
  }, [strMode]);

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

  const bIsDark = fnGetIsDark();

  return (
    <ConfigProvider
      locale={koKR}
      theme={{
        algorithm: [
          bIsDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          ...(bCompact ? [antdTheme.compactAlgorithm] : []),
        ],
        token: {
          colorPrimary: strPrimaryColor,
          fontSize: nFontSize,
        },
      }}
    >
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
                <PermissionRoute arrRequiredPerms={['product.view', 'product.manage']}>
                  <ProductPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/events"
              element={
                <PermissionRoute arrRequiredPerms={['event_template.view', 'event_template.manage']}>
                  <EventPage />
                </PermissionRoute>
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
            <Route
              path="/db-connections"
              element={
                <AdminRoute>
                  <DbConnectionPage />
                </AdminRoute>
              }
            />
            <Route
              path="/roles"
              element={
                <AdminRoute>
                  <RolePage />
                </AdminRoute>
              }
            />

            {/* 공통: 나의 대시보드 + 이벤트 생성 */}
            <Route path="/my-dashboard" element={<MyDashboardPage />} />
            <Route path="/query" element={<QueryPage />} />
          </Route>

          {/* 존재하지 않는 경로 → 역할에 맞는 페이지로 */}
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
