import { Card, Col, Row, Statistic, Typography } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CodeOutlined,
  TeamOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

// 대시보드 - 전체 현황 요약
const DashboardPage = () => {
  return (
    <>
      <Title level={4} style={{ marginBottom: 24 }}>
        대시보드
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="등록된 프로덕트"
              value={0}
              prefix={<AppstoreOutlined style={{ color: '#667eea' }} />}
              suffix="개"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="이벤트 템플릿"
              value={0}
              prefix={<CalendarOutlined style={{ color: '#52c41a' }} />}
              suffix="개"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="생성된 쿼리"
              value={0}
              prefix={<CodeOutlined style={{ color: '#faad14' }} />}
              suffix="건"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="사용자"
              value={1}
              prefix={<TeamOutlined style={{ color: '#eb2f96' }} />}
              suffix="명"
            />
          </Card>
        </Col>
      </Row>

      {/* 최근 활동 영역 */}
      <Card style={{ marginTop: 24 }}>
        <Title level={5}>최근 활동</Title>
        <div
          style={{
            padding: '40px 0',
            textAlign: 'center',
            color: '#bfbfbf',
          }}
        >
          아직 활동 내역이 없습니다. 프로덕트를 등록하고 이벤트 쿼리를 생성해보세요.
        </div>
      </Card>
    </>
  );
};

export default DashboardPage;
