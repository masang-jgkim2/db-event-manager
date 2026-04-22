import { fnGetStoreBackend } from '../persistence/storeBackend';
import { fnLoadJson, fnSaveJson } from './jsonStore';
import { arrDbConnections } from './dbConnections';

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

/** 기존 단일 쿼리/기본값 → 쿼리 템플릿 세트 1건으로 이전 */
function fnMigrateToQuerySets(raw: IEventTemplate[]): IEventTemplate[] {
  return raw.map((e) => {
    if (e.arrQueryTemplates?.length) return e;
    if (!e.strQueryTemplate?.trim()) return e;
    const firstConn = arrDbConnections.find((c) => c.nProductId === e.nProductId && c.bIsActive);
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
}

const rawEvents = fnLoadJson<IEventTemplate>(STR_FILE, []);
const migrated = fnMigrateToQuerySets(rawEvents);
const bNeedSave = migrated.some((e, i) => e !== rawEvents[i]);
if (bNeedSave && fnGetStoreBackend() === 'json') fnSaveJson(STR_FILE, migrated);

export const arrEvents: IEventTemplate[] = migrated;

export const fnSaveEvents = async (): Promise<void> => {
  if (fnGetStoreBackend() === 'rdb') {
    const { fnFlushProductCatalogToRdb } = await import('../persistence/rdb/catalogPersistHelper');
    await fnFlushProductCatalogToRdb();
    return;
  }
  fnSaveJson(STR_FILE, arrEvents);
};

export const fnGetNextEventId = (): number =>
  arrEvents.length > 0 ? Math.max(...arrEvents.map((e) => e.nId)) + 1 : 1;
