import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Space } from 'antd';
import LabeledSwitch from '../../components/LabeledSwitch';

const meta = {
  title: 'DQPM/LabeledSwitch',
  component: LabeledSwitch,
  tags: ['autodocs'],
} satisfies Meta<typeof LabeledSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RealtimeRefresh: Story = {
  args: {
    strLabel: '실시간 갱신',
    bChecked: true,
    onChange: () => {},
  },
  render: function Render(args) {
    const [bOn, setBOn] = useState(args.bChecked);
    return <LabeledSwitch {...args} bChecked={bOn} onChange={setBOn} />;
  },
};

export const AutoConnection: Story = {
  args: {
    strLabel: '자동 연결',
    bChecked: false,
    onChange: () => {},
    strTooltip: '활성 접속을 약 30초마다 자동 테스트 (기본 꺼짐)',
  },
  render: function Render(args) {
    const [bOn, setBOn] = useState(args.bChecked);
    return <LabeledSwitch {...args} bChecked={bOn} onChange={setBOn} />;
  },
};

export const SideBySide: Story = {
  args: {
    strLabel: '예시',
    bChecked: false,
    onChange: () => {},
  },
  render: () => (
    <Space direction="vertical" size="middle">
      <LabeledSwitch strLabel="실시간 갱신" bChecked onChange={() => {}} />
      <LabeledSwitch
        strLabel="자동 연결"
        bChecked={false}
        onChange={() => {}}
        strTooltip="활성 접속을 약 30초마다 자동 테스트"
      />
    </Space>
  ),
};
