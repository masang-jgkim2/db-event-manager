import { IDbConnection, TDbConnectionKind } from '../types';
import { fnLoadJson, fnSaveJson } from './jsonStore';

const STR_FILE = 'dbConnections.json';

// 로드 시 기존 데이터에 strKind 없으면 GAME으로 보정
const fnNormalizeConnections = (arr: IDbConnection[]): IDbConnection[] =>
  arr.map((c) => ('strKind' in c && c.strKind ? c : { ...c, strKind: 'GAME' as TDbConnectionKind }));

export const arrDbConnections: IDbConnection[] = fnNormalizeConnections(
  fnLoadJson<IDbConnection>(STR_FILE, [])
);

export const fnSaveDbConnections = () => fnSaveJson(STR_FILE, arrDbConnections);

export const fnGetNextDbConnectionId = (): number =>
  arrDbConnections.length > 0 ? Math.max(...arrDbConnections.map((c) => c.nId)) + 1 : 1;

/** 프로덕트+환경 기준 활성 접속 1건 (종류 무관, 레거시용) */
export const fnFindActiveConnection = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live'
): IDbConnection | undefined =>
  arrDbConnections.find(
    (c) => c.nProductId === nProductId && c.strEnv === strEnv && c.bIsActive
  );

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
