import './loadEnv';
import { fnBootstrapDataStore } from './data/bootstrapDataStore';
import { fnAwaitMysqlDocFlush } from './db/mysqlDocPersist';
import { fnIsMysqlStore } from './data/dataStore';

const nPort = Number(process.env.PORT) || 4000;

const fnLogMemoryCounts = async (): Promise<void> => {
  const { arrProducts } = await import('./data/products');
  const { arrEvents } = await import('./data/events');
  const { arrDbConnections } = await import('./data/dbConnections');
  const { arrEventInstances } = await import('./data/eventInstances');
  const { arrUsers } = await import('./data/users');
  const { arrRoles } = await import('./data/roles');
  console.log(
    `[서버] 인메모리 건수 | products=${arrProducts.length} events=${arrEvents.length} ` +
      `dbConn=${arrDbConnections.length} instances=${arrEventInstances.length} users=${arrUsers.length} roles=${arrRoles.length}`,
  );
};

const fnStartServer = async (): Promise<void> => {
  await fnBootstrapDataStore();

  const { fnHasSeedTest, fnLoadSeedTest, fnApplySeedToMemory } = await import('./data/seedTest');
  if (fnHasSeedTest()) {
    const seed = fnLoadSeedTest();
    if (seed) {
      fnApplySeedToMemory(seed);
      console.log('[서버] 테스트 초기화 데이터(seed_test.json) 로드 완료 — 메모리가 JSON과 다르면 이 파일을 확인하세요');
    }
  } else {
    console.log(
      fnIsMysqlStore()
        ? '[서버] seed_test.json 없음 — 메타 MySQL + 개별 JSON(미적재 시) 사용'
        : '[서버] seed_test.json 없음 — data/*.json 그대로 사용',
    );
  }

  const { fnInitUsers } = await import('./data/users');
  await fnInitUsers();
  await fnLogMemoryCounts();

  const { default: app } = await import('./app');
  const { fnStartUserPresenceSweep } = await import('./services/userPresence');

  const strHost = process.env.HOST || '0.0.0.0';
  app.listen(nPort, strHost, () => {
    fnStartUserPresenceSweep();
    const strMode = fnIsMysqlStore() ? '메타 MySQL + 인메모리' : '인메모리(JSON)';
    console.log(`[서버] http://${strHost === '0.0.0.0' ? 'localhost' : strHost}:${nPort} 에서 실행 중 (${strMode})`);
    if (strHost === '0.0.0.0') {
      console.log(`[서버] 외부 접근: http://<이_PC_IP>:${nPort}`);
    }
  });

  const fnOnShutdown = (): void => {
    void (async () => {
      if (fnIsMysqlStore()) {
        await fnAwaitMysqlDocFlush();
      }
      process.exit(0);
    })();
  };
  process.once('SIGINT', fnOnShutdown);
  process.once('SIGTERM', fnOnShutdown);
};

void fnStartServer().catch((err: unknown) => {
  console.error('[서버] 기동 실패 |', err);
  process.exit(1);
});
