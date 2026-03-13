import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Typography, Card, Tag, Space, Button, Modal,
  Input, message, Row, Col, Statistic, Timeline, Popconfirm,
  Segmented, Select, Descriptions, Alert, Spin, Divider, Progress, DatePicker,
  Steps, Checkbox, Tooltip, theme as antdTheme, Collapse,
} from 'antd';
import dayjs from 'dayjs';
import {
  EyeOutlined, CheckOutlined, ClockCircleOutlined,
  SyncOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  RocketOutlined, CopyOutlined, UserOutlined, EditOutlined,
  SendOutlined, ExclamationCircleOutlined, ThunderboltOutlined,
  EyeInvisibleOutlined, EyeTwoTone, CodeOutlined,
  TableOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import AppTable, { fnMakeIndexColumn } from '../components/AppTable';
import RequestWithLongPressButton from '../components/RequestWithLongPressButton';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';
import { useEventInstanceStore } from '../stores/useEventInstanceStore';
import type {
  IEventInstance, TEventStatus, IStageActor,
  IQueryExecutionResult, TDeployScope,
} from '../types';
import { OBJ_STATUS_CONFIG, ARR_DEPLOY_SCOPE_OPTIONS, fnFormatPermissionErrorMessage } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SKIP_CONFIRM_KEY = 'dashboard_skip_confirm_';

// 다시 보지 않기 체크박스가 있는 Popconfirm (요청/숨기기 버튼용)
interface IPopconfirmWithSkipProps {
  actionKey: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  okText?: string;
  cancelText?: string;
  onConfirm: () => void;
  children: React.ReactElement;
  disabled?: boolean;
  okButtonProps?: React.ComponentProps<typeof Button>;
}
const PopconfirmWithSkip = ({
  actionKey, title, description, okText = '확인', cancelText = '취소',
  onConfirm, children, disabled, okButtonProps,
}: IPopconfirmWithSkipProps) => {
  const [bDontShowAgain, setBDontShowAgain] = useState(false);
  const bSkip = typeof window !== 'undefined' && localStorage.getItem(SKIP_CONFIRM_KEY + actionKey) === '1';

  const fnHandleConfirm = () => {
    if (bDontShowAgain) localStorage.setItem(SKIP_CONFIRM_KEY + actionKey, '1');
    onConfirm();
  };

  if (bSkip) {
    if (disabled) return children;
    return React.cloneElement(children, { onClick: fnHandleConfirm });
  }

  const content = (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {description && <div>{description}</div>}
      <Checkbox checked={bDontShowAgain} onChange={(e) => setBDontShowAgain(e.target.checked)}>
        다시 보지 않기
      </Checkbox>
    </Space>
  );

  return (
    <Popconfirm
      title={title}
      description={content}
      okText={okText}
      cancelText={cancelText}
      onConfirm={fnHandleConfirm}
      disabled={disabled}
      okButtonProps={okButtonProps}
    >
      {children}
    </Popconfirm>
  );
};

// 처리자 표시 컴포넌트
const ActorTag = ({ objActor, strLabel }: { objActor: IStageActor | null; strLabel: string }) => {
  if (!objActor) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
  return (
    <Space size={4}>
      <Text style={{ fontSize: 12 }}>{strLabel}:</Text>
      <Tag icon={<UserOutlined />} color="blue" style={{ fontSize: 11 }}>{objActor.strDisplayName}</Tag>
      <Text type="secondary" style={{ fontSize: 11 }}>{new Date(objActor.dtProcessedAt).toLocaleString('ko-KR')}</Text>
    </Space>
  );
};

// 쿼리 실행 결과 모달 컴포넌트
const ExecutionResultModal = ({
  bOpen,
  objResult,
  strEnv,
  onClose,
}: {
  bOpen: boolean;
  objResult: IQueryExecutionResult | null;
  strEnv: 'qa' | 'live';
  onClose: () => void;
}) => {
  const { token } = antdTheme.useToken();
  if (!objResult) return null;

  return (
    <Modal
      title={
        <Space>
          {objResult.bSuccess
            ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            : <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
          }
          <span>{strEnv.toUpperCase()} 쿼리 실행 {objResult.bSuccess ? '완료' : '실패'}</span>
        </Space>
      }
      open={bOpen}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>확인</Button>,
      ]}
      width={640}
    >
      {objResult.bSuccess ? (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="success"
            showIcon
            message={`${strEnv.toUpperCase()} DB에 쿼리가 성공적으로 실행되었습니다.`}
          />
          {/* 실행 요약 */}
          <Card size="small" title="실행 요약">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="총 처리 건수"
                  value={objResult.nTotalAffectedRows}
                  suffix="건"
                  valueStyle={{ color: '#1890ff', fontSize: 24 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="실행 시간"
                  value={objResult.nElapsedMs}
                  suffix="ms"
                  valueStyle={{ color: '#52c41a', fontSize: 24 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="쿼리 수"
                  value={objResult.arrQueryResults.length}
                  suffix="개"
                  valueStyle={{ fontSize: 24 }}
                />
              </Col>
            </Row>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                실행 시각: {new Date(objResult.dtExecutedAt).toLocaleString('ko-KR')}
              </Text>
            </div>
          </Card>

          {/* 개별 쿼리 결과 */}
          {objResult.arrQueryResults.length > 1 && (
            <Card size="small" title="쿼리별 결과">
              {objResult.arrQueryResults.map((r) => (
                <div key={r.nIndex} style={{ marginBottom: 8 }}>
                  <Space>
                    <Tag color="blue">#{r.nIndex + 1}</Tag>
                    <Tag color="green">{r.nAffectedRows}건 처리</Tag>
                  </Space>
                  <div
                    style={{
                      marginTop: 4,
                      padding: '6px 10px',
                      background: token.colorFillTertiary,
                      borderRadius: token.borderRadiusSM,
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: token.colorText,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 80,
                      overflow: 'auto',
                    }}
                  >
                    {r.strQuery}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="error"
            showIcon
            message="실행 실패"
            description={
              <Space direction="vertical" size={4}>
                <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {objResult.strError}
                </Text>
                {objResult.strRollbackMsg && (
                  <Text strong style={{ color: '#1890ff' }}>✓ {objResult.strRollbackMsg}</Text>
                )}
              </Space>
            }
          />
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              시도 시각: {new Date(objResult.dtExecutedAt).toLocaleString('ko-KR')}
              {objResult.nElapsedMs > 0 && ` · ${objResult.nElapsedMs}ms`}
            </Text>
          </div>
          {/* 실행을 시도한 쿼리 표시 (디버깅용) */}
          {objResult.strExecutedQuery && (
            <Card size="small" title="실행 시도 쿼리" extra={
              <Text type="secondary" style={{ fontSize: 11 }}>오류 원인 파악용</Text>
            }>
              <div style={{
                padding: '8px 12px',
                background: token.colorFillTertiary,
                borderRadius: token.borderRadiusSM,
                fontFamily: 'monospace',
                fontSize: 11,
                color: token.colorText,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 160,
                overflow: 'auto',
              }}>
                {objResult.strExecutedQuery}
              </div>
            </Card>
          )}
        </Space>
      )}
    </Modal>
  );
};

// 이벤트 인스턴스의 arrDeployScope에 따라 스텝 목록을 동적으로 생성
const fnBuildSteps = (objInstance: IEventInstance) => {
  const arrScope = objInstance.arrDeployScope ?? ['qa', 'live'];
  const bHasQa = arrScope.includes('qa');
  const bHasLive = arrScope.includes('live');

  const arrSteps = [
    { strStatus: 'event_created',     strLabel: '작성',          strSubLabel: '' },
    { strStatus: 'confirm_requested', strLabel: '컨펌 요청',     strSubLabel: '' },
    { strStatus: 'dba_confirmed',     strLabel: 'DBA 컨펌',      strSubLabel: '' },
  ];

  if (bHasQa) {
    arrSteps.push(
      { strStatus: 'qa_requested', strLabel: 'QA 요청',  strSubLabel: '' },
      { strStatus: 'qa_deployed',  strLabel: 'QA 쿼리 실행',  strSubLabel: '' },
      { strStatus: 'qa_verified',  strLabel: 'QA 확인',  strSubLabel: '' },
    );
  }

  if (bHasLive) {
    arrSteps.push(
      { strStatus: 'live_requested', strLabel: 'LIVE 요청', strSubLabel: '' },
      { strStatus: 'live_deployed',  strLabel: 'LIVE 쿼리 실행', strSubLabel: '' },
      { strStatus: 'live_verified',  strLabel: '완료',       strSubLabel: '' },
    );
  }

  // 현재 상태의 스텝 인덱스 계산
  const nCurrentIdx = arrSteps.findIndex((s) => s.strStatus === objInstance.strStatus);
  const nStep = nCurrentIdx >= 0 ? nCurrentIdx : 0;

  // 이미 완료된 상태면 마지막 스텝을 finish로
  const bFinished = objInstance.strStatus === 'live_verified';

  return { arrSteps, nStep, bFinished };
};

// 이벤트별 진행 상태 스테퍼 컴포넌트 — 행 인라인 확장용
const InstanceStepper = ({ objInstance }: { objInstance: IEventInstance }) => {
  const { arrSteps, nStep, bFinished } = fnBuildSteps(objInstance);
  const arrScope = objInstance.arrDeployScope ?? ['qa', 'live'];
  const { token } = antdTheme.useToken();

  return (
    <div style={{
      padding: '12px 24px 16px',
      background: token.colorFillAlter,
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>쿼리 실행 대상:</Text>
        {arrScope.map((s) => (
          <Tag key={s} color={s === 'qa' ? 'orange' : 'red'} style={{ fontSize: 11 }}>
            {s.toUpperCase()}
          </Tag>
        ))}
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>진행 단계:</Text>
        <Tag color={OBJ_STATUS_CONFIG[objInstance.strStatus].strColor} style={{ fontSize: 11 }}>
          {OBJ_STATUS_CONFIG[objInstance.strStatus].strLabel}
        </Tag>
      </div>
      <Steps
        current={nStep}
        status={bFinished ? 'finish' : 'process'}
        size="small"
        items={arrSteps.map((s, nIdx) => ({
          title: s.strLabel,
          status: (() => {
            if (nIdx < nStep) return 'finish' as const;
            if (nIdx === nStep) return (bFinished ? 'finish' : 'process') as const;
            return 'wait' as const;
          })(),
        }))}
      />
    </div>
  );
};

const MyDashboardPage = () => {
  const [objDetail, setObjDetail] = useState<IEventInstance | null>(null);
  const [bDetailOpen, setBDetailOpen] = useState(false);
  // 테이블에서 선택된 이벤트 (상단 스테퍼 표시용)
  const [objSelectedRow, setObjSelectedRow] = useState<IEventInstance | null>(null);
  // 수정 모달
  const [bEditOpen, setBEditOpen] = useState(false);
  const [objEditInstance, setObjEditInstance] = useState<IEventInstance | null>(null);
  const [strEditEventName, setStrEditEventName] = useState('');
  const [strEditInputValues, setStrEditInputValues] = useState('');
  const [strEditDeployDate, setStrEditDeployDate] = useState('');  // ISO 8601
  const [arrEditDeployScope, setArrEditDeployScope] = useState<TDeployScope[]>(['qa', 'live']);
  // DBA 쿼리 수정 모달
  const [bQueryEditOpen, setBQueryEditOpen] = useState(false);
  const [objQueryEditInstance, setObjQueryEditInstance] = useState<IEventInstance | null>(null);
  const [strQueryEditValue, setStrQueryEditValue] = useState('');
  const [bQuerySaving, setBQuerySaving] = useState(false);
  // 실행 관련
  const [bExecuting, setBExecuting] = useState<number | null>(null);
  const [objExecResult, setObjExecResult] = useState<IQueryExecutionResult | null>(null);
  const [strExecEnv, setStrExecEnv] = useState<'qa' | 'live'>('qa');
  const [bExecResultOpen, setBExecResultOpen] = useState(false);
  // QA/LIVE 확인 팝업 — 팝업 안에 취소 / 확인 / 재요청 버튼
  const [objConfirmModal, setObjConfirmModal] = useState<{ nId: number; strType: 'qa' | 'live' } | null>(null);

  const [messageApi, contextHolder] = message.useMessage();
  const { token } = antdTheme.useToken();

  const user = useAuthStore((s) => s.user);
  const arrPermissions = user?.arrPermissions || [];

  // 전역 이벤트 인스턴스 스토어 (SSE 실시간 업데이트 포함)
  const arrInstances = useEventInstanceStore((s) => s.arrInstances);
  const arrAllInstances = useEventInstanceStore((s) => s.arrAllInstances);
  const setHiddenIds = useEventInstanceStore((s) => s.setHiddenIds);
  const fnHideInstance = useEventInstanceStore((s) => s.fnHideInstance);
  const fnUnhideInstance = useEventInstanceStore((s) => s.fnUnhideInstance);
  const bLoading = useEventInstanceStore((s) => s.bLoading);
  const strFilter = useEventInstanceStore((s) => s.strFilter);
  const fnFetchInstances = useEventInstanceStore((s) => s.fnFetchInstances);
  const fnSetFilter = useEventInstanceStore((s) => s.fnSetFilter);
  const fnStoreUpdateStatus = useEventInstanceStore((s) => s.fnUpdateStatus);
  const fnStoreExecuteQuery = useEventInstanceStore((s) => s.fnExecuteQuery);
  const fnStoreUpdateInstance = useEventInstanceStore((s) => s.fnUpdateInstance);

  const bFunMode = useThemeStore((s) => s.bFunMode);

  // 권한 확인 헬퍼
  const fnHasPermission = (strPerm: string) => arrPermissions.includes(strPerm as any);

  // 페이지 진입 시 최초 1회 로드 (이후는 SSE가 자동 동기화)
  useEffect(() => {
    fnFetchInstances();
  }, [fnFetchInstances]);

  // SSE/스토어 업데이트 → 상세 모달·선택 행은 항상 최신 인스턴스로 동기화 (쿼리 수정 등 새로고침 없이 반영)
  useEffect(() => {
    const fnFindInstance = (nId: number) =>
      arrInstances.find((e) => e.nId === nId) ?? arrAllInstances.find((e) => e.nId === nId);
    if (objDetail) {
      const objUpdated = fnFindInstance(objDetail.nId);
      if (objUpdated) setObjDetail(objUpdated);
    }
    if (objSelectedRow) {
      const objUpdated = fnFindInstance(objSelectedRow.nId);
      if (objUpdated) setObjSelectedRow(objUpdated);
    }
  }, [arrInstances, arrAllInstances]); // eslint-disable-line react-hooks/exhaustive-deps

  // 상태 변경 처리 (일반 상태 전이) — API 403/에러 시 서버 메시지 표시
  const fnHandleAction = async (nId: number, strNextStatus: TEventStatus, strActionLabel: string) => {
    try {
      const result = await fnStoreUpdateStatus(nId, strNextStatus, strActionLabel, user?.strDisplayName || '');
      if (result.bSuccess) {
        messageApi.success(`${strActionLabel} 처리 완료`);
        if (objDetail?.nId === nId && result.objInstance) setObjDetail(result.objInstance);
    } else {
      messageApi.error(fnFormatPermissionErrorMessage(result.strMessage || '처리에 실패했습니다.'));
    }
  } catch (err: any) {
    const strMsg = err?.response?.data?.strMessage || err?.message || '해당 상태를 변경할 권한이 없습니다.';
    messageApi.error(fnFormatPermissionErrorMessage(strMsg));
  }
};

  // QA/LIVE DB 실행
  const fnHandleExecute = async (r: IEventInstance, strEnv: 'qa' | 'live') => {
    setBExecuting(r.nId);
    setStrExecEnv(strEnv);
    try {
      const result = await fnStoreExecuteQuery(r.nId, strEnv, user?.strDisplayName || '');

      if (result.bSuccess) {
        // 성공: 실행 결과 모달 표시
        setObjExecResult(result.objExecutionResult as IQueryExecutionResult ?? null);
        setBExecResultOpen(true);
        messageApi.success(`${strEnv.toUpperCase()} 쿼리 실행 완료`);
        if (objDetail?.nId === r.nId && result.objInstance) setObjDetail(result.objInstance);
      } else {
        // 실패: objExecutionResult 있으면 모달로, 없으면(사전 검증 오류) 전용 에러 모달로
        const objExecRes = result.objExecutionResult as IQueryExecutionResult | undefined;
        if (objExecRes) {
          // DB 실행 중 오류 (쿼리 오류, 연결 실패 등) → 실행 결과 모달
          setObjExecResult(objExecRes);
          setBExecResultOpen(true);
        } else {
          // 사전 검증 오류 (반영 날짜 조건, 상태 불일치, DB 접속 정보 없음 등) → 에러 모달
          setObjExecResult({
            bSuccess: false,
            strEnv,
            strExecutedQuery: r.strGeneratedQuery || '',
            arrQueryResults: [],
            nTotalAffectedRows: 0,
            nElapsedMs: 0,
            strError: fnFormatPermissionErrorMessage(result.strMessage || '실행에 실패했습니다.'),
            dtExecutedAt: new Date().toISOString(),
          });
          setBExecResultOpen(true);
        }
      }
    } catch (error: any) {
      // 예상치 못한 예외 (네트워크 단절 등)
      setObjExecResult({
        bSuccess: false,
        strEnv,
        strExecutedQuery: r.strGeneratedQuery || '',
        arrQueryResults: [],
        nTotalAffectedRows: 0,
        nElapsedMs: 0,
        strError: error?.message || '네트워크 오류가 발생했습니다.',
        dtExecutedAt: new Date().toISOString(),
      });
      setBExecResultOpen(true);
    } finally {
      setBExecuting(null);
    }
  };

  // 수정 모달 열기
  const fnOpenEdit = (r: IEventInstance) => {
    setObjEditInstance(r);
    setStrEditEventName(r.strEventName);
    setStrEditInputValues(r.strInputValues);
    setStrEditDeployDate(r.dtDeployDate);
    setArrEditDeployScope(r.arrDeployScope ?? ['qa', 'live']);
    setBEditOpen(true);
  };

  // 수정 저장
  const fnSaveEdit = async () => {
    if (!objEditInstance) return;
    const result = await fnStoreUpdateInstance(objEditInstance.nId, {
      strEventName: strEditEventName,
      strInputValues: strEditInputValues,
      dtDeployDate: strEditDeployDate,
      arrDeployScope: arrEditDeployScope,
    });
    if (result.bSuccess) {
      messageApi.success('이벤트가 수정되었습니다.');
      setBEditOpen(false);
    } else {
      messageApi.error(fnFormatPermissionErrorMessage(result.strMessage || '수정에 실패했습니다.'));
    }
  };

  // DBA 쿼리 수정 모달 열기
  const fnOpenQueryEdit = (r: IEventInstance) => {
    setObjQueryEditInstance(r);
    setStrQueryEditValue(r.strGeneratedQuery);
    setBQueryEditOpen(true);
  };

  // DBA 쿼리 수정 저장
  const fnSaveQueryEdit = async () => {
    if (!objQueryEditInstance) return;
    setBQuerySaving(true);
    try {
      const result = await fnStoreUpdateInstance(objQueryEditInstance.nId, {
        strGeneratedQuery: strQueryEditValue,
      });
      if (result.bSuccess) {
        messageApi.success('쿼리가 수정되었습니다.');
        setBQueryEditOpen(false);
        if (objDetail?.nId === objQueryEditInstance.nId && result.objInstance) {
          setObjDetail(result.objInstance);
        }
      } else {
        messageApi.error(fnFormatPermissionErrorMessage(result.strMessage || '쿼리 수정에 실패했습니다.'));
      }
    } finally {
      setBQuerySaving(false);
    }
  };

  // 클립보드 복사
  const fnCopy = (str: string) => {
    navigator.clipboard.writeText(str);
    messageApi.success('클립보드에 복사되었습니다.');
  };

  // 통계 — 항상 전체 목록(arrAllInstances) 기준으로 계산해 필터 변경과 무관하게 실시간 반영
  // 상태별 "다음 액션 가능" 권한 — 내 처리 대기 건수·버튼 노출은 권한만 사용
  const OBJ_ACTION_PERMISSIONS: Record<string, string[]> = {
    event_created: ['my_dashboard.request_confirm'],
    confirm_requested: ['my_dashboard.confirm'],
    qa_requested: ['my_dashboard.execute_qa', 'instance.execute_qa'],
    qa_deployed: ['my_dashboard.verify_qa', 'my_dashboard.request_qa_rereq'],
    qa_verified: ['my_dashboard.request_live', 'my_dashboard.request_qa_rereq'],
    live_requested: ['my_dashboard.execute_live', 'instance.execute_live'],
    live_deployed: ['my_dashboard.verify_live', 'my_dashboard.request_live_rereq'],
    live_verified: ['my_dashboard.request_live_rereq'],
  };
  const nTotal = arrAllInstances.length;
  const nMyAction = arrAllInstances.filter((e) =>
    OBJ_ACTION_PERMISSIONS[e.strStatus]?.some((p) => arrPermissions.includes(p))
  ).length;
  const nInProgress = arrAllInstances.filter((e) => e.strStatus !== 'live_verified').length;
  const nCompleted = arrAllInstances.filter((e) => e.strStatus === 'live_verified').length;

  // 액션 버튼 렌더링 (권한 + 상태 + 쿼리 실행 대상 기반)
  const fnRenderActions = (r: IEventInstance) => {
    const arrButtons = [];
    // 이 이벤트의 쿼리 실행 대상 (단일 서버 또는 다중 서버)
    const arrScope = r.arrDeployScope ?? ['qa', 'live'];
    const bHasQa   = arrScope.includes('qa');
    const bHasLive = arrScope.includes('live');

    // 상세 — my_dashboard.detail 권한 있을 때만 버튼 노출
    if (fnHasPermission('my_dashboard.detail')) {
      arrButtons.push(
        <Button key="detail" size="small" icon={<EyeOutlined />}
          onClick={() => { setObjDetail(r); setBDetailOpen(true); }}>상세</Button>
      );
    }

    // 쿼리 수정 — my_dashboard.query_edit 권한만 사용
    const ARR_QUERY_EDIT_STATUS: TEventStatus[] = ['confirm_requested', 'qa_requested', 'live_requested'];
    if (fnHasPermission('my_dashboard.query_edit') && ARR_QUERY_EDIT_STATUS.includes(r.strStatus)) {
      arrButtons.push(
        <Tooltip key="query-edit" title="쿼리 직접 수정 (DBA)">
          <Button size="small" icon={<CodeOutlined />} onClick={() => fnOpenQueryEdit(r)}>
            쿼리 수정
          </Button>
        </Tooltip>
      );
    }

    // 운영자: 작성 중 — 이벤트 수정/컨펌 요청은 해당 권한 있을 때만 버튼 노출
    const bCanEdit = fnHasPermission('my_dashboard.edit');
    const bCanRequestConfirm = fnHasPermission('my_dashboard.request_confirm');
    if (r.strStatus === 'event_created' && r.nCreatedByUserId === user?.nId && (bCanEdit || bCanRequestConfirm)) {
      if (bCanEdit) {
        arrButtons.push(
          <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => fnOpenEdit(r)}>수정</Button>
        );
      }
      if (bCanRequestConfirm) {
        arrButtons.push(
          <PopconfirmWithSkip
            key="req-confirm"
            actionKey="confirm_requested"
            title="컨펌을 요청하시겠습니까? 요청 후 수정이 불가합니다."
            okText="요청"
            cancelText="취소"
            onConfirm={() => fnHandleAction(r.nId, 'confirm_requested', '컨펌 요청')}
          >
            <Button size="small" type="primary" icon={<SendOutlined />}>컨펌 요청</Button>
          </PopconfirmWithSkip>
        );
      }
    }

    // DBA 컨펌 — my_dashboard.confirm 권한만 사용
    if (r.strStatus === 'confirm_requested' && fnHasPermission('my_dashboard.confirm')) {
      arrButtons.push(
        <Popconfirm key="confirm" title="컨펌 처리하시겠습니까?" okText="확인" cancelText="취소"
          onConfirm={() => fnHandleAction(r.nId, 'dba_confirmed', 'DBA 컨펌')}>
          <Button size="small" type="primary" icon={<SafetyCertificateOutlined />}>컨펌</Button>
        </Popconfirm>
      );
    }

    // dba_confirmed 이후 → 쿼리 실행 대상에 따라 QA 요청 또는 LIVE 요청 (단일 권한)
    if (r.strStatus === 'dba_confirmed') {
      if (bHasQa && fnHasPermission('my_dashboard.request_qa')) {
        // QA 포함: QA 쿼리 실행 요청
        arrButtons.push(
          <PopconfirmWithSkip
            key="qa-req"
            actionKey="qa_requested"
            title="QA 쿼리 실행을 요청하시겠습니까?"
            okText="요청"
            cancelText="취소"
            onConfirm={() => fnHandleAction(r.nId, 'qa_requested', 'QA 쿼리 실행 요청')}
          >
            <Button size="small" type="primary" icon={<SendOutlined />}>QA 쿼리 실행 요청</Button>
          </PopconfirmWithSkip>
        );
      } else if (!bHasQa && bHasLive && fnHasPermission('my_dashboard.request_live')) {
        // LIVE만(단일 서버): QA 스킵 → LIVE 쿼리 실행 요청
        arrButtons.push(
          <PopconfirmWithSkip
            key="live-req-skip"
            actionKey="live_requested_skip"
            title={
              <Space direction="vertical" size={4}>
                <Text strong>LIVE 쿼리 실행을 요청하시겠습니까?</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>이 이벤트는 LIVE 전용(단일 서버)으로 QA 단계가 없습니다.</Text>
              </Space>
            }
            okText="요청"
            cancelText="취소"
            onConfirm={() => fnHandleAction(r.nId, 'live_requested', 'LIVE 쿼리 실행 요청')}
            >
              <Button size="small" style={{ background: '#eb2f96', border: 'none', color: '#fff' }} icon={<SendOutlined />}>LIVE 쿼리 실행 요청</Button>
          </PopconfirmWithSkip>
        );
      }
    }

    // QA 쿼리 실행 — my_dashboard.execute_qa 또는 instance.execute_qa 권한만 사용
    if (bHasQa && (fnHasPermission('my_dashboard.execute_qa') || fnHasPermission('instance.execute_qa')) && r.strStatus === 'qa_requested') {
      arrButtons.push(
        <Popconfirm
          key="qa-execute"
          title={
            <Space direction="vertical" size={4}>
              <Text strong>QA DB에 쿼리를 실행하시겠습니까?</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>실행 후 자동으로 트랜잭션 처리되며, 오류 시 롤백됩니다.</Text>
            </Space>
          }
          okText="실행"
          cancelText="취소"
          okButtonProps={{ danger: false, style: { background: '#faad14', border: 'none' } }}
          onConfirm={() => fnHandleExecute(r, 'qa')}
        >
          <Button
            size="small"
            style={{ background: '#faad14', border: 'none', color: '#fff' }}
            icon={bExecuting === r.nId ? <Spin size="small" /> : <ThunderboltOutlined />}
            disabled={bExecuting !== null}
          >
            QA 쿼리 실행
          </Button>
        </Popconfirm>
      );
    }

    // QA 확인 — 단일 권한 my_dashboard.verify_qa (재요청은 my_dashboard.request_qa)
    if (bHasQa && fnHasPermission('my_dashboard.verify_qa') && r.strStatus === 'qa_deployed') {
      arrButtons.push(
        <Popconfirm
          key="qa-v"
          open={objConfirmModal?.nId === r.nId && objConfirmModal?.strType === 'qa'}
          onOpenChange={(bOpen) => { if (!bOpen) setObjConfirmModal(null); }}
          title="QA 쿼리 실행을 확인하셨습니까?"
          description={
            fnHasPermission('my_dashboard.request_qa') ? (
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                <Button
                  size="small"
                  icon={<SyncOutlined />}
                  block
                  onClick={() => {
                    fnHandleAction(r.nId, 'qa_requested', 'QA 쿼리 실행 재요청');
                    setObjConfirmModal(null);
                  }}
                >
                  QA 쿼리 실행 재요청
                </Button>
              </Space>
            ) : undefined
          }
          okText="확인"
          cancelText="취소"
          onConfirm={() => {
            fnHandleAction(r.nId, 'qa_verified', 'QA 확인');
            setObjConfirmModal(null);
          }}
        >
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => setObjConfirmModal({ nId: r.nId, strType: 'qa' })}
          >
            QA확인
          </Button>
        </Popconfirm>
      );
    }

    // QA 확인 후: LIVE 쿼리 실행 요청 또는 QA 재요청 (단일 권한)
    if (bHasQa && r.strStatus === 'qa_verified') {
      const bCanLive = bHasLive && fnHasPermission('my_dashboard.request_live');
      const bCanQaRereq = fnHasPermission('my_dashboard.request_qa');

      if (bFunMode && bCanLive && bCanQaRereq) {
        // 재미 모드: 한 버튼에서 롱프레스 시 QA 쿼리 실행 재요청으로 전환
        arrButtons.push(
          <RequestWithLongPressButton
            key="live-qa-longpress"
            primaryLabel="LIVE 쿼리 실행 요청"
            primaryTitle="LIVE 쿼리 실행을 요청하시겠습니까?"
            onPrimaryConfirm={() => fnHandleAction(r.nId, 'live_requested', 'LIVE 쿼리 실행 요청')}
            rerequestLabel="QA 쿼리 실행 재요청"
            rerequestTitle="QA 쿼리 실행 재요청을 하시겠습니까?"
            rerequestDescription="QA 확인 결과 데이터에 문제가 있을 때, DBA가 다시 QA 쿼리 실행할 수 있도록 요청합니다."
            onRerequestConfirm={() => fnHandleAction(r.nId, 'qa_requested', 'QA 쿼리 실행 재요청')}
            primaryButtonStyle={{ background: '#eb2f96', border: 'none', color: '#fff' }}
            primaryIcon={<SendOutlined />}
            rerequestIcon={<SyncOutlined />}
            okText="요청"
            rerequestOkText="재요청"
            cancelText="취소"
          />
        );
      } else {
        if (bCanLive) {
          arrButtons.push(
            <PopconfirmWithSkip
              key="live-req"
              actionKey="live_requested"
              title="LIVE 쿼리 실행을 요청하시겠습니까?"
              okText="요청"
              cancelText="취소"
              onConfirm={() => fnHandleAction(r.nId, 'live_requested', 'LIVE 쿼리 실행 요청')}
            >
              <Button size="small" style={{ background: '#eb2f96', border: 'none', color: '#fff' }} icon={<SendOutlined />}>LIVE 쿼리 실행 요청</Button>
            </PopconfirmWithSkip>
          );
        }
        if (bCanQaRereq) {
          arrButtons.push(
            <Popconfirm
              key="qa-rereq"
              title="QA 쿼리 실행 재요청을 하시겠습니까?"
              description="QA 확인 결과 데이터에 문제가 있을 때, DBA가 다시 QA 쿼리 실행할 수 있도록 요청합니다."
              okText="재요청"
              cancelText="취소"
              onConfirm={() => fnHandleAction(r.nId, 'qa_requested', 'QA 쿼리 실행 재요청')}
            >
              <Button size="small" icon={<SyncOutlined />}>QA 쿼리 실행 재요청</Button>
            </Popconfirm>
          );
        }
      }
    }

    // LIVE 쿼리 실행 — my_dashboard.execute_live 또는 instance.execute_live 권한만 사용
    if (bHasLive && (fnHasPermission('my_dashboard.execute_live') || fnHasPermission('instance.execute_live')) && r.strStatus === 'live_requested') {
      arrButtons.push(
        <Popconfirm
          key="live-execute"
          title={
            <Space direction="vertical" size={4}>
              <Text strong style={{ color: '#ff4d4f' }}>⚠ LIVE DB에 쿼리를 실행하시겠습니까?</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>운영 DB에 직접 반영됩니다. 오류 시 롤백됩니다.</Text>
            </Space>
          }
          okText="실행"
          cancelText="취소"
          okButtonProps={{ danger: true }}
          onConfirm={() => fnHandleExecute(r, 'live')}
        >
          <Button
            size="small"
            danger
            type="primary"
            icon={bExecuting === r.nId ? <Spin size="small" /> : <RocketOutlined />}
            disabled={bExecuting !== null}
          >
            LIVE 쿼리 실행
          </Button>
        </Popconfirm>
      );
    }

    // LIVE 확인 — 단일 권한 my_dashboard.verify_live (재요청은 my_dashboard.request_live)
    if (bHasLive && fnHasPermission('my_dashboard.verify_live') && r.strStatus === 'live_deployed') {
      arrButtons.push(
        <Popconfirm
          key="live-v"
          open={objConfirmModal?.nId === r.nId && objConfirmModal?.strType === 'live'}
          onOpenChange={(bOpen) => { if (!bOpen) setObjConfirmModal(null); }}
          title="LIVE 쿼리 실행을 확인하셨습니까?"
          description={
            fnHasPermission('my_dashboard.request_live') ? (
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                <Button
                  size="small"
                  icon={<SyncOutlined />}
                  block
                  onClick={() => {
                    fnHandleAction(r.nId, 'live_requested', 'LIVE 쿼리 실행 재요청');
                    setObjConfirmModal(null);
                  }}
                >
                  LIVE 쿼리 실행 재요청
                </Button>
              </Space>
            ) : undefined
          }
          okText="확인"
          cancelText="취소"
          onConfirm={() => {
            fnHandleAction(r.nId, 'live_verified', 'LIVE 확인');
            setObjConfirmModal(null);
          }}
        >
          <Button
            size="small"
            style={{ background: '#52c41a', border: 'none', color: '#fff' }}
            icon={<CheckCircleOutlined />}
            onClick={() => setObjConfirmModal({ nId: r.nId, strType: 'live' })}
          >
            LIVE확인
          </Button>
        </Popconfirm>
      );
    }

    // 완료(live_verified) 후: LIVE 쿼리 실행 재요청 — 단일 권한 my_dashboard.request_live
    if (bHasLive && fnHasPermission('my_dashboard.request_live') && r.strStatus === 'live_verified') {
      if (bFunMode) {
        // 재미 모드: 롱프레스 후 클릭 시에만 재요청 (실수 방지)
        arrButtons.push(
          <RequestWithLongPressButton
            key="live-rereq-longpress"
            primaryLabel="LIVE 쿼리 실행 재요청"
            primaryTitle=""
            onPrimaryConfirm={() => {}}
            rerequestLabel="LIVE 쿼리 실행 재요청"
            rerequestTitle="LIVE 쿼리 실행 재요청을 하시겠습니까?"
            rerequestDescription="완료 확인 후 데이터에 문제가 있을 때, DBA가 다시 LIVE 쿼리 실행할 수 있도록 요청합니다."
            onRerequestConfirm={() => fnHandleAction(r.nId, 'live_requested', 'LIVE 쿼리 실행 재요청')}
            bRerequestOnly
            primaryIcon={<SyncOutlined />}
            rerequestIcon={<SyncOutlined />}
            rerequestOkText="재요청"
            cancelText="취소"
          />
        );
      } else {
        arrButtons.push(
          <Popconfirm
            key="live-rereq"
title="LIVE 쿼리 실행 재요청을 하시겠습니까?"
            description="완료 확인 후 데이터에 문제가 있을 때, DBA가 다시 LIVE 쿼리 실행할 수 있도록 요청합니다."
              okText="재요청"
              cancelText="취소"
              onConfirm={() => fnHandleAction(r.nId, 'live_requested', 'LIVE 쿼리 실행 재요청')}
            >
              <Button size="small" icon={<SyncOutlined />}>LIVE 쿼리 실행 재요청</Button>
          </Popconfirm>
        );
      }
    }

    return <Space wrap>{arrButtons}</Space>;
  };

  // 탭 (진행 이벤트 / 완료·숨김)
  const [strDashTab, setStrDashTab] = useState<'active' | 'completed'>('active');
  // 보기 형태: 테이블(행) / 카드
  const [strViewMode, setStrViewMode] = useState<'table' | 'card'>('table');
  // 전환 애니메이션: 빠른 연타 시 스크롤/번쩍임 방지
  const [strViewTransition, setStrViewTransition] = useState<'idle' | 'out' | 'in'>('idle');
  const [strViewDisplay, setStrViewDisplay] = useState<'table' | 'card'>('table'); // 전환 중 표시용
  const [nViewMinHeight, setNViewMinHeight] = useState<number | undefined>(undefined);
  const viewContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (strViewTransition !== 'out') return;
    const h = viewContentRef.current?.offsetHeight;
    if (typeof h === 'number' && h > 0) setNViewMinHeight(h);
    const t = setTimeout(() => {
      setStrViewMode((m) => (m === 'table' ? 'card' : 'table'));
      setStrViewDisplay((m) => (m === 'table' ? 'card' : 'table'));
      setStrViewTransition('in');
    }, 180);
    return () => clearTimeout(t);
  }, [strViewTransition]);

  useEffect(() => {
    if (strViewTransition !== 'in') return;
    const t = setTimeout(() => {
      setStrViewTransition('idle');
      setStrViewDisplay(strViewMode);
      // minHeight는 아래 effect에서 카드 높이로 맞춘 뒤 해제 (스크롤 깜빡임 방지)
    }, 180);
    return () => clearTimeout(t);
  }, [strViewTransition, strViewMode]);

  // idle로 돌아온 뒤: 카드 보기는 컨텐츠 높이로 맞춘 뒤 해제(스크롤 깜빡임 방지), 테이블은 짧은 뒤 해제
  const viewMinHeightCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (strViewTransition !== 'idle' || !nViewMinHeight) return;
    if (strViewMode === 'card') {
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = viewContentRef.current;
          const inner = el?.firstElementChild;
          const contentH = (inner?.scrollHeight ?? el?.offsetHeight) || nViewMinHeight;
          setNViewMinHeight(contentH);
          viewMinHeightCleanupRef.current = setTimeout(() => setNViewMinHeight(undefined), 120);
        });
      });
      return () => {
        cancelAnimationFrame(rafId);
        if (viewMinHeightCleanupRef.current) {
          clearTimeout(viewMinHeightCleanupRef.current);
          viewMinHeightCleanupRef.current = null;
        }
      };
    }
    viewMinHeightCleanupRef.current = setTimeout(() => setNViewMinHeight(undefined), 80);
    return () => {
      if (viewMinHeightCleanupRef.current) {
        clearTimeout(viewMinHeightCleanupRef.current);
        viewMinHeightCleanupRef.current = null;
      }
    };
  }, [strViewTransition, nViewMinHeight, strViewMode]);

  const fnToggleViewMode = useCallback(() => {
    if (strViewTransition !== 'idle') return;
    setStrViewDisplay(strViewMode);
    setStrViewTransition('out');
  }, [strViewTransition, strViewMode]);

  // 진행 이벤트 탭: 사용자가 직접 숨기기 버튼을 누른 이벤트만 제외
  // live_verified 완료 상태여도 숨기기 전까지는 진행탭에 남아 흐릿하게 표시됨
  const arrActiveInstances = arrInstances.filter((r) => !setHiddenIds.has(r.nId));
  // 완료·숨김 이벤트 탭: 사용자가 숨기기 버튼을 누른 이벤트만
  const arrCompletedInstances = arrInstances.filter((r) => setHiddenIds.has(r.nId));

  const arrDisplayInstances = strDashTab === 'active' ? arrActiveInstances : arrCompletedInstances;

  // 테이블 컬럼 — No. + 헤더·액션 정리 (PK 컬럼은 숨김)
  const arrColumns = [
    fnMakeIndexColumn(55),
    {
      title: '이벤트명',
      dataIndex: 'strEventName',
      key: 'strEventName',
      ellipsis: true,
    },
    {
      title: '프로덕트',
      key: 'product',
      width: 140,
      render: (_: unknown, r: IEventInstance) => <Tag>{r.strProductName} ({r.strServiceAbbr})</Tag>,
    },
    {
      title: '반영 일시',
      dataIndex: 'dtDeployDate',
      key: 'dtDeployDate',
      width: 140,
      render: (str: string) => str ? new Date(str).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-',
    },
    {
      title: '생성자',
      dataIndex: 'strCreatedBy',
      key: 'strCreatedBy',
      width: 100,
    },
    {
      title: '상태',
      dataIndex: 'strStatus',
      key: 'strStatus',
      width: 110,
      render: (s: TEventStatus) => <Tag color={OBJ_STATUS_CONFIG[s].strColor}>{OBJ_STATUS_CONFIG[s].strLabel}</Tag>,
    },
    {
      title: '액션',
      key: 'actions',
      width: 340,
      render: (_: unknown, r: IEventInstance) => (
        <Space wrap size="small" align="start">
          {/* 상태별 처리 버튼 (요청/확인/반영/재요청 등) */}
          {fnRenderActions(r)}
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          {/* 숨기기/보이기 — 완료(live_verified)에서만 숨기기 활성화 */}
          {!setHiddenIds.has(r.nId) ? (
            <Tooltip title={r.strStatus === 'live_verified' ? '완료·숨김 탭으로 이동' : '완료 상태에서만 숨길 수 있습니다'}>
              <PopconfirmWithSkip
                actionKey="hide_instance"
                title="이 이벤트를 숨기시겠습니까?"
                description="완료·숨김 탭으로 이동됩니다. 언제든지 복원할 수 있습니다."
                okText="숨기기"
                cancelText="취소"
                onConfirm={() => fnHideInstance(r.nId)}
                disabled={r.strStatus !== 'live_verified'}
              >
                <Button size="small" icon={<EyeInvisibleOutlined />} type="text" disabled={r.strStatus !== 'live_verified'}>
                  숨기기
                </Button>
              </PopconfirmWithSkip>
            </Tooltip>
          ) : (
            <Tooltip title="진행 이벤트 탭으로 복원">
              <Button size="small" icon={<EyeTwoTone />} type="text" onClick={() => fnUnhideInstance(r.nId)}>
                보이기
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 필터 옵션 — 전체를 첫 번째로
  const arrFilterOptions = [
    { label: '전체 이벤트', value: 'all' },
    { label: '내가 관여한 이벤트', value: 'involved' },
    { label: '내가 생성한 이벤트', value: 'mine' },
    { label: '내가 처리할 이벤트', value: 'my_action' },
  ];

  return (
    <>
      {contextHolder}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}>나의 대시보드</Title>
        {bFunMode && (
          <Tooltip title="버튼을 2~3초 길게 누르면 재요청으로 전환됩니다. (QA/LIVE 확인 버튼 포함)">
            <Tag color="orange">재미 모드</Tag>
          </Tooltip>
        )}
      </div>

      {/* 통계 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="전체" value={nTotal} suffix="건" prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="내 처리 대기" value={nMyAction} suffix="건" prefix={<SyncOutlined />} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="진행 중" value={nInProgress} suffix="건" prefix={<RocketOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="완료" value={nCompleted} suffix="건" prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      {/* 탭 + 필터 + 목록 */}
      <Card>
        {/* 탭 — 전체 이벤트 / 완료 이벤트 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Segmented
            options={[
              { label: `진행 이벤트 (${arrActiveInstances.length})`, value: 'active' },
              { label: `완료·숨김 (${arrCompletedInstances.length})`, value: 'completed' },
            ]}
            value={strDashTab}
            onChange={(v) => setStrDashTab(v as 'active' | 'completed')}
          />
          <Space size="middle">
            {/* 진행 이벤트 탭일 때 필터 — 드롭다운 */}
            {strDashTab === 'active' && (
              <Select
                options={arrFilterOptions}
                value={strFilter}
                onChange={(v) => fnSetFilter(v ?? 'all')}
                style={{ minWidth: 180 }}
                size="middle"
              />
            )}
            {/* 테이블 / 카드 보기 전환 — 드롭다운 우측 (전환 중 연타 무시) */}
            <Tooltip title={strViewTransition !== 'idle' ? '전환 중…' : strViewMode === 'table' ? '카드 보기' : '테이블(행) 보기'}>
              <Button
                type={strViewMode === 'table' ? 'default' : 'primary'}
                icon={strViewMode === 'table' ? <AppstoreOutlined /> : <TableOutlined />}
                onClick={fnToggleViewMode}
                disabled={strViewTransition !== 'idle'}
              />
            </Tooltip>
          </Space>
        </div>
        <div
          ref={viewContentRef}
          style={{
            minHeight: nViewMinHeight,
            height: nViewMinHeight,
            overflow: nViewMinHeight ? 'hidden' : undefined,
            transition: 'opacity 0.18s ease',
            opacity: strViewTransition === 'out' ? 0 : 1,
          }}
        >
        {strViewDisplay === 'table' ? (
        <AppTable
          strTableId={`dashboard_instances_${strDashTab}`}
          dataSource={arrDisplayInstances}
          columns={arrColumns}
          loading={bLoading}
          pagination={{ pageSize: 15 }}
          strEmptyText="해당 조건의 이벤트가 없습니다."
          expandable={{
            expandedRowKeys: objSelectedRow ? [objSelectedRow.nId] : [],
            onExpand: (bExpanded, r) => setObjSelectedRow(bExpanded ? r : null),
            expandedRowRender: (r) => <InstanceStepper objInstance={r} />,
            expandIcon: () => null,
            columnWidth: 24, // 펼침 컬럼을 작게만 표시 (제거하지 않음)
            rowExpandable: () => true,
          }}
          // 완료(live_verified) 행 또는 숨겨진 행: 흐릿하게 표시
          rowClassName={(r: IEventInstance) => {
            if (r.nId === objSelectedRow?.nId) return 'ant-table-row-selected';
            if (r.strStatus === 'live_verified' || setHiddenIds.has(r.nId)) return 'row-completed-dim';
            return '';
          }}
          onRow={(r: IEventInstance) => ({
            onClick: () => setObjSelectedRow((prev) => prev?.nId === r.nId ? null : r),
            style: { cursor: 'pointer' },
          })}
        />
        ) : (
        /* 카드 보기 */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bLoading ? (
            <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
          ) : arrDisplayInstances.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ant-color-text-secondary)' }}>해당 조건의 이벤트가 없습니다.</div>
          ) : (
            <Row gutter={[12, 12]}>
              {arrDisplayInstances.map((r: IEventInstance, nIdx: number) => (
                <Col xs={24} sm={24} md={12} lg={8} xl={6} key={r.nId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <span style={{ fontWeight: 600 }}>{r.strEventName}</span>
                        <Tag color={OBJ_STATUS_CONFIG[r.strStatus].strColor}>{OBJ_STATUS_CONFIG[r.strStatus].strLabel}</Tag>
                      </Space>
                    }
                    style={{
                      cursor: 'pointer',
                      borderColor: objSelectedRow?.nId === r.nId ? token.colorPrimary : undefined,
                      boxShadow: objSelectedRow?.nId === r.nId ? `0 0 0 2px ${token.colorPrimaryBorder}` : undefined,
                    }}
                    onClick={() => setObjSelectedRow((prev) => prev?.nId === r.nId ? null : r)}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div><Text type="secondary">프로덕트</Text> <Tag>{r.strProductName} ({r.strServiceAbbr})</Tag></div>
                      <div><Text type="secondary">반영 일시</Text> {r.dtDeployDate ? new Date(r.dtDeployDate).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</div>
                      <div><Text type="secondary">생성자</Text> {r.strCreatedBy ?? '-'}</div>
                      <Divider style={{ margin: '8px 0' }} />
                      <Space wrap size="small" onClick={(e) => e.stopPropagation()}>
                        {fnRenderActions(r)}
                        {!setHiddenIds.has(r.nId) ? (
                          <Tooltip title={r.strStatus === 'live_verified' ? '완료·숨김 탭으로 이동' : '완료 상태에서만 숨길 수 있습니다'}>
                            <PopconfirmWithSkip
                              actionKey="hide_instance"
                              title="이 이벤트를 숨기시겠습니까?"
                              description="완료·숨김 탭으로 이동됩니다. 언제든지 복원할 수 있습니다."
                              okText="숨기기"
                              cancelText="취소"
                              onConfirm={() => fnHideInstance(r.nId)}
                              disabled={r.strStatus !== 'live_verified'}
                            >
                              <Button size="small" icon={<EyeInvisibleOutlined />} type="text" disabled={r.strStatus !== 'live_verified'}>숨기기</Button>
                            </PopconfirmWithSkip>
                          </Tooltip>
                        ) : (
                          <Tooltip title="진행 이벤트 탭으로 복원">
                            <Button size="small" icon={<EyeTwoTone />} type="text" onClick={() => fnUnhideInstance(r.nId)}>보이기</Button>
                          </Tooltip>
                        )}
                      </Space>
                    </Space>
                    {objSelectedRow?.nId === r.nId && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }} onClick={(e) => e.stopPropagation()}>
                        <InstanceStepper objInstance={r} />
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>
        )}
        </div>
      </Card>

      {/* 상세 모달 — 각 섹션 접기/펼치기, 입력값·쿼리는 기본 접힘 */}
      <Modal title="이벤트 상세" open={bDetailOpen} onCancel={() => setBDetailOpen(false)} footer={null} width={780}>
        {objDetail && (
          <Collapse
            defaultActiveKey={['basic', 'actors', 'history']}
            items={[
              {
                key: 'basic',
                label: '기본 정보',
                children: (
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="이벤트명">{objDetail.strEventName}</Descriptions.Item>
                    <Descriptions.Item label="프로덕트">{objDetail.strProductName} ({objDetail.strServiceAbbr} / {objDetail.strServiceRegion})</Descriptions.Item>
                    <Descriptions.Item label="종류"><Tag color="blue">{objDetail.strCategory}</Tag></Descriptions.Item>
                    <Descriptions.Item label="유형"><Tag color="red">{objDetail.strType}</Tag></Descriptions.Item>
                    <Descriptions.Item label="반영 날짜">
                      {objDetail.dtDeployDate
                        ? new Date(objDetail.dtDeployDate).toLocaleString('ko-KR')
                        : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="쿼리 실행 대상">
                      <Space size={4}>
                        {(objDetail.arrDeployScope ?? ['qa', 'live']).map((s) => (
                          <Tag key={s} color={s === 'qa' ? 'orange' : 'red'}>{s.toUpperCase()}</Tag>
                        ))}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="상태"><Tag color={OBJ_STATUS_CONFIG[objDetail.strStatus].strColor}>{OBJ_STATUS_CONFIG[objDetail.strStatus].strLabel}</Tag></Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'actors',
                label: '단계별 처리자',
                children: (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <ActorTag objActor={objDetail.objCreator} strLabel="생성자" />
                    <ActorTag objActor={objDetail.objConfirmer} strLabel="컨펌자" />
                    <ActorTag objActor={objDetail.objQaRequester} strLabel="QA 쿼리 실행 요청자" />
                    <ActorTag objActor={objDetail.objQaDeployer} strLabel="QA 쿼리 실행자" />
                    <ActorTag objActor={objDetail.objQaVerifier} strLabel="QA확인자" />
                    <ActorTag objActor={objDetail.objLiveRequester} strLabel="LIVE 쿼리 실행 요청자" />
                    <ActorTag objActor={objDetail.objLiveDeployer} strLabel="LIVE 쿼리 실행자" />
                    <ActorTag objActor={objDetail.objLiveVerifier} strLabel="LIVE확인자" />
                  </Space>
                ),
              },
              ...(objDetail.strInputValues
                ? [{
                    key: 'input',
                    label: '입력값',
                    children: <Text code style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{objDetail.strInputValues}</Text>,
                  }]
                : []),
              ...(objDetail.strGeneratedQuery
                ? [{
                    key: 'query',
                    label: '최종 쿼리',
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }} size={8}>
                        <div style={{ textAlign: 'right' }}>
                          <Button size="small" icon={<CopyOutlined />} onClick={() => fnCopy(objDetail.strGeneratedQuery)}>복사</Button>
                        </div>
                        <TextArea value={objDetail.strGeneratedQuery} readOnly autoSize={{ minRows: 4, maxRows: 15 }}
                          style={{ fontFamily: 'monospace', fontSize: 12, background: token.colorFillTertiary, color: token.colorText, border: 'none', borderRadius: token.borderRadius, padding: 12 }} />
                      </Space>
                    ),
                  }]
                : []),
              {
                key: 'history',
                label: '진행 이력',
                children: (
                  <Timeline
                    items={objDetail.arrStatusLogs.map((log) => ({
                      color: OBJ_STATUS_CONFIG[log.strStatus]?.strColor || 'gray',
                      children: (
                        <div>
                          <Tag color={OBJ_STATUS_CONFIG[log.strStatus]?.strColor}>{OBJ_STATUS_CONFIG[log.strStatus]?.strLabel}</Tag>
                          <Text strong style={{ fontSize: 12 }}>{log.strChangedBy}</Text>
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{new Date(log.dtChangedAt).toLocaleString('ko-KR')}</Text>
                          {log.strComment && (
                            <div style={{ marginTop: 2 }}>
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: log.strComment === 'DBA 쿼리 직접 수정' ? token.colorError : token.colorTextSecondary,
                                }}
                              >
                                {log.strComment}
                              </Text>
                            </div>
                          )}
                          {log.objExecutionResult && (
                            <div style={{ marginTop: 6, padding: '6px 10px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                              <Space>
                                <Tag color={log.objExecutionResult.strEnv === 'qa' ? 'orange' : 'red'}>
                                  {log.objExecutionResult.strEnv.toUpperCase()}
                                </Tag>
                                <Text style={{ fontSize: 12 }}>처리 {log.objExecutionResult.nTotalAffectedRows}건</Text>
                                <Divider type="vertical" />
                                <Text type="secondary" style={{ fontSize: 11 }}>{log.objExecutionResult.nElapsedMs}ms</Text>
                              </Space>
                            </div>
                          )}
                        </div>
                      ),
                    }))}
                  />
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* 수정 모달 */}
      <Modal
        title="이벤트 수정 (컨펌 요청 전)"
        open={bEditOpen}
        onOk={fnSaveEdit}
        onCancel={() => setBEditOpen(false)}
        okText="저장"
        cancelText="취소"
        width={620}
      >
        {objEditInstance && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
            <div>
              <Text strong>프로덕트</Text>
              <Input value={`${objEditInstance.strProductName} (${objEditInstance.strServiceAbbr} / ${objEditInstance.strServiceRegion})`} disabled style={{ marginTop: 4 }} />
            </div>
            <div>
              <Text strong>이벤트 이름</Text>
              <Input value={strEditEventName} onChange={(e) => setStrEditEventName(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <Space style={{ marginBottom: 4 }}>
                <Text strong>쿼리 실행 대상</Text>
                {objEditInstance.strStatus !== 'event_created' && (
                  <Tag color="warning" style={{ fontSize: 11 }}>컨펌 요청 후 수정 불가</Tag>
                )}
              </Space>
              <div style={{ marginTop: 4 }}>
                {objEditInstance.strStatus === 'event_created' ? (
                  <Checkbox.Group
                    value={arrEditDeployScope}
                    onChange={(arrChecked) => {
                      const arrNext = arrChecked.filter(
                        (v): v is TDeployScope => v === 'qa' || v === 'live'
                      );
                      if (arrNext.length > 0) setArrEditDeployScope(arrNext);
                    }}
                  >
                    {ARR_DEPLOY_SCOPE_OPTIONS.map((opt) => (
                      <Checkbox key={opt.value} value={opt.value}>
                        <Tag color={opt.strColor} style={{ marginRight: 0 }}>{opt.label}</Tag>
                      </Checkbox>
                    ))}
                  </Checkbox.Group>
                ) : (
                  <Space>
                    {(objEditInstance.arrDeployScope ?? ['qa', 'live']).map((s) => (
                      <Tag key={s} color={s === 'qa' ? 'orange' : 'red'}>{s.toUpperCase()}</Tag>
                    ))}
                  </Space>
                )}
              </div>
            </div>
            <div>
              <Space style={{ marginBottom: 4 }}>
                <Text strong>반영 날짜</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>DEV/QA: 이 시각 이전 실행 가능 · LIVE: 이 시각 이후 실행 가능</Text>
              </Space>
              <DatePicker
                style={{ width: '100%', marginTop: 4 }}
                showTime={{ format: 'HH:mm:ss' }}
                format="YYYY-MM-DD HH:mm:ss"
                value={strEditDeployDate ? dayjs(strEditDeployDate) : null}
                onChange={(date) => setStrEditDeployDate(date ? date.toISOString() : '')}
              />
            </div>
            <div>
              <Space style={{ marginBottom: 4 }}>
                <Text strong>입력값 (아이템/퀘스트)</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>수정 시 쿼리 자동 재생성</Text>
              </Space>
              <TextArea
                value={strEditInputValues}
                onChange={(e) => setStrEditInputValues(e.target.value)}
                rows={5}
                style={{ fontFamily: 'monospace', fontSize: 13, marginTop: 4 }}
              />
            </div>
          </Space>
        )}
      </Modal>

      {/* DBA 쿼리 직접 수정 모달 */}
      <Modal
        title={
          <Space>
            <CodeOutlined />
            <span>DBA 쿼리 수정</span>
            {objQueryEditInstance && (
              <Tag color={OBJ_STATUS_CONFIG[objQueryEditInstance.strStatus].strColor}>
                {OBJ_STATUS_CONFIG[objQueryEditInstance.strStatus].strLabel}
              </Tag>
            )}
          </Space>
        }
        open={bQueryEditOpen}
        onOk={fnSaveQueryEdit}
        onCancel={() => setBQueryEditOpen(false)}
        okText="저장"
        cancelText="취소"
        confirmLoading={bQuerySaving}
        width={740}
      >
        {objQueryEditInstance && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="middle">
            <Alert
              type="warning"
              showIcon
              message="DBA 전용 쿼리 직접 수정"
              description={`이벤트: ${objQueryEditInstance.strEventName} | 수정 이력이 진행 로그에 기록됩니다.`}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" icon={<CopyOutlined />} onClick={() => fnCopy(strQueryEditValue)}>복사</Button>
            </div>
            <Input.TextArea
              value={strQueryEditValue}
              onChange={(e) => setStrQueryEditValue(e.target.value)}
              autoSize={{ minRows: 10, maxRows: 25 }}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              placeholder="SQL 쿼리를 입력하세요..."
            />
          </Space>
        )}
      </Modal>

      {/* 쿼리 실행 결과 모달 */}
      <ExecutionResultModal
        bOpen={bExecResultOpen}
        objResult={objExecResult}
        strEnv={strExecEnv}
        onClose={() => setBExecResultOpen(false)}
      />

      {/* 실행 중 전체 오버레이 */}
      {bExecuting !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <Card style={{ textAlign: 'center', padding: 24, minWidth: 280 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 16 }}>DB 쿼리 실행 중...</Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">트랜잭션 처리 중입니다. 잠시 기다려 주세요.</Text>
            </div>
            <Progress percent={99} status="active" style={{ marginTop: 16 }} showInfo={false} />
          </Card>
        </div>
      )}
    </>
  );
};

export default MyDashboardPage;
