import { Card, Typography, theme } from 'antd';
import type { ReactNode } from 'react';
import { useDesignSystem } from '../styles/DesignSystemContext';
import { fnTypoStyle } from '../styles/typographyTokens';

const { Text } = Typography;

export interface ICrudPageShellProps {
  strTitle: string;
  /** Title 왼쪽 아이콘 (DbConnectionPage 패턴) */
  nodeIcon?: ReactNode;
  /** 헤더 아래 보조 설명 — caption secondary */
  nodeDescription?: ReactNode;
  /** 우측 상단 (새로운 ~ 버튼 등) */
  nodeExtra?: ReactNode;
  /** Card 위·헤더 아래 (Segmented 툴바 등) */
  nodeToolbar?: ReactNode;
  /** Card 직전 (나의 대시보드 Statistic 행 등) */
  nodeAboveCard?: ReactNode;
  /** false면 Card 없이 children만 (이벤트 대시보드 캔버스 등) */
  bWrapChildrenInCard?: boolean;
  children: ReactNode;
}

/**
 * CRUD 목록 페이지 골격
 * - 외곽: DbConnection 스타일 헤더(제목·설명·액션)
 * - 내부: User 스타일 Card 한 장 + 테이블/필터
 */
const CrudPageShell = ({
  strTitle,
  nodeIcon,
  nodeDescription,
  nodeExtra,
  nodeToolbar,
  nodeAboveCard,
  bWrapChildrenInCard = true,
  children,
}: ICrudPageShellProps) => {
  const { token } = theme.useToken();
  const { objTypoRoles } = useDesignSystem();

  return (
  <>
    <div
      className="dqpm-crud-page-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: nodeToolbar ? 8 : 16,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1
          className="dqpm-page-title"
          style={{
            margin: 0,
            color: token.colorText,
            ...fnTypoStyle(objTypoRoles.pageTitle),
          }}
        >
          {nodeIcon != null ? (
            <span style={{ marginRight: 8, display: 'inline-flex', verticalAlign: 'middle' }}>
              {nodeIcon}
            </span>
          ) : null}
          {strTitle}
        </h1>
        {nodeDescription != null ? (
          <Text
            type="secondary"
            style={{
              ...fnTypoStyle(objTypoRoles.caption),
              display: 'block',
              marginTop: 4,
            }}
          >
            {nodeDescription}
          </Text>
        ) : null}
      </div>
      {nodeExtra != null ? <div style={{ flexShrink: 0 }}>{nodeExtra}</div> : null}
    </div>
    {nodeAboveCard}
    {nodeToolbar}
    {bWrapChildrenInCard ? (
      <Card className="dqpm-crud-page-card" bordered={false}>
        {children}
      </Card>
    ) : (
      children
    )}
  </>
  );
};

export default CrudPageShell;
