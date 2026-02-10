import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';

// 환경 변수 로드
dotenv.config();

const app = express();
const nPort = Number(process.env.PORT) || 4000;

// 미들웨어
app.use(cors({
  origin: 'http://localhost:5173', // Vite 기본 포트
  credentials: true,
}));
app.use(express.json());

// 라우트
app.use('/api/auth', authRoutes);

// 헬스 체크
app.get('/api/health', (_req, res) => {
  res.json({ bSuccess: true, strMessage: '서버가 정상 동작 중입니다.' });
});

// 서버 시작
app.listen(nPort, () => {
  console.log(`[서버] http://localhost:${nPort} 에서 실행 중`);
});

export default app;
