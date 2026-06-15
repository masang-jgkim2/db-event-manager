import type { Meta, StoryObj } from '@storybook/react';
import { Button, Card, Col, Row, Statistic, Table } from 'antd';
import { TeamOutlined, PlusOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import CrudPageShell from '../../components/CrudPageShell';
import CrudListToolbar from '../../components/CrudListToolbar';
import { fnSemanticStatisticStyle } from '../../styles/semanticColors';

const arrSampleRows = [
  { nId: 1, strName: 'admin' },
  { nId: 2, strName: 'dba01' },
];

const CrudListDemo = () => {
  const { token } = theme.useToken();

  return (
    <div className="dqpm-layout-content-panel" style={{ padding: 24, maxWidth: 960 }}>
      <CrudPageShell
        strTitle="사용자"
        nodeIcon={<TeamOutlined />}
        nodeDescription="CrudPageShell — 제목·아이콘·설명·Card 골격 (앱 CRUD 페이지와 동일)"
        nodeExtra={(
          <Button type="primary" icon={<PlusOutlined />}>
            새로운 사용자
          </Button>
        )}
        nodeAboveCard={(
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="stretch">
            <Col xs={12} sm={6} style={{ display: 'flex' }}>
              <Card bordered={false} style={{ width: '100%' }}>
                <Statistic
                  title="전체"
                  value={158}
                  suffix="건"
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ fontSize: 22, lineHeight: 1.2, color: token.colorText }}
                  styles={{ title: { minHeight: 22 } }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6} style={{ display: 'flex' }}>
              <Card bordered={false} style={{ width: '100%' }}>
                <Statistic
                  title="내 처리 대기"
                  value={18}
                  suffix="건"
                  prefix={<SyncOutlined />}
                  valueStyle={fnSemanticStatisticStyle('warning', token)}
                  styles={{ title: { minHeight: 22 } }}
                />
              </Card>
            </Col>
          </Row>
        )}
        nodeToolbar={<CrudListToolbar nodeLeft={<span style={{ opacity: 0.7 }}>툴바 슬롯</span>} />}
      >
        <Table
          rowKey="nId"
          size="small"
          bordered={false}
          pagination={false}
          dataSource={arrSampleRows}
          columns={[
            { title: '번호', dataIndex: 'nId', width: 72 },
            { title: '아이디', dataIndex: 'strName' },
          ]}
        />
      </CrudPageShell>
    </div>
  );
};

const meta: Meta = {
  title: 'DQPM/CrudPageShell',
  component: CrudListDemo,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type TStory = StoryObj;

export const UserListPattern: TStory = {
  render: () => <CrudListDemo />,
};
