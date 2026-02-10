import { useState, useMemo } from 'react';
import { Layout, Menu, Typography, Button, Avatar, Dropdown, Space, Tag } from 'antd';
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
  SettingOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 역할 표시 라벨
const objRoleLabel: Record<string, { strText: string; strColor: string }> = {
  admin: { strText: '관리자', strColor: '#f50' },
  gm: { strText: 'GM', strColor: '#2db7f5' },
  planner: { strText: '기획자', strColor: '#87d068' },
  dba: { strText: 'DBA', strColor: '#722ed1' },
};

const MainLayout = () => {
  const [bCollapsed, setBCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const fnLogout = useAuthStore((state) => state.fnLogout);

  const strRole = user?.strRole || '';

  // 역할에 따른 사이드바 메뉴
  const arrMenuItems = useMemo(() => {
    // 관리자 메뉴
    if (strRole === 'admin') {
      return [
        {
          key: 'admin-group',
          icon: <SettingOutlined />,
          label: '관리자',
          type: 'group' as const,
          children: [
            { key: '/', icon: <DashboardOutlined />, label: '대시보드' },
            { key: '/products', icon: <AppstoreOutlined />, label: '프로덕트 관리' },
            { key: '/events', icon: <CalendarOutlined />, label: '이벤트 템플릿' },
            { key: '/users', icon: <TeamOutlined />, label: '사용자 관리' },
          ],
        },
        {
          key: 'common-group',
          icon: <CodeOutlined />,
          label: '운영',
          type: 'group' as const,
          children: [
            { key: '/my-dashboard', icon: <DashboardOutlined />, label: '나의 대시보드' },
            { key: '/query', icon: <CodeOutlined />, label: '이벤트 생성' },
          ],
        },
      ];
    }

    // DBA 메뉴
    if (strRole === 'dba') {
      return [
        { key: '/my-dashboard', icon: <DashboardOutlined />, label: '나의 대시보드' },
      ];
    }

    // 운영자(GM, 기획자) 메뉴
    return [
      { key: '/my-dashboard', icon: <DashboardOutlined />, label: '나의 대시보드' },
      { key: '/query', icon: <CodeOutlined />, label: '이벤트 생성' },
    ];
  }, [strRole]);

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

  const objRole = objRoleLabel[user?.strRole || ''] || { strText: user?.strRole, strColor: '#999' };

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

          {/* 사용자 정보 */}
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
