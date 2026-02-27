import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/useAuthStore';

const { Title, Text } = Typography;

// 로그인 폼 필드 타입
interface ILoginFormValues {
  strUserId: string;
  strPassword: string;
}

const LoginPage = () => {
  const [bIsSubmitting, setBIsSubmitting] = useState(false);
  const fnLogin = useAuthStore((state) => state.fnLogin);
  const [messageApi, contextHolder] = message.useMessage();

  // 로그인 폼 제출 처리
  const fnHandleSubmit = async (objValues: ILoginFormValues) => {
    setBIsSubmitting(true);
    try {
      const bResult = await fnLogin(objValues.strUserId, objValues.strPassword);
      if (bResult) {
        messageApi.success('로그인 성공!');
      } else {
        messageApi.error('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch {
      messageApi.error('서버 연결에 실패했습니다.');
    } finally {
      setBIsSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Card
          style={{
            width: 420,
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          }}
          styles={{
            body: { padding: '40px 36px' },
          }}
        >
          {/* 로고 & 타이틀 영역 */}
          <Space
            direction="vertical"
            align="center"
            style={{ width: '100%', marginBottom: 32 }}
          >
            <DatabaseOutlined
              style={{ fontSize: 48, color: '#667eea' }}
            />
            <Title level={3} style={{ margin: 0, color: '#1a1a2e' }}>
              이벤트 매니저
            </Title>
            <Text type="secondary">DB 쿼리 매니저 시스템</Text>
          </Space>

          {/* 로그인 폼 */}
          <Form<ILoginFormValues>
            name="loginForm"
            onFinish={fnHandleSubmit}
            autoComplete="off"
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="strUserId"
              rules={[{ required: true, message: '아이디를 입력해주세요.' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="아이디"
              />
            </Form.Item>

            <Form.Item
              name="strPassword"
              rules={[{ required: true, message: '비밀번호를 입력해주세요.' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="비밀번호"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={bIsSubmitting}
                block
                style={{
                  height: 48,
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                }}
              >
                로그인
              </Button>
            </Form.Item>
          </Form>

          {/* 기본 계정 안내 */}
          <div
            style={{
              marginTop: 24,
              padding: '12px 16px',
              background: '#f6f8fa',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              기본 계정: <Text code>admin</Text> / <Text code>admin123</Text>
            </Text>
          </div>
        </Card>
      </div>
    </>
  );
};

export default LoginPage;
