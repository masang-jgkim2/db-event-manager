import type { ReactNode } from 'react';

export interface ICrudListToolbarProps {
  /** Segmented 등 목록 모드 전환 (사용자·나의 대시보드 공통) */
  nodeLeft?: ReactNode;
  /** Select · 버튼 · 보기 전환 등 */
  nodeRight?: ReactNode;
  /** Card 밖(nodeToolbar) vs Card 안 — 여백만 조정 */
  bInsideCard?: boolean;
}

/**
 * 목록 상단 툴바 — Segmented(사용자·나의 대시보드), 활동(필터 Form) 등에서
 * 동일한 flex·간격을 쓰기 위한 래퍼. 필터 Form 전체는 children으로 Card에 두면 됨.
 */
const CrudListToolbar = ({ nodeLeft, nodeRight, bInsideCard = false }: ICrudListToolbarProps) => {
  if (nodeLeft == null && nodeRight == null) return null;

  return (
    <div
      className="dqpm-crud-list-toolbar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: bInsideCard ? 12 : 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
        {nodeLeft}
      </div>
      {nodeRight != null ? (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
          {nodeRight}
        </div>
      ) : null}
    </div>
  );
};

export default CrudListToolbar;
