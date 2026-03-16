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

// 메서드별 권한: 보기 = db_connection.view/db.manage 또는 이벤트 생성용(my_dashboard.view, instance.create) 으로 목록 조회 가능
router.get('/', fnRequireAnyPermission('db_connection.view', 'db.manage', 'my_dashboard.view', 'instance.create'), fnGetDbConnections);
router.post('/', fnRequireAnyPermission('db_connection.create', 'db.manage'), fnCreateDbConnection);
router.put('/:id', fnRequireAnyPermission('db_connection.edit', 'db.manage'), fnUpdateDbConnection);
router.delete('/:id', fnRequireAnyPermission('db_connection.delete', 'db.manage'), fnDeleteDbConnection);
router.post('/:id/test', fnRequireAnyPermission('db_connection.test', 'db.manage'), fnTestConnection);

export default router;
