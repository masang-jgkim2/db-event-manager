import { Layout, Typography, Button, Space } from 'antd';
import { LogoutOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/useAuthStore';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// 대시보드 페이지 (로그인 후 메인 화면)
const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const fnLogout = useAuthStore((state) => state.fnLogout);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
        }}
      >
        <Space>
          <DatabaseOutlined style={{ fontSize: 24, color: '#667eea' }} />
          <Title level={4} style={{ margin: 0 }}>
            이벤트 매니저
          </Title>
        </Space>
        <Space>
          <Text>
            {user?.strDisplayName} ({user?.strRole})
          </Text>
          <Button
            icon={<LogoutOutlined />}
            onClick={fnLogout}
            danger
          >
            로그아웃
          </Button>
        </Space>
      </Header>
      <Content
        style={{
          padding: 24,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Title level={2} type="secondary">
          환영합니다! 이벤트 매니저 대시보드입니다.
        </Title>
      </Content>
    </Layout>
  );
};

export default DashboardPage;
