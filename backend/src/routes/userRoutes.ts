import { Router } from 'express';
import { fnGetUsers, fnCreateUser, fnDeleteUser, fnResetPassword } from '../controllers/userController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnAdminOnly } from '../middleware/roleMiddleware';

const router = Router();

// 모든 라우트에 인증 + 관리자 권한 필수
router.use(fnAuthMiddleware, fnAdminOnly);

// GET /api/users - 사용자 목록 조회
router.get('/', fnGetUsers);

// POST /api/users - 사용자 추가
router.post('/', fnCreateUser);

// DELETE /api/users/:id - 사용자 삭제
router.delete('/:id', fnDeleteUser);

// PATCH /api/users/:id/password - 비밀번호 초기화
router.patch('/:id/password', fnResetPassword);

export default router;
