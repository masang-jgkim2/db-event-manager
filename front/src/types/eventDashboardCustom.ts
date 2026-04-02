import type { TEventStatus } from './index';

/**
 * 이벤트 대시보드 — 사용자 정의 카드
 * 카드 ID는 `custom_${uuid}` 형태 (DashboardPage와 규약)
 */
export interface ICustomDashboardMetricRow {
  strLabel: string;
  /** 숫자 카드 지표 ID — DashboardPage `NUMBER_CARD_IDS` 와 동일 값만 허용 */
  strMetricId: string;
}

/** 접기 가능한 그룹 — 상태·진행 여부·기간으로 인스턴스 필터 */
export interface ICustomDashboardEventGroup {
  strGroupKey: string;
  strTitle: string;
  /** 포함할 상태(비우면 상태 조건 없음 — 진행만 등 다른 조건만 적용) */
  arrStatus?: TEventStatus[];
  /** true: live_verified 제외(진행 중만). arrStatus 와 AND */
  bInProgressOnly?: boolean;
  /** 기간 필터 시 비교할 날짜(미지정이면 deploy) */
  strDateBasis?: 'deploy' | 'created';
  /** YYYY-MM-DD 시작(포함). 비우면 하한 없음 */
  strPeriodStart?: string;
  /** YYYY-MM-DD 종료(포함). 비우면 상한 없음 */
  strPeriodEnd?: string;
}

export interface ICustomEventDashboardCard {
  strId: string;
  strTitle: string;
  /** 숫자 지표 행(선택) */
  arrRows?: ICustomDashboardMetricRow[];
  /** 인스턴스 목록 그룹(선택) — 둘 중 하나 이상 필요 */
  arrEventGroups?: ICustomDashboardEventGroup[];
  /** 카드 상단 요약 — arrEventGroups 중 strGroupKey 와 일치하는 그룹 필터 기준 자동 표시 */
  strSummaryGroupKey?: string;
}

/** 삽입 위치 — 생성 시 한 번 적용, 이후 DnD로 이동 가능 */
export type TCustomCardInsertMode = 'first' | 'last' | 'after';

export interface ICustomCardInsertOptions {
  strMode: TCustomCardInsertMode;
  /** strMode === 'after' 일 때만 사용 */
  strAfterItemId?: string;
}
