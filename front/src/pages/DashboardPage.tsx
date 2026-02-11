import { Card, Col, Row, Statistic, Typography, Table, Tag, Space } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CodeOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useProductStore } from '../stores/useProductStore';
import { useEventStore } from '../stores/useEventStore';
import type { IProduct, IService } from '../types';

const { Title } = Typography;

const DashboardPage = () => {
  const arrProducts = useProductStore((s) => s.arrProducts);
  const arrEvents = useEventStore((s) => s.arrEvents);

  // 프로덕트 테이블 컬럼
  const arrProductColumns = [
    {
      title: '프로젝트명',
      dataIndex: 'strName',
      key: 'strName',
      width: 140,
    },
    {
      title: '서비스',
      dataIndex: 'arrServices',
      key: 'arrServices',
      render: (arrServices: IService[]) => (
        <Space wrap>
          {arrServices.map((s) => (
            <Tag key={s.strAbbr} color="blue">
              {s.strAbbr} ({s.strRegion})
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '이벤트 수',
      key: 'eventCount',
      width: 100,
      render: (_: unknown, objRecord: IProduct) => {
        const nCount = arrEvents.filter((e) => e.nProductId === objRecord.nId).length;
        return nCount > 0 ? <Tag color="green">{nCount}개</Tag> : <Tag>0개</Tag>;
      },
    },
  ];

  return (
    <>
      <Title level={4} style={{ marginBottom: 24 }}>대시보드</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="등록된 프로덕트"
              value={arrProducts.length}
              prefix={<AppstoreOutlined style={{ color: '#667eea' }} />}
              suffix="개"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="이벤트 템플릿"
              value={arrEvents.length}
              prefix={<CalendarOutlined style={{ color: '#52c41a' }} />}
              suffix="개"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="생성된 이벤트"
              value={0}
              prefix={<CodeOutlined style={{ color: '#faad14' }} />}
              suffix="건"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="서비스 총 수"
              value={arrProducts.reduce((n, p) => n + p.arrServices.length, 0)}
              prefix={<TeamOutlined style={{ color: '#eb2f96' }} />}
              suffix="개"
            />
          </Card>
        </Col>
      </Row>

      {/* 프로덕트 현황 */}
      <Card style={{ marginTop: 24 }} title="프로덕트 현황">
        <Table
          dataSource={arrProducts}
          columns={arrProductColumns}
          rowKey="nId"
          pagination={false}
          size="small"
        />
      </Card>
    </>
  );
};

export default DashboardPage;
