import { useState } from 'react';
import { Form, Input, Button, Checkbox, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AuthCardLayout from '../components/AuthCardLayout';
import { fnApiRegister, fnApiCheckRegister } from '../api/authRegisterApi';
import {
  STR_EMAIL_DOMAIN,
  fnBuildMasangsoftEmail,
  fnIsValidEmailLocalPart,
} from '../constants/userStatus';
import { REG_USER_ID, ruleUserIdCharsOnly } from '../utils/userIdInput';

const { Text } = Typography;

interface IRegisterForm {
  strUserId: string;
  strEmailLocal: string;
  strDisplayName: string;
  strPassword: string;
  strPasswordConfirm: string;
  bAgree: boolean;
}

const RegisterPage = () => {
  const [bSubmitting, setBSubmitting] = useState(false);
  const [strUserIdCheck, setStrUserIdCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [strEmailCheck, setStrEmailCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const navigate = useNavigate();
  const [form] = Form.useForm<IRegisterForm>();
  const strEmailLocalWatch = Form.useWatch('strEmailLocal', form);

  const fnCheckUserId = async (strUserId: string): Promise<boolean> => {
    const s = strUserId.trim().toLowerCase();
    if (!s || !REG_USER_ID.test(s)) {
      setStrUserIdCheck('idle');
      return false;
    }
    setStrUserIdCheck('checking');
    try {
      const objRes = await fnApiCheckRegister({ strUserId: s });
      if (objRes.bUserIdAvailable === true) {
        setStrUserIdCheck('ok');
        return true;
      }
      setStrUserIdCheck('fail');
      return false;
    } catch {
      setStrUserIdCheck('idle');
      return false;
    }
  };

  const fnCheckEmailLocal = async (strEmailLocal: string): Promise<boolean> => {
    const s = strEmailLocal.trim().toLowerCase();
    if (!s || !fnIsValidEmailLocalPart(s)) {
      setStrEmailCheck('idle');
      return false;
    }
    setStrEmailCheck('checking');
    try {
      const objRes = await fnApiCheckRegister({ strEmailLocal: s });
      if (objRes.bEmailAvailable === true) {
        setStrEmailCheck('ok');
        return true;
      }
      setStrEmailCheck('fail');
      return false;
    } catch {
      setStrEmailCheck('idle');
      return false;
    }
  };

  /** Form.Item 자식 Input에 onChange를 직접 달면 Form 값이 안 바뀜 — onValuesChange로 이메일 동기화 */
  const fnOnValuesChange = (objChanged: Partial<IRegisterForm>, objAll: IRegisterForm) => {
    if (!Object.prototype.hasOwnProperty.call(objChanged, 'strUserId')) return;
    setStrUserIdCheck('idle');
    const strNorm = String(objAll.strUserId ?? '').trim().toLowerCase();
    if (/^[a-z0-9]*$/.test(strNorm)) {
      form.setFieldValue('strEmailLocal', strNorm);
    }
    setStrEmailCheck('idle');
  };

  const fnOnFinish = async (objValues: IRegisterForm) => {
    if (!objValues.bAgree) {
      message.warning('이용 안내에 동의해 주세요.');
      return;
    }
    const strUserId = objValues.strUserId.trim().toLowerCase();
    const strEmail = fnBuildMasangsoftEmail(objValues.strEmailLocal);

    setBSubmitting(true);
    try {
      const objRes = await fnApiRegister({
        strUserId,
        strEmail,
        strDisplayName: objValues.strDisplayName.trim(),
        strPassword: objValues.strPassword,
      });
      if (!objRes.bSuccess) {
        message.error(objRes.strMessage ?? '가입에 실패했습니다.');
        return;
      }
      navigate(`/register/sent?email=${encodeURIComponent(strEmail)}`, { replace: true });
    } catch (err: unknown) {
      const strMsg = err instanceof Error ? err.message : '서버 연결에 실패했습니다.';
      message.error(strMsg);
    } finally {
      setBSubmitting(false);
    }
  };

  const fnUserIdValidateStatus = (): '' | 'success' | 'error' | 'validating' | undefined => {
    if (strUserIdCheck === 'checking') return 'validating';
    if (strUserIdCheck === 'ok') return 'success';
    if (strUserIdCheck === 'fail') return 'error';
    return undefined;
  };

  const fnEmailValidateStatus = (): '' | 'success' | 'error' | 'validating' | undefined => {
    if (strEmailCheck === 'checking') return 'validating';
    if (strEmailCheck === 'ok') return 'success';
    if (strEmailCheck === 'fail') return 'error';
    return undefined;
  };

  return (
    <AuthCardLayout
      strTitle="회원 가입"
      strSubtitle={`사내 이메일(${STR_EMAIL_DOMAIN})로 DQPM 사용을 신청합니다.`}
      strFooterLabel="이미 계정이 있나요? 로그인"
      strFooterTo="/login"
      nWidth={460}
    >
      <Form
        form={form}
        layout="vertical"
        size="large"
        onFinish={fnOnFinish}
        onValuesChange={fnOnValuesChange}
        autoComplete="off"
        validateTrigger={['onChange', 'onBlur']}
      >
        <Form.Item
          name="strUserId"
          label="아이디"
          validateStatus={fnUserIdValidateStatus()}
          hasFeedback={strUserIdCheck === 'ok' || strUserIdCheck === 'fail'}
          help={
            strUserIdCheck === 'ok'
              ? '사용 가능한 아이디입니다.'
              : strUserIdCheck === 'fail'
                ? '이미 사용 중이거나 가입된 아이디입니다.'
                : '입력하면 이메일 앞부분이 같이 채워집니다. 포커스를 벗어나면 중복을 확인합니다.'
          }
          rules={[
            { required: true, message: '아이디를 입력해주세요.' },
            ruleUserIdCharsOnly,
            { pattern: REG_USER_ID, message: '영문·숫자 4~32자로 입력해주세요.' },
            { min: 4, max: 32 },
            {
              validator: async (_, strVal) => {
                const s = String(strVal ?? '').trim().toLowerCase();
                if (!s || s.length < 4) return Promise.resolve();
                const bOk = await fnCheckUserId(s);
                return bOk
                  ? Promise.resolve()
                  : Promise.reject(new Error('이미 사용 중인 아이디입니다.'));
              },
            },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="로그인에 사용할 아이디"
            onBlur={(e) => void fnCheckUserId(e.target.value)}
          />
        </Form.Item>
        <Form.Item
          name="strEmailLocal"
          label="이메일"
          normalize={(v) => (typeof v === 'string' ? v.toLowerCase() : v)}
          validateStatus={fnEmailValidateStatus()}
          hasFeedback={strEmailCheck === 'ok' || strEmailCheck === 'fail'}
          help={
            strEmailCheck === 'ok'
              ? `사용 가능합니다. (${fnBuildMasangsoftEmail(strEmailLocalWatch || '')})`
              : strEmailCheck === 'fail'
                ? '이미 등록된 이메일입니다.'
                : `아이디와 동일하게 채워지며, 뒤에 ${STR_EMAIL_DOMAIN} 이 붙습니다.`
          }
          rules={[
            { required: true, message: '이메일 앞부분을 입력해주세요.' },
            {
              validator: (_, strVal) => {
                const s = String(strVal ?? '').trim();
                if (!s) return Promise.resolve();
                return fnIsValidEmailLocalPart(s)
                  ? Promise.resolve()
                  : Promise.reject(new Error('영문·숫자·._- 만 사용할 수 있습니다.'));
              },
            },
            {
              validator: async (_, strVal) => {
                const s = String(strVal ?? '').trim().toLowerCase();
                if (!s || !fnIsValidEmailLocalPart(s)) return Promise.resolve();
                const bOk = await fnCheckEmailLocal(s);
                return bOk
                  ? Promise.resolve()
                  : Promise.reject(new Error('이미 등록된 이메일입니다.'));
              },
            },
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="이메일 아이디"
            addonAfter={STR_EMAIL_DOMAIN}
            onBlur={(e) => void fnCheckEmailLocal(e.target.value)}
          />
        </Form.Item>
        <Form.Item
          name="strDisplayName"
          label="이름"
          rules={[{ required: true, message: '이름을 입력해주세요.' }]}
        >
          <Input prefix={<IdcardOutlined />} placeholder="표시 이름" />
        </Form.Item>
        <Form.Item
          name="strPassword"
          label="비밀번호"
          rules={[
            { required: true, message: '비밀번호를 입력해주세요.' },
            { min: 8, message: '8자 이상 입력해주세요.' },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="비밀번호" />
        </Form.Item>
        <Form.Item
          name="strPasswordConfirm"
          label="비밀번호 확인"
          dependencies={['strPassword']}
          rules={[
            { required: true, message: '비밀번호 확인을 입력해주세요.' },
            ({ getFieldValue }) => ({
              validator(_, strVal) {
                if (!strVal || getFieldValue('strPassword') === strVal) return Promise.resolve();
                return Promise.reject(new Error('비밀번호가 일치하지 않습니다.'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="비밀번호 확인" />
        </Form.Item>
        <Form.Item name="bAgree" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Checkbox>가입 신청 및 사내 시스템 이용 안내에 동의합니다.</Checkbox>
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 16 }}>
          가입 신청 후 관리자 승인이 완료되면 로그인할 수 있습니다.
        </Text>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={bSubmitting} block style={{ height: 48, fontWeight: 600 }}>
            가입 신청
          </Button>
        </Form.Item>
      </Form>
    </AuthCardLayout>
  );
};

export default RegisterPage;
