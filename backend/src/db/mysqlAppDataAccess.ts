import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ARR_MYSQL_APP_DDL, ARR_META_TABLE_NAMES, fnExtractMysqlDdlTableName } from './mysqlAppSchema';
import {
  fnRelationalLoadActivityLogs,
  fnRelationalLoadDbConnections,
  fnRelationalLoadEventInstances,
  fnRelationalLoadEvents,
  fnRelationalLoadProducts,
  fnRelationalLoadRolePermissions,
  fnRelationalLoadRoles,
  fnRelationalLoadUserRoles,
  fnRelationalLoadUserUiRoot,
  fnRelationalLoadUsers,
  fnRelationalReplaceFullFromImportPayload,
  fnRelationalReplaceUserUiOnly,
  fnRelationalWriteFullFromMemory,
  type IRelationalImportPayload,
} from './mysqlRelationalSync';

export type { IRelationalImportPayload, IUserRowJson, IRoleRowJson } from './mysqlRelationalSync';

/** jsonStore STR_FILE 값 → 대표 정규화 테이블(로그·호환용) */
export const fnFilenameToMysqlTable = (strFilename: string): string | null => {
  const map: Record<string, string> = {
    'products.json': 'product',
    'events.json': 'event_template',
    'eventInstances.json': 'event_instance',
    'dbConnections.json': 'db_connection',
    'users.json': 'users',
    'roles.json': 'roles',
    'userRoles.json': 'user_roles',
    'rolePermissions.json': 'role_permissions',
    'activity_logs.json': 'activity_log',
  };
  return map[strFilename] ?? null;
};

export const fnEnsureMysqlAppSchema = async (pool: Pool): Promise<void> => {
  const nDdl = ARR_MYSQL_APP_DDL.length;
  console.log(`[DATA_MYSQL] 스키마 DDL 적용 시작 | 문장=${nDdl}건`);
  for (let nIdx = 0; nIdx < nDdl; nIdx++) {
    const strSql = ARR_MYSQL_APP_DDL[nIdx];
    await pool.query(strSql);
    const strTable = fnExtractMysqlDdlTableName(strSql) ?? `ddl_${nIdx + 1}`;
    console.log(`[DATA_MYSQL] 테이블 보장 완료 | ${strTable}`);
  }
  const [dbRows] = await pool.query<RowDataPacket[]>('SELECT DATABASE() AS strDb');
  const strCurrentDb = String((dbRows as RowDataPacket[])[0]?.strDb ?? '').trim();
  if (!strCurrentDb) {
    throw new Error(
      '[DATA_MYSQL] 연결에 기본 스키마가 없습니다. DATA_MYSQL_URL 끝에 /DB명 을 붙이거나 DATA_MYSQL_DATABASE 를 설정하세요.',
    );
  }
  const strPlaceholders = ARR_META_TABLE_NAMES.map(() => '?').join(', ');
  const [cntRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = ? AND table_name IN (${strPlaceholders})`,
    [strCurrentDb, ...ARR_META_TABLE_NAMES],
  );
  const nTables = Number((cntRows as RowDataPacket[])[0]?.n) || 0;
  const nExpected = ARR_META_TABLE_NAMES.length;
  console.log(
    `[DATA_MYSQL] 스키마 점검 완료 | database=${strCurrentDb} | information_schema=${nTables}/${nExpected}`,
  );
  if (nTables < nExpected) {
    console.warn(
      `[DATA_MYSQL] 메타 테이블이 ${nExpected}개 미만입니다. CREATE 권한·스키마를 확인하세요.`,
    );
  }
};

export const fnMysqlCountProducts = async (pool: Pool): Promise<number> => {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM product');
  return Number(rows[0]?.n) || 0;
};

/** 인메모리 스냅샷 전체를 DB에 반영(FK 순서 내장). strFilename·arr 인자는 호환만 유지. */
export const fnMysqlReplaceByFilename = async (
  pool: Pool,
  _strFilename: string,
  _arr: unknown[],
): Promise<void> => {
  await fnRelationalWriteFullFromMemory(pool);
};

const mapLoader: Record<string, (pool: Pool) => Promise<unknown[]>> = {
  'products.json': fnRelationalLoadProducts,
  'dbConnections.json': fnRelationalLoadDbConnections,
  'events.json': fnRelationalLoadEvents,
  'eventInstances.json': fnRelationalLoadEventInstances,
  'users.json': fnRelationalLoadUsers,
  'roles.json': fnRelationalLoadRoles,
  'userRoles.json': fnRelationalLoadUserRoles,
  'rolePermissions.json': fnRelationalLoadRolePermissions,
  'activity_logs.json': fnRelationalLoadActivityLogs,
};

export const fnMysqlLoadArrayByFilename = async (pool: Pool, strFilename: string): Promise<unknown[]> => {
  const fn = mapLoader[strFilename];
  if (!fn) return [];
  return fn(pool);
};

export const fnMysqlReplaceUserUiRoot = async (
  pool: Pool,
  objRoot: { mapByUserId: Record<string, Record<string, string>> },
): Promise<void> => {
  await fnRelationalReplaceUserUiOnly(pool, objRoot);
};

export const fnMysqlLoadUserUiRoot = async (
  pool: Pool,
): Promise<{ mapByUserId: Record<string, Record<string, string>> }> => {
  return fnRelationalLoadUserUiRoot(pool);
};

/** 부트스트랩·CLI: 디스크에서 읽은 배열을 한 트랜잭션으로 적재 */
export const fnMysqlImportRelationalPayload = async (
  pool: Pool,
  payload: IRelationalImportPayload,
): Promise<void> => {
  await fnRelationalReplaceFullFromImportPayload(pool, payload);
};
