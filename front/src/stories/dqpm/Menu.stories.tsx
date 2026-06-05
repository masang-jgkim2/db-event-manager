import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Menu } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { useDesignSystem } from '../../styles/DesignSystemContext';
import { ARR_STORY_SUBMENU_KEYS, fnBuildStoryMenuItems } from './menuStoryItems';

interface ISiderMenuDemoProps {
  bCollapsed?: boolean;
  nWidth?: number;
}

const SiderMenuDemo = ({ bCollapsed = false, nWidth }: ISiderMenuDemoProps) => {
  const { objSider, objMenuGroup } = useDesignSystem();
  const [arrOpenKeys, setArrOpenKeys] = useState<string[]>([...ARR_STORY_SUBMENU_KEYS]);
  const arrItems = fnBuildStoryMenuItems(objMenuGroup);
  const nSiderWidth = nWidth ?? (bCollapsed ? 80 : 200);

  return (
    <div
      className={`dqpm-layout-sider${bCollapsed ? ' ant-layout-sider-collapsed' : ''}`}
      style={{
        width: nSiderWidth,
        padding: 8,
        background: objSider.strBackground,
        border: `1px solid ${objSider.strLogoBorder}`,
        borderRadius: 8,
      }}
    >
      <div
        className="dqpm-layout-sider-logo"
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          borderBottom: `1px solid ${objSider.strLogoBorder}`,
        }}
      >
        <DatabaseOutlined style={{ fontSize: 22, color: objSider.strLogoText }} />
      </div>
      <Menu
        mode="inline"
        inlineCollapsed={bCollapsed}
        selectedKeys={['/users']}
        openKeys={bCollapsed ? [] : arrOpenKeys}
        onOpenChange={setArrOpenKeys}
        items={arrItems}
        style={{
          border: 'none',
          background: 'transparent',
          marginTop: 4,
          paddingLeft: bCollapsed ? 0 : 6,
          paddingRight: bCollapsed ? 0 : 6,
        }}
      />
    </div>
  );
};

const meta: Meta<ISiderMenuDemoProps> = {
  title: 'DQPM/Menu',
  component: SiderMenuDemo,
  parameters: { layout: 'padded' },
};

export default meta;
type TStory = StoryObj<ISiderMenuDemoProps>;

export const SubMenuExpanded: TStory = {
  name: 'SubMenu 펼침',
  render: () => <SiderMenuDemo bCollapsed={false} />,
};

export const SubMenuCollapsed: TStory = {
  name: 'SubMenu 접힘 (아이콘만)',
  render: () => <SiderMenuDemo bCollapsed />,
};
