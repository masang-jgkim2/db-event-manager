import { Router } from 'express';
import { fnLogin, fnVerifyToken } from '../controllers/authController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /api/auth/login - 로그인
router.post('/login', fnLogin);

// GET /api/auth/verify - 토큰 검증
router.get('/verify', fnAuthMiddleware, fnVerifyToken);

export default router;
