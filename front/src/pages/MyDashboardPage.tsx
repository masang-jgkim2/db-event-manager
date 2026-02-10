import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Table, Tag, Space, Button, Modal,
  Input, message, Row, Col, Statistic, Timeline, Popconfirm,
  Segmented, Descriptions,
} from 'antd';
import {
  EyeOutlined, CheckOutlined, ClockCircleOutlined,
  SyncOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  RocketOutlined, CopyOutlined, UserOutlined,
} from '@ant-design/icons';
import { fnApiGetInstances, fnApiUpdateStatus } from '../api/eventInstanceApi';
import { useAuthStore } from '../stores/useAuthStore';
import type { IEventInstance, TEventStatus, IStageActor } from '../types';
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

const MyDashboardPage = () => {
  const [arrInstances, setArrInstances] = useState<IEventInstance[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [objDetail, setObjDetail] = useState<IEventInstance | null>(null);
  const [bDetailOpen, setBDetailOpen] = useState(false);
  const [strFilter, setStrFilter] = useState<string>('involved');
  const [messageApi, contextHolder] = message.useMessage();

  const user = useAuthStore((s) => s.user);
  const strRole = user?.strRole || '';

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

  // 상태 변경 처리
  const fnHandleAction = async (nId: number, strNextStatus: TEventStatus, strActionLabel: string) => {
    try {
      const result = await fnApiUpdateStatus(nId, strNextStatus, strActionLabel, user?.strDisplayName || '');
      if (result.bSuccess) {
        messageApi.success(`${strActionLabel} 처리 완료`);
        fnLoad();
        // 상세 모달이 열려 있으면 갱신
        if (objDetail?.nId === nId) setObjDetail(result.objInstance);
      } else {
        messageApi.error(result.strMessage);
      }
    } catch {
      messageApi.error('처리에 실패했습니다.');
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
      event_created: ['dba', 'admin'],
      dba_confirmed: ['dba', 'admin'],
      qa_deployed: ['gm', 'planner', 'admin'],
      qa_verified: ['dba', 'admin'],
      live_deployed: ['gm', 'planner', 'admin'],
    };
    return arrTrans[e.strStatus]?.includes(strRole);
  }).length;
  const nInProgress = arrInstances.filter((e) => e.strStatus !== 'live_verified').length;
  const nCompleted = arrInstances.filter((e) => e.strStatus === 'live_verified').length;

  // 액션 버튼 렌더링 (역할 + 현재 상태에 따라)
  const fnRenderActions = (r: IEventInstance) => {
    const arrButtons = [];

    // 상세 보기 (항상)
    arrButtons.push(
      <Button key="detail" size="small" icon={<EyeOutlined />}
        onClick={() => { setObjDetail(r); setBDetailOpen(true); }}>상세</Button>
    );

    // DBA 액션
    if (['dba', 'admin'].includes(strRole)) {
      if (r.strStatus === 'event_created') {
        arrButtons.push(
          <Popconfirm key="confirm" title="컨펌 처리하시겠습니까?" okText="확인" cancelText="취소"
            onConfirm={() => fnHandleAction(r.nId, 'dba_confirmed', 'DBA 컨펌')}>
            <Button size="small" type="primary" icon={<SafetyCertificateOutlined />}>컨펌</Button>
          </Popconfirm>
        );
      }
      if (r.strStatus === 'dba_confirmed') {
        arrButtons.push(
          <Popconfirm key="qa" title="QA 반영 처리하시겠습니까?" okText="확인" cancelText="취소"
            onConfirm={() => fnHandleAction(r.nId, 'qa_deployed', 'QA 반영')}>
            <Button size="small" style={{ background: '#faad14', border: 'none', color: '#fff' }} icon={<RocketOutlined />}>QA반영</Button>
          </Popconfirm>
        );
      }
      if (r.strStatus === 'qa_verified') {
        arrButtons.push(
          <Popconfirm key="live" title="LIVE 반영 처리하시겠습니까?" okText="확인" cancelText="취소"
            onConfirm={() => fnHandleAction(r.nId, 'live_deployed', 'LIVE 반영')}>
            <Button size="small" danger type="primary" icon={<RocketOutlined />}>LIVE반영</Button>
          </Popconfirm>
        );
      }
    }

    // 운영자 액션
    if (['gm', 'planner', 'admin'].includes(strRole)) {
      if (r.strStatus === 'qa_deployed') {
        arrButtons.push(
          <Popconfirm key="qa-v" title="QA 반영을 확인하셨습니까?" okText="확인" cancelText="취소"
            onConfirm={() => fnHandleAction(r.nId, 'qa_verified', 'QA 확인')}>
            <Button size="small" type="primary" icon={<CheckOutlined />}>QA확인</Button>
          </Popconfirm>
        );
      }
      if (r.strStatus === 'live_deployed') {
        arrButtons.push(
          <Popconfirm key="live-v" title="LIVE 반영을 확인하셨습니까?" okText="확인" cancelText="취소"
            onConfirm={() => fnHandleAction(r.nId, 'live_verified', 'LIVE 확인')}>
            <Button size="small" style={{ background: '#52c41a', border: 'none', color: '#fff' }} icon={<CheckCircleOutlined />}>LIVE확인</Button>
          </Popconfirm>
        );
      }
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
      width: 220,
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

      {/* 필터 */}
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
                <ActorTag objActor={objDetail.objQaDeployer} strLabel="QA반영자" />
                <ActorTag objActor={objDetail.objQaVerifier} strLabel="QA확인자" />
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

            {/* 진행 이력 */}
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
                    </div>
                  ),
                }))}
              />
            </Card>
          </Space>
        )}
      </Modal>
    </>
  );
};

export default MyDashboardPage;
