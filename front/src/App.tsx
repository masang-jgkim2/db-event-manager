import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, Result, theme as antdTheme } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { useAuthStore } from './stores/useAuthStore';
import { useThemeStore } from './stores/useThemeStore';
import { fnBuildDesignSystem } from './styles/design-system';
import { DesignSystemContext } from './styles/DesignSystemContext';
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

// 권한 기반 라우트 가드 (특정 권한 필요 시 PermissionRoute 사용, 역할은 사용하지 않음)

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
    const arrPermissions = user?.arrPermissions || [];
    const bHasDashboard = arrPermissions.includes('dashboard.view');
    const bHasMyDashboard = arrPermissions.includes('my_dashboard.view');
    const bHasQuery = arrPermissions.includes('instance.view') || arrPermissions.includes('instance.create');
    const strRedirect = bHasDashboard ? '/' : (bHasMyDashboard ? '/my-dashboard' : (bHasQuery ? '/query' : '/my-dashboard'));
    return <Navigate to={strRedirect} replace />;
  }

  return <>{children}</>;
};

// 기본 리다이렉트 (권한에 따라, 역할 미사용)
const DefaultRedirect = () => {
  const user = useAuthStore((state) => state.user);
  const arrPermissions = user?.arrPermissions || [];
  const bHasDashboard = arrPermissions.includes('dashboard.view');
  const bHasMyDashboard = arrPermissions.includes('my_dashboard.view');
  const bHasQuery = arrPermissions.includes('instance.view') || arrPermissions.includes('instance.create');
  const strRedirect = bHasDashboard ? '/' : (bHasMyDashboard ? '/my-dashboard' : (bHasQuery ? '/query' : '/my-dashboard'));
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

  // 디자인 시스템 전체 토큰 생성
  const objDs = fnBuildDesignSystem(strPrimaryColor, bIsDark, nFontSize);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { token: dsToken, components: dsComponents } = objDs.antdThemeConfig as any;

  return (
    <DesignSystemContext.Provider value={objDs}>
    <ConfigProvider
      locale={koKR}
      theme={{
        algorithm: [
          bIsDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          ...(bCompact ? [antdTheme.compactAlgorithm] : []),
        ],
        token:      dsToken,
        components: dsComponents,
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
            {/* 대시보드: dashboard.view(확장으로 admin 부여) 또는 admin 역할 */}
            <Route
              path="/"
              element={
                <PermissionRoute arrRequiredPerms={['dashboard.view']}>
                  <DashboardPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/products"
              element={
                <PermissionRoute arrRequiredPerms={['product.view']}>
                  <ProductPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/events"
              element={
                <PermissionRoute arrRequiredPerms={['event_template.view']}>
                  <EventPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/users"
              element={
                <PermissionRoute arrRequiredPerms={['user.view']}>
                  <UserPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/db-connections"
              element={
                <PermissionRoute arrRequiredPerms={['db_connection.view', 'db.manage']}>
                  <DbConnectionPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/roles"
              element={
                <PermissionRoute arrRequiredPerms={['role.view']}>
                  <RolePage />
                </PermissionRoute>
              }
            />

            {/* 나의 대시보드: my_dashboard.view 필요. 이벤트 생성: instance.view 또는 instance.create 필요 */}
            <Route
              path="/my-dashboard"
              element={
                <PermissionRoute arrRequiredPerms={['my_dashboard.view']}>
                  <MyDashboardPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/query"
              element={
                <PermissionRoute arrRequiredPerms={['instance.view', 'instance.create']}>
                  <QueryPage />
                </PermissionRoute>
              }
            />
          </Route>

          {/* 존재하지 않는 경로 → 역할에 맞는 페이지로 */}
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
    </DesignSystemContext.Provider>
  );
};

export default App;
