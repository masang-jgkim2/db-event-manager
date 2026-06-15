import type { Meta, StoryObj } from '@storybook/react';
import { Button, Space } from 'antd';

const meta = {
  title: 'DQPM/Buttons',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrimaryAndDefault: Story = {
  render: () => (
    <Space wrap>
      <Button type="primary">새로운 프로덕트</Button>
      <Button>취소</Button>
      <Button type="link">링크</Button>
      <Button type="primary" danger>삭제</Button>
    </Space>
  ),
};
