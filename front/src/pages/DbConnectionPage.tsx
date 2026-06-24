import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import {
  Typography, Card, Space, Button, Modal,
  Form, Input, Select, InputNumber, Switch, Popconfirm,
  message, Descriptions, Alert, Spin, Tooltip, theme,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import CrudPageShell from '../components/CrudPageShell';
import { ProductNameTag } from '../components/ProductNameTag';
import { DqpmTag } from '../components/DqpmTag';
import {
  fnApiCreateDbConnection,
  fnApiUpdateDbConnection, fnApiDeleteDbConnection,
  fnApiTestDbConnection,
} from '../api/dbConnectionApi';
import { useProductStore } from '../stores/useProductStore';
import { useDbConnectionStore } from '../stores/useDbConnectionStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import type { IDbConnection, TDbConnectionKind, TPermission } from '../types';
import { ARR_DB_CONNECTION_KINDS } from '../types';
import { fnSemanticColor } from '../styles/semanticColors';
import { fnFormatDbConnectionCountryPlatform, fnFormatCountryPlatformOption, STR_SERVICE_SCOPE_LABEL } from '../utils/countryPlatformLabel';

const { Text } = Typography;

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

/** 연결 열 자동 점검: 간격·요청 타임아웃(무응답 시 빨간 점) */
const N_MONITOR_INTERVAL_MS = 30_000;
const N_MONITOR_TIMEOUT_MS = 12_000;
const N_MONITOR_CHUNK_SIZE = 3;

type TMonitorStatus = 'unknown' | 'pending' | 'ok' | 'fail';

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
  const { token } = theme.useToken();
  const [arrConnections, setArrConnections] = useState<IDbConnection[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [bModalOpen, setBModalOpen] = useState(false);
  const [objEditConn, setObjEditConn] = useState<IDbConnection | null>(null);
  const [objSelectedRow, setObjSelectedRow] = useState<IDbConnection | null>(null);  // 확장된 행(선택된 행)
  const [bTesting, setBTesting] = useState<number | null>(null);  // 테스트 중인 커넥션 ID
  const [objTestResult, setObjTestResult] = useState<{ nId: number; result: ITestResult } | null>(null);
  const [mapMonitorStatus, setMapMonitorStatus] = useState<Record<number, TMonitorStatus>>({});
  const [bSaving, setBSaving] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const objSelectedRowRef = useRef<IDbConnection | null>(null);
  objSelectedRowRef.current = objSelectedRow;
  const arrConnectionsRef = useRef<IDbConnection[]>([]);
  arrConnectionsRef.current = arrConnections;

  const arrProducts = useProductStore((s) => s.arrProducts);
  const nFormProductId = Form.useWatch('nProductId', form);
  const nFormServiceId = Form.useWatch('nServiceId', form);
  const strFormEnv = Form.useWatch('strEnv', form);
  const strFormKind = Form.useWatch('strKind', form);
  const objFormProduct = useMemo(
    () => arrProducts.find((p) => p.nId === (objEditConn?.nProductId ?? nFormProductId)),
    [arrProducts, objEditConn?.nProductId, nFormProductId],
  );
  const arrPermissions = useAuthStore((s) => s.user?.arrPermissions || []);
  const fnHas = (p: TPermission) => arrPermissions.includes(p);
  const bCanCreate = fnHas('db_connection.create') || fnHas('db.manage');
  const bCanEdit = fnHas('db_connection.edit') || fnHas('db.manage');
  const bCanDelete = fnHas('db_connection.delete') || fnHas('db.manage');
  /** 「연결」열 표시 — 보기 또는 관리 */
  const bShowConnectionColumn = fnHas('db_connection.view') || fnHas('db.manage');
  /** 연결 테스트 API 호출(자동 점검·행 펼침 시 실행) — 테스트 또는 관리 */
  const bCanRunConnectionTest = fnHas('db_connection.test') || fnHas('db.manage');

  // 목록 조회
  const fnLoad = useCallback(async () => {
    setBLoading(true);
    try {
      await useDbConnectionStore.getState().fnFetchDbConnections();
      const arr = useDbConnectionStore.getState().arrDbConnections;
      setArrConnections(arr);
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
      const objProd = arrProducts.find((p) => p.nId === objConn.nProductId);
      const nSvcId =
        objConn.nServiceId
        ?? objProd?.arrServices.find((s) => s.strAbbr === (objConn.strServiceAbbr ?? '').trim())?.nServiceId;
      form.setFieldsValue({
        ...objConn,
        nServiceId: nSvcId,
        strKind: objConn.strKind || 'GAME',
        strPassword: '',
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

  /** 프로덕트·서비스 구분·환경·접속 종류 조합 중복 (슬롯당 1건) */
  const fnFindScopeDuplicateInList = useCallback((
    nProductId: number | undefined,
    strEnv: string | undefined,
    strKind: string | undefined,
    nServiceId: number | undefined | null,
    nExcludeId?: number,
  ): IDbConnection | undefined => {
    if (!nProductId || !strEnv) return undefined;
    const nSvc = Number(nServiceId) || 0;
    const strKindNorm = (strKind ?? 'GAME') as TDbConnectionKind;
    return arrConnections.find(
      (c) =>
        c.nId !== nExcludeId &&
        c.nProductId === nProductId &&
        c.strEnv === strEnv &&
        (c.strKind ?? 'GAME') === strKindNorm &&
        (nSvc > 0 ? Number(c.nServiceId) === nSvc : !(c.nServiceId ?? 0) && !(c.strServiceAbbr ?? '').trim()),
    );
  }, [arrConnections]);

  const objScopeDuplicate = useMemo(() => {
    if (!bModalOpen) return undefined;
    const nProductId = objEditConn?.nProductId ?? nFormProductId;
    const strEnv = objEditConn?.strEnv ?? strFormEnv;
    const strKind = strFormKind ?? 'GAME';
    return fnFindScopeDuplicateInList(
      nProductId,
      strEnv,
      strKind,
      nFormServiceId,
      objEditConn?.nId,
    );
  }, [
    bModalOpen,
    objEditConn,
    nFormProductId,
    strFormEnv,
    strFormKind,
    nFormServiceId,
    fnFindScopeDuplicateInList,
  ]);

  const fnOpenExistingFromScopeDuplicate = () => {
    if (!objScopeDuplicate) return;
    fnOpenModal(objScopeDuplicate);
    setObjSelectedRow(objScopeDuplicate);
  };

  const nodeScopeDuplicateHint = objScopeDuplicate ? (
    <span style={{ fontSize: 12 }}>
      <ExclamationCircleOutlined style={{ marginRight: 4, color: token.colorWarning }} />
      <span style={{ color: token.colorWarning }}>이미 등록된 접속</span>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {' '}(#{objScopeDuplicate.nId} · {objScopeDuplicate.strHost}:{objScopeDuplicate.nPort}/{objScopeDuplicate.strDatabase})
      </Text>
      {bCanEdit ? (
        <>
          {' · '}
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
            onClick={fnOpenExistingFromScopeDuplicate}
          >
            수정
          </Button>
        </>
      ) : null}
    </span>
  ) : undefined;

  // 저장 — antd 6 Modal onOk는 항상 닫히므로 footer 버튼에서만 호출
  const fnHandleSave = async (): Promise<void> => {
    if (objScopeDuplicate) return;
    setBSaving(true);
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
        const objSaved = (result as { objDbConnection?: IDbConnection }).objDbConnection;
        if (objSaved?.nId) {
          setArrConnections((prev) => {
            const nIdx = prev.findIndex((c) => c.nId === objSaved.nId);
            const objRow = { ...objSaved, strPassword: '••••••••' };
            if (nIdx >= 0) {
              const arrNext = [...prev];
              arrNext[nIdx] = objRow;
              return arrNext;
            }
            return [...prev, objRow];
          });
          useDbConnectionStore.setState((s) => {
            const arr = [...s.arrDbConnections];
            const nIdx = arr.findIndex((c) => c.nId === objSaved.nId);
            const objRow = { ...objSaved, strPassword: '••••••••' };
            if (nIdx >= 0) arr[nIdx] = objRow;
            else arr.push(objRow);
            return { arrDbConnections: arr };
          });
        } else {
          void fnLoad();
        }
        return;
      }

      if ((result as { strErrorCode?: string }).strErrorCode === 'DUPLICATE') {
        messageApi.warning(result.strMessage || '동일한 접속 정보가 이미 있습니다.');
        return;
      }

      messageApi.error(result.strMessage || (objEditConn ? '수정에 실패했습니다.' : '등록에 실패했습니다.'));
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return;
      }
      const strMsg = (err as Error)?.message;
      if (strMsg) messageApi.error(strMsg);
    } finally {
      setBSaving(false);
    }
  };

  const fnCloseModal = () => {
    if (bSaving) return;
    setBModalOpen(false);
    form.resetFields();
    setObjEditConn(null);
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

  // 연결 테스트 — 행 선택 시·수동 호출(긴 타임아웃). 토스트 + 하단 패널
  const fnHandleTest = useCallback(async (objConn: IDbConnection) => {
    if (!bCanRunConnectionTest) return;
    setObjSelectedRow(objConn);
    setBTesting(objConn.nId);
    setObjTestResult(null);
    try {
      const result: ITestResult = await fnApiTestDbConnection(objConn.nId);
      setObjTestResult({ nId: objConn.nId, result });
      setMapMonitorStatus((prev) => ({ ...prev, [objConn.nId]: result.bSuccess ? 'ok' : 'fail' }));
      if (result.bSuccess) {
        messageApi.success('연결 성공!');
      } else {
        messageApi.error(result.strMessage || '연결 실패');
      }
    } catch (error: any) {
      setMapMonitorStatus((prev) => ({ ...prev, [objConn.nId]: 'fail' }));
      messageApi.error(error?.message || '테스트 요청에 실패했습니다.');
    } finally {
      setBTesting(null);
    }
  }, [messageApi, bCanRunConnectionTest]);

  const fnHandleTestRef = useRef(fnHandleTest);
  fnHandleTestRef.current = fnHandleTest;

  // 행 선택 시 자동 테스트 — 연결 테스트 실행 권한 있을 때만
  useEffect(() => {
    if (!objSelectedRow || !bCanRunConnectionTest) return;
    void fnHandleTestRef.current(objSelectedRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택 id·권한만 반응
  }, [objSelectedRow?.nId, bCanRunConnectionTest]);

  // 탭이 보일 때 주기 점검 — 파란점(정상) / 빨간점(실패·무응답). pending 일괄 갱신 없음(깜빡임 방지)
  useEffect(() => {
    if (!bCanRunConnectionTest) return undefined;

    const fnPoll = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const arrAll = arrConnectionsRef.current;
      if (arrAll.length === 0) return;
      const arrActive = arrAll.filter((c) => c.bIsActive);
      const arrTargets = arrActive.length > 0 ? arrActive : arrAll;

      for (let nOff = 0; nOff < arrTargets.length; nOff += N_MONITOR_CHUNK_SIZE) {
        const arrChunk = arrTargets.slice(nOff, nOff + N_MONITOR_CHUNK_SIZE);
        await Promise.all(
          arrChunk.map(async (c) => {
            const result = (await fnApiTestDbConnection(c.nId, {
              nTimeoutMs: N_MONITOR_TIMEOUT_MS,
            })) as ITestResult;
            const strSt: TMonitorStatus = result.bSuccess ? 'ok' : 'fail';
            setMapMonitorStatus((prev) => ({ ...prev, [c.nId]: strSt }));
            if (objSelectedRowRef.current?.nId === c.nId) {
              setObjTestResult({ nId: c.nId, result });
            }
          }),
        );
      }
    };

    void fnPoll();
    const nTimerId = window.setInterval(fnPoll, N_MONITOR_INTERVAL_MS);
    const fnVis = () => {
      if (!document.hidden) void fnPoll();
    };
    document.addEventListener('visibilitychange', fnVis);
    return () => {
      window.clearInterval(nTimerId);
      document.removeEventListener('visibilitychange', fnVis);
    };
  }, [bCanRunConnectionTest]);

  // 선택된 행 아래에 표시할 연결 테스트 상태/결과 패널
  const fnRenderTestPanel = (r: IDbConnection) => {
    if (!bCanRunConnectionTest) {
      return (
        <div style={{ padding: '12px 24px', background: 'var(--ant-color-fill-quaternary)', color: 'var(--ant-color-text-secondary)' }}>
          <Text type="secondary">
            연결 테스트를 실행하려면 db_connection.test 또는 db.manage 권한이 필요합니다. 「연결」열은 보기 권한이 있으면 표시되며, 점검·색상은 테스트 권한이 있을 때만 갱신됩니다.
          </Text>
        </div>
      );
    }
    const bIsTesting = bTesting === r.nId;
    const objResultForRow = objTestResult?.nId === r.nId ? objTestResult.result : null;

    if (bIsTesting) {
      return (
        <div style={{ padding: '12px 24px', background: 'var(--ant-color-fill-quaternary)' }}>
          <Spin tip="연결 테스트 중..." />
        </div>
      );
    }
    if (objResultForRow) {
      return (
        <div style={{ padding: 12, background: 'var(--ant-color-fill-quaternary)' }}>
          <Card
            size="small"
            style={{
              margin: 0,
              borderColor: objResultForRow.bSuccess
                ? fnSemanticColor('success', token)
                : fnSemanticColor('error', token),
            }}
          >
            {objResultForRow.bSuccess ? (
              <>
                <Text strong style={{ color: fnSemanticColor('success', token) }}>
                  <CheckCircleOutlined style={{ marginRight: 6 }} />
                  연결 성공
                </Text>
                {objResultForRow.objDbInfo && (
                  <Descriptions size="small" column={3} style={{ marginTop: 8 }}>
                    <Descriptions.Item label="IP">{r.strHost}</Descriptions.Item>
                    <Descriptions.Item label="PORT">{r.nPort}</Descriptions.Item>
                    <Descriptions.Item label="DB명">{objResultForRow.objDbInfo.strDatabase}</Descriptions.Item>
                    <Descriptions.Item label="사용자">{objResultForRow.objDbInfo.strUser}</Descriptions.Item>
                    <Descriptions.Item label="서버">{objResultForRow.objDbInfo.strServer}</Descriptions.Item>
                    <Descriptions.Item label="버전">{objResultForRow.objDbInfo.strVersion}</Descriptions.Item>
                    <Descriptions.Item label="서버 시각">{objResultForRow.objDbInfo.strServerTime}</Descriptions.Item>
                  </Descriptions>
                )}
              </>
            ) : (
              <Alert
                type="error"
                showIcon
                icon={<CloseCircleOutlined />}
                message="연결 실패"
                description={objResultForRow.strError}
              />
            )}
          </Card>
        </div>
      );
    }
    return (
      <div style={{ padding: '12px 24px', background: 'var(--ant-color-fill-quaternary)', color: 'var(--ant-color-text-secondary)' }}>
        <Text type="secondary">
          행을 선택하면 연결 테스트가 실행되고, 결과가 여기에 표시됩니다. 연결 열은 약 {N_MONITOR_INTERVAL_MS / 1000}초마다 자동 점검합니다.
        </Text>
      </div>
    );
  };

  const arrColumns = [
    fnMakeIndexColumn<IDbConnection>(),
    {
      title: '프로덕트',
      key: 'product',
      width: 120,
      render: (_: unknown, r: IDbConnection) => {
        const strDisplayName =
          arrProducts.find((p) => p.nId === r.nProductId)?.strName ?? r.strProductName;
        return <ProductNameTag strName={strDisplayName} />;
      },
    },
    {
      title: STR_SERVICE_SCOPE_LABEL,
      key: 'serviceScope',
      width: 110,
      render: (_: unknown, r: IDbConnection) => {
        const strLabel = fnFormatDbConnectionCountryPlatform(r.strServiceAbbr);
        const bUnset = !(r.strServiceAbbr ?? '').trim();
        return bUnset ? (
          <Tooltip title="등록 시점에 약자 미입력 — 수정에서 FH/KR, DK/KR, DK/G 등을 지정해주세요">
            <DqpmTag tone="warning" style={{ fontSize: 11 }}>
              {strLabel}
            </DqpmTag>
          </Tooltip>
        ) : (
          <DqpmTag tone="service">{strLabel}</DqpmTag>
        );
      },
    },
    {
      title: '환경',
      dataIndex: 'strEnv',
      key: 'strEnv',
      width: 80,
      render: (v: string) => (
        <DqpmTag color={OBJ_ENV_COLOR[v]} style={{ fontWeight: 700 }}>
          {v.toUpperCase()}
        </DqpmTag>
      ),
    },
    {
      title: '종류',
      dataIndex: 'strKind',
      key: 'strKind',
      width: 80,
      render: (v: TDbConnectionKind) => (
        <DqpmTag color={OBJ_KIND_COLOR[v || 'GAME']}>{v || 'GAME'}</DqpmTag>
      ),
    },
    {
      title: 'DB 타입',
      dataIndex: 'strDbType',
      key: 'strDbType',
      width: 80,
      render: (v: string) => <DqpmTag color={OBJ_DB_COLOR[v]}>{v.toUpperCase()}</DqpmTag>,
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
        ? <DqpmTag color="green">활성</DqpmTag>
        : <DqpmTag color="default">비활성</DqpmTag>,
    },
    ...(bShowConnectionColumn
      ? [
          {
            title: '연결',
            key: 'monitoring',
            width: 100,
            align: 'center' as const,
            render: (_: unknown, r: IDbConnection) => {
              const strSt = mapMonitorStatus[r.nId] ?? 'unknown';
              const strConnAddr = `${r.strHost}:${r.nPort}`;
              const strTip =
                strSt === 'ok'
                  ? `연결 정상 · ${strConnAddr} / ${r.strDatabase} (자동 점검, 약 ${N_MONITOR_INTERVAL_MS / 1000}초마다)`
                  : strSt === 'fail'
                    ? `연결 실패 · ${strConnAddr} / ${r.strDatabase} · 무응답 또는 타임아웃(${N_MONITOR_TIMEOUT_MS / 1000}초)`
                    : strSt === 'pending'
                      ? '점검 중…'
                      : bCanRunConnectionTest
                        ? '점검 전'
                        : '연결 테스트(db_connection.test) 권한이 있으면 자동 점검·색 표시';
              const strColor =
                strSt === 'ok'
                  ? fnSemanticColor('info', token)
                  : strSt === 'fail'
                    ? fnSemanticColor('error', token)
                    : strSt === 'pending'
                      ? fnSemanticColor('warning', token)
                      : String(token.colorTextQuaternary);
              const strShadow =
                strSt === 'ok'
                  ? '0 0 8px rgba(22, 119, 255, 0.42)'
                  : strSt === 'fail'
                    ? '0 0 6px rgba(255, 77, 79, 0.35)'
                    : 'none';
              const bBreathe = strSt === 'ok' || strSt === 'fail';
              return (
                <Tooltip title={strTip}>
                  <span
                    className={bBreathe ? 'db-conn-page-dot--breathe' : undefined}
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
        ]
      : []),
    {
      title: '수정일',
      dataIndex: 'dtUpdatedAt',
      key: 'dtUpdatedAt',
      width: 140,
      render: (v: string) => <Text style={{ fontSize: 11 }}>{new Date(v).toLocaleString('ko-KR')}</Text>,
    },
    ...(bCanEdit || bCanDelete
      ? [
          {
            title: '관리',
            key: 'actions',
            width: 140,
            render: (_: unknown, r: IDbConnection) => (
              <Space onClick={(e) => e.stopPropagation()}>
                {bCanEdit && (
                  <Tooltip title="수정">
                    <Button type="text" icon={<EditOutlined />} onClick={() => fnOpenModal(r)} />
                  </Tooltip>
                )}
                {bCanDelete && (
                  <Popconfirm
                    title="정말 삭제하시겠습니까?"
                    onConfirm={() => fnHandleDelete(r.nId)}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Tooltip title="삭제">
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <style>
        {`
          @keyframes dbConnPageDotBreathe {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.65; }
          }
          .db-conn-page-dot--breathe {
            animation: dbConnPageDotBreathe 2.6s ease-in-out infinite;
          }
        `}
      </style>
      {contextHolder}

      <CrudPageShell
        strTitle="DB 접속 정보 관리"
        nodeIcon={<DatabaseOutlined />}
        nodeDescription={
          bShowConnectionColumn && bCanRunConnectionTest ? (
            <>
              「연결」열은 db_connection.view로 표시됩니다. 브라우저가 연결 테스트 API를 약 {N_MONITOR_INTERVAL_MS / 1000}초마다 호출해 DB 응답을 표시합니다(타임아웃 {N_MONITOR_TIMEOUT_MS / 1000}초, 무응답·오류 시 빨간 점). 탭이 백그라운드일 때는 화면으로 돌아올 때 다시 점검합니다. 행을 펼치면 수동 테스트와 상세 결과를 볼 수 있습니다(db_connection.test).
            </>
          ) : bShowConnectionColumn ? (
            <>「연결」열은 보기 권한으로 표시됩니다. 자동 점검·색·행 펼침 테스트는 db_connection.test(또는 db.manage) 권한이 있을 때만 동작합니다.</>
          ) : (
            <>DB 접속 목록은 db_connection.view(또는 db.manage) 권한이 필요합니다.</>
          )
        }
        nodeExtra={
          bCanCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => fnOpenModal()}>
              새로운 DB 접속 정보
            </Button>
          ) : undefined
        }
      >
        {arrConnections.some((c) => !(c.strServiceAbbr ?? '').trim()) ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`${STR_SERVICE_SCOPE_LABEL} 미지정 접속이 있습니다`}
            description={`기존 등록분은 약자(FH/KR, LH/KR, DK/KR, DK/G 등)가 비어 있을 수 있습니다. 「전체(미지정)」는 모든 ${STR_SERVICE_SCOPE_LABEL} fallback용입니다. 서비스별 DB가 다르면 수정에서 약자를 지정해주세요.`}
          />
        ) : null}
        <AppTable
          strTableId="db_connections"
          dataSource={arrConnections}
          columns={arrColumns}
          loading={bLoading}
          pagination={false}
          strEmptyText="등록된 DB 접속 정보가 없습니다."
          expandable={{
            expandedRowKeys: objSelectedRow ? [objSelectedRow.nId] : [],
            onExpand: (bExpanded, r) => setObjSelectedRow(bExpanded ? r : null),
            expandedRowRender: (r) => fnRenderTestPanel(r),
            showExpandColumn: false,
            rowExpandable: () => true,
          }}
          rowClassName={(r: IDbConnection) => (r.nId === objSelectedRow?.nId ? 'ant-table-row-selected' : '')}
          onRow={(r: IDbConnection) => ({
            onClick: () => setObjSelectedRow((prev) => (prev?.nId === r.nId ? null : r)),
            style: { cursor: 'pointer' },
          })}
        />
      </CrudPageShell>

      {/* 추가/수정 모달 */}
      <Modal
        title={objEditConn ? 'DB 접속 정보 수정' : 'DB 접속 정보 추가'}
        open={bModalOpen}
        onCancel={fnCloseModal}
        footer={(
          <Space>
            <Button onClick={fnCloseModal} disabled={bSaving}>취소</Button>
            <Button
              type="primary"
              loading={bSaving}
              disabled={!!objScopeDuplicate}
              onClick={() => void fnHandleSave()}
            >
              {objEditConn ? '수정' : '등록'}
            </Button>
          </Space>
        )}
        width={520}
        destroyOnClose
        maskClosable={!bSaving}
        closable={!bSaving}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {objEditConn && !(objEditConn.nServiceId ?? 0) && !(objEditConn.strServiceAbbr ?? '').trim() ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${STR_SERVICE_SCOPE_LABEL} 미지정`}
              description="이 접속은 약자 없이 등록되어 있습니다. DK/KR·DK/G 등 해당 DB에 맞는 약자를 선택해 저장해주세요."
            />
          ) : null}
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

          <Form.Item
            name="nServiceId"
            label={STR_SERVICE_SCOPE_LABEL}
            extra="FH/KR, LH/KR, DK/KR, DK/G 등 프로덕트에 등록된 서비스. 비우면 전체(미지정·fallback)."
          >
            <Select
              allowClear
              placeholder={objFormProduct ? '서비스 선택 (예: DK/KR, DK/G)' : '먼저 프로덕트를 선택하세요'}
              disabled={!objFormProduct}
            >
              {(objFormProduct?.arrServices ?? []).map((s) => (
                <Select.Option key={s.nServiceId ?? s.strAbbr} value={s.nServiceId}>
                  {fnFormatCountryPlatformOption(s)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* 환경 선택 (추가 시에만) */}
          {!objEditConn && (
            <Form.Item
              name="strEnv"
              label="환경"
              rules={[{ required: true, message: '환경을 선택해주세요.' }]}
            >
              <Select placeholder="환경 선택">
                <Select.Option value="dev">
                  <DqpmTag color="green">DEV</DqpmTag> 개발/테스트 환경
                </Select.Option>
                <Select.Option value="qa">
                  <DqpmTag color="orange">QA</DqpmTag> QA 환경
                </Select.Option>
                <Select.Option value="live">
                  <DqpmTag color="red">LIVE</DqpmTag> 운영 환경
                </Select.Option>
              </Select>
            </Form.Item>
          )}

          {/* 접속 종류 (GAME/WEB/LOG) */}
          <Form.Item
            name="strKind"
            label="접속 종류"
            rules={[{ required: true, message: '종류를 선택해주세요.' }]}
            validateStatus={objScopeDuplicate ? 'warning' : undefined}
            help={nodeScopeDuplicateHint}
          >
            <Select placeholder="종류 선택">
              {ARR_DB_CONNECTION_KINDS.map((k) => (
                <Select.Option key={k} value={k}>
                  <DqpmTag color={OBJ_KIND_COLOR[k]}>{k}</DqpmTag>
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
