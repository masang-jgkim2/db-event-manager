import React from 'react';

/** 대시보드 카드 내부 공통 레이아웃: 아이콘(좌상단) · 제목 · 내용 영역 */
export const N_DASHBOARD_ICON_SIZE = 24;
/** 카드 제목·내용(숫자 등) 공통 크기 — 일관성 유지 */
export const N_DASHBOARD_TITLE_FONT_SIZE = 14;
export const N_DASHBOARD_VALUE_FONT_SIZE = 20;

export interface IDashboardCardContentProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  /** 내용 영역이 flex로 남은 공간 채움 (테이블 등 스크롤 필요 시 true) */
  bContentFill?: boolean;
}

export const DashboardCardContent = ({
  icon,
  title,
  children,
  bContentFill = false,
}: IDashboardCardContentProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}
    >
      {icon}
      <span style={{ fontWeight: 600, fontSize: N_DASHBOARD_TITLE_FONT_SIZE }}>{title}</span>
    </div>
    <div
      style={{
        flex: bContentFill ? 1 : undefined,
        minHeight: bContentFill ? 0 : undefined,
        overflow: bContentFill ? 'auto' : undefined,
      }}
    >
      {children}
    </div>
  </div>
);

/** 아이콘 스타일 통일 (크기 + 색상) — 대시보드 카드용 */
export function fnDashboardCardIcon(
  Icon: React.ComponentType<{ style?: React.CSSProperties }>,
  strColor: string
): React.ReactNode {
  return <Icon style={{ fontSize: N_DASHBOARD_ICON_SIZE, color: strColor }} />;
}
