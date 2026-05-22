import sql from 'mssql';

// 시스템 DB 연결 풀 (roles / users / db_connections 영구 저장용)
// .env 의 DB_SYSTEM_* 환경 변수를 사용한다.

let objPool: sql.ConnectionPool | null = null;

const OBJ_CONFIG: sql.config = {
  server:   process.env.DB_SYSTEM_HOST     || '127.0.0.1',
  port:     Number(process.env.DB_SYSTEM_PORT) || 1433,
  database: process.env.DB_SYSTEM_DATABASE || 'db_manager',
  user:     process.env.DB_SYSTEM_USER     || 'dba',
  password: process.env.DB_SYSTEM_PASSWORD || '',
  options: {
    trustServerCertificate: true,
    enableArithAbort:       true,
    encrypt:                false,  // 로컬 SQL Server 2022 연결 시 암호화 비활성화
  },
  pool: {
    max:              10,
    min:              1,
    idleTimeoutMillis: 30_000,
  },
};

// 연결 풀 반환 (최초 1회 생성, 이후 재사용)
export const fnGetSystemPool = async (): Promise<sql.ConnectionPool> => {
  if (objPool && objPool.connected) return objPool;
  objPool = await new sql.ConnectionPool(OBJ_CONFIG).connect();
  return objPool;
};

// 쿼리 헬퍼 — 파라미터 바인딩 콜백을 받아 실행
export const fnQuery = async <T = sql.IRecordSet<any>>(
  strSql: string,
  fnBind?: (req: sql.Request) => void,
): Promise<T> => {
  const pool    = await fnGetSystemPool();
  const request = pool.request();
  if (fnBind) fnBind(request);
  const result  = await request.query(strSql);
  return result.recordset as unknown as T;
};

// 서버 시작 시 연결 테스트
export const fnInitSystemDb = async (): Promise<void> => {
  console.log('[시스템 DB] 연결 시도:', {
    host:     OBJ_CONFIG.server,
    port:     OBJ_CONFIG.port,
    database: OBJ_CONFIG.database,
    user:     OBJ_CONFIG.user,
  });
  try {
    await fnGetSystemPool();
    console.log('[시스템 DB] MSSQL 연결 성공 →', OBJ_CONFIG.database);
  } catch (error: any) {
    console.error('[시스템 DB] 연결 실패 (code:', (error as any).code, '):', error.message);
    // 연결 실패 시에도 서버는 계속 시작 (인메모리 폴백 사용)
  }
};
