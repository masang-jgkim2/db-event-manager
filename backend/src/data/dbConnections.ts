import fs from 'fs';
import path from 'path';
import { IDbConnection, TDbConnectionKind } from '../types';
import { STR_DATA_DIR, fnSaveJson, fnReadJsonArrayFromDisk } from './jsonStore';
import { fnIsMysqlStore } from './dataStore';
import {
  fnDecryptDbConnPasswordIfNeeded,
  fnEncryptDbConnPasswordForDisk,
  fnIsDbConnPasswordEncrypted,
  fnIsDbConnPasswordSecretConfigured,
} from '../services/dbConnectionPasswordCrypto';

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
  // MySQL 모드에서 fnSaveJson 은 디스크에 안 씀 — 비밀키 있으면 JSON 백업도 enc 로 동기화
  if (fnIsMysqlStore() && fnIsDbConnPasswordSecretConfigured()) {
    try {
      fnWriteDbConnectionsJsonFileSync(arrForDisk);
    } catch (err: unknown) {
      console.error('[dbConnections] MySQL 모드 JSON 동기 실패 |', (err as Error)?.message);
    }
  }
  fnSaveJson(STR_FILE, arrForDisk);
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
