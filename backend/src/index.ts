import './loadEnv';
import { fnInitUsers } from './data/users';
import { fnHasSeedTest, fnLoadSeedTest, fnApplySeedToMemory } from './data/seedTest';
import { fnStartUserPresenceSweep } from './services/userPresence';
import app from './app';
import { arrProducts } from './data/products';
import { arrEvents } from './data/events';
import { arrDbConnections } from './data/dbConnections';
import { arrEventInstances } from './data/eventInstances';
import { arrUsers } from './data/users';
import { arrRoles } from './data/roles';

const nPort = Number(process.env.PORT) || 4000;

const fnLogMemoryCounts = () => {
  console.log(
    `[서버] 인메모리 건수 | products=${arrProducts.length} events=${arrEvents.length} ` +
      `dbConn=${arrDbConnections.length} instances=${arrEventInstances.length} users=${arrUsers.length} roles=${arrRoles.length}`,
  );
};

const fnStartServer = async () => {
  if (fnHasSeedTest()) {
    const seed = fnLoadSeedTest();
    if (seed) {
      fnApplySeedToMemory(seed);
      console.log('[서버] 테스트 초기화 데이터(seed_test.json) 로드 완료 — 메모리가 JSON과 다르면 이 파일을 확인하세요');
    }
  } else {
    console.log('[서버] seed_test.json 없음 — data/*.json 그대로 사용');
  }
  await fnInitUsers();
  fnLogMemoryCounts();
  const strHost = process.env.HOST || '0.0.0.0';  // 0.0.0.0 이면 외부 PC에서 접근 가능
  app.listen(nPort, strHost, () => {
    fnStartUserPresenceSweep();
    console.log(`[서버] http://${strHost === '0.0.0.0' ? 'localhost' : strHost}:${nPort} 에서 실행 중 (인메모리 모드)`);
    if (strHost === '0.0.0.0') {
      console.log(`[서버] 외부 접근: http://<이_PC_IP>:${nPort}`);
    }
  });
};

fnStartServer();

export default app;
