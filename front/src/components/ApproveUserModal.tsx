import { useEffect } from 'react';
import { Form, Input, Modal, Select, Tag, Typography } from 'antd';
import type { IRole } from '../types';

const { Text } = Typography;

export interface IPendingUserRow {
  nId: number;
  strUserId: string;
  strDisplayName: string;
  strEmail?: string | null;
  dtCreatedAt: string;
}

interface IApproveUserModalProps {
  bOpen: boolean;
  objUser: IPendingUserRow | null;
  arrRoles: IRole[];
  bLoading: boolean;
  fnOnCancel: () => void;
  fnOnApprove: (arrRoles: string[]) => void;
}

const ApproveUserModal = ({
  bOpen,
  objUser,
  arrRoles,
  bLoading,
  fnOnCancel,
  fnOnApprove,
}: IApproveUserModalProps) => {
  const [form] = Form.useForm<{ arrRoles: string[] }>();

  useEffect(() => {
    if (bOpen && objUser) {
      form.setFieldsValue({ arrRoles: [] });
    }
  }, [bOpen, objUser, form]);

  return (
    <Modal
      title="가입 승인"
      open={bOpen}
      onCancel={fnOnCancel}
      onOk={() => {
        void form.validateFields().then((v) => fnOnApprove(v.arrRoles));
      }}
      okText="승인"
      cancelText="취소"
      confirmLoading={bLoading}
      destroyOnClose
      width={520}
    >
      {objUser && (
        <>
          <Text>
            <Text code>{objUser.strUserId}</Text> · {objUser.strDisplayName}
          </Text>
          {objUser.strEmail && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {objUser.strEmail}
              </Text>
            </div>
          )}
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item
              name="arrRoles"
              label="부여할 역할"
              rules={[{ required: true, message: '역할을 1개 이상 선택해주세요.' }]}
            >
              <Select mode="multiple" placeholder="승인 후 역할 선택">
                {arrRoles
                  .filter((r) => r.strCode !== 'guest')
                  .map((r) => (
                    <Select.Option key={r.strCode} value={r.strCode}>
                      {r.strDisplayName}
                      {r.bIsSystem && (
                        <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>
                          시스템
                        </Tag>
                      )}
                    </Select.Option>
                  ))}
              </Select>
            </Form.Item>
            <Form.Item label="메모 (선택)">
              <Input.TextArea rows={2} disabled placeholder="추후 지원 예정" />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
};

export default ApproveUserModal;
