import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Card,
} from 'antd';
import { PlusOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { fnApiGetUsers, fnApiCreateUser, fnApiDeleteUser, fnApiResetPassword } from '../api/userApi';

const { Title } = Typography;

interface IUserRow {
  nId: number;
  strUserId: string;
  strDisplayName: string;
  strRole: string;
  dtCreatedAt: string;
}

// 역할 색상 매핑
const objRoleConfig: Record<string, { strColor: string; strLabel: string }> = {
  admin: { strColor: '#f50', strLabel: '관리자' },
  gm: { strColor: '#2db7f5', strLabel: 'GM' },
  planner: { strColor: '#87d068', strLabel: '기획자' },
  dba: { strColor: '#722ed1', strLabel: 'DBA' },
};

const UserPage = () => {
  const [arrUsers, setArrUsers] = useState<IUserRow[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [bModalOpen, setBModalOpen] = useState(false);
  const [bResetModalOpen, setBResetModalOpen] = useState(false);
  const [nResetUserId, setNResetUserId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // 사용자 목록 조회
  const fnLoadUsers = useCallback(async () => {
    setBLoading(true);
    try {
      const objResult = await fnApiGetUsers();
      if (objResult.bSuccess) {
        setArrUsers(objResult.arrUsers);
      }
    } catch {
      messageApi.error('사용자 목록을 불러올 수 없습니다.');
    } finally {
      setBLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    fnLoadUsers();
  }, [fnLoadUsers]);

  // 사용자 추가
  const fnHandleCreate = async () => {
    try {
      const objValues = await form.validateFields();
      const objResult = await fnApiCreateUser(objValues);

      if (objResult.bSuccess) {
        messageApi.success('사용자가 생성되었습니다.');
        setBModalOpen(false);
        form.resetFields();
        fnLoadUsers();
      } else {
        messageApi.error(objResult.strMessage);
      }
    } catch {
      // 유효성 검사 실패
    }
  };

  // 사용자 삭제
  const fnHandleDelete = async (nId: number) => {
    try {
      const objResult = await fnApiDeleteUser(nId);
      if (objResult.bSuccess) {
        messageApi.success('사용자가 삭제되었습니다.');
        fnLoadUsers();
      } else {
        messageApi.error(objResult.strMessage);
      }
    } catch {
      messageApi.error('삭제에 실패했습니다.');
    }
  };

  // 비밀번호 초기화
  const fnHandleResetPassword = async () => {
    try {
      const objValues = await resetForm.validateFields();
      if (!nResetUserId) return;

      const objResult = await fnApiResetPassword(nResetUserId, objValues.strNewPassword);
      if (objResult.bSuccess) {
        messageApi.success('비밀번호가 초기화되었습니다.');
        setBResetModalOpen(false);
        resetForm.resetFields();
      } else {
        messageApi.error(objResult.strMessage);
      }
    } catch {
      // 유효성 검사 실패
    }
  };

  // 테이블 컬럼
  const arrColumns = [
    {
      title: 'No.',
      key: 'index',
      width: 60,
      render: (_: unknown, __: unknown, nIndex: number) => nIndex + 1,
    },
    {
      title: '아이디',
      dataIndex: 'strUserId',
      key: 'strUserId',
    },
    {
      title: '이름',
      dataIndex: 'strDisplayName',
      key: 'strDisplayName',
    },
    {
      title: '역할',
      dataIndex: 'strRole',
      key: 'strRole',
      width: 100,
      render: (strRole: string) => {
        const objConfig = objRoleConfig[strRole] || { strColor: '#999', strLabel: strRole };
        return <Tag color={objConfig.strColor}>{objConfig.strLabel}</Tag>;
      },
    },
    {
      title: '생성일',
      dataIndex: 'dtCreatedAt',
      key: 'dtCreatedAt',
      width: 180,
      render: (strDate: string) => new Date(strDate).toLocaleString('ko-KR'),
    },
    {
      title: '관리',
      key: 'actions',
      width: 160,
      render: (_: unknown, objRecord: IUserRow) => (
        <Space>
          <Button
            type="text"
            icon={<KeyOutlined />}
            onClick={() => {
              setNResetUserId(objRecord.nId);
              setBResetModalOpen(true);
            }}
            title="비밀번호 초기화"
          />
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => fnHandleDelete(objRecord.nId)}
            okText="삭제"
            cancelText="취소"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          사용자 관리
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setBModalOpen(true);
          }}
        >
          사용자 추가
        </Button>
      </div>

      <Card>
        <Table
          dataSource={arrUsers}
          columns={arrColumns}
          rowKey="nId"
          loading={bLoading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '등록된 사용자가 없습니다.' }}
        />
      </Card>

      {/* 사용자 추가 모달 */}
      <Modal
        title="사용자 추가"
        open={bModalOpen}
        onOk={fnHandleCreate}
        onCancel={() => setBModalOpen(false)}
        okText="생성"
        cancelText="취소"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="strUserId"
            label="아이디"
            rules={[{ required: true, message: '아이디를 입력해주세요.' }]}
          >
            <Input placeholder="로그인에 사용할 아이디" />
          </Form.Item>
          <Form.Item
            name="strPassword"
            label="비밀번호"
            rules={[{ required: true, message: '비밀번호를 입력해주세요.' }]}
          >
            <Input.Password placeholder="초기 비밀번호" />
          </Form.Item>
          <Form.Item
            name="strDisplayName"
            label="이름"
            rules={[{ required: true, message: '이름을 입력해주세요.' }]}
          >
            <Input placeholder="표시될 이름 (예: GM_홍길동)" />
          </Form.Item>
          <Form.Item
            name="strRole"
            label="역할"
            rules={[{ required: true, message: '역할을 선택해주세요.' }]}
          >
            <Select placeholder="역할 선택">
              <Select.Option value="gm">GM</Select.Option>
              <Select.Option value="planner">기획자</Select.Option>
              <Select.Option value="dba">DBA</Select.Option>
              <Select.Option value="admin">관리자</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 비밀번호 초기화 모달 */}
      <Modal
        title="비밀번호 초기화"
        open={bResetModalOpen}
        onOk={fnHandleResetPassword}
        onCancel={() => {
          setBResetModalOpen(false);
          resetForm.resetFields();
        }}
        okText="초기화"
        cancelText="취소"
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="strNewPassword"
            label="새 비밀번호"
            rules={[{ required: true, message: '새 비밀번호를 입력해주세요.' }]}
          >
            <Input.Password placeholder="새 비밀번호 입력" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UserPage;
