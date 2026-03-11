import { useState, useEffect } from 'react';
import {
  Typography, Card, Table, Tag, Space, Button, Modal,
  Input, message, Row, Col, Statistic, Timeline, Popconfirm,
  Segmented, Descriptions, Alert, Spin, Divider, Progress, DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import {
  EyeOutlined, CheckOutlined, ClockCircleOutlined,
  SyncOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  RocketOutlined, CopyOutlined, UserOutlined, EditOutlined,
  SendOutlined, ExclamationCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/useAuthStore';
import { useEventInstanceStore } from '../stores/useEventInstanceStore';
import type {
  IEventInstance, TEventStatus, IStageActor,
  IQueryExecutionResult,
} from '../types';
import { OBJ_STATUS_CONFIG } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

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
  if (!objResult) return null;

  return (
    <Modal
      title={
        <Space>
          {objResult.bSuccess
            ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            : <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
          }
          <span>{strEnv.toUpperCase()} 반영 {objResult.bSuccess ? '완료' : '실패'}</span>
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
                      background: '#1e1e1e',
                      borderRadius: 4,
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: '#d4d4d4',
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
                background: '#1e1e1e',
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: 11,
                color: '#d4d4d4',
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

const MyDashboardPage = () => {
  const [objDetail, setObjDetail] = useState<IEventInstance | null>(null);
  const [bDetailOpen, setBDetailOpen] = useState(false);
  // 수정 모달
  const [bEditOpen, setBEditOpen] = useState(false);
  const [objEditInstance, setObjEditInstance] = useState<IEventInstance | null>(null);
  const [strEditEventName, setStrEditEventName] = useState('');
  const [strEditInputValues, setStrEditInputValues] = useState('');
  const [strEditDeployDate, setStrEditDeployDate] = useState('');  // ISO 8601
  // 실행 관련
  const [bExecuting, setBExecuting] = useState<number | null>(null);
  const [objExecResult, setObjExecResult] = useState<IQueryExecutionResult | null>(null);
  const [strExecEnv, setStrExecEnv] = useState<'qa' | 'live'>('qa');
  const [bExecResultOpen, setBExecResultOpen] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  const user = useAuthStore((s) => s.user);
  const arrRoles = user?.arrRoles || [];
  const arrPermissions = user?.arrPermissions || [];

  // 전역 이벤트 인스턴스 스토어 (SSE 실시간 업데이트 포함)
  const arrInstances = useEventInstanceStore((s) => s.arrInstances);
  const bLoading = useEventInstanceStore((s) => s.bLoading);
  const strFilter = useEventInstanceStore((s) => s.strFilter);
  const fnFetchInstances = useEventInstanceStore((s) => s.fnFetchInstances);
  const fnSetFilter = useEventInstanceStore((s) => s.fnSetFilter);
  const fnStoreUpdateStatus = useEventInstanceStore((s) => s.fnUpdateStatus);
  const fnStoreExecuteQuery = useEventInstanceStore((s) => s.fnExecuteQuery);
  const fnStoreUpdateInstance = useEventInstanceStore((s) => s.fnUpdateInstance);

  // 권한 확인 헬퍼
  const fnHasPermission = (strPerm: string) => arrPermissions.includes(strPerm as any);

  // 페이지 진입 시 최초 1회 로드 (이후는 SSE가 자동 동기화)
  useEffect(() => {
    fnFetchInstances();
  }, [fnFetchInstances]);

  // SSE로 수신된 업데이트가 상세 모달에도 반영
  useEffect(() => {
    if (objDetail) {
      const objUpdated = arrInstances.find((e) => e.nId === objDetail.nId);
      if (objUpdated && objUpdated.strStatus !== objDetail.strStatus) {
        setObjDetail(objUpdated);
      }
    }
  }, [arrInstances, objDetail]);

  // 상태 변경 처리 (일반 상태 전이)
  const fnHandleAction = async (nId: number, strNextStatus: TEventStatus, strActionLabel: string) => {
    const result = await fnStoreUpdateStatus(nId, strNextStatus, strActionLabel, user?.strDisplayName || '');
    if (result.bSuccess) {
      messageApi.success(`${strActionLabel} 처리 완료`);
      if (objDetail?.nId === nId && result.objInstance) setObjDetail(result.objInstance);
    } else {
      messageApi.error(result.strMessage || '처리에 실패했습니다.');
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
        messageApi.success(`${strEnv.toUpperCase()} 반영 완료`);
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
            strError: result.strMessage || '실행에 실패했습니다.',
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
    setBEditOpen(true);
  };

  // 수정 저장
  const fnSaveEdit = async () => {
    if (!objEditInstance) return;
    const result = await fnStoreUpdateInstance(objEditInstance.nId, {
      strEventName: strEditEventName,
      strInputValues: strEditInputValues,
      dtDeployDate: strEditDeployDate,
    });
    if (result.bSuccess) {
      messageApi.success('이벤트가 수정되었습니다.');
      setBEditOpen(false);
    } else {
      messageApi.error(result.strMessage || '수정에 실패했습니다.');
    }
  };

  // 클립보드 복사
  const fnCopy = (str: string) => {
    navigator.clipboard.writeText(str);
    messageApi.success('클립보드에 복사되었습니다.');
  };

  // 통계
  const nTotal = arrInstances.length;
  const nMyAction = arrInstances.filter((e) => {
    const arrTrans: Record<string, string[]> = {
      event_created: ['game_manager', 'game_designer', 'admin'],
      confirm_requested: ['dba', 'admin'],
      dba_confirmed: ['game_manager', 'game_designer', 'admin'],
      qa_requested: ['dba', 'admin'],
      qa_deployed: ['game_manager', 'game_designer', 'admin'],
      qa_verified: ['game_manager', 'game_designer', 'admin'],
      live_requested: ['dba', 'admin'],
      live_deployed: ['game_manager', 'game_designer', 'admin'],
    };
    return arrTrans[e.strStatus]?.some((r) => arrRoles.includes(r));
  }).length;
  const nInProgress = arrInstances.filter((e) => e.strStatus !== 'live_verified').length;
  const nCompleted = arrInstances.filter((e) => e.strStatus === 'live_verified').length;

  // 액션 버튼 렌더링 (역할 + 권한 + 상태 기반)
  const fnRenderActions = (r: IEventInstance) => {
    const arrButtons = [];

    // 상세 보기 (항상)
    arrButtons.push(
      <Button key="detail" size="small" icon={<EyeOutlined />}
        onClick={() => { setObjDetail(r); setBDetailOpen(true); }}>상세</Button>
    );

    // 운영자: 작성 중 → 수정 + 컨펌 요청
    if (fnHasPermission('instance.create') && r.strStatus === 'event_created' && r.nCreatedByUserId === user?.nId) {
      arrButtons.push(
        <Button key="edit" size="small" icon={<EditOutlined />} onClick={() => fnOpenEdit(r)}>수정</Button>
      );
      arrButtons.push(
        <Popconfirm key="req-confirm" title="컨펌을 요청하시겠습니까? 요청 후 수정이 불가합니다." okText="요청" cancelText="취소"
          onConfirm={() => fnHandleAction(r.nId, 'confirm_requested', '컨펌 요청')}>
          <Button size="small" type="primary" icon={<SendOutlined />}>컨펌 요청</Button>
        </Popconfirm>
      );
    }

    // DBA/관리자: 컨펌 처리
    if (r.strStatus === 'confirm_requested' && (fnHasPermission('instance.execute_qa') || arrRoles.includes('admin'))) {
      arrButtons.push(
        <Popconfirm key="confirm" title="컨펌 처리하시겠습니까?" okText="확인" cancelText="취소"
          onConfirm={() => fnHandleAction(r.nId, 'dba_confirmed', 'DBA 컨펌')}>
          <Button size="small" type="primary" icon={<SafetyCertificateOutlined />}>컨펌</Button>
        </Popconfirm>
      );
    }

    // QA 반영 요청 (운영자)
    if (fnHasPermission('instance.approve_qa') && r.strStatus === 'dba_confirmed') {
      arrButtons.push(
        <Popconfirm key="qa-req" title="QA 반영을 요청하시겠습니까?" okText="요청" cancelText="취소"
          onConfirm={() => fnHandleAction(r.nId, 'qa_requested', 'QA 반영 요청')}>
          <Button size="small" type="primary" icon={<SendOutlined />}>QA반영 요청</Button>
        </Popconfirm>
      );
    }

    // QA DB 실행 (DBA 권한 - 실제 DB 접속)
    if (fnHasPermission('instance.execute_qa') && r.strStatus === 'qa_requested') {
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
            QA 반영
          </Button>
        </Popconfirm>
      );
    }

    // QA 확인 (운영자)
    if (fnHasPermission('instance.verify_qa') && r.strStatus === 'qa_deployed') {
      arrButtons.push(
        <Popconfirm key="qa-v" title="QA 반영을 확인하셨습니까?" okText="확인" cancelText="취소"
          onConfirm={() => fnHandleAction(r.nId, 'qa_verified', 'QA 확인')}>
          <Button size="small" type="primary" icon={<CheckOutlined />}>QA확인</Button>
        </Popconfirm>
      );
    }

    // LIVE 반영 요청 (운영자)
    if (fnHasPermission('instance.approve_live') && r.strStatus === 'qa_verified') {
      arrButtons.push(
        <Popconfirm key="live-req" title="LIVE 반영을 요청하시겠습니까?" okText="요청" cancelText="취소"
          onConfirm={() => fnHandleAction(r.nId, 'live_requested', 'LIVE 반영 요청')}>
          <Button size="small" style={{ background: '#eb2f96', border: 'none', color: '#fff' }} icon={<SendOutlined />}>LIVE반영 요청</Button>
        </Popconfirm>
      );
    }

    // LIVE DB 실행 (DBA 권한 - 실제 DB 접속)
    if (fnHasPermission('instance.execute_live') && r.strStatus === 'live_requested') {
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
            LIVE 반영
          </Button>
        </Popconfirm>
      );
    }

    // LIVE 확인 (운영자)
    if (fnHasPermission('instance.verify_live') && r.strStatus === 'live_deployed') {
      arrButtons.push(
        <Popconfirm key="live-v" title="LIVE 반영을 확인하셨습니까?" okText="확인" cancelText="취소"
          onConfirm={() => fnHandleAction(r.nId, 'live_verified', 'LIVE 확인')}>
          <Button size="small" style={{ background: '#52c41a', border: 'none', color: '#fff' }} icon={<CheckCircleOutlined />}>LIVE확인</Button>
        </Popconfirm>
      );
    }

    return <Space wrap>{arrButtons}</Space>;
  };

  // 테이블 컬럼
  const arrColumns = [
    {
      title: '이벤트 이름',
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
      title: '반영 날짜',
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
      title: '처리',
      key: 'actions',
      width: 300,
      render: (_: unknown, r: IEventInstance) => fnRenderActions(r),
    },
  ];

  // 필터 옵션
  const arrFilterOptions = [
    { label: '내가 관여한 이벤트', value: 'involved' },
    { label: '내가 생성한 이벤트', value: 'mine' },
    { label: '내가 처리할 이벤트', value: 'my_action' },
    { label: '전체 이벤트', value: 'all' },
  ];

  return (
    <>
      {contextHolder}
      <Title level={4} style={{ marginBottom: 24 }}>나의 대시보드</Title>

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

      {/* 필터 + 목록 */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Segmented options={arrFilterOptions} value={strFilter} onChange={(v) => fnSetFilter(v as string)} />
        </div>
        <Table
          dataSource={arrInstances}
          columns={arrColumns}
          rowKey="nId"
          loading={bLoading}
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: '해당 조건의 이벤트가 없습니다.' }}
          size="small"
        />
      </Card>

      {/* 상세 모달 */}
      <Modal title="이벤트 상세" open={bDetailOpen} onCancel={() => setBDetailOpen(false)} footer={null} width={780}>
        {objDetail && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 기본 정보 */}
            <Card size="small" title="기본 정보">
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
                <Descriptions.Item label="상태"><Tag color={OBJ_STATUS_CONFIG[objDetail.strStatus].strColor}>{OBJ_STATUS_CONFIG[objDetail.strStatus].strLabel}</Tag></Descriptions.Item>
              </Descriptions>
            </Card>

            {/* 단계별 처리자 */}
            <Card size="small" title="단계별 처리자">
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <ActorTag objActor={objDetail.objCreator} strLabel="생성자" />
                <ActorTag objActor={objDetail.objConfirmer} strLabel="컨펌자" />
                <ActorTag objActor={objDetail.objQaRequester} strLabel="QA반영요청자" />
                <ActorTag objActor={objDetail.objQaDeployer} strLabel="QA반영자" />
                <ActorTag objActor={objDetail.objQaVerifier} strLabel="QA확인자" />
                <ActorTag objActor={objDetail.objLiveRequester} strLabel="LIVE반영요청자" />
                <ActorTag objActor={objDetail.objLiveDeployer} strLabel="LIVE반영자" />
                <ActorTag objActor={objDetail.objLiveVerifier} strLabel="LIVE확인자" />
              </Space>
            </Card>

            {/* 입력값 */}
            {objDetail.strInputValues && (
              <Card size="small" title="입력값">
                <Text code style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{objDetail.strInputValues}</Text>
              </Card>
            )}

            {/* 쿼리 */}
            {objDetail.strGeneratedQuery && (
              <Card size="small" title="생성된 쿼리" extra={
                <Button size="small" icon={<CopyOutlined />} onClick={() => fnCopy(objDetail.strGeneratedQuery)}>복사</Button>
              }>
                <TextArea value={objDetail.strGeneratedQuery} readOnly autoSize={{ minRows: 4, maxRows: 15 }}
                  style={{ fontFamily: 'monospace', fontSize: 12, background: '#1e1e1e', color: '#d4d4d4', border: 'none', borderRadius: 8, padding: 12 }} />
              </Card>
            )}

            {/* 진행 이력 (실행 결과 포함) */}
            <Card size="small" title="진행 이력">
              <Timeline
                items={objDetail.arrStatusLogs.map((log) => ({
                  color: OBJ_STATUS_CONFIG[log.strStatus]?.strColor || 'gray',
                  children: (
                    <div>
                      <Tag color={OBJ_STATUS_CONFIG[log.strStatus]?.strColor}>{OBJ_STATUS_CONFIG[log.strStatus]?.strLabel}</Tag>
                      <Text strong style={{ fontSize: 12 }}>{log.strChangedBy}</Text>
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{new Date(log.dtChangedAt).toLocaleString('ko-KR')}</Text>
                      {log.strComment && <div style={{ marginTop: 2 }}><Text type="secondary" style={{ fontSize: 12 }}>{log.strComment}</Text></div>}
                      {/* 실행 결과 인라인 표시 */}
                      {log.objExecutionResult && (
                        <div style={{ marginTop: 6, padding: '6px 10px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                          <Space>
                            <Tag color={log.objExecutionResult.strEnv === 'qa' ? 'orange' : 'red'}>
                              {log.objExecutionResult.strEnv.toUpperCase()}
                            </Tag>
                            <Text style={{ fontSize: 12 }}>
                              처리 {log.objExecutionResult.nTotalAffectedRows}건
                            </Text>
                            <Divider type="vertical" />
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {log.objExecutionResult.nElapsedMs}ms
                            </Text>
                          </Space>
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            </Card>
          </Space>
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
