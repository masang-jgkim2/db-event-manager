import dotenv from 'dotenv';
import { fnInitUsers } from './data/users';
import { fnHasSeedTest, fnLoadSeedTest, fnApplySeedToMemory } from './data/seedTest';
import app from './app';

dotenv.config();

const nPort = Number(process.env.PORT) || 4000;

const fnStartServer = async () => {
  if (fnHasSeedTest()) {
    const seed = fnLoadSeedTest();
    if (seed) {
      fnApplySeedToMemory(seed);
      console.log('[서버] 테스트 초기화 데이터(seed_test.json) 로드 완료');
    }
  }
  await fnInitUsers();
  const strHost = process.env.HOST || '0.0.0.0';  // 0.0.0.0 이면 외부 PC에서 접근 가능
  app.listen(nPort, strHost, () => {
    console.log(`[서버] http://${strHost === '0.0.0.0' ? 'localhost' : strHost}:${nPort} 에서 실행 중 (인메모리 모드)`);
    if (strHost === '0.0.0.0') {
      console.log(`[서버] 외부 접근: http://<이_PC_IP>:${nPort}`);
    }
  });
};

fnStartServer();

export default app;
