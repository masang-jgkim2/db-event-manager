/**
 * QA 메타 MySQL db_connection → scripts/live_meta_reset.sql 5절 INSERT 병합
 *
 *   export QA_MYSQL_HOST=...
 *   export QA_MYSQL_USER=dqpm
 *   export QA_MYSQL_PASSWORD='...'
 *   export QA_MYSQL_DATABASE=dqpm
 *   cd backend && npm run merge-qa-db-connection-into-reset
 *
 * 병합 후 live_meta_reset.sql 에 호스트·암호화 비밀번호 포함 → git commit 금지
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';

const STR_MARKER_BEGIN = '-- @db_connection_seed_begin';
const STR_MARKER_END = '-- @db_connection_seed_end';
const STR_RESET_PATH = path.join(__dirname, '../../../scripts/live_meta_reset.sql');

const fnEsc = (v: string): string => v.replace(/\\/g, '\\\\').replace(/'/g, "''");

const fnSqlVal = (v: unknown): string => {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) {
    const p = (n: number, L: number) => String(n).padStart(L, '0');
    return `'${v.getFullYear()}-${p(v.getMonth() + 1, 2)}-${p(v.getDate(), 2)} ${p(v.getHours(), 2)}:${p(v.getMinutes(), 2)}:${p(v.getSeconds(), 2)}.${p(v.getMilliseconds(), 3)}000'`;
  }
  return `'${fnEsc(String(v))}'`;
};

const fnBuildInsertBlock = (arrRows: RowDataPacket[]): string => {
  if (arrRows.length === 0) {
    return '-- (QA db_connection 0건 — QA DB·권한 확인)';
  }
  const arrCols = [
    'n_id',
    'n_product_id',
    'str_product_name',
    'n_service_id',
    'str_service_abbr',
    'str_kind',
    'str_env',
    'str_db_type',
    'str_host',
    'n_port',
    'str_database',
    'str_user',
    'str_password',
    'b_is_active',
    'dt_created_at',
    'dt_updated_at',
  ];
  const arrLines = arrRows.map((row) => {
    const arrVals = arrCols.map((c) => fnSqlVal(row[c]));
    return `\t(${arrVals.join(', ')})`;
  });
  return [
    'INSERT INTO `db_connection` (`n_id`, `n_product_id`, `str_product_name`, `n_service_id`, `str_service_abbr`, `str_kind`, `str_env`, `str_db_type`, `str_host`, `n_port`, `str_database`, `str_user`, `str_password`, `b_is_active`, `dt_created_at`, `dt_updated_at`) VALUES',
    arrLines.join(',\n') + ';',
  ].join('\n');
};

const fnMergeIntoResetSql = (strInsertBlock: string): void => {
  const strSrc = fs.readFileSync(STR_RESET_PATH, 'utf-8');
  const nBegin = strSrc.indexOf(STR_MARKER_BEGIN);
  const nEnd = strSrc.indexOf(STR_MARKER_END);
  if (nBegin < 0 || nEnd < 0 || nEnd <= nBegin) {
    throw new Error(`마커 없음: ${STR_MARKER_BEGIN} / ${STR_MARKER_END}`);
  }
  const strHead = strSrc.slice(0, nBegin + STR_MARKER_BEGIN.length);
  const strTail = strSrc.slice(nEnd);
  const strMerged = `${strHead}\n${strInsertBlock}\n${strTail}`;
  fs.writeFileSync(STR_RESET_PATH, strMerged, 'utf-8');
};

const fnMain = async (): Promise<void> => {
  const strHost = process.env.QA_MYSQL_HOST?.trim() || '127.0.0.1';
  const nPort = Number(process.env.QA_MYSQL_PORT) || 3306;
  const strUser = process.env.QA_MYSQL_USER?.trim() || 'dqpm';
  const strPassword = process.env.QA_MYSQL_PASSWORD ?? '';
  const strDb = process.env.QA_MYSQL_DATABASE?.trim() || 'dqpm';

  if (!strPassword) {
    console.error('[merge-db-conn] QA_MYSQL_PASSWORD 필요');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: strHost,
    port: nPort,
    user: strUser,
    password: strPassword,
    database: strDb,
  });

  try {
    const [arrRows] = await conn.query<RowDataPacket[]>(
      `SELECT n_id, n_product_id, str_product_name, n_service_id, str_service_abbr, str_kind, str_env,
              str_db_type, str_host, n_port, str_database, str_user, str_password, b_is_active,
              dt_created_at, dt_updated_at
       FROM db_connection
       ORDER BY n_id`,
    );
    const strBlock = fnBuildInsertBlock(arrRows);
    fnMergeIntoResetSql(strBlock);
    console.log(`[merge-db-conn] ${STR_RESET_PATH} | db_connection ${arrRows.length}건 병합`);
    console.log('[merge-db-conn] ⚠ 병합된 live_meta_reset.sql 은 git commit 하지 마세요 (비밀번호 포함)');
  } finally {
    await conn.end();
  }
};

void fnMain().catch((err: unknown) => {
  console.error('[merge-db-conn] 실패 |', (err as Error)?.message);
  process.exit(1);
});
