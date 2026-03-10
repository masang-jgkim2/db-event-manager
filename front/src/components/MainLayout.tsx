import { useState, useMemo } from 'react';
import { Layout, Menu, Typography, Button, Avatar, Dropdown, Space, Tag, Badge } from 'antd';
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
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useEventStream } from '../hooks/useEventStream';
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

const MainLayout = () => {
  const [bCollapsed, setBCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const fnLogout = useAuthStore((state) => state.fnLogout);

  // SSE 연결 - 레이아웃 마운트 시 시작, 앱 전체 유효
  const { bConnected } = useEventStream();

  const arrRoles = user?.arrRoles || [];
  const arrPermissions = user?.arrPermissions || [];

  // 권한 보유 여부 헬퍼
  const fnHasPerm = (strPerm: string) => arrPermissions.includes(strPerm);
  const bIsAdmin = arrRoles.includes('admin');

  // 권한 기반 사이드바 메뉴 동적 생성
  const arrMenuItems = useMemo(() => {
    const arrResult = [];

    // ── 이벤트 그룹 ──────────────────────────────────
    const arrEventChildren = [];

    // 관리자 전용: 대시보드
    if (bIsAdmin) {
      arrEventChildren.push({ key: '/', icon: <DashboardOutlined />, label: '대시보드' });
    }
    // 프로덕트 조회 또는 관리 권한
    if (fnHasPerm('product.view') || fnHasPerm('product.manage')) {
      arrEventChildren.push({ key: '/products', icon: <AppstoreOutlined />, label: '프로덕트 관리' });
    }
    // 이벤트 템플릿 조회 또는 관리 권한
    if (fnHasPerm('event_template.view') || fnHasPerm('event_template.manage')) {
      arrEventChildren.push({ key: '/events', icon: <CalendarOutlined />, label: '이벤트 템플릿' });
    }
    // DB 접속 정보: 관리 권한
    if (fnHasPerm('db.manage')) {
      arrEventChildren.push({ key: '/db-connections', icon: <DatabaseOutlined />, label: 'DB 접속 정보' });
    }

    if (arrEventChildren.length > 0) {
      arrResult.push({
        key: 'event-group',
        label: '이벤트',
        type: 'group' as const,
        children: arrEventChildren,
      });
    }

    // ── 사용자 그룹 (관리자 전용) ─────────────────────
    if (fnHasPerm('user.manage') || bIsAdmin) {
      arrResult.push({
        key: 'user-group',
        label: '사용자',
        type: 'group' as const,
        children: [
          { key: '/users', icon: <TeamOutlined />, label: '사용자 관리' },
          { key: '/roles', icon: <SafetyCertificateOutlined />, label: '역할 권한 관리' },
        ],
      });
    }

    // ── 운영 그룹 ─────────────────────────────────────
    const arrOpChildren = [
      { key: '/my-dashboard', icon: <DashboardOutlined />, label: '나의 대시보드' },
    ];
    if (fnHasPerm('instance.create')) {
      arrOpChildren.push({ key: '/query', icon: <CodeOutlined />, label: '이벤트 생성' });
    }

    arrResult.push({
      key: 'operation-group',
      label: '운영',
      type: 'group' as const,
      children: arrOpChildren,
    });

    return arrResult;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrRoles, arrPermissions]);

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
      onClick: fnLogout,
    },
  ];

  // 첫 번째 역할을 대표로 표시
  const strFirstRole = arrRoles[0] || '';
  const objRole = objRoleLabel[strFirstRole] || { strText: strFirstRole, strColor: '#999' };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 사이드바 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={bCollapsed}
        style={{
          background: '#001529',
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
      >
        {/* 로고 영역 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <DatabaseOutlined style={{ fontSize: 24, color: '#667eea' }} />
          {!bCollapsed && (
            <Text
              strong
              style={{
                color: '#fff',
                fontSize: 16,
                marginLeft: 10,
                whiteSpace: 'nowrap',
              }}
            >
              이벤트 매니저
            </Text>
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
      </Sider>

      {/* 메인 영역 */}
      <Layout style={{ marginLeft: bCollapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        {/* 상단 헤더 */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
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

          {/* 실시간 연결 상태 + 사용자 정보 */}
          <Space>
            <Badge
              status={bConnected ? 'success' : 'default'}
              title={bConnected ? '실시간 연결됨' : '연결 중...'}
            >
              <WifiOutlined
                style={{
                  fontSize: 16,
                  color: bConnected ? '#52c41a' : '#bfbfbf',
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
          </Space>
        </Header>

        {/* 콘텐츠 영역 */}
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
