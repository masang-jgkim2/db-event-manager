import { Router } from 'express';
import {
  fnGetDbConnections, fnCreateDbConnection, fnUpdateDbConnection,
  fnDeleteDbConnection, fnTestConnection,
} from '../controllers/dbConnectionController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// 모든 라우트 인증 필수
router.use(fnAuthMiddleware);

// GET /api/db-connections - 목록 조회 (db.manage 권한 필요)
router.get('/', fnRequirePermission('db.manage'), fnGetDbConnections);

// POST /api/db-connections - 추가
router.post('/', fnRequirePermission('db.manage'), fnCreateDbConnection);

// PUT /api/db-connections/:id - 수정
router.put('/:id', fnRequirePermission('db.manage'), fnUpdateDbConnection);

// DELETE /api/db-connections/:id - 삭제
router.delete('/:id', fnRequirePermission('db.manage'), fnDeleteDbConnection);

// POST /api/db-connections/:id/test - 연결 테스트
router.post('/:id/test', fnRequirePermission('db.manage'), fnTestConnection);

export default router;
