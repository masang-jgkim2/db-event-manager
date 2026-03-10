import * as mssql from 'mssql';
import mysql from 'mysql2/promise';
import { IDbConnection } from '../types';

// 커넥션 풀 캐시 (접속 정보 ID → 풀 인스턴스)
const objMssqlPools = new Map<number, mssql.ConnectionPool>();
const objMysqlPools = new Map<number, mysql.Pool>();

// =============================================
// MSSQL 풀 관리
// =============================================

const fnGetMssqlPool = async (objConn: IDbConnection): Promise<mssql.ConnectionPool> => {
  const objCached = objMssqlPools.get(objConn.nId);
  if (objCached && objCached.connected) return objCached;

  const objConfig: mssql.config = {
    server: objConn.strHost,
    port: objConn.nPort,
    database: objConn.strDatabase,
    user: objConn.strUser,
    password: objConn.strPassword,
    options: {
      trustServerCertificate: true,   // 내부망 환경 기본 허용
      enableArithAbort: true,
    },
    connectionTimeout: 10000,
    requestTimeout: 60000,
  };

  const objPool = new mssql.ConnectionPool(objConfig);
  await objPool.connect();
  objMssqlPools.set(objConn.nId, objPool);
  return objPool;
};

// =============================================
// MySQL 풀 관리
// =============================================

const fnGetMysqlPool = (objConn: IDbConnection): mysql.Pool => {
  const objCached = objMysqlPools.get(objConn.nId);
  if (objCached) return objCached;

  const objPool = mysql.createPool({
    host: objConn.strHost,
    port: objConn.nPort,
    database: objConn.strDatabase,
    user: objConn.strUser,
    password: objConn.strPassword,
    waitForConnections: true,
    connectionLimit: 5,
    connectTimeout: 10000,
    multipleStatements: false,  // 보안: 멀티 스테이트먼트 비활성 (개별 실행으로 처리)
  });

  objMysqlPools.set(objConn.nId, objPool);
  return objPool;
};

// =============================================
// 풀 캐시 무효화 (접속 정보 변경 시 호출)
// =============================================

export const fnInvalidatePool = async (nConnectionId: number): Promise<void> => {
  const objMssqlPool = objMssqlPools.get(nConnectionId);
  if (objMssqlPool) {
    try { await objMssqlPool.close(); } catch { /* 무시 */ }
    objMssqlPools.delete(nConnectionId);
  }

  const objMysqlPool = objMysqlPools.get(nConnectionId);
  if (objMysqlPool) {
    try { await objMysqlPool.end(); } catch { /* 무시 */ }
    objMysqlPools.delete(nConnectionId);
  }
};

// =============================================
// 연결 테스트
// DB명/사용자/서버/버전/서버시각을 한 번에 확인
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
  try {
    if (objConn.strDbType === 'mssql') {
      const objPool = await fnGetMssqlPool(objConn);
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
          strVersion: String(objRow.strVersion).split('\n')[0].trim(),  // 첫 줄만
          strServerTime: objRow.strServerTime,
        },
      };
    }

    if (objConn.strDbType === 'mysql') {
      const objPool = fnGetMysqlPool(objConn);
      const objDbConn = await objPool.getConnection();
      try {
        const [arrRows] = await objDbConn.execute<mysql.RowDataPacket[]>(`
          SELECT
            DATABASE()   AS strDatabase,
            USER()       AS strUser,
            @@hostname   AS strServer,
            VERSION()    AS strVersion,
            NOW()        AS strServerTime
        `);
        const objRow = arrRows[0];
        return {
          bSuccess: true,
          strMessage: '연결 성공',
          objDbInfo: {
            strDatabase: objRow.strDatabase,
            strUser: objRow.strUser,
            strServer: objRow.strServer,
            strVersion: objRow.strVersion,
            strServerTime: String(objRow.strServerTime),
          },
        };
      } finally {
        objDbConn.release();
      }
    }

    return { bSuccess: false, strMessage: '지원하지 않는 DB 타입입니다.', strError: 'UNSUPPORTED_DB_TYPE' };
  } catch (error: any) {
    // 실패 시 캐시된 풀 제거 (다음 요청 시 재연결)
    await fnInvalidatePool(objConn.nId);
    return {
      bSuccess: false,
      strMessage: '연결 실패',
      strError: error?.message || String(error),
    };
  }
};

// =============================================
// 쿼리 실행용 커넥션 획득
// =============================================

export const fnGetMssqlConnection = async (objConn: IDbConnection): Promise<mssql.ConnectionPool> => {
  return fnGetMssqlPool(objConn);
};

export const fnGetMysqlConnection = async (objConn: IDbConnection): Promise<mysql.PoolConnection> => {
  const objPool = fnGetMysqlPool(objConn);
  return objPool.getConnection();
};
