import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Table, Tag, Space, Button, Modal,
  Input, message, Badge, Row, Col, Statistic, Timeline,
} from 'antd';
import {
  EyeOutlined, CheckOutlined, ClockCircleOutlined,
  SyncOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { fnApiGetInstances, fnApiUpdateStatus } from '../api/eventInstanceApi';
import { useAuthStore } from '../stores/useAuthStore';
import type { IEventInstance, TEventStatus } from '../types';
import { OBJ_STATUS_CONFIG } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const MyDashboardPage = () => {
  const [arrInstances, setArrInstances] = useState<IEventInstance[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [objDetailInstance, setObjDetailInstance] = useState<IEventInstance | null>(null);
  const [bDetailOpen, setBDetailOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const user = useAuthStore((s) => s.user);

  // 내 이벤트 목록 조회
  const fnLoadInstances = useCallback(async () => {
    setBLoading(true);
    try {
      const result = await fnApiGetInstances('mine');
      if (result.bSuccess) {
        setArrInstances(result.arrInstances);
      }
    } catch {
      messageApi.error('이벤트 목록을 불러올 수 없습니다.');
    } finally {
      setBLoading(false);
    }
  }, [messageApi]);

  useEffect(() => { fnLoadInstances(); }, [fnLoadInstances]);

  // 상태 변경 (QA 확인, LIVE 확인)
  const fnHandleVerify = async (nId: number, strNextStatus: TEventStatus) => {
    try {
      const result = await fnApiUpdateStatus(nId, strNextStatus, `${user?.strDisplayName} 확인 완료`);
      if (result.bSuccess) {
        messageApi.success('확인 처리되었습니다.');
        fnLoadInstances();
      } else {
        messageApi.error(result.strMessage);
      }
    } catch {
      messageApi.error('처리에 실패했습니다.');
    }
  };

  // 통계 계산
  const nTotal = arrInstances.length;
  const nPending = arrInstances.filter((e) =>
    e.strStatus === 'event_created' || e.strStatus === 'dba_confirmed'
  ).length;
  const nMyAction = arrInstances.filter((e) =>
    e.strStatus === 'qa_deployed' || e.strStatus === 'live_deployed'
  ).length;
  const nCompleted = arrInstances.filter((e) => e.strStatus === 'live_verified').length;

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
      dataIndex: 'strProductName',
      key: 'strProductName',
      width: 110,
      render: (str: string) => <Tag>{str}</Tag>,
    },
    {
      title: '실행일',
      dataIndex: 'dtExecDate',
      key: 'dtExecDate',
      width: 100,
    },
    {
      title: '종류',
      key: 'category',
      width: 70,
      render: (_: unknown, r: IEventInstance) => <Tag color="blue">{r.strCategory}</Tag>,
    },
    {
      title: '유형',
      key: 'type',
      width: 70,
      render: (_: unknown, r: IEventInstance) => <Tag color="red">{r.strType}</Tag>,
    },
    {
      title: '상태',
      dataIndex: 'strStatus',
      key: 'strStatus',
      width: 120,
      render: (strStatus: TEventStatus) => {
        const cfg = OBJ_STATUS_CONFIG[strStatus];
        return <Tag color={cfg.strColor}>{cfg.strLabel}</Tag>;
      },
    },
    {
      title: '처리',
      key: 'actions',
      width: 150,
      render: (_: unknown, r: IEventInstance) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setObjDetailInstance(r); setBDetailOpen(true); }}>
            상세
          </Button>
          {r.strStatus === 'qa_deployed' && (
            <Button size="small" type="primary" icon={<CheckOutlined />}
              onClick={() => fnHandleVerify(r.nId, 'qa_verified')}>
              QA확인
            </Button>
          )}
          {r.strStatus === 'live_deployed' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a', border: 'none' }}
              onClick={() => fnHandleVerify(r.nId, 'live_verified')}>
              LIVE확인
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Title level={4} style={{ marginBottom: 24 }}>내 이벤트 대시보드</Title>

      {/* 통계 카드 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="전체" value={nTotal} suffix="건" prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="진행 중" value={nPending} suffix="건" prefix={<SyncOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Badge count={nMyAction} offset={[10, 0]}>
              <Statistic title="내 확인 대기" value={nMyAction} suffix="건" prefix={<CheckOutlined />} valueStyle={{ color: '#faad14' }} />
            </Badge>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="완료" value={nCompleted} suffix="건" prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      {/* 이벤트 목록 */}
      <Card>
        <Table
          dataSource={arrInstances}
          columns={arrColumns}
          rowKey="nId"
          loading={bLoading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '생성한 이벤트가 없습니다. 이벤트 생성 메뉴에서 이벤트를 만들어보세요.' }}
          size="small"
        />
      </Card>

      {/* 상세 모달 */}
      <Modal
        title="이벤트 상세 정보"
        open={bDetailOpen}
        onCancel={() => setBDetailOpen(false)}
        footer={null}
        width={700}
      >
        {objDetailInstance && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card size="small" title="기본 정보">
              <Row gutter={16}>
                <Col span={12}><Text type="secondary">이벤트명</Text><br /><Text strong>{objDetailInstance.strEventName}</Text></Col>
                <Col span={12}><Text type="secondary">프로덕트</Text><br /><Text strong>{objDetailInstance.strProductName} ({objDetailInstance.strServiceAbbr})</Text></Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={8}><Text type="secondary">종류</Text><br /><Tag color="blue">{objDetailInstance.strCategory}</Tag></Col>
                <Col span={8}><Text type="secondary">유형</Text><br /><Tag color="red">{objDetailInstance.strType}</Tag></Col>
                <Col span={8}><Text type="secondary">실행일</Text><br /><Text strong>{objDetailInstance.dtExecDate}</Text></Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={12}><Text type="secondary">담당자</Text><br /><Text>{objDetailInstance.strCreatedBy}</Text></Col>
                <Col span={12}><Text type="secondary">상태</Text><br /><Tag color={OBJ_STATUS_CONFIG[objDetailInstance.strStatus].strColor}>{OBJ_STATUS_CONFIG[objDetailInstance.strStatus].strLabel}</Tag></Col>
              </Row>
            </Card>

            {objDetailInstance.strInputValues && (
              <Card size="small" title="입력값">
                <Text code style={{ whiteSpace: 'pre-wrap' }}>{objDetailInstance.strInputValues}</Text>
              </Card>
            )}

            {objDetailInstance.strGeneratedQuery && (
              <Card size="small" title="생성된 쿼리">
                <TextArea value={objDetailInstance.strGeneratedQuery} readOnly autoSize={{ minRows: 4, maxRows: 15 }}
                  style={{ fontFamily: 'monospace', fontSize: 12, background: '#1e1e1e', color: '#d4d4d4', border: 'none', borderRadius: 8 }} />
              </Card>
            )}

            <Card size="small" title="진행 이력">
              <Timeline
                items={objDetailInstance.arrStatusLogs.map((log) => ({
                  color: OBJ_STATUS_CONFIG[log.strStatus]?.strColor || 'gray',
                  children: (
                    <>
                      <Tag color={OBJ_STATUS_CONFIG[log.strStatus]?.strColor}>{OBJ_STATUS_CONFIG[log.strStatus]?.strLabel}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}> {log.strChangedBy} - {new Date(log.dtChangedAt).toLocaleString('ko-KR')}</Text>
                      {log.strComment && <><br /><Text style={{ fontSize: 12 }}>{log.strComment}</Text></>}
                    </>
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
