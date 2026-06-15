import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from 'antd';
import SettingsDrawer from '../../components/SettingsDrawer';

const SettingsDrawerDemo = () => {
  const [bOpen, setBOpen] = useState(true);

  return (
    <div style={{ padding: 24 }}>
      <Button type="primary" onClick={() => setBOpen(true)}>
        UI 설정 열기
      </Button>
      <SettingsDrawer bOpen={bOpen} fnOnClose={() => setBOpen(false)} />
    </div>
  );
};

const meta: Meta = {
  title: 'DQPM/SettingsDrawer',
  component: SettingsDrawerDemo,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type TStory = StoryObj;

export const PointColorsThree: TStory = {
  name: '포인트 컬러 3종',
  render: () => <SettingsDrawerDemo />,
};
