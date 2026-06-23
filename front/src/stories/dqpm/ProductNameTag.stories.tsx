import type { Meta, StoryObj } from '@storybook/react';
import { ProductNameTag } from '../../components/ProductNameTag';

const meta = {
  title: 'DQPM/ProductNameTag',
  component: ProductNameTag,
  tags: ['autodocs'],
  args: { strName: '출조낚시왕' },
} satisfies Meta<typeof ProductNameTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongName: Story = {
  args: {
    strName: '매우 긴 프로덕트 이름이 말줄임으로 표시되는지 확인합니다',
  },
};
