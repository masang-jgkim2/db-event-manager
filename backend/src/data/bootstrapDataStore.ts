/**
 * DATA_STORE=mysql 일 때: 스키마 보장 → (옵션) JSON 파일 → MySQL 적재 → 인메모리 하이드레이트.
 * 게임 DB 접속(DATA_MYSQL_*)과 쿼리 실행 대상 DB는 별개.
 */
import fs from 'fs';
import path from 'path';
import type { RowDataPacket } from 'mysql2/promise';
import { STR_DATA_DIR } from './jsonStore';
import { fnIsMysqlStore } from './dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import {
  fnEnsureMysqlAppSchema,
  fnMysqlCountProducts,
  fnMysqlImportRelationalPayload,
  fnMysqlLoadArrayByFilename,
  type IUserRowJson,
  type IRoleRowJson,
} from '../db/mysqlAppDataAccess';
import { fnAwaitMysqlDocFlush } from '../db/mysqlDocPersist';
import { fnMigrateToQuerySetsWithConnections } from './events';
import type { IEventTemplate } from './events';
import type { IProduct } from './products';
import type { IEventInstance } from './eventInstances';
import type { IDbConnection } from '../types';
import { fnNormalizeConnections } from './dbConnections';
import { fnApplyRolePermissionBootFixesAfterHydrate } from './rolePermissions';
import { fnRehydrateActivityLogsFromDocs } from './activityLogs';
import type { IActivityLogRow } from './activityLogs';
import { fnHydrateUserUiPreferencesFromMysql } from './userUiPreferences';
import { fnIsDbConnPasswordSecretConfigured } from '../services/dbConnectionPasswordCrypto';
import { fnRelationalWriteFullFromMemory } from '../db/mysqlRelationalSync';

const B_SKIP_JSON_IMPORT =
  process.env.DATA_MYSQL_NO_JSON_IMPORT === '1' || process.env.DATA_MYSQL_NO_JSON_IMPORT === 'true';

const fnReadJsonArrayFromDataDir = <T>(strFilename: string): T[] | null => {
  const strP = path.join(STR_DATA_DIR, strFilename);
  if (!fs.existsSync(strP)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(strP, 'utf-8')) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
};

const fnReadUserUiRootFromDisk = (): {
  mapByUserId: Record<string, Record<string, string>>;
} | null => {
  const strP = path.join(STR_DATA_DIR, 'userUiPreferences.json');
  if (!fs.existsSync(strP)) return null;
  try {
    const v = JSON.parse(fs.readFileSync(strP, 'utf-8')) as { mapByUserId?: unknown };
    if (v && typeof v === 'object' && v.mapByUserId && typeof v.mapByUserId === 'object') {
      return { mapByUserId: v.mapByUserId as Record<string, Record<string, string>> };
    }
    return { mapByUserId: {} };
  } catch {
    return null;
  }
};

/** CLI·외부에서 JSON 폴더 → MySQL 전체 덮어쓰기(스키마는 선행 `fnEnsureMysqlAppSchema`) */
export const fnMysqlImportAllFromJsonDisk = async (): Promise<void> => {
  const pool = fnGetMysqlAppPool();
  const arrProducts = (fnReadJsonArrayFromDataDir<IProduct>('products.json') ?? []) as IProduct[];
  const arrDbRaw = fnReadJsonArrayFromDataDir<IDbConnection>('dbConnections.json') ?? [];
  const arrDb = fnNormalizeConnections(arrDbRaw);
  const arrEventsRaw = fnReadJsonArrayFromDataDir<IEventTemplate>('events.json') ?? [];
  const arrEvents = fnMigrateToQuerySetsWithConnections(arrEventsRaw, arrDb);
  const arrInst = (fnReadJsonArrayFromDataDir<IEventInstance>('eventInstances.json') ??
    []) as IEventInstance[];
  const arrUsers = fnReadJsonArrayFromDataDir<Record<string, unknown>>('users.json') ?? [];
  const arrRoles = fnReadJsonArrayFromDataDir<Record<string, unknown>>('roles.json') ?? [];
  const arrUserRoles = fnReadJsonArrayFromDataDir<Record<string, unknown>>('userRoles.json') ?? [];
  const arrRp = fnReadJsonArrayFromDataDir<Record<string, unknown>>('rolePermissions.json') ?? [];
  const arrLogs = fnReadJsonArrayFromDataDir<Record<string, unknown>>('activity_logs.json') ?? [];
  const objUi = fnReadUserUiRootFromDisk();

  console.log('[DataStore] JSON → MySQL 전체 치환 시작 | 디스크 JSON → 정규화 테이블');
  await fnMysqlImportRelationalPayload(pool, {
    arrProducts: arrProducts,
    arrDbConnections: arrDb,
    arrEvents: arrEvents,
    arrEventInstances: arrInst,
    arrUsers: arrUsers as unknown as IUserRowJson[],
    arrRoles: arrRoles as unknown as IRoleRowJson[],
    arrUserRoles: arrUserRoles as Array<{ nUserId: number; nRoleId: number }>,
    arrRolePermissions: arrRp as Array<{ nRoleId: number; strPermission: string }>,
    arrActivityLogs: arrLogs as unknown as IActivityLogRow[],
    objUserUi: objUi ?? { mapByUserId: {} },
  });
  console.log('[DataStore] JSON → MySQL 전체 치환 완료 | 상세 건수는 [DATA_MYSQL] 정규화 적재 완료 로그 참고');
};

const fnHydrateMemoryFromMysql = async (): Promise<void> => {
  const pool = fnGetMysqlAppPool();
  console.log('[DataStore] MySQL → 인메모리 하이드레이트 시작 | 정규화 테이블 로드');
  const { arrProducts } = await import('./products');
  const { arrDbConnections } = await import('./dbConnections');
  const { arrEvents } = await import('./events');
  const { arrEventInstances } = await import('./eventInstances');
  const { arrUsers } = await import('./users');
  const { arrRoles } = await import('./roles');
  const { arrUserRoles } = await import('./userRoles');
  const { arrRolePermissions } = await import('./rolePermissions');

  const arrP = (await fnMysqlLoadArrayByFilename(pool, 'products.json')) as typeof arrProducts;
  arrProducts.length = 0;
  arrProducts.push(...arrP);
  console.log(`[DataStore] 로드 완료 | product·products.json | ${arrProducts.length}건`);

  const arrD = (await fnMysqlLoadArrayByFilename(pool, 'dbConnections.json')) as typeof arrDbConnections;
  arrDbConnections.length = 0;
  arrDbConnections.push(...fnNormalizeConnections(arrD));
  console.log(`[DataStore] 로드 완료 | db_connection·dbConnections.json | ${arrDbConnections.length}건`);

  const arrE = (await fnMysqlLoadArrayByFilename(pool, 'events.json')) as IEventTemplate[];
  arrEvents.length = 0;
  arrEvents.push(...fnMigrateToQuerySetsWithConnections(arrE, arrDbConnections));
  console.log(`[DataStore] 로드 완료 | event_template·events.json | ${arrEvents.length}건`);

  const arrI = (await fnMysqlLoadArrayByFilename(pool, 'eventInstances.json')) as typeof arrEventInstances;
  arrEventInstances.length = 0;
  arrEventInstances.push(...arrI);
  console.log(`[DataStore] 로드 완료 | event_instance·eventInstances.json | ${arrEventInstances.length}건`);

  const arrU = (await fnMysqlLoadArrayByFilename(pool, 'users.json')) as typeof arrUsers;
  arrUsers.length = 0;
  arrUsers.push(...arrU);
  console.log(`[DataStore] 로드 완료 | users·users.json | ${arrUsers.length}건`);

  const arrR = (await fnMysqlLoadArrayByFilename(pool, 'roles.json')) as typeof arrRoles;
  arrRoles.length = 0;
  arrRoles.push(...arrR);
  console.log(`[DataStore] 로드 완료 | roles·roles.json | ${arrRoles.length}건`);

  const arrUr = (await fnMysqlLoadArrayByFilename(pool, 'userRoles.json')) as typeof arrUserRoles;
  arrUserRoles.length = 0;
  arrUserRoles.push(...arrUr);
  console.log(`[DataStore] 로드 완료 | user_roles·userRoles.json | ${arrUserRoles.length}건`);

  const arrRpr = (await fnMysqlLoadArrayByFilename(pool, 'rolePermissions.json')) as typeof arrRolePermissions;
  arrRolePermissions.length = 0;
  arrRolePermissions.push(...arrRpr);
  console.log(`[DataStore] 로드 완료 | role_permissions·rolePermissions.json | ${arrRpr.length}건`);

  const arrL = (await fnMysqlLoadArrayByFilename(pool, 'activity_logs.json')) as IActivityLogRow[];
  fnRehydrateActivityLogsFromDocs(arrL);
  console.log(`[DataStore] 로드 완료 | activity_log·activity_logs.json | ${arrL.length}건`);

  await fnHydrateUserUiPreferencesFromMysql();
  fnApplyRolePermissionBootFixesAfterHydrate();
  await fnAwaitMysqlDocFlush();
  console.log(
    `[DataStore] MySQL → 인메모리 하이드레이트 완료 | products=${arrProducts.length} events=${arrEvents.length} ` +
      `dbConn=${arrDbConnections.length} instances=${arrEventInstances.length} users=${arrUsers.length} roles=${arrRoles.length}`,
  );
};

export const fnBootstrapDataStore = async (): Promise<void> => {
  if (!fnIsMysqlStore()) {
    console.log('[DataStore] DATA_STORE=json | data/*.json');
    return;
  }
  console.log('[DataStore] DATA_STORE=mysql | 메타 MySQL');
  const pool = fnGetMysqlAppPool();
  await fnEnsureMysqlAppSchema(pool);
  const nProducts = await fnMysqlCountProducts(pool);
  if (nProducts === 0 && !B_SKIP_JSON_IMPORT) {
    await fnMysqlImportAllFromJsonDisk();
  } else if (nProducts === 0 && B_SKIP_JSON_IMPORT) {
    console.warn('[DataStore] MySQL 비어 있음 — DATA_MYSQL_NO_JSON_IMPORT 로 JSON 적재 생략');
  }
  await fnHydrateMemoryFromMysql();

  if (fnIsDbConnPasswordSecretConfigured()) {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM db_connection
         WHERE str_password IS NULL OR str_password = '' OR str_password NOT LIKE 'enc:v1:%'`,
      );
      const nPlain = Number((rows as RowDataPacket[])[0]?.n) || 0;
      if (nPlain > 0) {
        await fnRelationalWriteFullFromMemory(pool);
        console.log(
          '[DataStore] db_connection 평문 str_password → enc:v1 메타 MySQL 반영 | 전체 스냅샷 1회',
        );
      }
    } catch (err: unknown) {
      console.error('[DataStore] db_connection 비밀번호 암호화 점검 실패 |', (err as Error)?.message);
    }
  }
};
