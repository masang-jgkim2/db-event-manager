import type { IEventInstance } from '../types';

/** 집계 테이블 한 행 */
export interface IInstanceAggregateRow {
  strKey: string;
  strLabel: string;
  nCount: number;
  nInProgress: number;
}

const fnIsInProgress = (strStatus: string) => strStatus !== 'live_verified';

/** 통계에서 제외: 서버 영구 삭제 인스턴스 */
export const fnFilterInstancesForStats = (arr: IEventInstance[]): IEventInstance[] =>
  arr.filter((i) => !i.bPermanentlyRemoved);

const fnSortByCountDesc = (arrRows: IInstanceAggregateRow[], nMax: number): IInstanceAggregateRow[] =>
  [...arrRows].sort((a, b) => b.nCount - a.nCount).slice(0, nMax);

/**
 * 생성자(표시명) 기준 집계 — nCreatedByUserId 우선 키, 0이면 표시 문자열 키
 */
export const fnAggregateInstancesByCreator = (
  arr: IEventInstance[],
  nMaxRows = 50,
): IInstanceAggregateRow[] => {
  const map = new Map<string, IInstanceAggregateRow>();
  for (const i of arr) {
    const strLabel =
      (i.strCreatedBy && i.strCreatedBy.trim()) ||
      i.objCreator?.strDisplayName?.trim() ||
      '(이름 없음)';
    const strKey = i.nCreatedByUserId > 0 ? `u:${i.nCreatedByUserId}` : `l:${strLabel}`;
    const cur = map.get(strKey) ?? { strKey, strLabel, nCount: 0, nInProgress: 0 };
    cur.nCount += 1;
    if (fnIsInProgress(i.strStatus)) cur.nInProgress += 1;
    if (i.nCreatedByUserId <= 0) cur.strLabel = strLabel;
    map.set(strKey, cur);
  }
  return fnSortByCountDesc(Array.from(map.values()), nMaxRows);
};

/** 프로덕트 기준 집계 */
export const fnAggregateInstancesByProduct = (
  arr: IEventInstance[],
  nMaxRows = 50,
): IInstanceAggregateRow[] => {
  const map = new Map<string, IInstanceAggregateRow>();
  for (const i of arr) {
    const strKey = `p:${i.nProductId}`;
    const strLabel = (i.strProductName && i.strProductName.trim()) || `프로덕트 ID ${i.nProductId}`;
    const cur = map.get(strKey) ?? { strKey, strLabel, nCount: 0, nInProgress: 0 };
    cur.nCount += 1;
    if (fnIsInProgress(i.strStatus)) cur.nInProgress += 1;
    map.set(strKey, cur);
  }
  return fnSortByCountDesc(Array.from(map.values()), nMaxRows);
};

/** 이벤트 템플릿 기준 집계 */
export const fnAggregateInstancesByEventTemplate = (
  arr: IEventInstance[],
  nMaxRows = 50,
): IInstanceAggregateRow[] => {
  const map = new Map<string, IInstanceAggregateRow>();
  for (const i of arr) {
    const strKey = `t:${i.nEventTemplateId}`;
    const strLabel = (i.strEventName && i.strEventName.trim()) || `템플릿 ID ${i.nEventTemplateId}`;
    const cur = map.get(strKey) ?? { strKey, strLabel, nCount: 0, nInProgress: 0 };
    cur.nCount += 1;
    if (fnIsInProgress(i.strStatus)) cur.nInProgress += 1;
    map.set(strKey, cur);
  }
  return fnSortByCountDesc(Array.from(map.values()), nMaxRows);
};
