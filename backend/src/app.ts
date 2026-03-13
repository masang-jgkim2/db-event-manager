// Express 앱 생성 (라우트·미들웨어만 구성, listen 없음 — 테스트에서 supertest로 사용)
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

const app = express();

// 개발/ E2E 시 프론트 포트가 5173 또는 5174일 수 있음
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/event-instances', eventInstanceRoutes);
app.use('/api/db-connections', dbConnectionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ bSuccess: true, strMessage: '서버가 정상 동작 중입니다.' });
});

export default app;
