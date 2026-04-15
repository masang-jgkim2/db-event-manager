import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Layout, Menu, Typography, Button, Avatar, Dropdown, Space, Tag, Badge, theme as antdTheme } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  CodeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  DatabaseOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  WifiOutlined,
  SettingOutlined,
  RocketOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useEventStream } from '../hooks/useEventStream';
import { useThemeStore, N_SIDER_MIN } from '../stores/useThemeStore';
import { useDesignSystem } from '../styles/DesignSystemContext';
import SettingsDrawer from './SettingsDrawer';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 역할 표시 라벨
const objRoleLabel: Record<string, { strText: string; strColor: string }> = {
  admin: { strText: '관리자', strColor: '#f50' },
  game_manager: { strText: 'GM', strColor: '#2db7f5' },
  game_designer: { strText: '기획자', strColor: '#87d068' },
  dba: { strText: 'DBA', strColor: '#722ed1' },
};

/** 사이드바 메뉴 그룹 라벨 (커스텀 ReactNode일 때도 디자인 토큰 색·타이포 적용) */
const fnRenderMenuGroupLabel = (
  nodeIcon: React.ReactNode,
  strLabel: string,
  objMg: {
    strColor: string;
    nFontSize: number;
    nFontWeight: number;
    strLetterSpacing: string;
    strTextTransform: string;
  },
) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: objMg.strColor,
      fontSize: objMg.nFontSize,
      fontWeight: objMg.nFontWeight,
      letterSpacing: objMg.strLetterSpacing,
      textTransform: objMg.strTextTransform as React.CSSProperties['textTransform'],
    }}
  >
    {nodeIcon} {strLabel}
  </span>
);

const MainLayout = () => {
  const [bCollapsed, setBCollapsed] = useState(false);
  const [bSettingsOpen, setBSettingsOpen] = useState(false);
  /** 사이드바 폭 드래그 중 — ref만 쓰면 margin/width transition 이 먹지 않아 state로 동기화 */
  const [bIsResizingSider, setBIsResizingSider] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const fnLogout = useAuthStore((state) => state.fnLogout);

  // SSE 연결 - 레이아웃 마운트 시 시작, 앱 전체 유효
  const { bConnected } = useEventStream();

  // 테마 스토어
  const nSiderWidth = useThemeStore((s) => s.nSiderWidth);
  const fnSetSiderWidth = useThemeStore((s) => s.fnSetSiderWidth);
  const { token } = antdTheme.useToken();

  // 디자인 시스템 토큰
  const ds = useDesignSystem();

  // 사이드바 드래그 리사이즈
  const bDragging = useRef(false);
  const nDragStartX = useRef(0);
  const nDragStartWidth = useRef(nSiderWidth);
  const bCollapsedRef = useRef(bCollapsed);
  bCollapsedRef.current = bCollapsed;

  const fnOnDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    bDragging.current = true;
    setBIsResizingSider(true);
    nDragStartX.current = e.clientX;
    nDragStartWidth.current = nSiderWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [nSiderWidth]);

  useEffect(() => {
    const fnEndDragChrome = () => {
      bDragging.current = false;
      setBIsResizingSider(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const fnOnMouseMove = (e: MouseEvent) => {
      if (!bDragging.current) return;
      if (bCollapsedRef.current) return;

      const nDelta = e.clientX - nDragStartX.current;
      const nRaw = nDragStartWidth.current + nDelta;

      // 최소 폭보다 더 줄이려 하면 접기 버튼과 동일하게 아이콘만 표시
      if (nRaw < N_SIDER_MIN) {
        setBCollapsed(true);
        fnEndDragChrome();
        return;
      }

      fnSetSiderWidth(nRaw);
    };

    const fnOnMouseUp = () => {
      if (!bDragging.current) return;
      fnEndDragChrome();
    };

    window.addEventListener('mousemove', fnOnMouseMove);
    window.addEventListener('mouseup', fnOnMouseUp);
    return () => {
      window.removeEventListener('mousemove', fnOnMouseMove);
      window.removeEventListener('mouseup', fnOnMouseUp);
    };
  }, [fnSetSiderWidth]);

  const arrPermissions = user?.arrPermissions || [];
  const arrRoles = user?.arrRoles || []; // UI 표시용(첫 역할 라벨), 접근 제어는 권한만 사용

  // 권한 보유 여부 헬퍼 (역할 대신 권한만 사용)
  const fnHasPerm = (strPerm: string) => arrPermissions.includes(strPerm);

  const objMg = ds.objMenuGroup;

  // 권한 기반 사이드바 메뉴 동적 생성
  const arrMenuItems = useMemo(() => {
    const arrResult = [];

    // ── 이벤트 그룹 ──────────────────────────────────
    const arrEventChildren = [];

    // 대시보드: dashboard.view 권한
    if (fnHasPerm('dashboard.view')) {
      arrEventChildren.push({ key: '/', icon: <DashboardOutlined />, label: '대시보드' });
    }
    // 프로덕트: 보기 권한 있어야 메뉴 노출
    if (fnHasPerm('product.view')) {
      arrEventChildren.push({ key: '/products', icon: <AppstoreOutlined />, label: '프로덕트' });
    }
    // 쿼리 템플릿: 보기 권한 있어야 메뉴 노출
    if (fnHasPerm('event_template.view')) {
      arrEventChildren.push({ key: '/events', icon: <CalendarOutlined />, label: '쿼리 템플릿' });
    }
    // DB 접속 정보: 보기 권한 있어야 메뉴 노출
    if (fnHasPerm('db_connection.view') || fnHasPerm('db.manage')) {
      arrEventChildren.push({ key: '/db-connections', icon: <DatabaseOutlined />, label: 'DB 접속 정보' });
    }

    if (arrEventChildren.length > 0) {
      arrResult.push({
        key: 'event-group',
        label: fnRenderMenuGroupLabel(<CalendarOutlined />, '이벤트', objMg),
        type: 'group' as const,
        children: arrEventChildren,
      });
    }

    // ── 사용자 그룹: 사용자 보기 또는 역할 보기 권한 있어야 메뉴 노출
    const arrUserGroupChildren = [];
    if (fnHasPerm('user.view')) {
      arrUserGroupChildren.push({ key: '/users', icon: <TeamOutlined />, label: '사용자' });
    }
    if (fnHasPerm('role.view')) {
      arrUserGroupChildren.push({ key: '/roles', icon: <SafetyCertificateOutlined />, label: '역할 권한' });
    }
    if (fnHasPerm('activity.view')) {
      arrUserGroupChildren.push({ key: '/activity', icon: <HistoryOutlined />, label: '활동' });
    }
    if (arrUserGroupChildren.length > 0) {
      arrResult.push({
        key: 'user-group',
        label: fnRenderMenuGroupLabel(<TeamOutlined />, '사용자', objMg),
        type: 'group' as const,
        children: arrUserGroupChildren,
      });
    }

    // ── 운영 그룹 ─────────────────────────────────────
    const arrOpChildren: { key: string; icon: React.ReactNode; label: string }[] = [];
    if (fnHasPerm('my_dashboard.view')) {
      arrOpChildren.push({ key: '/my-dashboard', icon: <DashboardOutlined />, label: '나의 대시보드' });
    }
    if (fnHasPerm('instance.view') || fnHasPerm('instance.create')) {
      arrOpChildren.push({ key: '/query', icon: <CodeOutlined />, label: '이벤트 생성' });
    }

    arrResult.push({
      key: 'operation-group',
      label: fnRenderMenuGroupLabel(<RocketOutlined />, '운영', objMg),
      type: 'group' as const,
      children: arrOpChildren,
    });

    return arrResult;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrPermissions, objMg.strColor, objMg.nFontSize, objMg.nFontWeight, objMg.strLetterSpacing, objMg.strTextTransform]);

  // 사이드바 메뉴 클릭 처리
  const fnHandleMenuClick = (info: { key: string }) => {
    navigate(info.key);
  };

  // 사용자 드롭다운 메뉴
  const arrUserMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      danger: true,
      onClick: () => {
        void fnLogout();
      },
    },
  ];

  // 첫 번째 역할을 대표로 표시
  const strFirstRole = arrRoles[0] || '';
  const objRole = objRoleLabel[strFirstRole] || { strText: strFirstRole, strColor: '#999' };

  // 사이드 폭에 맞춰 로고 글자 크기 조절(좁게 당기면 자동으로 줄어듦)
  const nLogoFontPx = bCollapsed
    ? ds.objSider.nLogoFontSize
    : Math.min(ds.objSider.nLogoFontSize, Math.max(11, Math.round(nSiderWidth * 0.082)));

  const strSiderTransition = bIsResizingSider
    ? 'none'
    : 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 사이드바 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={bCollapsed}
        width={nSiderWidth}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
          background: ds.objSider.strBackground,
          transition: strSiderTransition,
        }}
      >
        {/* 로고 영역 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: ds.objSider.strLogoBackground,
            borderBottom: `1px solid ${ds.objSider.strLogoBorder}`,
          }}
        >
          <DatabaseOutlined style={{ fontSize: ds.objTypo.nLg + 8, color: token.colorPrimary }} />
          {!bCollapsed && (
            <span
              style={{
                fontSize: nLogoFontPx,
                fontWeight: ds.objSider.nLogoFontWeight,
                marginLeft: ds.objSpacing.nSm,
                whiteSpace: 'nowrap',
                color: ds.objSider.strLogoText,
                maxWidth: Math.max(0, nSiderWidth - 56),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Database Query Process Manager
            </span>
          )}
        </div>

        {/* 네비게이션 메뉴 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={arrMenuItems}
          onClick={fnHandleMenuClick}
          style={{ borderRight: 0, marginTop: 8 }}
        />

        {/* 드래그 리사이즈 핸들 — collapsed 시 숨김 */}
        {!bCollapsed && (
          <div
            onMouseDown={fnOnDragStart}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 5,
              height: '100%',
              cursor: 'col-resize',
              zIndex: 20,
              // hover 시 primary 컬러로 하이라이트
              background: 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = ds.objSider.strResizeHandle; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          />
        )}
      </Sider>

      {/* 메인 영역 — 드래그 중에는 transition 제거로 버벅임 방지 */}
      <Layout
        style={{
          marginLeft: bCollapsed ? 80 : nSiderWidth,
          transition: bIsResizingSider
            ? 'none'
            : 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* 상단 헤더 */}
        <Header
          style={{
            padding: `0 ${ds.objSpacing.nXl}px`,
            background: ds.objHeader.strBackground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${ds.objHeader.strBorder}`,
            position: 'sticky',
            top: 0,
            zIndex: 9,
          }}
        >
          {/* 사이드바 접기/펼치기 버튼 */}
          <Button
            type="text"
            icon={bCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setBCollapsed(!bCollapsed)}
            style={{ fontSize: 18 }}
          />

          {/* 실시간 연결 상태 + 사용자 정보 + 설정 버튼 */}
          <Space>
            <Badge
              status={bConnected ? 'success' : 'default'}
              title={bConnected ? '실시간 연결됨' : '연결 중...'}
            >
              <WifiOutlined
                style={{
                  fontSize: 16,
                  color: bConnected ? '#52c41a' : token.colorTextDisabled,
                }}
              />
            </Badge>
            <Dropdown menu={{ items: arrUserMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  icon={<UserOutlined />}
                  style={{ background: objRole.strColor }}
                />
                <Text strong>{user?.strDisplayName}</Text>
                <Tag color={objRole.strColor}>{objRole.strText}</Tag>
              </Space>
            </Dropdown>
            {/* UI 설정 버튼 */}
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => setBSettingsOpen(true)}
              title="UI 설정"
              style={{ fontSize: 16 }}
            />
          </Space>
        </Header>

        {/* 콘텐츠 영역 */}
        <Content style={{ margin: ds.objSpacing.nXl, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>

      {/* UI 설정 드로어 */}
      <SettingsDrawer
        bOpen={bSettingsOpen}
        fnOnClose={() => setBSettingsOpen(false)}
      />
    </Layout>
  );
};

export default MainLayout;
