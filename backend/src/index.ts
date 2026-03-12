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
  app.listen(nPort, () => {
    console.log(`[서버] http://localhost:${nPort} 에서 실행 중 (인메모리 모드)`);
  });
};

fnStartServer();

export default app;
