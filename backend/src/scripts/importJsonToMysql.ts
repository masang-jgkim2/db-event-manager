/**
 * DATA_DIR(또는 기본 backend/data)의 JSON을 DATA_MYSQL_* DB 메타 정규화 테이블에 덮어씀.
 * 실행: backend 폴더에서 `npm run import-json-to-mysql`
 */
import '../loadEnv';
import { fnGetMysqlAppPool, fnResetMysqlAppPoolForTests } from '../db/mysqlAppPool';
import { fnEnsureMysqlAppSchema } from '../db/mysqlAppDataAccess';
import { fnMysqlImportAllFromJsonDisk } from '../data/bootstrapDataStore';

process.env.DATA_STORE = 'mysql';

void (async () => {
  try {
    const pool = fnGetMysqlAppPool();
    await fnEnsureMysqlAppSchema(pool);
    await fnMysqlImportAllFromJsonDisk();
    await pool.end();
    fnResetMysqlAppPoolForTests();
    console.log('[import-json-to-mysql] 완료');
    process.exit(0);
  } catch (err) {
    console.error('[import-json-to-mysql] 실패 |', err);
    process.exit(1);
  }
})();
