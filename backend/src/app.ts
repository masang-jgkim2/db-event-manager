// Express 앱 생성 (라우트·미들웨어만 구성, listen 없음 — 테스트에서 supertest로 사용)
import path from 'path';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import eventRoutes from './routes/eventRoutes';
import eventInstanceRoutes from './routes/eventInstanceRoutes';
import dbConnectionRoutes from './routes/dbConnectionRoutes';
import roleRoutes from './routes/roleRoutes';
import adminRoutes from './routes/adminRoutes';
import activityRoutes from './routes/activityRoutes';
import { fnActivityLogMiddleware } from './middleware/activityLogMiddleware';

const app = express();

// localhost + IP(외부 접속) 허용 — 동일 서버를 IP로 접근해도 로그인 등 동작
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return cb(null, true);
    if (/^https?:\/\/(\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(fnActivityLogMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/event-instances', eventInstanceRoutes);
app.use('/api/db-connections', dbConnectionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/activity', activityRoutes);

app.get('/api/health', (_req, res) => {
  const strCwd = process.cwd();
  const strDataDir = path.join(strCwd, 'data');
  res.json({
    bSuccess: true,
    strMessage: '서버가 정상 동작 중입니다.',
    strDataDir,  // 외부/로컬 접속 시 동일 백엔드인지 확인용
  });
});

export default app;
