// 라우트·도메인 모듈은 부트스트랩 이후 동적 import — RDB 하이드레이트 순서 보장
import 'dotenv/config';
import { fnGetStoreBackend } from './persistence/storeBackend';

const fnStartServer = async () => {
  const { fnBootstrapPersistence } = await import('./persistence/bootstrap');
  await fnBootstrapPersistence();

  const { fnHasSeedTest, fnLoadSeedTest, fnApplySeedToMemory } = await import('./data/seedTest');
  if (fnHasSeedTest()) {
    const strBackend = fnGetStoreBackend();
    const bSeedRdb = process.env.SEED_TEST_WITH_RDB === '1' || process.env.SEED_TEST_WITH_RDB === 'true';
    if (strBackend === 'rdb' && !bSeedRdb) {
      console.warn(
        '[서버] seed_test.json 무시 — STORE_BACKEND=rdb. 로컬 시드+RDB 반영 시 SEED_TEST_WITH_RDB=1',
      );
    } else {
      const seed = fnLoadSeedTest();
      if (seed) {
        fnApplySeedToMemory(seed);
        console.log('[서버] 테스트 초기화 데이터(seed_test.json) 로드 완료');
        if (strBackend === 'rdb' && bSeedRdb) {
          const { fnPersistDbConnectionsToRdb } = await import('./persistence/rdb/dbConnectionsPersistence');
          const { arrDbConnections } = await import('./data/dbConnections');
          await fnPersistDbConnectionsToRdb(arrDbConnections);
          const { fnFlushProductCatalogToRdb } = await import('./persistence/rdb/catalogPersistHelper');
          await fnFlushProductCatalogToRdb();
          const { fnFlushAuthDomainToRdb } = await import('./persistence/rdb/authPersistHelper');
          await fnFlushAuthDomainToRdb();
          console.log('[서버] seed_test 적용 후 RDB 플러시 완료(db_connections·카탈로그·auth)');
        }
      }
    }
  }

  const { fnInitUsers } = await import('./data/users');
  await fnInitUsers();

  const { default: app } = await import('./app');
  const { fnStartUserPresenceSweep } = await import('./services/userPresence');

  const nPort = Number(process.env.PORT) || 4000;
  const strHost = process.env.HOST || '0.0.0.0';

  app.listen(nPort, strHost, () => {
    fnStartUserPresenceSweep();
    const strMode = process.env.STORE_BACKEND || 'json';
    console.log(`[서버] http://${strHost === '0.0.0.0' ? 'localhost' : strHost}:${nPort} (STORE_BACKEND=${strMode})`);
    if (strHost === '0.0.0.0') {
      console.log(`[서버] 외부 접근: http://<이_PC_IP>:${nPort}`);
    }
  });
};

fnStartServer().catch((err: unknown) => {
  console.error('[서버] 시작 실패 |', err);
  process.exit(1);
});
