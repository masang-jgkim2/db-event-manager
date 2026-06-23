import type { Meta, StoryObj } from '@storybook/react';
import { Space } from 'antd';
import { DqpmTag } from '../../components/DqpmTag';
import type { TTagVariant } from '../../styles/tagPalette';

const ARR_TONES: TTagVariant[] = [
  'product', 'service', 'dbMysql', 'dbMssql', 'dbPostgresql',
  'tone0', 'tone1', 'tone2', 'tone3', 'tone4', 'tone5',
  'tone6', 'tone7', 'tone8', 'tone9',
  'success', 'warning', 'danger', 'info', 'muted',
];

const meta = {
  title: 'DQPM/DqpmTag',
  component: DqpmTag,
  tags: ['autodocs'],
} satisfies Meta<typeof DqpmTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProductAndService: Story = {
  render: () => (
    <Space wrap>
      <DqpmTag tone="product">출조낚시왕</DqpmTag>
      <DqpmTag tone="service">FH (국내)</DqpmTag>
      <DqpmTag tone="dbMssql">MSSQL</DqpmTag>
    </Space>
  ),
};

export const AllTones: Story = {
  render: () => (
    <Space wrap size={[8, 8]}>
      {ARR_TONES.map((tone) => (
        <DqpmTag key={tone} tone={tone}>{tone}</DqpmTag>
      ))}
    </Space>
  ),
};

export const LegacyColorPresets: Story = {
  render: () => (
    <Space wrap>
      <DqpmTag color="blue">blue → palette</DqpmTag>
      <DqpmTag color="geekblue">geekblue</DqpmTag>
      <DqpmTag color="orange">orange</DqpmTag>
    </Space>
  ),
};
