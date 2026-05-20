// Express 앱 생성 (라우트·미들웨어만 구성, listen 없음 — 테스트에서 supertest로 사용)
import './loadEnv';
import express from 'express';
import { STR_DATA_DIR } from './data/jsonStore';
import { arrProducts } from './data/products';
import { arrEvents } from './data/events';
import { arrDbConnections } from './data/dbConnections';
import { arrEventInstances } from './data/eventInstances';
import { arrUsers } from './data/users';
import { arrRoles } from './data/roles';
import { arrActivityLogs } from './data/activityLogs';
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
import pushRoutes from './routes/pushRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { fnIsInAppNotificationsPersisted } from './data/userNotifications';
import { fnActivityLogMiddleware } from './middleware/activityLogMiddleware';

const app = express();

// 인메모리 JSON API는 ETag/304 재검증 시 브라우저가 예전(빈) 본문을 붙잡는 문제가 생길 수 있음 — API는 캐시 금지
app.set('etag', false);
app.use((req, res, next) => {
  if ((req.originalUrl ?? req.url ?? '').startsWith('/api')) {
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

// localhost + IP + DQPM_CORS_ORIGINS(예: db.masangsoft.com) — SSE는 :5173→:4000 직접 연결 시 Origin 검사 필요
const fnIsCorsOriginAllowed = (origin: string): boolean => {
  if (process.env.DQPM_RELAX_CORS === 'true' || process.env.DQPM_RELAX_CORS === '1') {
    return true;
  }
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/(\d+\.\d+\.\d+\.\d+)(:\d+)?$/i.test(origin)) return true;
  const strExtra = process.env.DQPM_CORS_ORIGINS?.trim();
  if (strExtra) {
    try {
      const strHost = new URL(origin).hostname.toLowerCase();
      const arr = strExtra.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (arr.some((h) => strHost === h || strHost.endsWith(`.${h}`))) return true;
    } catch {
      return false;
    }
  }
  return false;
};

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (fnIsCorsOriginAllowed(origin)) return cb(null, true);
    console.warn(`[CORS] 차단된 Origin | ${origin} | DQPM_CORS_ORIGINS 또는 DQPM_RELAX_CORS 설정`);
    cb(null, false);
  },
  credentials: true,
}));
// 대시보드 UI 동기화(objEntries) 등 큰 JSON 본문 허용
app.use(express.json({ limit: '5mb' }));
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
app.use('/api/push', pushRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    bSuccess: true,
    strMessage: '서버가 정상 동작 중입니다.',
    strDataDir: STR_DATA_DIR,
    strCwd: process.cwd(),
    bInAppNotificationsPersisted: fnIsInAppNotificationsPersisted(),
    // UI와 불일치 시: 브라우저가 다른 백엔드를 치는지 vs 이 프로세스 메모리가 비었는지 구분용
    objMemoryCounts: {
      nProducts: arrProducts.length,
      nEvents: arrEvents.length,
      nDbConnections: arrDbConnections.length,
      nEventInstances: arrEventInstances.length,
      nUsers: arrUsers.length,
      nRoles: arrRoles.length,
      nActivityLogs: arrActivityLogs.length,
    },
  });
});

export default app;
