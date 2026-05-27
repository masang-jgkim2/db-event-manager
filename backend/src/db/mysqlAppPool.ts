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

const fnResolveMysqlCredentials = (opt: {
  user?: string;
  password?: string;
}): { user: string; password: string } => {
  const strUserFromUrl = (opt.user ?? '').trim();
  const strPassFromUrl = opt.password ?? '';
  const strUser = strUserFromUrl || process.env.DATA_MYSQL_USER?.trim() || 'root';
  const strPass =
    strUserFromUrl && strPassFromUrl !== ''
      ? strPassFromUrl
      : process.env.DATA_MYSQL_PASSWORD ?? strPassFromUrl;
  return { user: strUser, password: strPass };
};

const fnAssertMysqlCredentials = (opt: { user: string; password: string; host?: string }): void => {
  if (!opt.user.trim()) {
    throw new Error(
      '[DATA_MYSQL] MySQL 사용자명이 비어 있습니다. backend/.env 에 ' +
        'DATA_MYSQL_USER·DATA_MYSQL_PASSWORD 를 설정하거나, ' +
        'DATA_MYSQL_URL=mysql://user:pass@호스트:3306/dqpm 형식으로 넣으세요.',
    );
  }
  const strHost = (opt.host ?? '').trim().toLowerCase();
  const bLocal = strHost === '127.0.0.1' || strHost === 'localhost' || strHost === '';
  if (!opt.password && !bLocal) {
    throw new Error(
      `[DATA_MYSQL] 원격 MySQL(${opt.host})에는 비밀번호가 필요합니다. ` +
        'backend/.env 에 DATA_MYSQL_PASSWORD 를 설정하세요. (Using password: NO / Access denied)',
    );
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
      const objCred = fnResolveMysqlCredentials({ user: opt.user, password: opt.password });
      fnAssertMysqlCredentials({ ...objCred, host: opt.host });
      opt.database = strDb;
      opt.user = objCred.user;
      opt.password = objCred.password;
      console.log(
        `[DATA_MYSQL] 연결 | ${objCred.user}@${opt.host}:${opt.port}/${strDb}`,
      );
      return mysql.createPool(opt);
    }
    throw new Error(
      `[DATA_MYSQL] DATA_MYSQL_URL 형식이 올바르지 않습니다: ${strUrl}\n` +
        '예: mysql://dqpm:비밀번호@10.31.104.28:3306/dqpm',
    );
  }
  const strHost = process.env.DATA_MYSQL_HOST?.trim() || '127.0.0.1';
  const nPort = Number(process.env.DATA_MYSQL_PORT) || 3306;
  const objCred = fnResolveMysqlCredentials({});
  fnAssertMysqlCredentials({ ...objCred, host: strHost });
  const strDb = process.env.DATA_MYSQL_DATABASE?.trim();
  if (!strDb) {
    throw new Error('[DATA_MYSQL] DATA_MYSQL_DATABASE 또는 DATA_MYSQL_URL 필요');
  }
  console.log(`[DATA_MYSQL] 연결 | ${objCred.user}@${strHost}:${nPort}/${strDb}`);
  return mysql.createPool({
    host: strHost,
    port: nPort,
    user: objCred.user,
    password: objCred.password,
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

/** 기동 시 메타 DB 연결 검증 — 잘못된 .env 를 즉시 드러냄 */
export const fnVerifyMysqlAppPoolConnection = async (): Promise<void> => {
  const p = fnGetMysqlAppPool();
  await p.query('SELECT 1 AS n');
};
