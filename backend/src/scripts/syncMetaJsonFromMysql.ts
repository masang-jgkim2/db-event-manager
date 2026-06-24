/**
 * MySQL 메타 → shared/data/*.json 미러 (단방향, reconcile 병합 없음)
 *
 * live_meta_reset.sql 실행 직후·백엔드 기동 전에 실행:
 *   cd backend && npm run sync-meta-json-from-mysql
 *
 * DATA_STORE=mysql, backend/.env 의 DATA_MYSQL_* 사용
 * DATA_DIR 미설정 시 backend/data (= EC2 shared/data 심링크)
 */
import fs from 'fs';
import path from 'path';
import '../loadEnv';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnEnsureMysqlAppSchema } from '../db/mysqlAppDataAccess';
import { fnGetMysqlAppPool, fnResetMysqlAppPoolForTests } from '../db/mysqlAppPool';
import { fnHydrateMemoryFromMysql } from '../data/bootstrapDataStore';
import { fnMirrorJsonToDisk, STR_DATA_DIR } from '../data/jsonStore';
import { fnEncryptDbConnPasswordForDisk } from '../services/dbConnectionPasswordCrypto';
import { fnGetUserUiRootForMysql } from '../data/userUiPreferences';

process.env.DATA_STORE = 'mysql';

const fnMirrorUserUiRoot = (objRoot: { mapByUserId: Record<string, Record<string, string>> }): void => {
  const strPath = path.join(STR_DATA_DIR, 'userUiPreferences.json');
  fs.writeFileSync(strPath, JSON.stringify(objRoot, null, 2), 'utf-8');
};

void (async () => {
  if (!fnIsMysqlStore()) {
    console.error('[sync-meta-json] DATA_STORE=mysql 필요');
    process.exit(1);
  }

  const pool = fnGetMysqlAppPool();
  await fnEnsureMysqlAppSchema(pool);
  await fnHydrateMemoryFromMysql();

  const { arrProducts } = await import('../data/products');
  const { arrDbConnections } = await import('../data/dbConnections');
  const { arrEvents } = await import('../data/events');
  const { arrEventInstances } = await import('../data/eventInstances');
  const { arrUsers } = await import('../data/users');
  const { arrRoles } = await import('../data/roles');
  const { arrUserRoles } = await import('../data/userRoles');
  const { arrRolePermissions } = await import('../data/rolePermissions');
  const { arrActivityLogs } = await import('../data/activityLogs');

  fnMirrorJsonToDisk('products.json', arrProducts);
  fnMirrorJsonToDisk(
    'dbConnections.json',
    arrDbConnections.map((c) => ({
      ...c,
      strPassword: fnEncryptDbConnPasswordForDisk(c.strPassword),
    })),
  );
  fnMirrorJsonToDisk('events.json', arrEvents);
  fnMirrorJsonToDisk('eventInstances.json', arrEventInstances);
  fnMirrorJsonToDisk('users.json', arrUsers);
  fnMirrorJsonToDisk('roles.json', arrRoles);
  fnMirrorJsonToDisk('userRoles.json', arrUserRoles);
  fnMirrorJsonToDisk('rolePermissions.json', arrRolePermissions);
  fnMirrorJsonToDisk('activity_logs.json', arrActivityLogs);
  fnMirrorUserUiRoot(fnGetUserUiRootForMysql());

  await pool.end();
  fnResetMysqlAppPoolForTests();

  console.log(
    `[sync-meta-json] 완료 | dir=${STR_DATA_DIR} | ` +
      `products=${arrProducts.length} dbConn=${arrDbConnections.length} users=${arrUsers.length} ` +
      `roles=${arrRoles.length} events=${arrEvents.length} instances=${arrEventInstances.length}`,
  );
  console.log('[sync-meta-json] 이후 dqpm-backend 기동 (DATA_MYSQL_SKIP_JSON_RECONCILE 없어도 JSON=MySQL)');
  process.exit(0);
})().catch((err: unknown) => {
  console.error('[sync-meta-json] 실패 |', (err as Error)?.message);
  process.exit(1);
});
