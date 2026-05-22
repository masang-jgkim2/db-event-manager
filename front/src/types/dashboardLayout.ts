/**
 * 나의 대시보드 위젯·레이아웃 — docs/DASHBOARD-LAYOUT-SPEC.md 와 동기
 * 실데이터(IEventInstance) 스키마는 변경하지 않음.
 */

/** 서버 목록 필터와 맞춘 위젯 단위 필터 */
export interface IDashboardFilter {
  strInstanceFilter?: 'all' | 'involved' | 'mine' | 'my_action';
  arrStatus?: string[];
  arrProductIds?: number[];
  arrProductGroupIds?: string[];
  bExcludeDeleted?: boolean;
}

export interface IProductGroup {
  strGroupId: string;
  strLabel: string;
  arrProductIds: number[];
  strColor?: string;
}

/** instance_list 카드 모드 — 라벨 ← 필드 바인딩 한 줄 */
export interface ICardLabelRow {
  strLabel: string;
  strFieldPath: string;
  strRender?: 'text' | 'datetime_short' | 'datetime_full' | 'status_tag' | 'tag' | 'env_tag';
  strEmpty?: string;
  strLabelWidth?: string;
  nGridColumn?: number;
  nGridRow?: number;
  nColSpan?: number;
}

export interface IInstanceListWidgetOptions {
  strView?: 'table' | 'card';
  arrColumns?: string[];
  arrCardRows?: ICardLabelRow[];
  nPageSize?: number;
  strDensity?: string;
  strCardInnerLayout?: 'stack' | 'grid';
  nInnerColumns?: number;
  strInnerGap?: string;
}

export interface IStatusSummaryOptions {
  strDisplay?: string;
  bShowZero?: boolean;
}

export interface IProductSummaryOptions {
  strGroupBy?: 'product' | 'group';
  strDisplay?: string;
}

export interface IDashboardWidget {
  strWidgetId: string;
  strWidgetType: string;
  strTitle?: string;
  objFilter?: IDashboardFilter;
  objOptions?: Record<string, unknown>;
}

export interface ILayoutColumnSpan {
  strWidgetId: string;
  nColSpan: number;
}

export interface ILayoutRow {
  nOrder: number;
  strHeight?: string;
  arrColumnSpans: ILayoutColumnSpan[];
}

export interface IDashboardLayoutRoot {
  strSchemaVersion: string;
  strLayoutId: string;
  strLabel: string;
  arrProductGroups?: IProductGroup[];
  arrWidgets: IDashboardWidget[];
  arrLayoutRows?: ILayoutRow[];
}
