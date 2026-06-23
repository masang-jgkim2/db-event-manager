import type { IDbConnection } from '../types';
import { fnLoadJson, fnSaveJson, fnReadJsonArrayFromDisk, fnMirrorJsonToDisk } from './jsonStore';
import { arrDbConnections } from './dbConnections';
import { fnIsMysqlStore } from './dataStore';

/** 템플릿 워크플로: 등록 → 쿼리 리뷰 요청 → DBA 리뷰 완료 */
export type TTemplateStatus =
  | 'template_created'
  | 'confirm_requested'
  | 'dba_confirmed';

export interface ITemplateStageActor {
  strDisplayName: string;
  nUserId: number;
  strUserId: string;
  dtProcessedAt: string;
}

import type { IQueryEditLog } from '../utils/queryEditLog';

export interface ITemplateStatusLog {
  strStatus: TTemplateStatus;
  strChangedBy: string;
  nChangedByUserId: number;
  strComment?: string;
  dtChangedAt: string;
  /** DBA 리뷰 중 쿼리 직접 수정 diff */
  objQueryEdit?: IQueryEditLog;
}

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
  /** 생성 시 로그인 사용자 표시명 */
  strCreatedBy?: string;
  nCreatedByUserId?: number;
  strStatus: TTemplateStatus;
  arrStatusLogs: ITemplateStatusLog[];
  objCreator?: ITemplateStageActor | null;
  objConfirmer?: ITemplateStageActor | null;
}

const ARR_TEMPLATE_STATUS: TTemplateStatus[] = ['template_created', 'confirm_requested', 'dba_confirmed'];

/** API·D2 판별용 — 미설정 시 dba_confirmed (레거시 템플릿) */
export const fnResolveTemplateStatus = (raw: Pick<IEventTemplate, 'strStatus'>): TTemplateStatus =>
  raw.strStatus && ARR_TEMPLATE_STATUS.includes(raw.strStatus) ? raw.strStatus : 'dba_confirmed';

/** 레거시 행·미설정 → 기존 템플릿은 DBA 리뷰 완료로 간주 */
export const fnNormalizeEventTemplate = (raw: Partial<IEventTemplate> & Pick<IEventTemplate, 'nId'>): IEventTemplate => {
  const strStatus =
    raw.strStatus && ARR_TEMPLATE_STATUS.includes(raw.strStatus) ? raw.strStatus : 'dba_confirmed';
  return {
    nId: raw.nId,
    nProductId: raw.nProductId ?? 0,
    strProductName: raw.strProductName ?? '',
    strEventLabel: raw.strEventLabel ?? '',
    strDescription: raw.strDescription ?? '',
    strCategory: raw.strCategory ?? '',
    strType: raw.strType ?? '',
    strInputFormat: raw.strInputFormat ?? 'item_number',
    strDefaultItems: raw.strDefaultItems ?? '',
    strQueryTemplate: raw.strQueryTemplate ?? '',
    arrQueryTemplates: raw.arrQueryTemplates,
    dtCreatedAt: raw.dtCreatedAt ?? new Date().toISOString(),
    strCreatedBy: raw.strCreatedBy,
    nCreatedByUserId: raw.nCreatedByUserId,
    strStatus,
    arrStatusLogs: Array.isArray(raw.arrStatusLogs) ? raw.arrStatusLogs : [],
    objCreator: raw.objCreator ?? null,
    objConfirmer: raw.objConfirmer ?? null,
  };
};

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
const migrated = fnMigrateToQuerySets(rawEvents).map((e) => fnNormalizeEventTemplate(e));
const bNeedSave = migrated.some((e, i) => e !== rawEvents[i] || e.strStatus !== rawEvents[i]?.strStatus);
if (bNeedSave) fnSaveJson(STR_FILE, migrated);

export const arrEvents: IEventTemplate[] = migrated;

/** 메모리가 비어 있고 디스크에 건수가 있으면 events.json에서 다시 채움 (시드 적용 후·수동 JSON 편집 불일치 보정) */
export const fnReloadEventsFromDiskIfEmpty = (): boolean => {
  if (arrEvents.length > 0) return false;
  if (fnIsMysqlStore()) return false;
  const arrRaw = fnReadJsonArrayFromDisk<IEventTemplate>(STR_FILE);
  if (!arrRaw?.length) return false;
  const arrMigrated = fnMigrateToQuerySets(arrRaw).map((e) => fnNormalizeEventTemplate(e));
  arrEvents.length = 0;
  arrEvents.push(...arrMigrated);
  console.log(`[events] 메모리 비어 ${STR_FILE}에서 ${arrMigrated.length}건 재로드`);
  return true;
};

export const fnSaveEvents = () => {
  fnSaveJson(STR_FILE, arrEvents);
  // mysql 모드: 정규 테이블 반영(디바운스) + 재기동 시 JSON→MySQL 재적재에 쓰이는 events.json 미러
  if (fnIsMysqlStore()) {
    fnMirrorJsonToDisk(STR_FILE, arrEvents);
  }
};

export const fnGetNextEventId = (): number =>
  arrEvents.length > 0 ? Math.max(...arrEvents.map((e) => e.nId)) + 1 : 1;

/** D1: 이벤트 생성 허용 — 템플릿 DBA 리뷰 완료만 (레거시 미설정 포함) */
export const fnIsTemplateReadyForInstance = (objTemplate: Pick<IEventTemplate, 'strStatus'>): boolean =>
  fnResolveTemplateStatus(objTemplate) === 'dba_confirmed';

/** 인스턴스 FK용 — events.json에 없는 nEventTemplateId 스텁 1건 */
export const fnBuildStubEventTemplateFromInstance = (
  nTplId: number,
  inst: {
    nProductId: number;
    strProductName: string;
    strEventLabel: string;
    strCategory: string;
    strType: string;
    dtCreatedAt: string;
    strCreatedBy?: string;
    nCreatedByUserId?: number;
  },
): IEventTemplate => ({
  nId: nTplId,
  nProductId: inst.nProductId,
  strProductName: inst.strProductName,
  strEventLabel: inst.strEventLabel,
  strDescription: 'events.json에 해당 템플릿 없음 — 인스턴스 FK 보존 스텁',
  strCategory: inst.strCategory,
  strType: inst.strType,
  strInputFormat: 'raw',
  strDefaultItems: '',
  strQueryTemplate: '',
  dtCreatedAt: inst.dtCreatedAt,
  strCreatedBy: inst.strCreatedBy,
  nCreatedByUserId: inst.nCreatedByUserId,
  strStatus: 'dba_confirmed',
  arrStatusLogs: [],
  objCreator: null,
  objConfirmer: null,
});

/** 인스턴스가 참조하는 템플릿이 arrEvents에 없으면 스텁 추가 — MySQL full flush FK 방지 */
export const fnEnsureEventTemplatesForInstances = (
  arrEvents: IEventTemplate[],
  arrEventInstances: readonly {
    nEventTemplateId: number;
    nProductId: number;
    strProductName: string;
    strEventLabel: string;
    strCategory: string;
    strType: string;
    dtCreatedAt: string;
    strCreatedBy?: string;
    nCreatedByUserId?: number;
  }[],
): number => {
  const setIds = new Set(arrEvents.map((e) => e.nId));
  const arrMissing = [
    ...new Set(
      arrEventInstances
        .map((i) => i.nEventTemplateId)
        .filter((nId) => Number.isFinite(nId) && nId > 0 && !setIds.has(nId)),
    ),
  ];
  if (!arrMissing.length) return 0;

  for (const nTplId of arrMissing) {
    const inst = arrEventInstances.find((i) => i.nEventTemplateId === nTplId);
    if (!inst) continue;
    arrEvents.push(fnBuildStubEventTemplateFromInstance(nTplId, inst));
    setIds.add(nTplId);
  }
  console.warn(
    `[events] 인스턴스 FK 보존 | 누락 템플릿 ${arrMissing.length}건 스텁 추가 | nId=${arrMissing.join(',')}`,
  );
  return arrMissing.length;
};
