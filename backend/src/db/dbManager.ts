import * as mssql from 'mssql';
import type { RowDataPacket } from 'mysql2';
import { IDbConnection } from '../types';
import { fnIsDbConnPasswordEncrypted } from '../services/dbConnectionPasswordCrypto';
import {
  fnEndMysqlGamePool,
  fnGetMysqlGameConnection,
  fnNormalizeGameConn,
} from './mysqlGameConnection';
import { fnGetMysqlServerVersionCached, fnIsLegacyMysqlServerVersion } from './mysqlServerProbe';

// 커넥션 풀 캐시 (MSSQL)
const objMssqlPools = new Map<number, mssql.ConnectionPool>();
const mapMssqlPoolFingerprint = new Map<number, string>();

const fnConnectionPoolFingerprint = (objConn: IDbConnection): string =>
  [
    objConn.strDbType,
    objConn.strHost,
    String(objConn.nPort),
    objConn.strDatabase,
    (objConn.strUser ?? '').trim(),
    objConn.strPassword ?? '',
  ].join('\0');

const fnNormalizeConnForPool = (objConn: IDbConnection): IDbConnection =>
  fnNormalizeGameConn(objConn);

// =============================================
// MSSQL 풀 관리
// =============================================

const fnGetMssqlEncryptOption = (): boolean => process.env.MSSQL_ENCRYPT !== 'false';

const fnGetMssqlPool = async (objConn: IDbConnection): Promise<mssql.ConnectionPool> => {
  const objNorm = fnNormalizeConnForPool(objConn);
  const strFp = fnConnectionPoolFingerprint(objNorm);
  const objCached = objMssqlPools.get(objNorm.nId);
  if (objCached && objCached.connected && mapMssqlPoolFingerprint.get(objNorm.nId) === strFp) {
    return objCached;
  }
  if (objCached) {
    try {
      await objCached.close();
    } catch {
      /* 무시 */
    }
    objMssqlPools.delete(objNorm.nId);
    mapMssqlPoolFingerprint.delete(objNorm.nId);
  }

  const bEncrypt = fnGetMssqlEncryptOption();
  const objConfig: mssql.config = {
    server: objNorm.strHost,
    port: objNorm.nPort,
    database: objNorm.strDatabase,
    user: objNorm.strUser,
    password: objNorm.strPassword,
    options: {
      encrypt: bEncrypt,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    connectionTimeout: 10000,
    requestTimeout: 60000,
  };

  const objPool = new mssql.ConnectionPool(objConfig);
  await objPool.connect();
  objMssqlPools.set(objNorm.nId, objPool);
  mapMssqlPoolFingerprint.set(objNorm.nId, strFp);
  return objPool;
};

// =============================================
// 풀 캐시 무효화
// =============================================

export const fnInvalidatePool = async (nConnectionId: number): Promise<void> => {
  const objMssqlPool = objMssqlPools.get(nConnectionId);
  if (objMssqlPool) {
    try {
      await objMssqlPool.close();
    } catch {
      /* 무시 */
    }
    objMssqlPools.delete(nConnectionId);
    mapMssqlPoolFingerprint.delete(nConnectionId);
  }
  await fnEndMysqlGamePool(nConnectionId);
};

// =============================================
// 연결 테스트
// =============================================

export interface ITestResult {
  bSuccess: boolean;
  strMessage: string;
  objDbInfo?: {
    strDatabase: string;
    strUser: string;
    strServer: string;
    strVersion: string;
    strServerTime: string;
  };
  strError?: string;
}

export const fnTestDbConnection = async (objConn: IDbConnection): Promise<ITestResult> => {
  const objNorm = fnNormalizeConnForPool(objConn);
  const strUser = objNorm.strUser;
  const strPass = objNorm.strPassword;
  if (!strUser) {
    return {
      bSuccess: false,
      strMessage: '연결 실패',
      strError:
        'DB 접속 정보에 사용자 계정이 없습니다. 수정 화면에서 사용자·비밀번호를 입력한 뒤 저장하세요. ' +
        `(호스트 ${objConn.strHost})`,
    };
  }
  if (!strPass || fnIsDbConnPasswordEncrypted(strPass)) {
    return {
      bSuccess: false,
      strMessage: '연결 실패',
      strError:
        `비밀번호가 없거나 복호화되지 않았습니다(${objConn.strDbType}·${objConn.strHost}). ` +
        '수정 화면에서 비밀번호를 다시 입력·저장하세요.',
    };
  }
  await fnInvalidatePool(objNorm.nId);
  try {
    if (objNorm.strDbType === 'mssql') {
      const objPool = await fnGetMssqlPool(objNorm);
      const objResult = await objPool.request().query(`
        SELECT
          DB_NAME()    AS strDatabase,
          USER_NAME()  AS strUser,
          @@SERVERNAME AS strServer,
          @@VERSION    AS strVersion,
          CONVERT(varchar, GETDATE(), 120) AS strServerTime
      `);
      const objRow = objResult.recordset[0];
      return {
        bSuccess: true,
        strMessage: '연결 성공',
        objDbInfo: {
          strDatabase: objRow.strDatabase,
          strUser: objRow.strUser,
          strServer: objRow.strServer,
          strVersion: String(objRow.strVersion).split('\n')[0].trim(),
          strServerTime: objRow.strServerTime,
        },
      };
    }

    if (objNorm.strDbType === 'mysql') {
      const strVer = await fnGetMysqlServerVersionCached(objNorm.strHost, objNorm.nPort);
      const bLegacy = fnIsLegacyMysqlServerVersion(strVer);
      const objDbConn = await fnGetMysqlGameConnection(objNorm);
      try {
        // MySQL 4.x — @@hostname 없음(Heidi와 동일 서버, mysql2 대신 레거시 드라이버 사용)
        const strSql = bLegacy
          ? `SELECT DATABASE() AS strDatabase, USER() AS strUser, VERSION() AS strVersion, NOW() AS strServerTime`
          : `SELECT DATABASE() AS strDatabase, USER() AS strUser, @@hostname AS strServer, VERSION() AS strVersion, NOW() AS strServerTime`;
        const [arrRows] = await objDbConn.query<RowDataPacket[]>(strSql);
        const objRow = (arrRows as RowDataPacket[])[0];
        return {
          bSuccess: true,
          strMessage: '연결 성공',
          objDbInfo: {
            strDatabase: String(objRow.strDatabase),
            strUser: String(objRow.strUser),
            strServer: bLegacy ? objNorm.strHost : String(objRow.strServer ?? objNorm.strHost),
            strVersion: String(objRow.strVersion),
            strServerTime: String(objRow.strServerTime),
          },
        };
      } finally {
        objDbConn.release();
      }
    }

    return { bSuccess: false, strMessage: '지원하지 않는 DB 타입입니다.', strError: 'UNSUPPORTED_DB_TYPE' };
  } catch (error: unknown) {
    await fnInvalidatePool(objNorm.nId);
    const strErr = error instanceof Error ? error.message : String(error);
    if (/''@|using password: no/i.test(strErr)) {
      const strVer = await fnGetMysqlServerVersionCached(objNorm.strHost, objNorm.nPort);
      if (fnIsLegacyMysqlServerVersion(strVer)) {
        return {
          bSuccess: false,
          strMessage: '연결 실패',
          strError:
            `대상 MySQL이 구버전(${strVer})입니다. 백엔드를 최신으로 재시작했는지 확인하세요. ` +
            '(Heidi는 되고 DQPM만 실패하면 이 경우입니다)',
        };
      }
    }
    return {
      bSuccess: false,
      strMessage: '연결 실패',
      strError: strErr,
    };
  }
};

// =============================================
// 쿼리 실행용 커넥션 획득
// =============================================

export const fnGetMssqlConnection = async (objConn: IDbConnection): Promise<mssql.ConnectionPool> =>
  fnGetMssqlPool(objConn);

export { fnGetMysqlGameConnection as fnGetMysqlConnection } from './mysqlGameConnection';
export type { IMysqlGameConnection } from './mysqlGameConnection';
