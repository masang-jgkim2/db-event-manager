import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import eventRoutes from './routes/eventRoutes';
import eventInstanceRoutes from './routes/eventInstanceRoutes';
import dbConnectionRoutes from './routes/dbConnectionRoutes';
import roleRoutes from './routes/roleRoutes';
import adminRoutes from './routes/adminRoutes';
import { fnInitUsers } from './data/users';
import { fnHasSeedTest, fnLoadSeedTest, fnApplySeedToMemory } from './data/seedTest';

// 환경 변수 로드
dotenv.config();

const app = express();
const nPort = Number(process.env.PORT) || 4000;

// 미들웨어
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/event-instances', eventInstanceRoutes);
app.use('/api/db-connections', dbConnectionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/admin', adminRoutes);

// 헬스 체크
app.get('/api/health', (_req, res) => {
  res.json({ bSuccess: true, strMessage: '서버가 정상 동작 중입니다.' });
});

// 서버 시작 — 인메모리 모드 (테스트 초기화 데이터 있으면 우선 로드 후 비밀번호 해싱)
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
