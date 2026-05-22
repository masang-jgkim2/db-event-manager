import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, theme } from 'antd';
import { UserOutlined, LockOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';
import { bShowLoginDefaultAccountHint } from '../config/loginUi';

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
  const { token } = theme.useToken();
  const fnGetIsDark = useThemeStore((s) => s.fnGetIsDark);
  const strPrimaryColor = useThemeStore((s) => s.strPrimaryColor);
  const bIsDark = fnGetIsDark();
  // 테마별 페이지 배경 — 본문·카드는 token으로 대비 확보
  const strPageBackground = `radial-gradient(ellipse 110% 70% at 50% -18%, ${strPrimaryColor}40 0%, transparent 52%), ${token.colorBgLayout}`;

  // 로그인 폼 제출 처리
  const fnHandleSubmit = async (objValues: ILoginFormValues) => {
    setBIsSubmitting(true);
    try {
      const bResult = await fnLogin(objValues.strUserId, objValues.strPassword);
      if (bResult) {
        messageApi.success('로그인 성공!');
        // PublicRoute가 redirect 파라미터를 읽어 자동 이동 처리
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
          background: strPageBackground,
        }}
      >
        <Card
          style={{
            width: 420,
            borderRadius: token.borderRadiusLG,
            boxShadow: bIsDark ? token.boxShadowSecondary : '0 20px 48px rgba(0, 0, 0, 0.12)',
            background: token.colorBgContainer,
            borderColor: token.colorBorderSecondary,
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
            <DatabaseOutlined style={{ fontSize: 48, color: strPrimaryColor }} />
            <Title level={3} style={{ margin: 0, color: token.colorTextHeading, textAlign: 'center' }}>
              Database Query Process Manager
            </Title>
            <Text style={{ color: token.colorTextSecondary, textAlign: 'center' }}>
              계정으로 로그인하세요
            </Text>
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
                prefix={<UserOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder="아이디"
              />
            </Form.Item>

            <Form.Item
              name="strPassword"
              rules={[{ required: true, message: '비밀번호를 입력해주세요.' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
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
                  borderRadius: token.borderRadiusLG,
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                로그인
              </Button>
            </Form.Item>
          </Form>

          {/* 기본 계정 안내 — VITE_SHOW_LOGIN_DEFAULT_ACCOUNT_HINT=true 일 때만 표시 */}
          {bShowLoginDefaultAccountHint && (
            <div
              style={{
                marginTop: 24,
                padding: '12px 16px',
                background: token.colorFillAlter,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
                textAlign: 'center',
              }}
            >
              <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                기본 계정: <Text code style={{ color: token.colorText }}>admin</Text> /{' '}
                <Text code style={{ color: token.colorText }}>admin123</Text>
              </Text>
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export default LoginPage;
