import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';

let pool: Pool | null = null;

const fnParseUrl = (strUrl: string): mysql.PoolOptions | null => {
  try {
    const u = new URL(strUrl);
    if (u.protocol !== 'mysql:' && u.protocol !== 'mysql2:') return null;
    const strDb = u.pathname.replace(/^\//, '') || '';
    const nPort = u.port ? Number(u.port) : 3306;
    return {
      host: u.hostname,
      port: Number.isFinite(nPort) ? nPort : 3306,
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      database: strDb,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    };
  } catch {
    return null;
  }
};

/** DATA_MYSQL_URL 우선, 없으면 DATA_MYSQL_HOST 등 분리 변수 */
export const fnCreateMysqlAppPool = (): Pool => {
  const strUrl = process.env.DATA_MYSQL_URL?.trim();
  if (strUrl) {
    const strNormalized = strUrl.includes('://') ? strUrl : `mysql://${strUrl}`;
    const opt = fnParseUrl(strNormalized);
    if (opt) {
      const strDb = String(opt.database ?? '').trim();
      if (!strDb) {
        throw new Error(
          '[DATA_MYSQL] DATA_MYSQL_URL에 스키마(DB)명이 없습니다. 예: mysql://user:pass@127.0.0.1:3306/dqpm (경로 마지막이 DB명)',
        );
      }
      opt.database = strDb;
      return mysql.createPool(opt);
    }
    return mysql.createPool(strNormalized);
  }
  const strHost = process.env.DATA_MYSQL_HOST?.trim() || '127.0.0.1';
  const nPort = Number(process.env.DATA_MYSQL_PORT) || 3306;
  const strUser = process.env.DATA_MYSQL_USER?.trim() || 'root';
  const strPass = process.env.DATA_MYSQL_PASSWORD ?? '';
  const strDb = process.env.DATA_MYSQL_DATABASE?.trim();
  if (!strDb) {
    throw new Error('[DATA_MYSQL] DATA_MYSQL_DATABASE 또는 DATA_MYSQL_URL 필요');
  }
  return mysql.createPool({
    host: strHost,
    port: nPort,
    user: strUser,
    password: strPass,
    database: strDb,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
};

export const fnGetMysqlAppPool = (): Pool => {
  if (!pool) pool = fnCreateMysqlAppPool();
  return pool;
};

export const fnResetMysqlAppPoolForTests = (): void => {
  if (pool) {
    void pool.end();
    pool = null;
  }
};
