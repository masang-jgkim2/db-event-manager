import { Router } from 'express';
import {
  fnGetDbConnections, fnCreateDbConnection, fnUpdateDbConnection,
  fnDeleteDbConnection, fnTestConnection,
} from '../controllers/dbConnectionController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';

const router = Router();

// db.manage 또는 세분화 권한(db_connection.*) 중 하나 있으면 통과
const DB_ACCESS_PERMISSIONS = [
  'db.manage',
  'db_connection.view', 'db_connection.create', 'db_connection.edit', 'db_connection.delete', 'db_connection.test',
] as const;

// 모든 라우트 인증 필수
router.use(fnAuthMiddleware);

router.get('/', fnRequireAnyPermission(...DB_ACCESS_PERMISSIONS), fnGetDbConnections);
router.post('/', fnRequireAnyPermission(...DB_ACCESS_PERMISSIONS), fnCreateDbConnection);
router.put('/:id', fnRequireAnyPermission(...DB_ACCESS_PERMISSIONS), fnUpdateDbConnection);
router.delete('/:id', fnRequireAnyPermission(...DB_ACCESS_PERMISSIONS), fnDeleteDbConnection);
router.post('/:id/test', fnRequireAnyPermission(...DB_ACCESS_PERMISSIONS), fnTestConnection);

export default router;
