import { fnGetSystemPool } from '../db/systemDb';

/** STORE_BACKEND=rdb 일 때만 호출 — 연결 실패 시 프로세스 종료(롤백: STORE_BACKEND=json) */
export const fnEnsureSystemDbForRdb = async (): Promise<void> => {
  try {
    await fnGetSystemPool();
    console.log('[persistence] 시스템 DB(MSSQL) 연결 확인');
  } catch (err: unknown) {
    const strMsg = err instanceof Error ? err.message : String(err);
    console.error('[persistence] STORE_BACKEND=rdb 인데 시스템 DB 연결 실패 |', strMsg);
    console.error('[persistence] 롤백: STORE_BACKEND=json 또는 DB_SYSTEM_* 확인');
    process.exit(1);
  }
};
