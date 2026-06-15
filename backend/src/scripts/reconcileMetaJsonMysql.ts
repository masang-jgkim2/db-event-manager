/**
 * 디스크 JSON 미러 ↔ MySQL 메타 동기화 (수동 실행).
 * 사용: npm run reconcile-meta-json-mysql  (backend, DATA_STORE=mysql)
 */
import 'dotenv/config';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnEnsureMysqlAppSchema } from '../db/mysqlAppDataAccess';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnHydrateMemoryFromMysql } from '../data/bootstrapDataStore';
import { fnReconcileMetaJsonWithMysql } from '../data/metaJsonMysqlReconcile';

const fnMain = async (): Promise<void> => {
  if (!fnIsMysqlStore()) {
    console.log('[reconcile-meta] DATA_STORE=json — 생략');
    return;
  }
  const pool = fnGetMysqlAppPool();
  await fnEnsureMysqlAppSchema(pool);
  await fnHydrateMemoryFromMysql();
  const { arrEventInstances } = await import('../data/eventInstances');
  const nBefore = arrEventInstances.length;
  const objSummary = await fnReconcileMetaJsonWithMysql(pool);
  const nAfter = arrEventInstances.length;
  console.log(
    `[reconcile-meta] 완료 | changed=${objSummary.bAnyChanged} instances ${nBefore}→${nAfter}`,
  );
};

void fnMain().catch((err: unknown) => {
  console.error('[reconcile-meta] 실패 |', (err as Error)?.message);
  process.exit(1);
});
