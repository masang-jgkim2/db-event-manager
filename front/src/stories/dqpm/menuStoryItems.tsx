import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
  RocketOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import type { CSSProperties } from 'react';

type TMenuGroupStyle = {
  strColor: string;
  nFontSize: number;
  nFontWeight: number;
  strLetterSpacing: string;
  strTextTransform: string;
};

/** MainLayout `fnRenderMenuSubmenuLabel` 와 동일 패턴 */
export const fnStoryMenuSubmenuLabel = (strLabel: string, objMg: TMenuGroupStyle) => (
  <span
    className="dqpm-menu-submenu-label"
    style={{
      color: objMg.strColor,
      fontSize: objMg.nFontSize,
      fontWeight: objMg.nFontWeight,
      letterSpacing: objMg.strLetterSpacing,
      textTransform: objMg.strTextTransform as CSSProperties['textTransform'],
    }}
  >
    {strLabel}
  </span>
);

/** 앱 사이드바와 동일 SubMenu 구조 (권한 필터 없이 전체 노출) */
export function fnBuildStoryMenuItems(objMg: TMenuGroupStyle): MenuProps['items'] {
  return [
    {
      key: 'event-group',
      icon: <CalendarOutlined />,
      label: fnStoryMenuSubmenuLabel('이벤트', objMg),
      children: [
        { key: '/dashboard', icon: <DashboardOutlined />, label: '대시보드' },
        { key: '/products', icon: <AppstoreOutlined />, label: '프로덕트' },
        { key: '/db-connections', icon: <DatabaseOutlined />, label: 'DB 접속 정보' },
        { key: '/events', icon: <CalendarOutlined />, label: '쿼리 템플릿' },
      ],
    },
    {
      key: 'user-group',
      icon: <TeamOutlined />,
      label: fnStoryMenuSubmenuLabel('사용자', objMg),
      children: [
        { key: '/users', icon: <TeamOutlined />, label: '사용자' },
        { key: '/roles', icon: <SafetyCertificateOutlined />, label: '역할 권한' },
        { key: '/activity', icon: <HistoryOutlined />, label: '활동' },
      ],
    },
    {
      key: 'operation-group',
      icon: <RocketOutlined />,
      label: fnStoryMenuSubmenuLabel('운영', objMg),
      children: [
        { key: '/my-dashboard', icon: <DashboardOutlined />, label: '나의 대시보드' },
        { key: '/query', icon: <CodeOutlined />, label: '이벤트 생성' },
      ],
    },
  ];
}

export const ARR_STORY_SUBMENU_KEYS = ['event-group', 'user-group', 'operation-group'];
