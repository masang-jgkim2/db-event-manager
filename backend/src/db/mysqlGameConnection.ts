import mysql2 from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2';
import type { Pool as Pool2, PoolConnection as PoolConnection2 } from 'mysql2/promise';
import mysqlLegacy from 'mysql';
import type { Pool as PoolLegacy, PoolConnection as PoolConnectionLegacy } from 'mysql';
import { IDbConnection } from '../types';
import { fnGetMysqlServerVersionCached, fnIsLegacyMysqlServerVersion } from './mysqlServerProbe';

/** queryExecutor·연결테스트 공통 — mysql2 / 레거시 mysql 패키지 추상화 */
export interface IMysqlGameConnection {
  query<T = mysql2.ResultSetHeader>(strSql: string): Promise<[T, unknown]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

const fnPromisifyQuery = (
  conn: PoolConnectionLegacy,
  strSql: string,
): Promise<[unknown, unknown]> =>
  new Promise((resolve, reject) => {
    conn.query(strSql, (err: Error | null, rows: unknown) => {
      if (err) reject(err);
      else resolve([rows, undefined]);
    });
  });

const fnWrapMysql2 = (conn: PoolConnection2): IMysqlGameConnection => ({
  query: async <T = ResultSetHeader>(strSql: string) => {
    const [rows, fields] = await conn.query(strSql);
    return [rows as T, fields];
  },
  beginTransaction: async () => {
    await conn.beginTransaction();
  },
  commit: async () => {
    await conn.commit();
  },
  rollback: async () => {
    await conn.rollback();
  },
  release: () => {
    conn.release();
  },
});

const fnWrapLegacy = (conn: PoolConnectionLegacy): IMysqlGameConnection => ({
  query: async <T = ResultSetHeader>(strSql: string) => {
    const [rows] = await fnPromisifyQuery(conn, strSql);
    return [rows as T, undefined];
  },
  beginTransaction: () =>
    new Promise<void>((resolve, reject) => {
      conn.beginTransaction((err: Error | null) => (err ? reject(err) : resolve()));
    }),
  commit: () =>
    new Promise<void>((resolve, reject) => {
      conn.commit((err: Error | null) => (err ? reject(err) : resolve()));
    }),
  rollback: () =>
    new Promise<void>((resolve, reject) => {
      conn.rollback((err: Error | null) => (err ? reject(err) : resolve()));
    }),
  release: () => {
    conn.release();
  },
});

const fnConnectionPoolFingerprint = (objConn: IDbConnection): string =>
  [
    objConn.strDbType,
    objConn.strHost,
    String(objConn.nPort),
    objConn.strDatabase,
    (objConn.strUser ?? '').trim(),
    objConn.strPassword ?? '',
  ].join('\0');

type TPoolEntry = {
  strFp: string;
  bLegacy: boolean;
  pool2?: Pool2;
  poolLegacy?: PoolLegacy;
};

const mapPools = new Map<number, TPoolEntry>();

export const fnNormalizeGameConn = (objConn: IDbConnection): IDbConnection => ({
  ...objConn,
  strUser: (objConn.strUser ?? '').trim(),
  strPassword: objConn.strPassword ?? '',
});

export const fnIsLegacyMysqlGameHost = async (objConn: IDbConnection): Promise<boolean> => {
  const strVer = await fnGetMysqlServerVersionCached(objConn.strHost, objConn.nPort);
  return fnIsLegacyMysqlServerVersion(strVer);
};

const fnEnsurePool = async (objConn: IDbConnection): Promise<TPoolEntry> => {
  const objNorm = fnNormalizeGameConn(objConn);
  const strFp = fnConnectionPoolFingerprint(objNorm);
  const bLegacy = await fnIsLegacyMysqlGameHost(objNorm);
  const objExisting = mapPools.get(objNorm.nId);
  if (objExisting && objExisting.strFp === strFp && objExisting.bLegacy === bLegacy) {
    return objExisting;
  }
  if (objExisting) {
    if (objExisting.pool2) void objExisting.pool2.end();
    if (objExisting.poolLegacy) objExisting.poolLegacy.end();
    mapPools.delete(objNorm.nId);
  }

  const objEntry: TPoolEntry = { strFp, bLegacy };
  if (bLegacy) {
    objEntry.poolLegacy = mysqlLegacy.createPool({
      host: objNorm.strHost,
      port: objNorm.nPort,
      database: objNorm.strDatabase,
      user: objNorm.strUser,
      password: objNorm.strPassword,
      connectionLimit: 5,
      connectTimeout: 10000,
      insecureAuth: true,
      multipleStatements: false,
    });
    console.log(
      `[MySQL] 레거시(4.x) 풀 | nId=${objNorm.nId} | ${objNorm.strUser}@${objNorm.strHost}:${objNorm.nPort}/${objNorm.strDatabase}`,
    );
  } else {
    objEntry.pool2 = mysql2.createPool({
      host: objNorm.strHost,
      port: objNorm.nPort,
      database: objNorm.strDatabase,
      user: objNorm.strUser,
      password: objNorm.strPassword,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 10000,
      multipleStatements: false,
    });
  }
  mapPools.set(objNorm.nId, objEntry);
  return objEntry;
};

export const fnGetMysqlGameConnection = async (
  objConn: IDbConnection,
): Promise<IMysqlGameConnection> => {
  const objNorm = fnNormalizeGameConn(objConn);
  const objPool = await fnEnsurePool(objNorm);
  if (objPool.bLegacy && objPool.poolLegacy) {
    return fnWrapLegacy(
      await new Promise<PoolConnectionLegacy>((resolve, reject) => {
        objPool.poolLegacy!.getConnection((err: Error | null, conn: PoolConnectionLegacy) =>
          err ? reject(err) : resolve(conn),
        );
      }),
    );
  }
  if (objPool.pool2) {
    return fnWrapMysql2(await objPool.pool2.getConnection());
  }
  throw new Error('MySQL 게임 DB 풀을 만들지 못했습니다.');
};

export const fnEndMysqlGamePool = async (nConnectionId: number): Promise<void> => {
  const objPool = mapPools.get(nConnectionId);
  if (!objPool) return;
  if (objPool.pool2) {
    try {
      await objPool.pool2.end();
    } catch {
      /* 무시 */
    }
  }
  if (objPool.poolLegacy) {
    try {
      objPool.poolLegacy.end();
    } catch {
      /* 무시 */
    }
  }
  mapPools.delete(nConnectionId);
};
