import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Table, Tag, Space, Button, Modal,
  Input, message, Row, Col, Statistic, Timeline, Popconfirm,
  Segmented, Descriptions, Alert, Spin, Divider, Progress,
} from 'antd';
import {
  EyeOutlined, CheckOutlined, ClockCircleOutlined,
  SyncOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  RocketOutlined, CopyOutlined, UserOutlined, EditOutlined,
  SendOutlined, ExclamationCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import {
  fnApiGetInstances, fnApiUpdateStatus,
  fnApiUpdateInstance, fnApiExecuteQuery,
} from '../api/eventInstanceApi';
import { useAuthStore } from '../stores/useAuthStore';
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
            message="쿼리 실행 실패"
            description={
              <Space direction="vertical" size={4}>
                <Text>{objResult.strError}</Text>
                {objResult.strRollbackMsg && (
                  <Text strong style={{ color: '#1890ff' }}>✓ {objResult.strRollbackMsg}</Text>
                )}
              </Space>
            }
          />
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              실행 시도 시각: {new Date(objResult.dtExecutedAt).toLocaleString('ko-KR')}
              {' · '}소요 시간: {objResult.nElapsedMs}ms
            </Text>
          </div>
        </Space>
      )}
    </Modal>
  );
};

const MyDashboardPage = () => {
  const [arrInstances, setArrInstances] = useState<IEventInstance[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [objDetail, setObjDetail] = useState<IEventInstance | null>(null);
  const [bDetailOpen, setBDetailOpen] = useState(false);
  const [strFilter, setStrFilter] = useState<string>('involved');
  // 수정 모달
  const [bEditOpen, setBEditOpen] = useState(false);
  const [objEditInstance, setObjEditInstance] = useState<IEventInstance | null>(null);
  const [strEditEventName, setStrEditEventName] = useState('');
  const [strEditInputValues, setStrEditInputValues] = useState('');
  const [strEditExecDate, setStrEditExecDate] = useState('');
  // 실행 관련
  const [bExecuting, setBExecuting] = useState<number | null>(null);  // 실행 중인 인스턴스 ID
  const [objExecResult, setObjExecResult] = useState<IQueryExecutionResult | null>(null);
  const [strExecEnv, setStrExecEnv] = useState<'qa' | 'live'>('qa');
  const [bExecResultOpen, setBExecResultOpen] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  const user = useAuthStore((s) => s.user);
  const strRole = user?.strRole || '';
  const arrPermissions = user?.arrPermissions || [];

  // 권한 확인 헬퍼
  const fnHasPermission = (strPerm: string) => arrPermissions.includes(strPerm as any);

  // 이벤트 목록 조회
  const fnLoad = useCallback(async () => {
    setBLoading(true);
    try {
      const result = await fnApiGetInstances(strFilter);
      if (result.bSuccess) setArrInstances(result.arrInstances);
    } catch {
      messageApi.error('이벤트 목록을 불러올 수 없습니다.');
    } finally {
      setBLoading(false);
    }
  }, [strFilter, messageApi]);

  useEffect(() => { fnLoad(); }, [fnLoad]);

  // 상태 변경 처리 (일반 상태 전이)
  const fnHandleAction = async (nId: number, strNextStatus: TEventStatus, strActionLabel: string) => {
    try {
      const result = await fnApiUpdateStatus(nId, strNextStatus, strActionLabel, user?.strDisplayName || '');
      if (result.bSuccess) {
        messageApi.success(`${strActionLabel} 처리 완료`);
        fnLoad();
        if (objDetail?.nId === nId) setObjDetail(result.objInstance);
      } else {
        messageApi.error(result.strMessage);
      }
    } catch {
      messageApi.error('처리에 실패했습니다.');
    }
  };

  // QA/LIVE DB 실행
  const fnHandleExecute = async (r: IEventInstance, strEnv: 'qa' | 'live') => {
    setBExecuting(r.nId);
    setStrExecEnv(strEnv);
    try {
      const result = await fnApiExecuteQuery(r.nId, strEnv, user?.strDisplayName || '');
      setObjExecResult(result.objExecutionResult);
      setBExecResultOpen(true);

      if (result.bSuccess) {
        messageApi.success(`${strEnv.toUpperCase()} 반영 완료`);
        fnLoad();
        if (objDetail?.nId === r.nId) setObjDetail(result.objInstance);
      } else {
        // 실패해도 결과 모달은 열림 (롤백 메시지 표시)
        messageApi.error(`${strEnv.toUpperCase()} 반영 실패 - 롤백 완료`);
      }
    } catch {
      messageApi.error('실행 요청에 실패했습니다.');
    } finally {
      setBExecuting(null);
    }
  };

  // 수정 모달 열기
  const fnOpenEdit = (r: IEventInstance) => {
    setObjEditInstance(r);
    setStrEditEventName(r.strEventName);
    setStrEditInputValues(r.strInputValues);
    setStrEditExecDate(r.dtExecDate);
    setBEditOpen(true);
  };

  // 수정 저장
  const fnSaveEdit = async () => {
    if (!objEditInstance) return;
    try {
      const result = await fnApiUpdateInstance(objEditInstance.nId, {
        strEventName: strEditEventName,
        strInputValues: strEditInputValues,
        dtExecDate: strEditExecDate,
      });
      if (result.bSuccess) {
        messageApi.success('이벤트가 수정되었습니다.');
        setBEditOpen(false);
        fnLoad();
      } else {
        messageApi.error(result.strMessage);
      }
    } catch {
      messageApi.error('수정에 실패했습니다.');
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
      event_created: ['gm', 'planner', 'admin'],
      confirm_requested: ['dba', 'admin'],
      dba_confirmed: ['gm', 'planner', 'admin'],
      qa_requested: ['dba', 'admin'],
      qa_deployed: ['gm', 'planner', 'admin'],
      qa_verified: ['gm', 'planner', 'admin'],
      live_requested: ['dba', 'admin'],
      live_deployed: ['gm', 'planner', 'admin'],
    };
    return arrTrans[e.strStatus]?.includes(strRole);
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

    // DBA: 컨펌 처리
    if (r.strStatus === 'confirm_requested' && (fnHasPermission('instance.execute_qa') || strRole === 'admin')) {
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
      title: '실행일',
      dataIndex: 'dtExecDate',
      key: 'dtExecDate',
      width: 100,
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
          <Segmented options={arrFilterOptions} value={strFilter} onChange={(v) => setStrFilter(v as string)} />
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
                <Descriptions.Item label="실행일">{objDetail.dtExecDate}</Descriptions.Item>
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
        width={600}
      >
        {objEditInstance && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="middle">
            <div>
              <Text strong>프로덕트</Text>
              <Input value={`${objEditInstance.strProductName} (${objEditInstance.strServiceAbbr} / ${objEditInstance.strServiceRegion})`} disabled />
            </div>
            <div>
              <Text strong>이벤트 이름</Text>
              <Input value={strEditEventName} onChange={(e) => setStrEditEventName(e.target.value)} />
            </div>
            <div>
              <Text strong>실행 날짜</Text>
              <Input value={strEditExecDate} onChange={(e) => setStrEditExecDate(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <Text strong>입력값 (아이템/퀘스트)</Text>
              <TextArea value={strEditInputValues} onChange={(e) => setStrEditInputValues(e.target.value)}
                rows={5} style={{ fontFamily: 'monospace', fontSize: 13 }} />
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
