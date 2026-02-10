import { useState } from 'react';
import { Layout, Menu, Typography, Button, Avatar, Dropdown, Space } from 'antd';
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
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 사이드바 메뉴 항목
const arrMenuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '대시보드',
  },
  {
    key: '/products',
    icon: <AppstoreOutlined />,
    label: '프로덕트 관리',
  },
  {
    key: '/events',
    icon: <CalendarOutlined />,
    label: '이벤트 템플릿',
  },
  {
    key: '/query',
    icon: <CodeOutlined />,
    label: '쿼리 생성',
  },
];

const MainLayout = () => {
  const [bCollapsed, setBCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const fnLogout = useAuthStore((state) => state.fnLogout);

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
                style={{ background: '#667eea' }}
              />
              <Text strong>{user?.strDisplayName}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {user?.strRole}
              </Text>
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
