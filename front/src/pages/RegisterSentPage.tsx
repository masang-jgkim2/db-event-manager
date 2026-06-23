import { ClockCircleOutlined } from '@ant-design/icons';
import { Button, Result, Typography, theme } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthCardLayout from '../components/AuthCardLayout';
import { fnSemanticColor } from '../styles/semanticColors';

const { Text } = Typography;

const RegisterSentPage = () => {
  const { token } = theme.useToken();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const strEmail = searchParams.get('email') ?? '';
  const strMasked = strEmail.replace(/(^.).*(@.*$)/, '$1***$2');

  return (
    <AuthCardLayout
      strTitle="가입 신청 완료"
      strFooterLabel="로그인 화면으로"
      strFooterTo="/login"
    >
      <Result
        icon={<ClockCircleOutlined style={{ color: fnSemanticColor('warning', token) }} />}
        title="관리자 승인 대기"
        subTitle={
          <span style={{ display: 'block', textAlign: 'left' }}>
            <Text>
              <strong>{strMasked || '입력하신 이메일'}</strong> 로 가입 신청이 접수되었습니다.
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              승인 전에는 로그인할 수 없습니다. 관리자가 역할을 부여·승인하면 로그인 화면에서 이용할 수 있습니다.
              (Phase A: 인증 메일 발송 안내는 추후 제공 예정)
            </Text>
          </span>
        }
        extra={
          <Button type="primary" onClick={() => navigate('/login')}>
            확인
          </Button>
        }
      />
    </AuthCardLayout>
  );
};

export default RegisterSentPage;
