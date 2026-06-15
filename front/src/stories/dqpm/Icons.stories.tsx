import type { Meta, StoryObj } from '@storybook/react';
import { Typography, theme } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  CodeOutlined,
  DatabaseOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
  RocketOutlined,
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
  WifiOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { OBJ_STATUS_ICONS, fnRenderStatusIcon } from '../../constants/statusIcons';
import { OBJ_STATUS_CONFIG, type TEventStatus } from '../../types';

interface IIconEntry {
  strId: string;
  nodeIcon: React.ReactNode;
  strWhere: string;
}

const IconGrid = ({ arrItems, nIconSize = 18 }: { arrItems: IIconEntry[]; nIconSize?: number }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
      }}
    >
      {arrItems.map((obj) => (
        <div
          key={obj.strId}
          style={{
            padding: 12,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: nIconSize, color: token.colorText, marginBottom: 8 }}>{obj.nodeIcon}</div>
          <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{obj.strId}</div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 4 }}>{obj.strWhere}</div>
        </div>
      ))}
    </div>
  );
};

/** MainLayout 사이드바·헤더 — 앱과 동일 @ant-design/icons 컴포넌트 */
const ARR_SIDEBAR_MENU: IIconEntry[] = [
  { strId: 'DashboardOutlined', nodeIcon: <DashboardOutlined />, strWhere: '대시보드 · 나의 대시보드' },
  { strId: 'AppstoreOutlined', nodeIcon: <AppstoreOutlined />, strWhere: '프로덕트' },
  { strId: 'CalendarOutlined', nodeIcon: <CalendarOutlined />, strWhere: '쿼리 템플릿 · 그룹「이벤트」' },
  { strId: 'DatabaseOutlined', nodeIcon: <DatabaseOutlined />, strWhere: 'DB 접속 정보' },
  { strId: 'TeamOutlined', nodeIcon: <TeamOutlined />, strWhere: '사용자 · 그룹「사용자」' },
  { strId: 'SafetyCertificateOutlined', nodeIcon: <SafetyCertificateOutlined />, strWhere: '역할 권한' },
  { strId: 'HistoryOutlined', nodeIcon: <HistoryOutlined />, strWhere: '활동' },
  { strId: 'RocketOutlined', nodeIcon: <RocketOutlined />, strWhere: '그룹「운영」' },
  { strId: 'CodeOutlined', nodeIcon: <CodeOutlined />, strWhere: '이벤트 생성' },
];

const ARR_CHROME: IIconEntry[] = [
  { strId: 'SettingOutlined', nodeIcon: <SettingOutlined />, strWhere: '헤더 UI 설정' },
  { strId: 'BellOutlined', nodeIcon: <BellOutlined />, strWhere: '알림' },
  { strId: 'WifiOutlined', nodeIcon: <WifiOutlined />, strWhere: 'SSE 연결 상태' },
  { strId: 'UserOutlined', nodeIcon: <UserOutlined />, strWhere: '아바타·로그인' },
  { strId: 'LogoutOutlined', nodeIcon: <LogoutOutlined />, strWhere: '로그아웃' },
];

const ARR_STATUS: IIconEntry[] = (Object.keys(OBJ_STATUS_ICONS) as TEventStatus[]).map((strStatus) => {
  const Icon = OBJ_STATUS_ICONS[strStatus];
  return {
    strId: Icon.displayName || Icon.name || strStatus,
    nodeIcon: fnRenderStatusIcon(strStatus, 18),
    strWhere: OBJ_STATUS_CONFIG[strStatus].strLabel,
  };
});

const IconsCatalogPanel = () => (
  <div style={{ maxWidth: 900 }}>
    <Typography.Paragraph type="secondary">
      DQPM에서 쓰는 아이콘은 모두{' '}
      <a href="https://ant.design/components/icon" target="_blank" rel="noreferrer">
        @ant-design/icons
      </a>
      입니다. 색은 Ant Menu·<code>currentColor</code>·시맨틱 토큰에 따릅니다. 전체 800+ 아이콘은 Ant 문서에서 검색하세요.
    </Typography.Paragraph>

    <Typography.Title level={5} style={{ marginTop: 24 }}>
      사이드바 메뉴 (MainLayout)
    </Typography.Title>
    <IconGrid arrItems={ARR_SIDEBAR_MENU} />

    <Typography.Title level={5} style={{ marginTop: 32 }}>
      헤더·크롬
    </Typography.Title>
    <IconGrid arrItems={ARR_CHROME} />

    <Typography.Title level={5} style={{ marginTop: 32 }}>
      워크플로 상태 (statusIcons.tsx)
    </Typography.Title>
    <IconGrid arrItems={ARR_STATUS} nIconSize={16} />

    <Typography.Paragraph type="secondary" style={{ marginTop: 32, fontSize: 12 }}>
      메뉴 맥락 미리보기: Storybook <strong>DQPM / Menu</strong>
    </Typography.Paragraph>
  </div>
);

const meta: Meta = {
  title: 'DQPM/Icons',
  component: IconsCatalogPanel,
  parameters: { layout: 'padded' },
};

export default meta;
type TStory = StoryObj;

export const AppCatalog: TStory = {
  render: () => <IconsCatalogPanel />,
};
