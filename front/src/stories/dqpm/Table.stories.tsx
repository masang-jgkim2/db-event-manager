import type { Meta, StoryObj } from '@storybook/react';
import { Table, Card } from 'antd';
import { DqpmTag } from '../../components/DqpmTag';
import { ProductNameTag } from '../../components/ProductNameTag';

interface IRow {
  nId: number;
  strProductName: string;
  strEnv: string;
  strStatus: string;
}

const arrData: IRow[] = [
  { nId: 1, strProductName: 'DK', strEnv: 'qa', strStatus: 'qa_requested' },
  { nId: 2, strProductName: 'Sample', strEnv: 'live', strStatus: 'live_verified' },
];

const arrColumns = [
  { title: '번호', dataIndex: 'nId', width: 72 },
  {
    title: '프로덕트',
    dataIndex: 'strProductName',
    render: (str: string) => <ProductNameTag strName={str} />,
  },
  {
    title: '환경',
    dataIndex: 'strEnv',
    render: (str: string) => (
      <DqpmTag tone={str === 'live' ? 'danger' : 'warning'}>{str.toUpperCase()}</DqpmTag>
    ),
  },
  {
    title: '상태',
    dataIndex: 'strStatus',
    render: () => <DqpmTag tone="info">진행 중</DqpmTag>,
  },
];

const TableInCard = () => (
  <Card title="목록 (CrudPageShell 패턴)" bordered={false} style={{ maxWidth: 720 }}>
    <Table<IRow>
      rowKey="nId"
      size="small"
      bordered={false}
      pagination={false}
      dataSource={arrData}
      columns={arrColumns}
    />
  </Card>
);

const meta: Meta = {
  title: 'DQPM/Table',
  component: TableInCard,
  parameters: { layout: 'padded' },
};

export default meta;
type TStory = StoryObj;

export const ListInCard: TStory = {
  render: () => <TableInCard />,
};
