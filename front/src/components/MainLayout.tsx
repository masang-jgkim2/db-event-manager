import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Layout, Menu, Typography, Button, Avatar, Dropdown, Space, Tag, Badge, Tooltip, theme as antdTheme } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  CodeOutlined,
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
import {
  useThemeStore,
  N_SIDER_MIN,
  N_SIDER_DEFAULT,
  N_SIDER_COLLAPSED_WIDTH,
  N_SIDER_EXPAND_RELEASE,
  fnClampSiderWidth,
} from '../stores/useThemeStore';
import { useDesignSystem } from '../styles/DesignSystemContext';
import SettingsDrawer from './SettingsDrawer';
import NotificationBellDropdown from './NotificationBellDropdown';
import type { TPermission } from '../types';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 역할 표시 라벨
const objRoleLabel: Record<string, { strText: string; strColor: string }> = {
  admin: { strText: '관리자', strColor: '#f50' },
  game_manager: { strText: 'GM', strColor: '#2db7f5' },
  game_designer: { strText: '기획자', strColor: '#87d068' },
  dba: { strText: 'DBA', strColor: '#722ed1' },
  guest: { strText: 'GUEST', strColor: '#faad14' },
};

function fnResolveHeaderUserDisplay(
  strDisplayName: string | undefined,
  strUserId: string | undefined,
  strRoleCode: string,
) {
  const strHeaderDisplayName = strDisplayName?.trim() ?? '';
  const strRoleNorm = strRoleCode.trim();
  // 표시명과 역할 한글 라벨이 같으면 태그를 숨기던 기존 동작 → 역할 코드는 항상 구분 가능
  const bShowRoleTag =
    Boolean(strRoleNorm) && strRoleNorm.toLowerCase() !== strHeaderDisplayName.toLowerCase();
  const strUserHoverHint =
    !bShowRoleTag && strUserId && strUserId.toLowerCase() !== strHeaderDisplayName.toLowerCase()
      ? `아이디: ${strUserId}${strRoleNorm ? ` · 역할: ${strRoleNorm}` : ''}`
      : undefined;
  return { strHeaderDisplayName, bShowRoleTag, strUserHoverHint };
}

type TMenuGroupStyle = {
  strColor: string;
  nFontSize: number;
  nFontWeight: number;
  strLetterSpacing: string;
  strTextTransform: string;
};

/** SubMenu 펼침 시 제목 텍스트 — 아이콘은 Menu `icon` prop (접힘 시 아이콘만 표시) */
const fnRenderMenuSubmenuLabel = (strLabel: string, objMg: TMenuGroupStyle) => (
  <span
    className="dqpm-menu-submenu-label"
    style={{
      color: objMg.strColor,
      fontSize: objMg.nFontSize,
      fontWeight: objMg.nFontWeight,
      letterSpacing: objMg.strLetterSpacing,
      textTransform: objMg.strTextTransform as React.CSSProperties['textTransform'],
    }}
  >
    {strLabel}
  </span>
);

const MainLayout = () => {
  const [bCollapsed, setBCollapsed] = useState(false);
  const [bSettingsOpen, setBSettingsOpen] = useState(false);
  /** 사이드바 폭 드래그 중 — ref만 쓰면 margin/width transition 이 먹지 않아 state로 동기화 */
  const [bIsResizingSider, setBIsResizingSider] = useState(false);
  /** 인라인 SubMenu 펼침 키 (group 은 접기 불가 → children = SubMenu) */
  const [arrOpenKeys, setArrOpenKeys] = useState<string[]>([]);
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
  /** 접힌 상태에서 드래그로 펼치는 중 — nRaw<최소 시 즉시 재접힘 방지 */
  const bExpandDragRef = useRef(false);
  bCollapsedRef.current = bCollapsed;

  const fnOnDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    bDragging.current = true;
    bExpandDragRef.current = false;
    setBIsResizingSider(true);
    nDragStartX.current = e.clientX;
    nDragStartWidth.current = bCollapsedRef.current
      ? N_SIDER_COLLAPSED_WIDTH
      : useThemeStore.getState().nSiderWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const fnOnResizeHandleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (bCollapsedRef.current) {
        setBCollapsed(false);
        bCollapsedRef.current = false;
      }
      fnSetSiderWidth(N_SIDER_DEFAULT);
    },
    [fnSetSiderWidth],
  );

  useEffect(() => {
    const fnEndDragChrome = () => {
      bDragging.current = false;
      bExpandDragRef.current = false;
      setBIsResizingSider(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const fnOnMouseMove = (e: MouseEvent) => {
      if (!bDragging.current) return;

      const nDelta = e.clientX - nDragStartX.current;

      // 접힌(아이콘) 상태에서 오른쪽으로 당기면 펼침 — 80px부터 커서를 따라감(160으로 점프하지 않음)
      if (bCollapsedRef.current) {
        if (nDelta <= 2) return;
        setBCollapsed(false);
        bCollapsedRef.current = false;
        bExpandDragRef.current = true;
        nDragStartWidth.current = N_SIDER_COLLAPSED_WIDTH;
        nDragStartX.current = e.clientX;
      }

      const nRaw = nDragStartWidth.current + (e.clientX - nDragStartX.current);

      if (bExpandDragRef.current) {
        fnSetSiderWidth(fnClampSiderWidth(nRaw, false), false);
        return;
      }

      const nClamped = fnClampSiderWidth(nRaw, false);

      // 최소 폭보다 더 줄이려 하면 아이콘만 표시
      if (nClamped < N_SIDER_MIN) {
        setBCollapsed(true);
        bCollapsedRef.current = true;
        fnEndDragChrome();
        return;
      }

      fnSetSiderWidth(nClamped, true);
    };

    const fnOnMouseUp = () => {
      if (!bDragging.current) return;
      const bWasExpandDrag = bExpandDragRef.current;
      fnEndDragChrome();
      if (!bWasExpandDrag) return;
      const nW = useThemeStore.getState().nSiderWidth;
      if (nW < N_SIDER_EXPAND_RELEASE) {
        setBCollapsed(true);
        bCollapsedRef.current = true;
        return;
      }
      if (nW < N_SIDER_MIN) {
        fnSetSiderWidth(N_SIDER_MIN, true);
      }
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
  const fnHasPerm = (strPerm: TPermission) => arrPermissions.includes(strPerm);

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
    // DB 접속 정보: 보기 권한 있어야 메뉴 노출 (쿼리 템플릿보다 먼저 — 접속 설정 후 템플릿)
    if (fnHasPerm('db_connection.view') || fnHasPerm('db.manage')) {
      arrEventChildren.push({ key: '/db-connections', icon: <DatabaseOutlined />, label: 'DB 접속 정보' });
    }
    // 쿼리 템플릿: 보기 권한 있어야 메뉴 노출
    if (fnHasPerm('event_template.view')) {
      arrEventChildren.push({ key: '/events', icon: <CalendarOutlined />, label: '쿼리 템플릿' });
    }

    if (arrEventChildren.length > 0) {
      arrResult.push({
        key: 'event-group',
        icon: <CalendarOutlined />,
        label: fnRenderMenuSubmenuLabel('이벤트', objMg),
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
        icon: <TeamOutlined />,
        label: fnRenderMenuSubmenuLabel('사용자', objMg),
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

    if (arrOpChildren.length > 0) {
      arrResult.push({
        key: 'operation-group',
        icon: <RocketOutlined />,
        label: fnRenderMenuSubmenuLabel('운영', objMg),
        children: arrOpChildren,
      });
    }

    return arrResult;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrPermissions, objMg.strColor, objMg.nFontSize, objMg.nFontWeight, objMg.strLetterSpacing, objMg.strTextTransform]);

  const arrSubmenuKeys = useMemo(
    () =>
      arrMenuItems
        .filter((obj) => obj != null && 'children' in obj && Array.isArray(obj.children) && obj.children.length > 0)
        .map((obj) => String(obj!.key)),
    [arrMenuItems],
  );

  // 권한에 따라 메뉴가 늘면 새 SubMenu는 기본 펼침
  useEffect(() => {
    setArrOpenKeys((prev) => [...new Set([...prev, ...arrSubmenuKeys])]);
  }, [arrSubmenuKeys]);

  // 현재 경로가 속한 그룹은 접혀 있어도 펼침
  useEffect(() => {
    const strPath = location.pathname;
    const objParent = arrMenuItems.find(
      (obj) =>
        obj != null
        && 'children' in obj
        && Array.isArray(obj.children)
        && obj.children.some((ch) => ch != null && 'key' in ch && ch.key === strPath),
    );
    if (objParent?.key == null) return;
    const strKey = String(objParent.key);
    setArrOpenKeys((prev) => (prev.includes(strKey) ? prev : [...prev, strKey]));
  }, [location.pathname, arrMenuItems]);

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

  // 첫 번째 역할을 대표로 표시 (표시명은 로그인·토큰 검증 시 mapRoleDisplayNames 반영)
  const strFirstRole = arrRoles[0] || '';
  const strRoleDisplayName = user?.mapRoleDisplayNames?.[strFirstRole];
  const objRoleFallback = objRoleLabel[strFirstRole] || { strText: strFirstRole, strColor: '#999' };
  const objRole = {
    strText: strRoleDisplayName ?? objRoleFallback.strText,
    strColor: objRoleFallback.strColor,
  };

  const { strHeaderDisplayName, bShowRoleTag, strUserHoverHint } = useMemo(
    () => fnResolveHeaderUserDisplay(user?.strDisplayName, user?.strUserId, strFirstRole),
    [user?.strDisplayName, user?.strUserId, strFirstRole],
  );

  // 사이드 폭에 맞춰 로고 글자 크기 조절(좁게 당기면 자동으로 줄어듦)
  const nLogoFontPx = bCollapsed
    ? ds.objSider.nLogoFontSize
    : Math.min(ds.objSider.nLogoFontSize, Math.max(11, Math.round(nSiderWidth * 0.082)));

  const strSiderTransition = bIsResizingSider
    ? 'none'
    : 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)';

  const { objShell } = ds;

  return (
    <Layout style={{ minHeight: '100vh', background: objShell.strContentBg }}>
      {/* 사이드바 — Cursor 스타일 밝은/다크 네비 */}
      <Sider
        className="dqpm-layout-sider"
        trigger={null}
        collapsible
        collapsed={bCollapsed}
        collapsedWidth={N_SIDER_COLLAPSED_WIDTH}
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
          borderRight: `1px solid ${objShell.strSiderBorder}`,
          transition: strSiderTransition,
        }}
      >
        {/* 로고 영역 */}
        <div
          className="dqpm-layout-sider-logo"
          style={{
            height: objShell.nLogoHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: ds.objSider.strLogoBackground,
            borderBottom: `1px solid ${ds.objSider.strLogoBorder}`,
            flexShrink: 0,
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
          theme={objShell.strMenuTheme}
          mode="inline"
          inlineCollapsed={bCollapsed}
          selectedKeys={[location.pathname]}
          openKeys={arrOpenKeys}
          onOpenChange={setArrOpenKeys}
          items={arrMenuItems}
          onClick={fnHandleMenuClick}
          style={{
            borderRight: 0,
            marginTop: 4,
            marginBottom: 8,
            paddingLeft: bCollapsed ? 0 : 6,
            paddingRight: bCollapsed ? 0 : 6,
            background: 'transparent',
          }}
        />

        {/* 드래그 리사이즈 — 당김: 아이콘 모드 / 펼침: 너비 조절 · 더블클릭: 기본 200px */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="드래그: 너비 조절(왼쪽으로 당기면 아이콘만) · 더블클릭: 기본 너비"
          onMouseDown={fnOnDragStart}
          onDoubleClick={fnOnResizeHandleDoubleClick}
          className="dqpm-sider-resize-handle"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 5,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 20,
            background: 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = ds.objSider.strResizeHandle; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        />
      </Sider>

      {/* 메인 영역 — 드래그 중에는 transition 제거로 버벅임 방지 */}
      <Layout
        style={{
          marginLeft: bCollapsed ? N_SIDER_COLLAPSED_WIDTH : nSiderWidth,
          background: objShell.strContentBg,
          transition: bIsResizingSider
            ? 'none'
            : 'margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* 상단 헤더 */}
        <Header
          className="dqpm-layout-header"
          style={{
            height: objShell.nHeaderHeight,
            lineHeight: `${objShell.nHeaderHeight}px`,
            padding: `0 ${ds.objSpacing.nLg}px`,
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
          {/* 실시간 연결 상태 + 사용자 정보 + 설정 버튼 */}
          <Space style={{ marginLeft: 'auto' }}>
            <Badge
              status={bConnected ? 'success' : 'default'}
              title={bConnected ? '실시간 연결됨' : '연결 중...'}
            >
              <WifiOutlined
                style={{
                  fontSize: 15,
                  color: bConnected ? token.colorSuccess : token.colorTextDisabled,
                }}
              />
            </Badge>
            <NotificationBellDropdown />
            <Dropdown menu={{ items: arrUserMenuItems }} placement="bottomRight">
              <Space data-testid="header-user-menu" style={{ cursor: 'pointer' }}>
                <Tooltip title={strUserHoverHint}>
                  <Avatar
                    icon={<UserOutlined />}
                    style={{ background: objRole.strColor }}
                  />
                </Tooltip>
                <Text strong>{strHeaderDisplayName || user?.strUserId}</Text>
                {bShowRoleTag ? <Tag color={objRole.strColor}>{strFirstRole}</Tag> : null}
              </Space>
            </Dropdown>
            {/* UI 설정 버튼 */}
            <Button
              type="text"
              className="dqpm-header-icon-btn"
              icon={<SettingOutlined />}
              onClick={() => setBSettingsOpen(true)}
              aria-label="UI 설정"
              title="UI 설정"
              style={{ fontSize: 16, color: token.colorTextSecondary }}
            />
          </Space>
        </Header>

        {/* 콘텐츠 영역 — 회색 레이아웃 위 흰 패널(Cursor 에디터 영역 톤) */}
        <Content
          className="dqpm-layout-content"
          style={{
            margin: ds.objSpacing.nMd,
            padding: 0,
            minHeight: 280,
            background: 'transparent',
          }}
        >
          <div
            className="dqpm-layout-content-panel"
            style={{
              minHeight: `calc(100vh - ${objShell.nHeaderHeight}px - ${ds.objSpacing.nMd * 2}px)`,
              padding: ds.objSpacing.nLg,
              background: objShell.strContentPanelBg,
              border: `1px solid ${objShell.strContentPanelBorder}`,
              borderRadius: objShell.nContentPanelRadius,
            }}
          >
            <Outlet />
          </div>
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
