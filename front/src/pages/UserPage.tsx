import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Modal, Form, Input, Select, Space,
  Popconfirm, message, Tooltip, Segmented, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, DeleteOutlined, KeyOutlined, EditOutlined,
  CheckCircleOutlined, CloseCircleOutlined, MailOutlined, TeamOutlined,
} from '@ant-design/icons';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import CrudPageShell from '../components/CrudPageShell';
import CrudListToolbar from '../components/CrudListToolbar';
import ApproveUserModal, { type IPendingUserRow } from '../components/ApproveUserModal';
import {
  fnApiGetUsers, fnApiCreateUser, fnApiUpdateUser,
  fnApiDeleteUser, fnApiResetPassword, fnApiApproveUser, fnApiRejectUser,
} from '../api/userApi';
import { fnApiGetRoles } from '../api/roleApi';
import { useAuthStore } from '../stores/useAuthStore';
import { DqpmTag } from '../components/DqpmTag';
import { useUserPresenceStream } from '../hooks/useUserPresenceStream';
import {
  OBJ_USER_STATUS_LABEL, OBJ_USER_STATUS_COLOR,
  STR_EMAIL_DOMAIN, fnIsMasangsoftEmail, type TUserStatus,
} from '../constants/userStatus';
import type { IRole, TPermission } from '../types';
import { REG_USER_ID, ruleUserIdCharsOnly } from '../utils/userIdInput';
import { fnSemanticColor } from '../styles/semanticColors';

const { Text } = Typography;

const fnFormatLastAccess = (strIso?: string | null): string => {
  if (!strIso) return '-';
  return new Date(strIso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
};

interface IUserRow {
  nId: number;
  strUserId: string;
  strDisplayName: string;
  strEmail?: string | null;
  strStatus?: TUserStatus | string;
  arrRoles: string[];
  arrPermissions: string[];
  dtCreatedAt: string;
  bOnline?: boolean;
  strLastSeenAt?: string | null;
}

type TUserListTab = 'all' | 'pending_approval';

const UserPage = () => {
  const { token } = theme.useToken();
  const [arrUsers, setArrUsers] = useState<IUserRow[]>([]);
  const [bUsersListReady, setBUsersListReady] = useState(false);
  const [arrRoles, setArrRoles] = useState<IRole[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [strListTab, setStrListTab] = useState<TUserListTab>('all');
  const [bModalOpen, setBModalOpen] = useState(false);
  const [bEditModalOpen, setBEditModalOpen] = useState(false);
  const [bResetModalOpen, setBResetModalOpen] = useState(false);
  const [bApproveModalOpen, setBApproveModalOpen] = useState(false);
  const [bApproveLoading, setBApproveLoading] = useState(false);
  const [objApproveUser, setObjApproveUser] = useState<IPendingUserRow | null>(null);
  const [objEditUser, setObjEditUser] = useState<IUserRow | null>(null);
  const [nResetUserId, setNResetUserId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const objRoleMap: Record<string, string> = {};
  arrRoles.forEach((r) => { objRoleMap[r.strCode] = r.strDisplayName; });

  const arrPermissions = useAuthStore((s) => s.user?.arrPermissions || []);
  const fnHas = (p: TPermission) => arrPermissions.includes(p);
  const bCanCreate = fnHas('user.create') || fnHas('user.manage');
  const bCanEdit = fnHas('user.edit') || fnHas('user.manage');
  const bCanDelete = fnHas('user.delete') || fnHas('user.manage');
  const bCanResetPassword = fnHas('user.reset_password') || fnHas('user.manage');
  const bCanViewUsers = fnHas('user.view') || fnHas('user.manage');
  const bCanApprove = fnHas('user.approve') || fnHas('user.manage');

  const fnOnPresenceSnapshot = useCallback((arrRows: { nUserId: number; bOnline: boolean; strLastSeenAt: string | null }[]) => {
    setArrUsers((prev) => {
      const mapRows = new Map(arrRows.map((r) => [r.nUserId, r]));
      return prev.map((u) => {
        const p = mapRows.get(u.nId);
        if (!p) return u;
        return { ...u, bOnline: p.bOnline, strLastSeenAt: p.strLastSeenAt ?? undefined };
      });
    });
  }, []);

  const fnOnPresenceDelta = useCallback((row: { nUserId: number; bOnline: boolean; strLastSeenAt: string | null }) => {
    setArrUsers((prev) =>
      prev.map((u) =>
        u.nId === row.nUserId
          ? { ...u, bOnline: row.bOnline, strLastSeenAt: row.strLastSeenAt ?? undefined }
          : u,
      ),
    );
  }, []);

  useUserPresenceStream({
    bEnabled: bCanViewUsers && bUsersListReady,
    fnOnSnapshot: fnOnPresenceSnapshot,
    fnOnPresence: fnOnPresenceDelta,
  });

  const fnLoadUsers = useCallback(async (bShowLoading = true) => {
    if (bShowLoading) setBLoading(true);
    try {
      const strStatusFilter = strListTab === 'pending_approval' ? 'pending_approval' : undefined;
      const objResult = await fnApiGetUsers(strStatusFilter);
      if (objResult.bSuccess) {
        setArrUsers(objResult.arrUsers);
        setBUsersListReady(true);
      }
    } catch {
      messageApi.error('사용자 목록을 불러올 수 없습니다.');
    } finally {
      if (bShowLoading) setBLoading(false);
    }
  }, [messageApi, strListTab]);

  const fnLoadRoles = useCallback(async () => {
    try {
      const result = await fnApiGetRoles();
      if (result.bSuccess) setArrRoles(result.arrRoles);
    } catch {
      messageApi.error('역할 목록을 불러올 수 없습니다.');
    }
  }, [messageApi]);

  useEffect(() => {
    void fnLoadUsers(true);
    void fnLoadRoles();
  }, [fnLoadUsers, fnLoadRoles]);

  useEffect(() => {
    const nTimer = window.setInterval(() => void fnLoadUsers(false), 120_000);
    return () => window.clearInterval(nTimer);
  }, [fnLoadUsers]);

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

  const fnOpenEdit = (objUser: IUserRow) => {
    setObjEditUser(objUser);
    editForm.setFieldsValue({
      strDisplayName: objUser.strDisplayName,
      arrRoles: objUser.arrRoles,
    });
    setBEditModalOpen(true);
  };

  const fnOpenApprove = (objUser: IUserRow) => {
    setObjApproveUser({
      nId: objUser.nId,
      strUserId: objUser.strUserId,
      strDisplayName: objUser.strDisplayName,
      strEmail: objUser.strEmail,
      dtCreatedAt: objUser.dtCreatedAt,
    });
    setBApproveModalOpen(true);
  };

  const fnHandleApprove = async (arrRoles: string[]) => {
    if (!objApproveUser) return;
    setBApproveLoading(true);
    try {
      const objResult = await fnApiApproveUser(objApproveUser.nId, arrRoles);
      if (objResult.bSuccess) {
        messageApi.success('가입이 승인되었습니다.');
        setBApproveModalOpen(false);
        setObjApproveUser(null);
        fnLoadUsers();
      } else {
        messageApi.error(objResult.strMessage);
      }
    } finally {
      setBApproveLoading(false);
    }
  };

  const fnHandleReject = async (nId: number) => {
    const objResult = await fnApiRejectUser(nId);
    if (objResult.bSuccess) {
      messageApi.success(
        objResult.strMessage
          ?? '가입이 거절되었습니다. 해당 계정은 로그인할 수 없으며, 전체 목록에 «거절»로 표시됩니다.',
      );
      fnLoadUsers();
    } else {
      messageApi.error(objResult.strMessage);
    }
  };

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

  const fnHandleDelete = async (nId: number) => {
    try {
      const objResult = await fnApiDeleteUser(nId);
      if (objResult.bSuccess) {
        messageApi.success('사용자가 삭제되었습니다.');
        fnLoadUsers();
      } else {
        messageApi.error(objResult.strMessage);
      }
    } catch (error: unknown) {
      const strMsg = error instanceof Error ? error.message : '삭제에 실패했습니다.';
      messageApi.error(strMsg);
    }
  };

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

  const fnRenderStatusTag = (strStatus?: string) => {
    const s = (strStatus ?? 'active') as TUserStatus;
    const strLabel = OBJ_USER_STATUS_LABEL[s] ?? s;
    const strColor = OBJ_USER_STATUS_COLOR[s] ?? 'default';
    return <DqpmTag color={strColor}>{strLabel}</DqpmTag>;
  };

  const bShowPresenceCols = strListTab !== 'pending_approval';

  const arrColumns: ColumnsType<IUserRow> = [
    fnMakeIndexColumn<IUserRow>(),
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
      title: '이메일',
      dataIndex: 'strEmail',
      key: 'strEmail',
      width: 200,
      render: (v: string | null | undefined) =>
        v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '상태',
      dataIndex: 'strStatus',
      key: 'strStatus',
      width: 110,
      render: (v: string | undefined) => fnRenderStatusTag(v),
    },
    ...(bShowPresenceCols
      ? [
          {
            title: '연결',
            key: 'presence',
            width: 72,
            align: 'center' as const,
            render: (_: unknown, r: IUserRow) => {
              const bOn = Boolean(r.bOnline);
              const strTip = bOn ? '온라인 (최근 API 활동 기준)' : '오프라인';
              const strColor = bOn
                ? fnSemanticColor('success', token)
                : String(token.colorTextQuaternary);
              const strShadow = bOn ? '0 0 8px rgba(82, 196, 26, 0.45)' : 'none';
              return (
                <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{strTip}</span>}>
                  <span
                    className={bOn ? 'user-page-presence-dot--breathe' : undefined}
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: strColor,
                      boxShadow: strShadow,
                      verticalAlign: 'middle',
                      transition: 'background-color 0.55s ease, box-shadow 0.55s ease',
                    }}
                  />
                </Tooltip>
              );
            },
          },
          {
            title: '최근 접속일',
            key: 'strLastSeenAt',
            width: 150,
            render: (_: unknown, r: IUserRow) => (
              <Text type={r.strLastSeenAt ? undefined : 'secondary'} style={{ fontSize: 12 }}>
                {fnFormatLastAccess(r.strLastSeenAt)}
              </Text>
            ),
            sorter: (a: IUserRow, b: IUserRow) => {
              const nA = a.strLastSeenAt ? new Date(a.strLastSeenAt).getTime() : 0;
              const nB = b.strLastSeenAt ? new Date(b.strLastSeenAt).getTime() : 0;
              return nA - nB;
            },
          },
        ]
      : []),
    {
      title: '역할',
      dataIndex: 'arrRoles',
      key: 'arrRoles',
      width: 200,
      render: (arrRoles: string[]) => (
        <Space wrap size={4}>
          {arrRoles.map((code) => (
            <DqpmTag key={code} color="blue">{objRoleMap[code] || code}</DqpmTag>
          ))}
        </Space>
      ),
    },
    ...(strListTab === 'all'
      ? [{
          title: '권한 수',
          key: 'permCount',
          width: 80,
          render: (_: unknown, r: IUserRow) => <DqpmTag color="green">{r.arrPermissions.length}개</DqpmTag>,
        }]
      : []),
    {
      title: '생성일',
      dataIndex: 'dtCreatedAt',
      key: 'dtCreatedAt',
      width: 160,
      render: (strDate: string) => <Text style={{ fontSize: 12 }}>{new Date(strDate).toLocaleString('ko-KR')}</Text>,
    },
    ...(bCanEdit || bCanResetPassword || bCanDelete || bCanApprove
      ? [{
          title: '관리',
          key: 'actions',
          width: strListTab === 'pending_approval' ? 200 : 180,
          render: (_: unknown, objRecord: IUserRow) => {
            const bPending = objRecord.strStatus === 'pending_approval';
            return (
              <Space wrap size={4}>
                {bCanApprove && bPending && (
                  <>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => fnOpenApprove(objRecord)}
                    >
                      승인
                    </Button>
                    <Popconfirm
                      title="가입 신청을 거절하시겠습니까?"
                      description="거절해도 계정 행은 «거절» 상태로 남습니다. 이미 로그인한 경우 즉시 차단됩니다."
                      onConfirm={() => fnHandleReject(objRecord.nId)}
                      okText="거절"
                      cancelText="취소"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" danger icon={<CloseCircleOutlined />}>
                        거절
                      </Button>
                    </Popconfirm>
                  </>
                )}
                {bCanEdit && !bPending && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => fnOpenEdit(objRecord)}
                    title="사용자 수정"
                  >
                    수정
                  </Button>
                )}
                {bCanResetPassword && !bPending && (
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
                )}
                {bCanDelete && !bPending && (
                  <Popconfirm
                    title="정말 삭제하시겠습니까?"
                    onConfirm={() => fnHandleDelete(objRecord.nId)}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            );
          },
        }]
      : []),
  ];

  const nPendingCount = arrUsers.filter((u) => u.strStatus === 'pending_approval').length;

  return (
    <>
      <style>
        {`
          @keyframes userPagePresenceDotBreathe {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.65; }
          }
          .user-page-presence-dot--breathe {
            animation: userPagePresenceDotBreathe 2.6s ease-in-out infinite;
          }
        `}
      </style>
      {contextHolder}
      <CrudPageShell
        strTitle="사용자"
        nodeIcon={<TeamOutlined />}
        nodeDescription="관리자 직접 추가는 즉시 활성(active)이며, 회원 가입은 승인 대기(pending_approval) 후 역할을 부여합니다."
        nodeExtra={
          bCanCreate ? (
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
          ) : undefined
        }
        nodeToolbar={(
          <CrudListToolbar
            nodeLeft={(
              <Segmented
                value={strListTab}
                onChange={(v) => setStrListTab(v as TUserListTab)}
                options={[
                  { label: '전체', value: 'all' },
                  {
                    label: `승인 대기 (${strListTab === 'pending_approval' ? arrUsers.length : nPendingCount})`,
                    value: 'pending_approval',
                  },
                ]}
              />
            )}
          />
        )}
      >
        <AppTable
          strTableId={`users-${strListTab}`}
          dataSource={arrUsers}
          columns={arrColumns}
          loading={bLoading}
          strEmptyText={strListTab === 'pending_approval' ? '승인 대기 중인 사용자가 없습니다.' : '등록된 사용자가 없습니다.'}
        />
      </CrudPageShell>

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
              ruleUserIdCharsOnly,
              { pattern: REG_USER_ID, message: '영문·숫자 4~32자로 입력해주세요.' },
            ]}
            validateTrigger={['onChange', 'onBlur']}
          >
            <Input placeholder="로그인에 사용할 아이디 (영문·숫자)" />
          </Form.Item>
          <Form.Item
            name="strEmail"
            label={`이메일 (선택, ${STR_EMAIL_DOMAIN})`}
            rules={[
              { type: 'email', message: '올바른 이메일 형식이 아닙니다.' },
              {
                validator: (_, strVal) =>
                  !strVal || fnIsMasangsoftEmail(String(strVal))
                    ? Promise.resolve()
                    : Promise.reject(new Error(`사내 이메일(${STR_EMAIL_DOMAIN})만 등록할 수 있습니다.`)),
              },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={`name${STR_EMAIL_DOMAIN}`} />
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
              {arrRoles
                .filter((r) => r.strCode !== 'guest')
                .map((r) => (
                  <Select.Option key={r.strCode} value={r.strCode}>
                    {r.strDisplayName}
                    {r.bIsSystem && <DqpmTag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>시스템</DqpmTag>}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

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
                {arrRoles
                  .filter((r) => r.strCode !== 'guest')
                  .map((r) => (
                    <Select.Option key={r.strCode} value={r.strCode}>
                      {r.strDisplayName}
                      {r.bIsSystem && <DqpmTag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>시스템</DqpmTag>}
                    </Select.Option>
                  ))}
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>

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

      <ApproveUserModal
        bOpen={bApproveModalOpen}
        objUser={objApproveUser}
        arrRoles={arrRoles}
        bLoading={bApproveLoading}
        fnOnCancel={() => {
          setBApproveModalOpen(false);
          setObjApproveUser(null);
        }}
        fnOnApprove={(arrRoleCodes) => void fnHandleApprove(arrRoleCodes)}
      />
    </>
  );
};

export default UserPage;
