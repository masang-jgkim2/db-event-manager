import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Tag, Space, Button, Modal,
  Form, Input, Checkbox, Popconfirm, message, Alert, Divider,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import {
  fnApiGetRoles, fnApiCreateRole, fnApiUpdateRole, fnApiDeleteRole,
} from '../api/roleApi';
import type { IRole, TPermission } from '../types';
import { OBJ_PERMISSION_LABELS } from '../types';

const { Title, Text } = Typography;

const RolePage = () => {
  const [arrRoles, setArrRoles] = useState<IRole[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditRole, setObjEditRole] = useState<IRole | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // 역할 목록 조회
  const fnLoad = useCallback(async () => {
    setBLoading(true);
    try {
      const result = await fnApiGetRoles();
      if (result.bSuccess) setArrRoles(result.arrRoles);
    } catch {
      messageApi.error('역할 목록을 불러올 수 없습니다.');
    } finally {
      setBLoading(false);
    }
  }, [messageApi]);

  useEffect(() => { fnLoad(); }, [fnLoad]);

  // 추가/수정 모달 열기
  const fnOpenModal = (objRole?: IRole) => {
    if (objRole) {
      setObjEditRole(objRole);
      form.setFieldsValue({
        strCode: objRole.strCode,
        strDisplayName: objRole.strDisplayName,
        strDescription: objRole.strDescription,
        arrPermissions: objRole.arrPermissions,
      });
    } else {
      setObjEditRole(null);
      form.resetFields();
    }
    setBModalOpen(true);
  };

  // 저장
  const fnHandleSave = async () => {
    try {
      const objValues = await form.validateFields();

      let result;
      if (objEditRole) {
        result = await fnApiUpdateRole(objEditRole.nId, objValues);
      } else {
        result = await fnApiCreateRole(objValues);
      }

      if (result.bSuccess) {
        messageApi.success(objEditRole ? '역할이 수정되었습니다.' : '역할이 생성되었습니다.');
        setBModalOpen(false);
        form.resetFields();
        setObjEditRole(null);
        fnLoad();
      } else {
        messageApi.error(result.strMessage);
      }
    } catch {
      // 유효성 검사 실패
    }
  };

  // 삭제
  const fnHandleDelete = async (nId: number) => {
    try {
      const result = await fnApiDeleteRole(nId);
      if (result.bSuccess) {
        messageApi.success('역할이 삭제되었습니다.');
        fnLoad();
      } else {
        messageApi.error(result.strMessage);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '삭제에 실패했습니다.');
    }
  };

  // 전체 권한 목록 (체크박스 그룹)
  const arrAllPermissions = Object.keys(OBJ_PERMISSION_LABELS) as TPermission[];

  const arrColumns = [
    fnMakeIndexColumn(),
    {
      title: '역할 코드',
      dataIndex: 'strCode',
      key: 'strCode',
      width: 140,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '역할명',
      dataIndex: 'strDisplayName',
      key: 'strDisplayName',
      width: 100,
    },
    {
      title: '설명',
      dataIndex: 'strDescription',
      key: 'strDescription',
    },
    {
      title: '타입',
      dataIndex: 'bIsSystem',
      key: 'bIsSystem',
      width: 80,
      render: (v: boolean) => v
        ? <Tag color="blue" icon={<SafetyCertificateOutlined />}>시스템</Tag>
        : <Tag color="default">커스텀</Tag>,
    },
    {
      title: '권한 수',
      key: 'permCount',
      width: 80,
      render: (_: unknown, r: IRole) => <Tag color="green">{r.arrPermissions.length}개</Tag>,
    },
    {
      title: '관리',
      key: 'actions',
      width: 140,
      render: (_: unknown, r: IRole) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => fnOpenModal(r)}>
            {r.bIsSystem ? '권한' : '수정'}
          </Button>
          {!r.bIsSystem && (
            <Popconfirm
              title="정말 삭제하시겠습니까?"
              description="이 역할을 사용 중인 사용자가 있으면 삭제할 수 없습니다."
              onConfirm={() => fnHandleDelete(r.nId)}
              okText="삭제"
              cancelText="취소"
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>역할 권한 관리</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
          새로운 역할
        </Button>
      </div>

      <Card>
        <AppTable
          dataSource={arrRoles}
          columns={arrColumns}
          loading={bLoading}
          pagination={false}
          strEmptyText="등록된 역할이 없습니다."
        />
      </Card>

      {/* 추가/수정 모달 */}
      <Modal
        title={objEditRole ? (objEditRole.bIsSystem ? '시스템 역할 권한 수정' : '역할 수정') : '새로운 역할 추가'}
        open={bModalOpen}
        onOk={fnHandleSave}
        onCancel={() => { setBModalOpen(false); form.resetFields(); setObjEditRole(null); }}
        okText={objEditRole ? '수정' : '생성'}
        cancelText="취소"
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* 시스템 역할 경고 */}
          {objEditRole?.bIsSystem && (
            <Alert
              type="info"
              showIcon
              message="시스템 기본 역할은 권한만 수정할 수 있습니다."
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 역할 코드 (신규 추가 시에만) */}
          {!objEditRole && (
            <Form.Item
              name="strCode"
              label="역할 코드"
              rules={[
                { required: true, message: '역할 코드를 입력해주세요.' },
                { pattern: /^[a-z_]+$/, message: '소문자와 밑줄(_)만 사용 가능합니다.' },
              ]}
            >
              <Input placeholder="예: custom_operator (소문자, 밑줄만)" />
            </Form.Item>
          )}

          {/* 역할명 */}
          {(!objEditRole || !objEditRole.bIsSystem) && (
            <Form.Item
              name="strDisplayName"
              label="역할명"
              rules={[{ required: true, message: '역할명을 입력해주세요.' }]}
            >
              <Input placeholder="예: 커스텀 운영자" />
            </Form.Item>
          )}

          {/* 설명 */}
          {(!objEditRole || !objEditRole.bIsSystem) && (
            <Form.Item name="strDescription" label="설명">
              <Input.TextArea rows={2} placeholder="이 역할에 대한 설명" />
            </Form.Item>
          )}

          <Divider />

          {/* 권한 선택 */}
          <Form.Item
            name="arrPermissions"
            label={
              <Space>
                <Text strong>권한 설정</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>(이 역할이 수행할 수 있는 기능)</Text>
              </Space>
            }
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {arrAllPermissions.map((perm) => (
                  <Checkbox key={perm} value={perm}>
                    <Text code style={{ fontSize: 12 }}>{perm}</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      {OBJ_PERMISSION_LABELS[perm]}
                    </Text>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default RolePage;
