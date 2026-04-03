import { Router } from 'express';
import { fnLogin, fnLogout, fnVerifyToken } from '../controllers/authController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /api/auth/login - 로그인
router.post('/login', fnLogin);

// POST /api/auth/logout - 로그아웃 (활동 로그는 미들웨어 finish에서 기록)
router.post('/logout', fnAuthMiddleware, fnLogout);

// GET /api/auth/verify - 토큰 검증
router.get('/verify', fnAuthMiddleware, fnVerifyToken);

export default router;
