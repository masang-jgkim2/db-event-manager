/**
 * 이벤트 대시보드 — 사용자 정의 카드 (숫자 지표만 ×N 행)
 * 카드 ID는 `custom_${uuid}` 형태 (DashboardPage와 규약)
 */
export interface ICustomDashboardMetricRow {
  strLabel: string;
  /** 숫자 카드 지표 ID — DashboardPage `NUMBER_CARD_IDS` 와 동일 값만 허용 */
  strMetricId: string;
}

export interface ICustomEventDashboardCard {
  strId: string;
  strTitle: string;
  arrRows: ICustomDashboardMetricRow[];
}

/** 삽입 위치 — 생성 시 한 번 적용, 이후 DnD로 이동 가능 */
export type TCustomCardInsertMode = 'first' | 'last' | 'after';

export interface ICustomCardInsertOptions {
  strMode: TCustomCardInsertMode;
  /** strMode === 'after' 일 때만 사용 */
  strAfterItemId?: string;
}
