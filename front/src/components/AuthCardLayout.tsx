import type { ReactNode } from 'react';
import { Card, Space, Typography, theme } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../stores/useThemeStore';

const { Title, Text } = Typography;

interface IAuthCardLayoutProps {
  strTitle: string;
  strSubtitle?: string;
  children: ReactNode;
  strFooterLabel?: string;
  strFooterTo?: string;
  nWidth?: number;
}

/** 로그인·가입 등 공개 인증 화면 공통 카드 */
const AuthCardLayout = ({
  strTitle,
  strSubtitle,
  children,
  strFooterLabel,
  strFooterTo,
  nWidth = 420,
}: IAuthCardLayoutProps) => {
  const { token } = theme.useToken();
  const fnGetIsDark = useThemeStore((s) => s.fnGetIsDark);
  const strPrimaryColor = useThemeStore((s) => s.strPrimaryColor);
  const bIsDark = fnGetIsDark();
  const strPageBackground = `radial-gradient(ellipse 110% 70% at 50% -18%, ${strPrimaryColor}40 0%, transparent 52%), ${token.colorBgLayout}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: strPageBackground,
        padding: 24,
      }}
    >
      <Card
        style={{
          width: nWidth,
          maxWidth: '100%',
          borderRadius: token.borderRadiusLG,
          boxShadow: bIsDark ? token.boxShadowSecondary : '0 20px 48px rgba(0, 0, 0, 0.12)',
          background: token.colorBgContainer,
          borderColor: token.colorBorderSecondary,
        }}
        styles={{ body: { padding: '40px 36px' } }}
      >
        <Space direction="vertical" align="center" style={{ width: '100%', marginBottom: 28 }}>
          <DatabaseOutlined style={{ fontSize: 48, color: strPrimaryColor }} />
          <Title level={3} style={{ margin: 0, color: token.colorTextHeading, textAlign: 'center' }}>
            {strTitle}
          </Title>
          {strSubtitle && (
            <Text style={{ color: token.colorTextSecondary, textAlign: 'center', fontSize: 13 }}>
              {strSubtitle}
            </Text>
          )}
        </Space>
        {children}
        {strFooterLabel && strFooterTo && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Link to={strFooterTo} style={{ fontSize: 13 }}>
              {strFooterLabel}
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuthCardLayout;
