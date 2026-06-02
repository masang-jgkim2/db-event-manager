import type { Meta, StoryObj } from '@storybook/react';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useDesignSystem } from '../../styles/DesignSystemContext';

const SidebarMenuDemo = () => {
  const { objSider, objMenuGroup } = useDesignSystem();

  return (
    <div
      style={{
        width: 220,
        padding: 8,
        background: objSider.strBackground,
        border: `1px solid ${objSider.strLogoBorder}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          padding: '12px 10px',
          fontWeight: objSider.nLogoFontWeight,
          fontSize: objSider.nLogoFontSize,
          color: objSider.strLogoText,
          borderBottom: `1px solid ${objSider.strLogoBorder}`,
          marginBottom: 8,
        }}
      >
        DQPM
      </div>
      <div
        style={{
          fontSize: objMenuGroup.nFontSize,
          fontWeight: objMenuGroup.nFontWeight,
          letterSpacing: objMenuGroup.strLetterSpacing,
          textTransform: objMenuGroup.strTextTransform as 'uppercase',
          color: objMenuGroup.strColor,
          padding: '8px 10px 4px',
        }}
      >
        이벤트
      </div>
      <Menu
        mode="inline"
        selectedKeys={['dashboard']}
        style={{ border: 'none', background: 'transparent' }}
        items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: '대시보드' },
          { key: 'product', icon: <AppstoreOutlined />, label: '프로덕트' },
          { key: 'event', icon: <CalendarOutlined />, label: '쿼리 템플릿' },
          { key: 'db', icon: <DatabaseOutlined />, label: 'DB 접속 정보' },
        ]}
      />
      <div
        style={{
          fontSize: objMenuGroup.nFontSize,
          fontWeight: objMenuGroup.nFontWeight,
          letterSpacing: objMenuGroup.strLetterSpacing,
          textTransform: objMenuGroup.strTextTransform as 'uppercase',
          color: objMenuGroup.strColor,
          padding: '12px 10px 4px',
        }}
      >
        사용자
      </div>
      <Menu
        mode="inline"
        style={{ border: 'none', background: 'transparent' }}
        items={[{ key: 'user', icon: <UserOutlined />, label: '사용자' }]}
      />
    </div>
  );
};

const meta: Meta = {
  title: 'DQPM/Menu',
  component: SidebarMenuDemo,
  parameters: { layout: 'padded' },
};

export default meta;
type TStory = StoryObj;

export const SiderInline: TStory = {
  render: () => <SidebarMenuDemo />,
};
