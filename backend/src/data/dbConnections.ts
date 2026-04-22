import { IDbConnection, TDbConnectionKind } from '../types';
import { fnGetStoreBackend } from '../persistence/storeBackend';
import { fnPersistDbConnectionsToRdb } from '../persistence/rdb/dbConnectionsPersistence';
import { fnLoadJson, fnSaveJson } from './jsonStore';

const STR_FILE = 'dbConnections.json';

// 로드 시 기존 데이터에 strKind 없으면 GAME으로 보정
const fnNormalizeConnections = (arr: IDbConnection[]): IDbConnection[] =>
  arr.map((c) => ('strKind' in c && c.strKind ? c : { ...c, strKind: 'GAME' as TDbConnectionKind }));

export const arrDbConnections: IDbConnection[] = fnNormalizeConnections(
  fnLoadJson<IDbConnection>(STR_FILE, [])
);

export const fnSaveDbConnections = async (): Promise<void> => {
  if (fnGetStoreBackend() === 'rdb') {
    await fnPersistDbConnectionsToRdb(arrDbConnections);
    return;
  }
  fnSaveJson(STR_FILE, arrDbConnections);
};

export const fnGetNextDbConnectionId = (): number =>
  arrDbConnections.length > 0 ? Math.max(...arrDbConnections.map((c) => c.nId)) + 1 : 1;

/** 프로덕트+환경 기준 활성 접속 1건 (종류 무관, 배열 순서 비결정적 — 신규 코드는 fnResolveExecuteConnection 사용) */
export const fnFindActiveConnection = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live'
): IDbConnection | undefined =>
  arrDbConnections.find(
    (c) => c.nProductId === nProductId && c.strEnv === strEnv && c.bIsActive
  );

/**
 * 쿼리 실행용 접속 해석 (다중 세트와 동일 규칙).
 * - nDbConnectionId 있음: 해당 템플릿 연결 조회 → 요청 env·활성이면 그대로, 아니면 동일 strKind의 요청 env 활성 접속.
 * - 없음(레거시 단일 strGeneratedQuery): strKind GAME 활성 접속 1건.
 */
export const fnResolveExecuteConnection = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live',
  nDbConnectionId?: number | null
): IDbConnection | undefined => {
  if (nDbConnectionId != null && nDbConnectionId > 0) {
    const objTemplateConn = fnFindConnectionById(nDbConnectionId);
    if (!objTemplateConn || objTemplateConn.nProductId !== nProductId) return undefined;
    const strKind = objTemplateConn.strKind ?? 'GAME';
    return objTemplateConn.strEnv === strEnv && objTemplateConn.bIsActive
      ? objTemplateConn
      : fnFindActiveConnectionByKind(nProductId, strEnv, strKind);
  }
  return fnFindActiveConnectionByKind(nProductId, strEnv, 'GAME');
};

/** 프로덕트+환경+종류 기준 활성 접속 1건 */
export const fnFindActiveConnectionByKind = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live',
  strKind: TDbConnectionKind
): IDbConnection | undefined =>
  arrDbConnections.find(
    (c) => c.nProductId === nProductId && c.strEnv === strEnv && c.strKind === strKind && c.bIsActive
  );

/** ID로 접속 정보 1건 조회 */
export const fnFindConnectionById = (nId: number): IDbConnection | undefined =>
  arrDbConnections.find((c) => c.nId === nId);
