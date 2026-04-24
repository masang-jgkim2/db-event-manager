import type { IDbConnection } from '../types';
import { fnLoadJson, fnSaveJson, fnReadJsonArrayFromDisk } from './jsonStore';
import { arrDbConnections } from './dbConnections';
import { fnIsMysqlStore } from './dataStore';

/** 템플릿 내 쿼리 1세트: DB 연결 + (선택) 기본 아이템값 + 쿼리 템플릿 */
export interface IQueryTemplateItem {
  nDbConnectionId: number;
  /** 이 세트용 기본값 예시 (이벤트 생성 시 입력란 채울 때, 템플릿 기본값 없으면 첫 세트 값 사용) */
  strDefaultItems?: string;
  strQueryTemplate: string;
}

export interface IEventTemplate {
  nId: number;
  nProductId: number;
  strProductName: string;
  strEventLabel: string;
  strDescription: string;
  strCategory: string;
  strType: string;
  strInputFormat: string;
  strDefaultItems: string;
  strQueryTemplate: string;           // 레거시 호환용 (세트 사용 시 비움)
  arrQueryTemplates?: IQueryTemplateItem[];  // 실제 사용: 세트 1개 이상
  dtCreatedAt: string;
}

const STR_FILE = 'events.json';

/** 기존 단일 쿼리/기본값 → 쿼리 템플릿 세트 1건으로 이전 (JSON→MySQL 임포트 시 `arrDbConnections` 스냅샷 전달) */
export const fnMigrateToQuerySetsWithConnections = (
  raw: IEventTemplate[],
  arrConns: Pick<IDbConnection, 'nId' | 'nProductId' | 'bIsActive'>[],
): IEventTemplate[] =>
  raw.map((e) => {
    if (e.arrQueryTemplates?.length) return e;
    if (!e.strQueryTemplate?.trim()) return e;
    const firstConn = arrConns.find((c) => c.nProductId === e.nProductId && c.bIsActive);
    return {
      ...e,
      arrQueryTemplates: [{
        nDbConnectionId: firstConn?.nId ?? 0,
        strDefaultItems: e.strDefaultItems ?? '',
        strQueryTemplate: e.strQueryTemplate,
      }],
      strQueryTemplate: '',
      strDefaultItems: '',
    };
  });

const fnMigrateToQuerySets = (raw: IEventTemplate[]): IEventTemplate[] =>
  fnMigrateToQuerySetsWithConnections(raw, arrDbConnections);

const rawEvents = fnLoadJson<IEventTemplate>(STR_FILE, []);
const migrated = fnMigrateToQuerySets(rawEvents);
const bNeedSave = migrated.some((e, i) => e !== rawEvents[i]);
if (bNeedSave) fnSaveJson(STR_FILE, migrated);

export const arrEvents: IEventTemplate[] = migrated;

/** 메모리가 비어 있고 디스크에 건수가 있으면 events.json에서 다시 채움 (시드 적용 후·수동 JSON 편집 불일치 보정) */
export const fnReloadEventsFromDiskIfEmpty = (): boolean => {
  if (arrEvents.length > 0) return false;
  if (fnIsMysqlStore()) return false;
  const arrRaw = fnReadJsonArrayFromDisk<IEventTemplate>(STR_FILE);
  if (!arrRaw?.length) return false;
  const arrMigrated = fnMigrateToQuerySets(arrRaw);
  arrEvents.length = 0;
  arrEvents.push(...arrMigrated);
  console.log(`[events] 메모리 비어 ${STR_FILE}에서 ${arrMigrated.length}건 재로드`);
  return true;
};

export const fnSaveEvents = () => fnSaveJson(STR_FILE, arrEvents);

export const fnGetNextEventId = (): number =>
  arrEvents.length > 0 ? Math.max(...arrEvents.map((e) => e.nId)) + 1 : 1;
