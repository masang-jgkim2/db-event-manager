import { Router } from 'express';
import {
  fnGetRoles, fnCreateRole, fnUpdateRole, fnDeleteRole,
} from '../controllers/roleController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnAdminOnly } from '../middleware/roleMiddleware';

const router = Router();

// 모든 라우트 인증 + 관리자 권한 필수
router.use(fnAuthMiddleware, fnAdminOnly);

// GET /api/roles - 역할 목록 조회
router.get('/', fnGetRoles);

// POST /api/roles - 역할 추가
router.post('/', fnCreateRole);

// PUT /api/roles/:id - 역할 수정
router.put('/:id', fnUpdateRole);

// DELETE /api/roles/:id - 역할 삭제
router.delete('/:id', fnDeleteRole);

export default router;
