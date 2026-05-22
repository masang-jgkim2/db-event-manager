import { Router } from 'express';
import {
  fnGetRoles, fnCreateRole, fnUpdateRole, fnDeleteRole,
} from '../controllers/roleController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';

const router = Router();

router.use(fnAuthMiddleware);

// GET: 보기 권한. POST/PUT/DELETE: 해당 액션 권한
router.get('/', fnRequireAnyPermission('role.view'), fnGetRoles);
router.post('/', fnRequireAnyPermission('role.create'), fnCreateRole);
router.put('/:id', fnRequireAnyPermission('role.edit'), fnUpdateRole);
router.delete('/:id', fnRequireAnyPermission('role.delete'), fnDeleteRole);

export default router;
