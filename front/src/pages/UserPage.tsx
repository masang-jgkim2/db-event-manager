import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Modal, Form, Input, Select, Space, Tag,
  Popconfirm, message, Card, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, KeyOutlined, EditOutlined } from '@ant-design/icons';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import {
  fnApiGetUsers, fnApiCreateUser, fnApiUpdateUser,
  fnApiDeleteUser, fnApiResetPassword,
} from '../api/userApi';
import { fnApiGetRoles } from '../api/roleApi';
import type { IRole } from '../types';

const { Title, Text } = Typography;

interface IUserRow {
  nId: number;
  strUserId: string;
  strDisplayName: string;
  arrRoles: string[];
  arrPermissions: string[];
  dtCreatedAt: string;
}

const UserPage = () => {
  const [arrUsers, setArrUsers] = useState<IUserRow[]>([]);
  const [arrRoles, setArrRoles] = useState<IRole[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [bModalOpen, setBModalOpen] = useState(false);
  const [bEditModalOpen, setBEditModalOpen] = useState(false);
  const [bResetModalOpen, setBResetModalOpen] = useState(false);
  const [objEditUser, setObjEditUser] = useState<IUserRow | null>(null);
  const [nResetUserId, setNResetUserId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // 역할명 매핑 객체
  const objRoleMap: Record<string, string> = {};
  arrRoles.forEach((r) => { objRoleMap[r.strCode] = r.strDisplayName; });

  // 사용자 목록 조회
  const fnLoadUsers = useCallback(async () => {
    setBLoading(true);
    try {
      const objResult = await fnApiGetUsers();
      if (objResult.bSuccess) setArrUsers(objResult.arrUsers);
    } catch {
      messageApi.error('사용자 목록을 불러올 수 없습니다.');
    } finally {
      setBLoading(false);
    }
  }, [messageApi]);

  // 역할 목록 조회
  const fnLoadRoles = useCallback(async () => {
    try {
      const result = await fnApiGetRoles();
      if (result.bSuccess) setArrRoles(result.arrRoles);
    } catch {
      messageApi.error('역할 목록을 불러올 수 없습니다.');
    }
  }, [messageApi]);

  useEffect(() => {
    fnLoadUsers();
    fnLoadRoles();
  }, [fnLoadUsers, fnLoadRoles]);

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

  // 수정 모달 열기
  const fnOpenEdit = (objUser: IUserRow) => {
    setObjEditUser(objUser);
    editForm.setFieldsValue({
      strDisplayName: objUser.strDisplayName,
      arrRoles: objUser.arrRoles,
    });
    setBEditModalOpen(true);
  };

  // 사용자 수정 (이름, 역할)
  const fnHandleUpdate = async () => {
    if (!objEditUser) return;
    try {
      const objValues = await editForm.validateFields();
      const objResult = await fnApiUpdateUser(objEditUser.nId, objValues);

      if (objResult.bSuccess) {
        messageApi.success('사용자가 수정되었습니다.');
        setBEditModalOpen(false);
        editForm.resetFields();
        setObjEditUser(null);
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
    } catch (error: any) {
      messageApi.error(error?.message || '삭제에 실패했습니다.');
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
    fnMakeIndexColumn(),
    {
      title: '아이디',
      dataIndex: 'strUserId',
      key: 'strUserId',
      width: 120,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '이름',
      dataIndex: 'strDisplayName',
      key: 'strDisplayName',
    },
    {
      title: '역할',
      dataIndex: 'arrRoles',
      key: 'arrRoles',
      width: 200,
      render: (arrRoles: string[]) => (
        <Space wrap size={4}>
          {arrRoles.map((code) => (
            <Tag key={code} color="blue">{objRoleMap[code] || code}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '권한 수',
      key: 'permCount',
      width: 80,
      render: (_: unknown, r: IUserRow) => <Tag color="green">{r.arrPermissions.length}개</Tag>,
    },
    {
      title: '생성일',
      dataIndex: 'dtCreatedAt',
      key: 'dtCreatedAt',
      width: 160,
      render: (strDate: string) => <Text style={{ fontSize: 12 }}>{new Date(strDate).toLocaleString('ko-KR')}</Text>,
    },
    {
      title: '관리',
      key: 'actions',
      width: 180,
      render: (_: unknown, objRecord: IUserRow) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => fnOpenEdit(objRecord)}
            title="사용자 수정"
          >
            수정
          </Button>
          <Button
            type="text"
            size="small"
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
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>사용자 관리</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setBModalOpen(true);
          }}
        >
          새로운 사용자
        </Button>
      </div>

      <Card>
        <AppTable
          strTableId="users"
          dataSource={arrUsers}
          columns={arrColumns}
          loading={bLoading}
          strEmptyText="등록된 사용자가 없습니다."
        />
      </Card>

      {/* 사용자 추가 모달 */}
      <Modal
        title="새로운 사용자 추가"
        open={bModalOpen}
        onOk={fnHandleCreate}
        onCancel={() => setBModalOpen(false)}
        okText="생성"
        cancelText="취소"
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="strUserId"
            label="아이디 (로그인 시 사용, 변경 불가)"
            rules={[
              { required: true, message: '아이디를 입력해주세요.' },
              { pattern: /^[a-z0-9_]+$/, message: '소문자, 숫자, 밑줄(_)만 사용 가능합니다.' },
            ]}
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
            name="arrRoles"
            label="역할 (다중 선택 가능)"
            rules={[{ required: true, message: '역할을 최소 1개 이상 선택해주세요.' }]}
          >
            <Select mode="multiple" placeholder="역할 선택 (여러 개 가능)">
              {arrRoles.map((r) => (
                <Select.Option key={r.strCode} value={r.strCode}>
                  {r.strDisplayName}
                  {r.bIsSystem && <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>시스템</Tag>}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 사용자 수정 모달 (이름, 역할) */}
      <Modal
        title="사용자 수정"
        open={bEditModalOpen}
        onOk={fnHandleUpdate}
        onCancel={() => {
          setBEditModalOpen(false);
          editForm.resetFields();
          setObjEditUser(null);
        }}
        okText="수정"
        cancelText="취소"
        destroyOnClose
        width={500}
      >
        {objEditUser && (
          <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label="아이디 (변경 불가)">
              <Input value={objEditUser.strUserId} disabled />
            </Form.Item>
            <Form.Item
              name="strDisplayName"
              label="이름"
              rules={[{ required: true, message: '이름을 입력해주세요.' }]}
            >
              <Input placeholder="표시될 이름" />
            </Form.Item>
            <Form.Item
              name="arrRoles"
              label="역할 (다중 선택 가능)"
              rules={[{ required: true, message: '역할을 최소 1개 이상 선택해주세요.' }]}
            >
              <Select mode="multiple" placeholder="역할 선택 (여러 개 가능)">
                {arrRoles.map((r) => (
                  <Select.Option key={r.strCode} value={r.strCode}>
                    {r.strDisplayName}
                    {r.bIsSystem && <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>시스템</Tag>}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        )}
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
        width={400}
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
