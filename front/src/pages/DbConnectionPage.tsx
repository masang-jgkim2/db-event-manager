import { useState, useEffect, useCallback } from 'react';

import {
  Typography, Card, Tag, Space, Button, Modal,
  Form, Input, Select, InputNumber, Switch, Popconfirm,
  message, Descriptions, Alert, Spin,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import {
  fnApiGetDbConnections, fnApiCreateDbConnection,
  fnApiUpdateDbConnection, fnApiDeleteDbConnection,
  fnApiTestDbConnection,
} from '../api/dbConnectionApi';
import { useProductStore } from '../stores/useProductStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { IDbConnection, TDbConnectionKind } from '../types';
import { ARR_DB_CONNECTION_KINDS } from '../types';

const { Title, Text } = Typography;

const OBJ_KIND_COLOR: Record<TDbConnectionKind, string> = {
  GAME: 'blue',
  WEB: 'geekblue',
  LOG: 'purple',
};

// 환경 태그 색상
const OBJ_ENV_COLOR: Record<string, string> = {
  dev: 'green',
  qa: 'orange',
  live: 'red',
};

// DB 타입 태그 색상
const OBJ_DB_COLOR: Record<string, string> = {
  mssql: 'blue',
  mysql: 'cyan',
};

// 연결 테스트 결과 타입
interface ITestResult {
  bSuccess: boolean;
  strMessage: string;
  objDbInfo?: {
    strDatabase: string;
    strUser: string;
    strServer: string;
    strVersion: string;
    strServerTime: string;
  };
  strError?: string;
}

const DbConnectionPage = () => {
  const [arrConnections, setArrConnections] = useState<IDbConnection[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditConn, setObjEditConn] = useState<IDbConnection | null>(null);
  const [bTesting, setBTesting] = useState<number | null>(null);  // 테스트 중인 커넥션 ID
  const [objTestResult, setObjTestResult] = useState<{ nId: number; result: ITestResult } | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const arrProducts = useProductStore((s) => s.arrProducts);
  const arrPermissions = useAuthStore((s) => s.user?.arrPermissions || []);
  const fnHas = (p: string) => arrPermissions.includes(p);
  const bCanCreate = fnHas('db_connection.create') || fnHas('db.manage');
  const bCanEdit = fnHas('db_connection.edit') || fnHas('db.manage');
  const bCanDelete = fnHas('db_connection.delete') || fnHas('db.manage');
  const bCanTest = fnHas('db_connection.test') || fnHas('db.manage');

  // 목록 조회
  const fnLoad = useCallback(async () => {
    setBLoading(true);
    try {
      const result = await fnApiGetDbConnections();
      if (result.bSuccess) setArrConnections(result.arrDbConnections);
    } catch {
      messageApi.error('DB 접속 정보를 불러올 수 없습니다.');
    } finally {
      setBLoading(false);
    }
  }, [messageApi]);

  useEffect(() => { fnLoad(); }, [fnLoad]);
  useAutoRefresh(fnLoad);

  // 추가/수정 모달 열기
  const fnOpenModal = (objConn?: IDbConnection) => {
    if (objConn) {
      setObjEditConn(objConn);
      form.setFieldsValue({
        ...objConn,
        strKind: objConn.strKind || 'GAME',
        strPassword: '',  // 비밀번호는 재입력 요구
      });
    } else {
      setObjEditConn(null);
      form.resetFields();
      form.setFieldsValue({ nPort: 1433, strKind: 'GAME' });
    }
    setBModalOpen(true);
  };

  // DB 타입 변경 시 기본 포트 자동 설정
  const fnHandleDbTypeChange = (strDbType: string) => {
    form.setFieldValue('nPort', strDbType === 'mssql' ? 1433 : 3306);
  };

  // 저장 — 성공/중복/오류를 구분해 표시, 성공 시에만 모달 닫힘
  const fnHandleSave = async () => {
    try {
      const objValues = await form.validateFields();
      const result = objEditConn
        ? await fnApiUpdateDbConnection(objEditConn.nId, objValues)
        : await fnApiCreateDbConnection(objValues);

      if (result.bSuccess) {
        messageApi.success(objEditConn ? 'DB 접속 정보가 수정되었습니다.' : 'DB 접속 정보가 등록되었습니다.');
        setBModalOpen(false);
        form.resetFields();
        setObjEditConn(null);
        fnLoad();
      } else if ((result as any).strErrorCode === 'DUPLICATE') {
        // 중복 등록 시 warning 아이콘으로 구분
        messageApi.warning(result.strMessage);
      } else {
        messageApi.error(result.strMessage || (objEditConn ? '수정에 실패했습니다.' : '등록에 실패했습니다.'));
      }
    } catch {
      // 유효성 검사 실패 — Ant Design Form 인라인 에러 표시
    }
  };

  // 삭제
  const fnHandleDelete = async (nId: number) => {
    try {
      const result = await fnApiDeleteDbConnection(nId);
      if (result.bSuccess) {
        messageApi.success('삭제되었습니다.');
        fnLoad();
      } else {
        messageApi.error(result.strMessage);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '삭제에 실패했습니다.');
    }
  };

  // 연결 테스트
  const fnHandleTest = async (objConn: IDbConnection) => {
    setBTesting(objConn.nId);
    setObjTestResult(null);
    try {
      const result: ITestResult = await fnApiTestDbConnection(objConn.nId);
      setObjTestResult({ nId: objConn.nId, result });
      if (result.bSuccess) {
        messageApi.success('연결 성공!');
      } else {
        messageApi.error(result.strMessage || '연결 실패');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '테스트 요청에 실패했습니다.');
    } finally {
      setBTesting(null);
    }
  };

  const arrColumns = [
    fnMakeIndexColumn(),
    {
      title: '프로덕트',
      key: 'product',
      width: 120,
      render: (_: unknown, r: IDbConnection) => <Text strong>{r.strProductName}</Text>,
    },
    {
      title: '환경',
      dataIndex: 'strEnv',
      key: 'strEnv',
      width: 80,
      render: (v: string) => (
        <Tag color={OBJ_ENV_COLOR[v]} style={{ fontWeight: 700 }}>
          {v.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '종류',
      dataIndex: 'strKind',
      key: 'strKind',
      width: 80,
      render: (v: TDbConnectionKind) => (
        <Tag color={OBJ_KIND_COLOR[v || 'GAME']}>{v || 'GAME'}</Tag>
      ),
    },
    {
      title: 'DB 타입',
      dataIndex: 'strDbType',
      key: 'strDbType',
      width: 80,
      render: (v: string) => <Tag color={OBJ_DB_COLOR[v]}>{v.toUpperCase()}</Tag>,
    },
    {
      title: '접속 정보',
      key: 'connInfo',
      render: (_: unknown, r: IDbConnection) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{r.strHost}:{r.nPort}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.strDatabase} / {r.strUser}</Text>
        </Space>
      ),
    },
    {
      title: '상태',
      dataIndex: 'bIsActive',
      key: 'bIsActive',
      width: 80,
      render: (v: boolean) => v
        ? <Tag color="green">활성</Tag>
        : <Tag color="default">비활성</Tag>,
    },
    {
      title: '수정일',
      dataIndex: 'dtUpdatedAt',
      key: 'dtUpdatedAt',
      width: 140,
      render: (v: string) => <Text style={{ fontSize: 11 }}>{new Date(v).toLocaleString('ko-KR')}</Text>,
    },
    ...(bCanTest || bCanEdit || bCanDelete
      ? [{
          title: '관리',
          key: 'actions',
          width: 220,
          render: (_: unknown, r: IDbConnection) => (
            <Space>
              {bCanTest && (
                <Button
                  size="small"
                  icon={bTesting === r.nId ? <Spin size="small" /> : <ApiOutlined />}
                  onClick={() => fnHandleTest(r)}
                  disabled={bTesting !== null}
                  title="연결 테스트"
                >
                  테스트
                </Button>
              )}
              {bCanEdit && (
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => fnOpenModal(r)}
                >
                  수정
                </Button>
              )}
              {bCanDelete && (
                <Popconfirm
                  title="정말 삭제하시겠습니까?"
                  onConfirm={() => fnHandleDelete(r.nId)}
                  okText="삭제"
                  cancelText="취소"
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </Space>
          ),
        }]
      : []),
  ];

  return (
    <>
      {contextHolder}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          DB 접속 정보 관리
        </Title>
        {bCanCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
            새로운 DB 접속 정보
          </Button>
        )}
      </div>

      {/* 테스트 결과 표시 */}
      {objTestResult && (
        <Card
          size="small"
          style={{ marginBottom: 16, borderColor: objTestResult.result.bSuccess ? '#52c41a' : '#ff4d4f' }}
        >
          {objTestResult.result.bSuccess ? (
            <>
              <Text strong style={{ color: '#52c41a' }}>
                <CheckCircleOutlined style={{ marginRight: 6 }} />
                연결 성공
              </Text>
              {objTestResult.result.objDbInfo && (
                <Descriptions size="small" column={3} style={{ marginTop: 8 }}>
                  <Descriptions.Item label="DB명">{objTestResult.result.objDbInfo.strDatabase}</Descriptions.Item>
                  <Descriptions.Item label="사용자">{objTestResult.result.objDbInfo.strUser}</Descriptions.Item>
                  <Descriptions.Item label="서버">{objTestResult.result.objDbInfo.strServer}</Descriptions.Item>
                  <Descriptions.Item label="버전">{objTestResult.result.objDbInfo.strVersion}</Descriptions.Item>
                  <Descriptions.Item label="서버 시각">{objTestResult.result.objDbInfo.strServerTime}</Descriptions.Item>
                </Descriptions>
              )}
            </>
          ) : (
            <Alert
              type="error"
              showIcon
              icon={<CloseCircleOutlined />}
              message="연결 실패"
              description={objTestResult.result.strError}
            />
          )}
        </Card>
      )}

      <Card>
        <AppTable
          strTableId="db_connections"
          dataSource={arrConnections}
          columns={arrColumns}
          loading={bLoading}
          pagination={false}
          strEmptyText="등록된 DB 접속 정보가 없습니다."
        />
      </Card>

      {/* 추가/수정 모달 */}
      <Modal
        title={objEditConn ? 'DB 접속 정보 수정' : 'DB 접속 정보 추가'}
        open={bModalOpen}
        onOk={fnHandleSave}
        onCancel={() => { setBModalOpen(false); form.resetFields(); setObjEditConn(null); }}
        okText={objEditConn ? '수정' : '등록'}
        cancelText="취소"
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* 프로덕트 선택 (추가 시에만) */}
          {!objEditConn && (
            <Form.Item
              name="nProductId"
              label="프로덕트"
              rules={[{ required: true, message: '프로덕트를 선택해주세요.' }]}
            >
              <Select placeholder="프로덕트 선택" showSearch optionFilterProp="children">
                {arrProducts.map((p) => (
                  <Select.Option key={p.nId} value={p.nId}>{p.strName}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 환경 선택 (추가 시에만) */}
          {!objEditConn && (
            <Form.Item
              name="strEnv"
              label="환경"
              rules={[{ required: true, message: '환경을 선택해주세요.' }]}
            >
              <Select placeholder="환경 선택">
                <Select.Option value="dev">
                  <Tag color="green">DEV</Tag> 개발/테스트 환경
                </Select.Option>
                <Select.Option value="qa">
                  <Tag color="orange">QA</Tag> QA 환경
                </Select.Option>
                <Select.Option value="live">
                  <Tag color="red">LIVE</Tag> 운영 환경
                </Select.Option>
              </Select>
            </Form.Item>
          )}

          {/* 접속 종류 (GAME/WEB/LOG) */}
          <Form.Item
            name="strKind"
            label="접속 종류"
            rules={[{ required: true, message: '종류를 선택해주세요.' }]}
          >
            <Select placeholder="종류 선택">
              {ARR_DB_CONNECTION_KINDS.map((k) => (
                <Select.Option key={k} value={k}>
                  <Tag color={OBJ_KIND_COLOR[k]}>{k}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="strDbType"
            label="DB 종류"
            rules={[{ required: true, message: 'DB 종류를 선택해주세요.' }]}
          >
            <Select placeholder="DB 종류 선택" onChange={fnHandleDbTypeChange}>
              <Select.Option value="mssql">MSSQL (기본 포트: 1433)</Select.Option>
              <Select.Option value="mysql">MySQL (기본 포트: 3306)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="strHost"
            label="호스트"
            rules={[{ required: true, message: '호스트를 입력해주세요.' }]}
          >
            <Input placeholder="예: 192.168.1.100 또는 db.example.com" />
          </Form.Item>

          <Form.Item name="nPort" label="포트" rules={[{ required: true, message: '포트를 입력해주세요.' }]}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="strDatabase"
            label="데이터베이스명"
            rules={[{ required: true, message: '데이터베이스명을 입력해주세요.' }]}
          >
            <Input placeholder="예: game_db" />
          </Form.Item>

          <Form.Item
            name="strUser"
            label="사용자 계정"
            rules={[{ required: true, message: '사용자 계정을 입력해주세요.' }]}
          >
            <Input placeholder="예: dba_user" />
          </Form.Item>

          <Form.Item
            name="strPassword"
            label={objEditConn ? '비밀번호 (변경 시에만 입력)' : '비밀번호'}
            rules={!objEditConn ? [{ required: true, message: '비밀번호를 입력해주세요.' }] : []}
          >
            <Input.Password placeholder={objEditConn ? '변경하지 않으려면 비워두세요' : '접속 비밀번호'} />
          </Form.Item>

          {objEditConn && (
            <Form.Item name="bIsActive" label="활성화 상태" valuePropName="checked">
              <Switch checkedChildren="활성" unCheckedChildren="비활성" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
};

export default DbConnectionPage;
