import { Router } from 'express';
import {
  fnGetDbConnections, fnCreateDbConnection, fnUpdateDbConnection,
  fnDeleteDbConnection, fnTestConnection,
} from '../controllers/dbConnectionController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';

const router = Router();

// 모든 라우트 인증 필수
router.use(fnAuthMiddleware);

// 메서드별 권한: 보기만 있으면 GET만, 생성/수정/삭제/테스트는 해당 권한 필요 (db.manage 있으면 전부 가능)
router.get('/', fnRequireAnyPermission('db_connection.view', 'db.manage'), fnGetDbConnections);
router.post('/', fnRequireAnyPermission('db_connection.create', 'db.manage'), fnCreateDbConnection);
router.put('/:id', fnRequireAnyPermission('db_connection.edit', 'db.manage'), fnUpdateDbConnection);
router.delete('/:id', fnRequireAnyPermission('db_connection.delete', 'db.manage'), fnDeleteDbConnection);
router.post('/:id/test', fnRequireAnyPermission('db_connection.test', 'db.manage'), fnTestConnection);

export default router;
