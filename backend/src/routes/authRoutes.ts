import { Router } from 'express';
import { fnLogin, fnLogout, fnVerifyToken } from '../controllers/authController';
import { fnRegister, fnCheckRegisterAvailability } from '../controllers/registrationController';
import { fnGetUserUiPreferences, fnPutUserUiPreferences } from '../controllers/userUiPreferencesController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /api/auth/login - 로그인
router.post('/login', fnLogin);

// GET /api/auth/check-register - 가입 전 아이디·이메일 중복 확인 (공개)
router.get('/check-register', fnCheckRegisterAvailability);

// POST /api/auth/register - 공개 가입 (Phase A)
router.post('/register', fnRegister);

// POST /api/auth/logout - 로그아웃 (활동 로그는 미들웨어 finish에서 기록)
router.post('/logout', fnAuthMiddleware, fnLogout);

// GET /api/auth/verify - 토큰 검증
router.get('/verify', fnAuthMiddleware, fnVerifyToken);

// 계정별 UI 설정 동기화 (localhost / IP 등 출처 달라도 동일 계정이면 동일 화면)
router.get('/ui-preferences', fnAuthMiddleware, fnGetUserUiPreferences);
router.put('/ui-preferences', fnAuthMiddleware, fnPutUserUiPreferences);

export default router;
