import fs from 'fs';
import path from 'path';
import { IDbConnection, TDbConnectionKind } from '../types';
import { STR_DATA_DIR, fnMirrorJsonToDisk, fnSaveJson, fnReadJsonArrayFromDisk } from './jsonStore';
import { fnIsMysqlStore } from './dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnCancelMysqlDocFlushForFiles, fnAwaitInFlightMysqlDocFlush } from '../db/mysqlDocPersist';
import {
  fnDeleteDbConnectionRowFromMysql,
  fnRelationalLoadDbConnections,
  fnSyncDbConnectionsOnlyToMysql,
  fnUpsertDbConnectionRowToMysql,
} from '../db/mysqlRelationalSync';
import {
  fnDecryptDbConnPasswordIfNeeded,
  fnEncryptDbConnPasswordForDisk,
  fnIsDbConnPasswordEncrypted,
  fnIsDbConnPasswordSecretConfigured,
} from '../services/dbConnectionPasswordCrypto';
import { fnNormalizeServiceAbbr, fnServiceAbbrsCompatible } from '../utils/serviceScope';

const STR_FILE = 'dbConnections.json';

/** fnLoadJson 은 DATA_STORE=mysql 일 때 항상 [] — 디스크 백업·암호화 마이그레이션용으로 파일을 직접 읽음 */
const fnReadRawDbConnectionsFromDiskFile = (): IDbConnection[] => {
  const strP = path.join(STR_DATA_DIR, STR_FILE);
  if (!fs.existsSync(strP)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(strP, 'utf-8')) as unknown;
    return Array.isArray(parsed) ? (parsed as IDbConnection[]) : [];
  } catch (err: unknown) {
    console.warn(
      `[dbConnections] ${STR_FILE} 읽기/파싱 실패 — 접속 0건으로 진행 |`,
      (err as Error)?.message ?? err,
    );
    return [];
  }
};

const fnWriteDbConnectionsJsonFileSync = (arrDisk: IDbConnection[]): void => {
  const strP = path.join(STR_DATA_DIR, STR_FILE);
  fs.writeFileSync(strP, JSON.stringify(arrDisk, null, 2), 'utf-8');
};

// 로드 시 strKind 보정 + strPassword(enc:v1) 복호화(키 없으면 enc 문자열 유지 → 연결 실패로 드러남)
export const fnNormalizeConnections = (arr: IDbConnection[]): IDbConnection[] =>
  arr.map((c) => {
    const objBase =
      'strKind' in c && c.strKind ? c : { ...c, strKind: 'GAME' as TDbConnectionKind };
    return {
      ...objBase,
      strPassword: fnDecryptDbConnPasswordIfNeeded(String(objBase.strPassword ?? '')),
    };
  });

/** 부트 시 디스크 원본(암호화 여부 판별용) — MySQL 모드에서도 JSON 파일을 읽음 */
const ARR_RAW_DB_CONN_AT_BOOT = fnReadRawDbConnectionsFromDiskFile();

export const arrDbConnections: IDbConnection[] = fnNormalizeConnections(ARR_RAW_DB_CONN_AT_BOOT);

/** 메모리가 비어 있고 디스크에 건수가 있으면 dbConnections.json에서 다시 채움 */
export const fnReloadDbConnectionsFromDiskIfEmpty = (): boolean => {
  if (arrDbConnections.length > 0) return false;
  if (fnIsMysqlStore()) return false;
  const arrRaw = fnReadJsonArrayFromDisk<IDbConnection>(STR_FILE);
  if (!arrRaw?.length) return false;
  const arrNorm = fnNormalizeConnections(arrRaw);
  arrDbConnections.length = 0;
  arrDbConnections.push(...arrNorm);
  console.log(`[dbConnections] 메모리 비어 ${STR_FILE}에서 ${arrNorm.length}건 재로드`);
  return true;
};

export const fnSaveDbConnections = (): void => {
  const arrForDisk = arrDbConnections.map((c) => ({
    ...c,
    strPassword: fnEncryptDbConnPasswordForDisk(c.strPassword),
  }));
  if (fnIsMysqlStore()) {
    // MySQL: 전체 메타 스냅샷(fnSaveJson) 예약 금지 — fnCommitDbConnectionsDataStore 가 db_connection 만 반영
    try {
      fnMirrorJsonToDisk(STR_FILE, arrForDisk);
    } catch (err: unknown) {
      console.error('[dbConnections] MySQL 모드 JSON 미러 실패 |', (err as Error)?.message);
    }
    return;
  }
  fnSaveJson(STR_FILE, arrForDisk);
};

const fnMirrorDbConnectionsJson = (): void => {
  const arrForDisk = arrDbConnections.map((c) => ({
    ...c,
    strPassword: fnEncryptDbConnPasswordForDisk(c.strPassword),
  }));
  fnMirrorJsonToDisk(STR_FILE, arrForDisk);
};

/** 추가·수정 1건 — 전체 메타 flush 대기 없음(이벤트 인스턴스 스냅샷과 분리) */
export const fnCommitOneDbConnectionToMysql = async (objConn: IDbConnection): Promise<void> => {
  if (!fnIsMysqlStore()) return;
  fnCancelMysqlDocFlushForFiles(['dbConnections.json']);
  const pool = fnGetMysqlAppPool();
  await fnUpsertDbConnectionRowToMysql(pool, objConn);
  fnMirrorDbConnectionsJson();
};

/** 삭제 1건 */
export const fnCommitDbConnectionDeleteToMysql = async (nId: number): Promise<void> => {
  if (!fnIsMysqlStore()) return;
  fnCancelMysqlDocFlushForFiles(['dbConnections.json']);
  await fnAwaitInFlightMysqlDocFlush();
  const pool = fnGetMysqlAppPool();
  await fnDeleteDbConnectionRowFromMysql(pool, nId);
  fnMirrorDbConnectionsJson();
};

/** 일괄·임포트용 — 전체 db_connection 테이블 동기화 */
export const fnCommitDbConnectionsDataStore = async (): Promise<void> => {
  if (!fnIsMysqlStore()) return;
  fnCancelMysqlDocFlushForFiles(['dbConnections.json']);
  const pool = fnGetMysqlAppPool();
  await fnSyncDbConnectionsOnlyToMysql(pool, [...arrDbConnections]);
  fnMirrorDbConnectionsJson();
};

/** 연결 테스트 직전 MySQL에서 해당 행 재로드(저장 직후·다른 flush와 어긋남 방지) */
export const fnRefreshDbConnectionByIdFromMysql = async (
  nId: number,
): Promise<IDbConnection | undefined> => {
  if (!fnIsMysqlStore()) return fnFindConnectionById(nId);
  const pool = fnGetMysqlAppPool();
  const arrFromDb = fnNormalizeConnections(await fnRelationalLoadDbConnections(pool));
  const row = arrFromDb.find((c) => c.nId === nId);
  if (!row) return undefined;
  const nIdx = arrDbConnections.findIndex((c) => c.nId === nId);
  if (nIdx >= 0) arrDbConnections[nIdx] = row;
  return row;
};

/** 비밀키 있고 디스크에 평문이 있으면 1회 enc:v1 재저장(재시작만으로 JSON 반영) */
const fnMaybeAutoEncryptPlainPasswordsOnDisk = (): void => {
  if (process.env.JEST_WORKER_ID || process.env.VITEST) return;
  const strPathAbs = path.join(STR_DATA_DIR, STR_FILE);
  const bAnyPlain = ARR_RAW_DB_CONN_AT_BOOT.some((c) =>
    !fnIsDbConnPasswordEncrypted(String(c.strPassword ?? '')),
  );
  if (!bAnyPlain) return;
  if (!fnIsDbConnPasswordSecretConfigured()) {
    const nPlainRows = ARR_RAW_DB_CONN_AT_BOOT.filter(
      (c) => !fnIsDbConnPasswordEncrypted(String(c.strPassword ?? '')),
    ).length;
    const strSecretRaw = process.env.DB_CONNECTION_PASSWORD_SECRET ?? '';
    const nLen = strSecretRaw.trim().length;
    const strKeyHint =
      nLen === 0
        ? 'DB_CONNECTION_PASSWORD_SECRET 미설정'
        : `DB_CONNECTION_PASSWORD_SECRET 길이=${nLen}(16자 이상 필요)`;
    console.warn(
      `[dbConnections] 평문 strPassword ${nPlainRows}건 — 디스크 암호화 생략 | ${strKeyHint} | ` +
        `DATA_STORE=json·mysql 공통 | backend/.env 저장 후 재시작 | 대상 파일=${strPathAbs}`,
    );
    return;
  }
  const arrForDisk = arrDbConnections.map((c) => ({
    ...c,
    strPassword: fnEncryptDbConnPasswordForDisk(c.strPassword),
  }));
  fnWriteDbConnectionsJsonFileSync(arrForDisk);
  console.log(
    `[dbConnections] 디스크 평문 strPassword → enc:v1 저장 완료 | n=${arrForDisk.length} | ${strPathAbs}`,
  );
};

fnMaybeAutoEncryptPlainPasswordsOnDisk();

export const fnGetNextDbConnectionId = (): number =>
  arrDbConnections.length > 0 ? Math.max(...arrDbConnections.map((c) => c.nId)) + 1 : 1;

export { fnNormalizeServiceAbbr } from '../utils/serviceScope';

/** 접속 행이 이벤트 Step2 서비스 범위와 호환 (nServiceId 우선, abbr fallback) */
export const fnConnectionMatchesServiceScope = (
  objConn: IDbConnection,
  strServiceAbbr?: string | null,
  nServiceId?: number | null,
): boolean => {
  const nInstId = Number(nServiceId) || 0;
  const nConnId = Number(objConn.nServiceId) || 0;
  if (nInstId > 0 && nConnId > 0) return nConnId === nInstId;

  const strConnSvc = fnNormalizeServiceAbbr(objConn.strServiceAbbr);
  const strInstSvc = fnNormalizeServiceAbbr(strServiceAbbr);
  if (!strInstSvc && nInstId <= 0) return !strConnSvc || strConnSvc === strInstSvc;
  if (!strConnSvc) return true;
  if (!strInstSvc) return true;
  return fnServiceAbbrsCompatible(strConnSvc, strInstSvc);
};

/** 프로덕트+환경+종류+서비스 범위 기준 활성 접속 1건 (서비스 전용 → 공통 fallback) */
export const fnFindActiveConnectionByKindAndService = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live',
  strKind: TDbConnectionKind,
  strServiceAbbr?: string | null,
  nServiceId?: number | null,
): IDbConnection | undefined => {
  const strSvc = fnNormalizeServiceAbbr(strServiceAbbr);
  const fnMatches = (c: IDbConnection) =>
    c.nProductId === nProductId &&
    c.strEnv === strEnv &&
    (c.strKind ?? 'GAME') === strKind &&
    c.bIsActive &&
    fnConnectionMatchesServiceScope(c, strSvc, nServiceId);

  if (strSvc || (nServiceId != null && nServiceId > 0)) {
    if (nServiceId != null && nServiceId > 0) {
      const objById = arrDbConnections.find(
        (c) => fnMatches(c) && Number(c.nServiceId) === Number(nServiceId),
      );
      if (objById) return objById;
    }
    const objExact = arrDbConnections.find(
      (c) => fnMatches(c) && fnNormalizeServiceAbbr(c.strServiceAbbr) === strSvc,
    );
    if (objExact) return objExact;
    const objCompat = arrDbConnections.find((c) => {
      const strConn = fnNormalizeServiceAbbr(c.strServiceAbbr);
      return fnMatches(c) && strConn && strConn !== strSvc && fnServiceAbbrsCompatible(strConn, strSvc);
    });
    if (objCompat) return objCompat;
    return arrDbConnections.find((c) => fnMatches(c) && !fnNormalizeServiceAbbr(c.strServiceAbbr));
  }
  return arrDbConnections.find((c) => fnMatches(c) && !fnNormalizeServiceAbbr(c.strServiceAbbr));
};

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
 * - nDbConnectionId 있음: 해당 템플릿 연결 조회 → 요청 env·서비스·활성이면 그대로, 아니면 동일 kind·서비스의 요청 env 활성 접속.
 * - 없음(레거시 단일 strGeneratedQuery): strKind GAME 활성 접속 1건.
 */
export const fnResolveExecuteConnection = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live',
  nDbConnectionId?: number | null,
  strServiceAbbr?: string | null,
  nServiceId?: number | null,
): IDbConnection | undefined => {
  if (nDbConnectionId != null && nDbConnectionId > 0) {
    const objTemplateConn = fnFindConnectionById(nDbConnectionId);
    if (!objTemplateConn || objTemplateConn.nProductId !== nProductId) return undefined;
    const strKind = objTemplateConn.strKind ?? 'GAME';
    if (
      objTemplateConn.strEnv === strEnv &&
      objTemplateConn.bIsActive &&
      fnConnectionMatchesServiceScope(objTemplateConn, strServiceAbbr, nServiceId)
    ) {
      return objTemplateConn;
    }
    return fnFindActiveConnectionByKindAndService(nProductId, strEnv, strKind, strServiceAbbr, nServiceId);
  }
  return fnFindActiveConnectionByKindAndService(nProductId, strEnv, 'GAME', strServiceAbbr, nServiceId);
};

/** @deprecated fnFindActiveConnectionByKindAndService 사용 — 서비스 범위 미반영 */
export const fnFindActiveConnectionByKind = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live',
  strKind: TDbConnectionKind,
): IDbConnection | undefined =>
  fnFindActiveConnectionByKindAndService(nProductId, strEnv, strKind);

/** 프로덕트·서비스·환경 기준 활성 접속 존재 (종류 무관) */
export const fnHasEnvConnectionForService = (
  nProductId: number,
  strServiceAbbr: string,
  strEnv: 'qa' | 'live',
  nServiceId?: number | null,
): boolean =>
  arrDbConnections.some(
    (c) =>
      c.nProductId === nProductId &&
      c.strEnv === strEnv &&
      c.bIsActive &&
      fnConnectionMatchesServiceScope(c, strServiceAbbr, nServiceId),
  );

/** 프로덕트·서비스·환경·종류 기준 활성 접속 존재 */
export const fnHasEnvConnectionForKindAndService = (
  nProductId: number,
  strServiceAbbr: string,
  strEnv: 'qa' | 'live',
  strKind: TDbConnectionKind,
  nServiceId?: number | null,
): boolean =>
  arrDbConnections.some(
    (c) =>
      c.nProductId === nProductId &&
      c.strEnv === strEnv &&
      (c.strKind ?? 'GAME') === strKind &&
      c.bIsActive &&
      fnConnectionMatchesServiceScope(c, strServiceAbbr, nServiceId),
  );

/** ID로 접속 정보 1건 조회 */
export const fnFindConnectionById = (nId: number): IDbConnection | undefined =>
  arrDbConnections.find((c) => c.nId === nId);

/**
 * 동일 프로덕트·환경·종류·호스트·DB명 조합 중복 여부.
 * (예: 라그하임 QA GAME — acheron / cassiopeia 는 DB명이 다르면 각각 등록 가능)
 */
export const fnFindDuplicateDbConnection = (
  nProductId: number,
  strEnv: IDbConnection['strEnv'],
  strKind: TDbConnectionKind,
  strHost: string,
  strDatabase: string,
  nExcludeId?: number,
  strServiceAbbr?: string | null,
): IDbConnection | undefined => {
  const strHostNorm = strHost.trim();
  const strDbNorm = strDatabase.trim();
  const strSvcNorm = fnNormalizeServiceAbbr(strServiceAbbr);
  return arrDbConnections.find(
    (c) =>
      c.nId !== nExcludeId &&
      c.nProductId === nProductId &&
      c.strEnv === strEnv &&
      c.strKind === strKind &&
      fnNormalizeServiceAbbr(c.strServiceAbbr) === strSvcNorm &&
      c.strHost.trim() === strHostNorm &&
      c.strDatabase.trim() === strDbNorm,
  );
};
